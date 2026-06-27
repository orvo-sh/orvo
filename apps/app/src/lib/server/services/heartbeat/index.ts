import { Instrument } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB, Tx } from "@repo/db";
import {
  app,
  heartbeatMonitor,
  heartbeatMonitorDestination,
  notificationDelivery,
  notificationDestination,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, generateRandomString, genId, ok } from "@repo/utils";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import type { IncidentService } from "../incident";
import { quote, toDateTime64 } from "../shared/query-builders";

@Instrument({ prefix: "heartbeat" })
class HeartbeatService {
  private logger: Logger;

  constructor(
    private db: DB,
    private clickhouse: ClickHouse,
    logger: Logger,
    private incidentService: IncidentService,
    private config: { ingestBaseUrl: string; appBaseUrl: string },
  ) {
    this.logger = logger.child("HeartbeatService");
  }

  async listHeartbeatMonitors(context: { appId: string }) {
    this.logger.info("listHeartbeatMonitors: listing heartbeat monitors", { context });

    try {
      const monitors = await this.db.query.heartbeatMonitor.findMany({
        where: eq(heartbeatMonitor.appId, context.appId),
        with: {
          destinations: {
            columns: {
              destinationId: true
            }
          }
        },
        orderBy: [asc(heartbeatMonitor.name)],
      });

      if (monitors.length === 0) return ok({ monitors: [] });

      return ok({
        monitors: monitors.map((monitor) => {
          return {
            ...monitor,
            destinationIds: monitor.destinations.map(
              (destination) => destination.destinationId,
            ),
            isPaused: !!monitor.pausedAt,
            url: new URL(
              `/v1/heartbeats/${encodeURIComponent(monitor.token)}`,
              this.config.ingestBaseUrl,
            ).toString(),
          };
        }),
      });
    } catch (error) {
      this.logger.error(
        "listHeartbeatMonitors: failed to list heartbeat monitors",
        error as Error,
      );
      return err("Failed to load heartbeat monitors.");
    }
  }

  async getHeartbeatMonitor(
    input: z.infer<typeof getHeartbeatMonitorInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getHeartbeatMonitor: getting heartbeat monitor", {
      input,
      context,
    });

    const validated = getHeartbeatMonitorInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const monitor = await this.db.query.heartbeatMonitor.findFirst({
        where: and(
          eq(heartbeatMonitor.id, validated.data),
          eq(heartbeatMonitor.appId, context.appId),
        ),
      });

      if (!monitor) {
        return err("Heartbeat monitor not found.");
      }

      const links = await this.db.query.heartbeatMonitorDestination.findMany({
        where: eq(heartbeatMonitorDestination.heartbeatMonitorId, monitor.id),
      });
      const destinations = links.length
        ? await this.db.query.notificationDestination.findMany({
          where: and(
            eq(notificationDestination.appId, context.appId),
            inArray(
              notificationDestination.id,
              links.map((link) => link.destinationId),
            ),
          ),
          orderBy: [asc(notificationDestination.name)],
        })
        : [];
      return ok({
        monitor: {
          ...monitor,
          isPaused: !!monitor.pausedAt,
          destinationIds: links.map((link) => link.destinationId),
          destinations: destinations.map((destination) => ({
            id: destination.id,
            name: destination.name,
            kind: destination.kind,
          })),
          secretUrl: buildHeartbeatUrl(this.config.ingestBaseUrl, monitor.token),
        },
      });
    } catch (error) {
      this.logger.error(
        "getHeartbeatMonitor: failed to get heartbeat monitor",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to load heartbeat monitor.");
    }
  }

  async getHeartbeatCheckInHistory(
    input: z.infer<typeof getHeartbeatMonitorInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info(
      "getHeartbeatCheckInHistory: loading heartbeat check-in history",
      {
        input,
        context,
      },
    );

    const validated = getHeartbeatMonitorInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const monitor = await this.db.query.heartbeatMonitor.findFirst({
        where: and(
          eq(heartbeatMonitor.id, validated.data),
          eq(heartbeatMonitor.appId, context.appId),
        ),
      });

      if (!monitor) {
        return err("Heartbeat monitor not found.");
      }

      const rangeEndAt = new Date();
      const rangeStartAt = new Date(
        rangeEndAt.getTime() - 24 * 60 * 60 * 1000,
      );
      const rangeSeconds = Math.max(
        Math.floor((rangeEndAt.getTime() - rangeStartAt.getTime()) / 1000),
        1,
      );
      const bucketSizeSeconds = Math.min(
        rangeSeconds,
        Math.max(monitor.expectedEverySeconds, Math.ceil(rangeSeconds / 48)),
      );
      const bucketSizeMs = bucketSizeSeconds * 1000;
      const alignedStartAt = new Date(
        Math.floor(rangeStartAt.getTime() / bucketSizeMs) * bucketSizeMs,
      );

      const [bucketResult, recentResult] = await Promise.all([
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT
              toStartOfInterval(checked_in_at, INTERVAL ${bucketSizeSeconds} SECOND) AS bucket_start,
              count() AS total
            FROM heartbeat_checkins
            WHERE app_id = ${quote(context.appId)}
              AND heartbeat_monitor_id = ${quote(monitor.id)}
              AND checked_in_at >= ${toDateTime64(alignedStartAt)}
              AND checked_in_at <= ${toDateTime64(rangeEndAt)}
            GROUP BY bucket_start
            ORDER BY bucket_start ASC
          `,
        }),
        this.clickhouse.query({
          format: "JSONEachRow",
          query: `
            SELECT checked_in_at
            FROM heartbeat_checkins
            WHERE app_id = ${quote(context.appId)}
              AND heartbeat_monitor_id = ${quote(monitor.id)}
            ORDER BY checked_in_at DESC
            LIMIT 20
          `,
        }),
      ]);
      const bucketRows = (await bucketResult.json()) as unknown as Array<{
        bucket_start: string;
        total: number | string;
      }>;
      const recentRows = (await recentResult.json()) as unknown as Array<{
        checked_in_at: string;
      }>;
      const totalsByBucket = new Map(
        bucketRows.map((row) => [
          new Date(row.bucket_start).getTime(),
          Number(row.total ?? 0),
        ]),
      );
      const buckets: Array<{
        startAt: Date;
        endAt: Date;
        count: number;
        status: "healthy" | "missed" | "grace";
      }> = [];

      for (
        let bucketStartMs = alignedStartAt.getTime();
        bucketStartMs <= rangeEndAt.getTime();
        bucketStartMs += bucketSizeMs
      ) {
        const startAt = new Date(bucketStartMs);
        const endAt = new Date(bucketStartMs + bucketSizeMs);
        const count = totalsByBucket.get(bucketStartMs) ?? 0;
        const status =
          count > 0
            ? "healthy"
            : endAt.getTime() + monitor.graceSeconds * 1000 < rangeEndAt.getTime()
              ? "missed"
              : "grace";

        buckets.push({
          startAt,
          endAt,
          count,
          status,
        });
      }

      const recentCheckIns = recentRows.map((row) => ({
        checkedInAt: new Date(row.checked_in_at),
      }));
      const ascendingCheckInTimes = recentCheckIns
        .slice()
        .reverse()
        .map((item) => item.checkedInAt.getTime());
      const intervals = ascendingCheckInTimes
        .slice(1)
        .map((time, index) => time - ascendingCheckInTimes[index]!)
        .filter((value) => value > 0);

      return ok({
        history: {
          rangeStartAt: alignedStartAt,
          rangeEndAt,
          bucketSizeSeconds,
          buckets,
          recentCheckIns,
          stats: {
            totalCheckIns24h: buckets.reduce(
              (total, bucket) => total + bucket.count,
              0,
            ),
            receivedBuckets24h: buckets.filter((bucket) => bucket.count > 0)
              .length,
            missedBuckets24h: buckets.filter((bucket) => bucket.status === "missed")
              .length,
            averageIntervalSeconds:
              intervals.length > 0
                ? Math.round(
                  intervals.reduce((total, value) => total + value, 0) /
                  intervals.length /
                  1000,
                )
                : null,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        "getHeartbeatCheckInHistory: failed to load heartbeat check-in history",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to load heartbeat history.");
    }
  }

  async createHeartbeatMonitor(
    input: z.infer<typeof createHeartbeatMonitorInputSchema>,
    context: { appId: string; userId: string },
  ) {
    this.logger.info("createHeartbeatMonitor: creating heartbeat monitor", {
      input,
      context,
    });

    const validated = createHeartbeatMonitorInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const destinationIds = uniqueValues(validated.data.destinationIds);
      const destinations = await this.loadDestinations(
        context.appId,
        destinationIds,
      );

      if (!destinations.success) {
        return destinations;
      }

      const id = genId("hbmt");
      const token = generateRandomString(48);

      await this.db.transaction(async (tx) => {
        await tx.insert(heartbeatMonitor).values({
          id,
          appId: context.appId,
          name: validated.data.name,
          token,
          expectedEverySeconds: validated.data.expectedEverySeconds,
          graceSeconds: validated.data.graceSeconds,
          createdBy: context.userId,
          updatedBy: context.userId,
        });

        if (destinationIds.length > 0) {
          await tx.insert(heartbeatMonitorDestination).values(
            destinationIds.map((destinationId) => ({
              heartbeatMonitorId: id,
              destinationId,
            })),
          );
        }
      });

      return ok({
        id,
        secretUrl: buildHeartbeatUrl(this.config.ingestBaseUrl, token),
      });
    } catch (error) {
      this.logger.error(
        "createHeartbeatMonitor: failed to create heartbeat monitor",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to create heartbeat monitor.");
    }
  }

  async updateHeartbeatMonitor(
    input: z.infer<typeof updateHeartbeatMonitorInputSchema>,
    context: { appId: string; userId: string },
  ) {
    this.logger.info("updateHeartbeatMonitor: updating heartbeat monitor", {
      input,
      context,
    });

    const validated = updateHeartbeatMonitorInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const existing = await this.db.query.heartbeatMonitor.findFirst({
        where: and(
          eq(heartbeatMonitor.id, validated.data.id),
          eq(heartbeatMonitor.appId, context.appId),
        ),
      });

      if (!existing) {
        return err("Heartbeat monitor not found.");
      }

      const destinationIds = uniqueValues(validated.data.destinationIds);
      const destinations = await this.loadDestinations(
        context.appId,
        destinationIds,
      );

      if (!destinations.success) {
        return destinations;
      }

      await this.db.transaction(async (tx) => {
        await tx
          .update(heartbeatMonitor)
          .set({
            name: validated.data.name,
            expectedEverySeconds: validated.data.expectedEverySeconds,
            graceSeconds: validated.data.graceSeconds,
            updatedBy: context.userId,
          })
          .where(eq(heartbeatMonitor.id, existing.id));

        await tx
          .delete(heartbeatMonitorDestination)
          .where(
            eq(heartbeatMonitorDestination.heartbeatMonitorId, existing.id),
          );

        if (destinationIds.length > 0) {
          await tx.insert(heartbeatMonitorDestination).values(
            destinationIds.map((destinationId) => ({
              heartbeatMonitorId: existing.id,
              destinationId,
            })),
          );
        }
      });

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "updateHeartbeatMonitor: failed to update heartbeat monitor",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to update heartbeat monitor.");
    }
  }

  async deleteHeartbeatMonitor(
    input: z.infer<typeof deleteHeartbeatMonitorInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("deleteHeartbeatMonitor: deleting heartbeat monitor", {
      input,
      context,
    });

    const validated = deleteHeartbeatMonitorInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const existing = await this.db.query.heartbeatMonitor.findFirst({
        where: and(
          eq(heartbeatMonitor.id, validated.data),
          eq(heartbeatMonitor.appId, context.appId),
        ),
      });

      if (!existing) {
        return err("Heartbeat monitor not found.");
      }

      await this.db.transaction(async (tx) => {
        await this.incidentService.resolveOpenIncidentBySourceKey(
          {
            appId: context.appId,
            sourceKey: buildHeartbeatIncidentSourceKey(existing.id),
            now: new Date(),
            metadata: {
              reason: "heartbeat_monitor_deleted",
            },
          },
          tx,
        );

        await tx.delete(heartbeatMonitor).where(eq(heartbeatMonitor.id, existing.id));
      });

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "deleteHeartbeatMonitor: failed to delete heartbeat monitor",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to delete heartbeat monitor.");
    }
  }

  async regenerateHeartbeatMonitorSecret(
    input: z.infer<typeof regenerateHeartbeatMonitorSecretInputSchema>,
    context: { appId: string; userId: string },
  ) {
    this.logger.info(
      "regenerateHeartbeatMonitorSecret: regenerating heartbeat monitor secret",
      {
        input,
        context,
      },
    );

    const validated =
      regenerateHeartbeatMonitorSecretInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const existing = await this.db.query.heartbeatMonitor.findFirst({
        where: and(
          eq(heartbeatMonitor.id, validated.data),
          eq(heartbeatMonitor.appId, context.appId),
        ),
      });

      if (!existing) {
        return err("Heartbeat monitor not found.");
      }

      const token = genId("hbt");

      await this.db
        .update(heartbeatMonitor)
        .set({
          token,
          updatedBy: context.userId,
        })
        .where(eq(heartbeatMonitor.id, existing.id));

      return ok({
        secretUrl: buildHeartbeatUrl(this.config.ingestBaseUrl, token),
      });
    } catch (error) {
      this.logger.error(
        "regenerateHeartbeatMonitorSecret: failed to regenerate heartbeat monitor secret",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to regenerate heartbeat monitor secret.");
    }
  }

  async toggleHeartbeatMonitorPaused(
    input: z.infer<typeof toggleHeartbeatMonitorPausedInputSchema>,
    context: { appId: string; userId: string },
  ) {
    this.logger.info(
      "toggleHeartbeatMonitorPaused: toggling heartbeat monitor paused state",
      { input, context },
    );

    const validated = toggleHeartbeatMonitorPausedInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const existing = await this.db.query.heartbeatMonitor.findFirst({
        where: and(
          eq(heartbeatMonitor.id, validated.data),
          eq(heartbeatMonitor.appId, context.appId),
        ),
      });

      if (!existing) {
        return err("Heartbeat monitor not found.");
      }

      const pausedAt = existing.pausedAt ? null : new Date();

      await this.db.transaction(async (tx) => {
        await tx
          .update(heartbeatMonitor)
          .set({
            pausedAt,
            updatedBy: context.userId,
          })
          .where(eq(heartbeatMonitor.id, existing.id));

        if (pausedAt) {
          await this.incidentService.resolveOpenIncidentBySourceKey(
            {
              appId: context.appId,
              sourceKey: buildHeartbeatIncidentSourceKey(existing.id),
              now: pausedAt,
              actorUserId: context.userId,
              metadata: {
                reason: "heartbeat_monitor_paused",
              },
            },
            tx,
          );
        }
      });

      return ok({ paused: !!pausedAt });
    } catch (error) {
      this.logger.error(
        "toggleHeartbeatMonitorPaused: failed to toggle heartbeat monitor paused state",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to update heartbeat monitor.");
    }
  }

  async sendHeartbeatMonitorTestAlert(
    input: z.infer<typeof sendHeartbeatMonitorTestAlertInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info(
      "sendHeartbeatMonitorTestAlert: sending heartbeat monitor test alert",
      { input, context },
    );

    const validated = sendHeartbeatMonitorTestAlertInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const monitor = await this.db.query.heartbeatMonitor.findFirst({
        where: and(
          eq(heartbeatMonitor.id, validated.data),
          eq(heartbeatMonitor.appId, context.appId),
        ),
      });

      if (!monitor) {
        return err("Heartbeat monitor not found.");
      }

      const currentApp = await this.db.query.app.findFirst({
        where: eq(app.id, context.appId),
      });

      if (!currentApp) {
        return err("App not found.");
      }

      const links = await this.db.query.heartbeatMonitorDestination.findMany({
        where: eq(heartbeatMonitorDestination.heartbeatMonitorId, monitor.id),
      });

      if (links.length === 0) {
        return err("Attach at least one notification destination first.");
      }

      const now = new Date();
      const payload = {
        type: "destination.test",
        timestamp: now.toISOString(),
        app: {
          id: currentApp.id,
          name: currentApp.name,
        },
        heartbeat: {
          id: monitor.id,
          name: monitor.name,
          expectedEverySeconds: monitor.expectedEverySeconds,
          graceSeconds: monitor.graceSeconds,
          lastCheckInAt: monitor.lastCheckInAt?.toISOString() ?? null,
          pingUrl: buildHeartbeatUrl(this.config.ingestBaseUrl, monitor.token),
        },
      } satisfies Record<string, unknown>;

      await this.db.insert(notificationDelivery).values(
        links.map((link) => ({
          id: genId("ntdl"),
          appId: currentApp.id,
          destinationId: link.destinationId,
          sourceKind: "heartbeat" as const,
          sourceId: monitor.id,
          eventType: "destination.test" as const,
          payload,
          status: "pending" as const,
          nextAttemptAt: now,
        })),
      );

      return ok({ deliveryCount: links.length });
    } catch (error) {
      this.logger.error(
        "sendHeartbeatMonitorTestAlert: failed to send heartbeat monitor test alert",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to send test alert.");
    }
  }

  async recordHeartbeatCheckInBySecret(
    input: z.infer<typeof recordHeartbeatCheckInBySecretInputSchema>,
  ) {
    this.logger.info(
      "recordHeartbeatCheckInBySecret: recording heartbeat check-in",
      {
        input,
      },
    );

    const validated =
      recordHeartbeatCheckInBySecretInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const existing = await this.db.query.heartbeatMonitor.findFirst({
        where: eq(heartbeatMonitor.token, validated.data.secretToken),
      });

      if (!existing) {
        return err("Heartbeat monitor not found.");
      }

      const now = new Date();
      const recovered = existing.status === "missed";

      await this.db.transaction(async (tx) => {
        await tx
          .update(heartbeatMonitor)
          .set({
            lastCheckInAt: now,
            status: "healthy",
          })
          .where(eq(heartbeatMonitor.id, existing.id));

        await tx
          .update(app)
          .set({
            heartbeatsFirstReceivedAt: now,
          })
          .where(
            and(
              eq(app.id, existing.appId),
              isNull(app.heartbeatsFirstReceivedAt),
            ),
          );

        if (recovered) {
          const recovery = await this.incidentService.recoverSourceIncident(
            {
              appId: existing.appId,
              sourceKey: buildHeartbeatIncidentSourceKey(existing.id),
              now,
              eventType: "heartbeat.recovered",
              eventMetadata: {
                heartbeatMonitorId: existing.id,
              },
            },
            tx,
          );

          if (recovery.mode === "resolved_open" && recovery.incident) {
            await this.insertHeartbeatDeliveries(
              tx,
              existing.id,
              recovery.incident.id,
              "heartbeat.recovered",
              now,
            );
          }
        }
      });

      return ok({
        appId: existing.appId,
        receivedAt: now.toISOString(),
        recovered,
      });
    } catch (error) {
      this.logger.error(
        "recordHeartbeatCheckInBySecret: failed to record heartbeat check-in",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to record heartbeat check-in.");
    }
  }

  async evaluateDueMonitors() {
    this.logger.info("evaluateDueMonitors: evaluating due heartbeat monitors");

    try {
      const monitors = await this.db.query.heartbeatMonitor.findMany({
        where: and(
          isNotNull(heartbeatMonitor.lastCheckInAt),
          isNull(heartbeatMonitor.pausedAt),
        ),
      });
      const now = new Date();
      let updated = 0;
      let newlyMissed = 0;

      for (const monitor of monitors) {
        const status = resolveHeartbeatStatus({
          lastCheckInAt: monitor.lastCheckInAt,
          expectedEverySeconds: monitor.expectedEverySeconds,
          graceSeconds: monitor.graceSeconds,
          now,
        });

        if (status === monitor.status) {
          continue;
        }

        await this.db
          .update(heartbeatMonitor)
          .set({
            status,
          })
          .where(eq(heartbeatMonitor.id, monitor.id));

        updated += 1;

        if (status === "missed" && monitor.status !== "missed") {
          newlyMissed += 1;
          const opened = await this.openHeartbeatIncident(this.db, monitor.id, now);
          if (opened?.opened && opened.incident) {
            await this.insertHeartbeatDeliveries(
              this.db,
              monitor.id,
              opened.incident.id,
              "heartbeat.missed",
              now,
            );
          }
        }
      }

      return ok({ updated, newlyMissed });
    } catch (error) {
      this.logger.error(
        "evaluateDueMonitors: failed to evaluate due heartbeat monitors",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to evaluate heartbeat monitors.");
    }
  }

  private async loadDestinations(appId: string, destinationIds: string[]) {
    if (destinationIds.length === 0) {
      return ok({ destinations: [] });
    }

    const destinations = await this.db.query.notificationDestination.findMany({
      where: and(
        eq(notificationDestination.appId, appId),
        inArray(notificationDestination.id, destinationIds),
      ),
    });

    if (destinations.length !== destinationIds.length) {
      return err("One or more notification destinations could not be found.");
    }

    return ok({ destinations });
  }

  private async openHeartbeatIncident(
    db: DB | Tx,
    heartbeatMonitorId: string,
    now: Date,
  ) {
    const monitor = await db.query.heartbeatMonitor.findFirst({
      where: eq(heartbeatMonitor.id, heartbeatMonitorId),
    });

    if (!monitor) {
      return null;
    }

    const currentApp = await db.query.app.findFirst({
      where: eq(app.id, monitor.appId),
    });
    if (!currentApp) {
      return null;
    }

    return this.incidentService.openOrGetIncident(
      {
        appId: currentApp.id,
        sourceType: "heartbeat",
        sourceId: monitor.id,
        sourceKey: buildHeartbeatIncidentSourceKey(monitor.id),
        type: "heartbeat_missed",
        title: monitor.name,
        severity: "critical",
        serviceName: null,
        entityType: "app",
        entityId: currentApp.id,
        entityName: currentApp.name,
        sourceSnapshot: {
          appName: currentApp.name,
          heartbeatMonitorId: monitor.id,
          heartbeatName: monitor.name,
          expectedEverySeconds: monitor.expectedEverySeconds,
          graceSeconds: monitor.graceSeconds,
          lastCheckInAt: monitor.lastCheckInAt?.toISOString() ?? null,
          pingUrl: buildHeartbeatUrl(this.config.ingestBaseUrl, monitor.token),
        },
        triggerEventType: "heartbeat.missed",
        now,
        lastObservedAt: now,
        lastNotifiedAt: now,
        openMetadata: {
          heartbeatMonitorId: monitor.id,
        },
        triggerMetadata: {
          heartbeatMonitorId: monitor.id,
        },
      },
      db === this.db ? undefined : db,
    );
  }

  private async insertHeartbeatDeliveries(
    db: DB | Tx,
    heartbeatMonitorId: string,
    incidentId: string,
    eventType: "heartbeat.missed" | "heartbeat.recovered",
    now: Date,
  ) {
    const monitor = await db.query.heartbeatMonitor.findFirst({
      where: eq(heartbeatMonitor.id, heartbeatMonitorId),
    });

    if (!monitor) {
      return;
    }

    const currentApp = await db.query.app.findFirst({
      where: eq(app.id, monitor.appId),
    });
    if (!currentApp) {
      return;
    }

    const links = await db.query.heartbeatMonitorDestination.findMany({
      where: eq(heartbeatMonitorDestination.heartbeatMonitorId, monitor.id),
    });

    if (links.length === 0) {
      return;
    }

    const payload = buildHeartbeatEventPayload({
      eventType,
      incidentId,
      now,
      monitor,
      app: currentApp,
      appBaseUrl: this.config.appBaseUrl,
      secretUrl: buildHeartbeatUrl(
        this.config.ingestBaseUrl,
        monitor.token,
      ),
    });

    await db.insert(notificationDelivery).values(
      links.map((link) => ({
        id: genId("ntdl"),
        appId: currentApp.id,
        destinationId: link.destinationId,
        incidentId,
        sourceKind: "heartbeat" as const,
        sourceId: monitor.id,
        eventType,
        payload,
        status: "pending" as const,
        nextAttemptAt: now,
      })),
    );
  }
}

const heartbeatIdSchema = z.string().trim().min(1);
const getHeartbeatMonitorInputSchema = heartbeatIdSchema;

const createHeartbeatMonitorInputSchema = z.object({
  name: z.string().trim().min(2).max(64),
  expectedEverySeconds: z.number().int().min(1).max(2_592_000),
  graceSeconds: z.number().int().min(0).max(2_592_000),
  destinationIds: z.array(heartbeatIdSchema).max(20).default([]),
});

const updateHeartbeatMonitorInputSchema =
  createHeartbeatMonitorInputSchema.extend({
    id: heartbeatIdSchema,
  });

const deleteHeartbeatMonitorInputSchema = heartbeatIdSchema;
const regenerateHeartbeatMonitorSecretInputSchema = heartbeatIdSchema;
const toggleHeartbeatMonitorPausedInputSchema = heartbeatIdSchema;
const sendHeartbeatMonitorTestAlertInputSchema = heartbeatIdSchema;

const recordHeartbeatCheckInBySecretInputSchema = z.object({
  secretToken: z.string().trim().min(1),
});

const resolveHeartbeatStatus = (input: {
  lastCheckInAt: Date | null;
  expectedEverySeconds: number;
  graceSeconds: number;
  now: Date;
}) => {
  if (!input.lastCheckInAt) {
    return "never_received" as const;
  }

  const lastCheckInAtMs = new Date(input.lastCheckInAt).getTime();
  const expectedDeadlineMs =
    lastCheckInAtMs + input.expectedEverySeconds * 1000;
  const graceDeadlineMs = expectedDeadlineMs + input.graceSeconds * 1000;
  const nowMs = input.now.getTime();

  if (nowMs <= expectedDeadlineMs) {
    return "healthy" as const;
  }

  if (nowMs <= graceDeadlineMs) {
    return "grace" as const;
  }

  return "missed" as const;
};

const buildHeartbeatEventPayload = (input: {
  eventType: "heartbeat.missed" | "heartbeat.recovered";
  incidentId: string;
  now: Date;
  monitor: typeof heartbeatMonitor.$inferSelect;
  app: typeof app.$inferSelect;
  appBaseUrl: string;
  secretUrl: string;
}) =>
  ({
    type: input.eventType,
    timestamp: input.now.toISOString(),
    app: {
      id: input.app.id,
      name: input.app.name,
    },
    incident: {
      id: input.incidentId,
      url: buildIncidentUrl(input.appBaseUrl, input.app.id, input.incidentId),
    },
    heartbeat: {
      id: input.monitor.id,
      name: input.monitor.name,
      expectedEverySeconds: input.monitor.expectedEverySeconds,
      graceSeconds: input.monitor.graceSeconds,
      lastCheckInAt: input.monitor.lastCheckInAt?.toISOString() ?? null,
      status: input.monitor.status,
      pingUrl: input.secretUrl,
    },
  }) satisfies Record<string, unknown>;

const buildHeartbeatUrl = (ingestBaseUrl: string, secretToken: string) =>
  new URL(
    `/v1/heartbeats/${encodeURIComponent(secretToken)}`,
    ingestBaseUrl,
  ).toString();
const buildIncidentUrl = (
  appBaseUrl: string,
  appId: string,
  incidentId: string,
) =>
  new URL(
    `/a/${encodeURIComponent(appId)}/incidents/${encodeURIComponent(incidentId)}`,
    appBaseUrl,
  ).toString();

const uniqueValues = <T>(values: T[]) => [...new Set(values)];
const buildHeartbeatIncidentSourceKey = (heartbeatMonitorId: string) =>
  `heartbeat:${heartbeatMonitorId}:missed`;

export {
  createHeartbeatMonitorInputSchema,
  deleteHeartbeatMonitorInputSchema,
  getHeartbeatMonitorInputSchema,
  HeartbeatService,
  recordHeartbeatCheckInBySecretInputSchema,
  regenerateHeartbeatMonitorSecretInputSchema,
  sendHeartbeatMonitorTestAlertInputSchema,
  toggleHeartbeatMonitorPausedInputSchema,
  updateHeartbeatMonitorInputSchema
};
