import type { DB, Tx } from "@repo/db";
import {
  app,
  heartbeatMonitor,
  heartbeatMonitorDestination,
  notificationDelivery,
  notificationDestination,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";

class HeartbeatService {
  private logger: Logger;

  constructor(
    private db: DB,
    logger: Logger,
    private config: { ingestBaseUrl: string },
  ) {
    this.logger = logger.child("HeartbeatService");
  }

  async listHeartbeatMonitors(context: { appId: string }) {
    this.logger.info("listHeartbeatMonitors: listing heartbeat monitors", {
      context,
    });

    try {
      const monitors = await this.db.query.heartbeatMonitor.findMany({
        where: eq(heartbeatMonitor.appId, context.appId),
        orderBy: [asc(heartbeatMonitor.name)],
      });

      if (monitors.length === 0) {
        return ok({ monitors: [] });
      }

      const monitorIds = monitors.map((monitor) => monitor.id);
      const links = await this.db.query.heartbeatMonitorDestination.findMany({
        where: inArray(
          heartbeatMonitorDestination.heartbeatMonitorId,
          monitorIds,
        ),
      });
      const destinationIdsByMonitorId = new Map<string, string[]>();

      for (const link of links) {
        const existing =
          destinationIdsByMonitorId.get(link.heartbeatMonitorId) ?? [];
        existing.push(link.destinationId);
        destinationIdsByMonitorId.set(link.heartbeatMonitorId, existing);
      }

      const now = new Date();

      return ok({
        monitors: monitors.map((monitor) => {
          const destinationIds =
            destinationIdsByMonitorId.get(monitor.id) ?? [];
          const status = resolveHeartbeatStatus({
            lastCheckInAt: monitor.lastCheckInAt,
            expectedEverySeconds: monitor.expectedEverySeconds,
            graceSeconds: monitor.graceSeconds,
            now,
          });

          return {
            ...monitor,
            status,
            isPaused: !!monitor.pausedAt,
            destinationIds,
            destinationCount: destinationIds.length,
            secretUrl: buildHeartbeatUrl(
              this.config.ingestBaseUrl,
              monitor.token,
            ),
          };
        }),
      });
    } catch (error) {
      this.logger.error(
        "listHeartbeatMonitors: failed to list heartbeat monitors",
        error instanceof Error ? error : undefined,
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
      const now = new Date();

      return ok({
        monitor: {
          ...monitor,
          status: resolveHeartbeatStatus({
            lastCheckInAt: monitor.lastCheckInAt,
            expectedEverySeconds: monitor.expectedEverySeconds,
            graceSeconds: monitor.graceSeconds,
            now,
          }),
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
      const token = genId("hbt");

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
      await this.db
        .delete(heartbeatMonitor)
        .where(
          and(
            eq(heartbeatMonitor.id, validated.data),
            eq(heartbeatMonitor.appId, context.appId),
          ),
        );

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

      await this.db
        .update(heartbeatMonitor)
        .set({
          pausedAt,
          updatedBy: context.userId,
        })
        .where(eq(heartbeatMonitor.id, existing.id));

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
      const recovered = existing.lastStatus === "missed";

      await this.db.transaction(async (tx) => {
        await tx
          .update(heartbeatMonitor)
          .set({
            lastCheckInAt: now,
            lastStatus: "healthy",
            lastRecoveredAt: recovered ? now : existing.lastRecoveredAt,
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
          await this.insertHeartbeatDeliveries(
            tx,
            existing.id,
            "heartbeat.recovered",
            now,
          );
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

        if (status === monitor.lastStatus) {
          continue;
        }

        await this.db
          .update(heartbeatMonitor)
          .set({
            lastStatus: status,
            lastMissedAt: status === "missed" ? now : monitor.lastMissedAt,
          })
          .where(eq(heartbeatMonitor.id, monitor.id));

        updated += 1;

        if (status === "missed" && monitor.lastStatus !== "missed") {
          newlyMissed += 1;
          await this.insertHeartbeatDeliveries(
            this.db,
            monitor.id,
            "heartbeat.missed",
            now,
          );
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

  private async insertHeartbeatDeliveries(
    db: DB | Tx,
    heartbeatMonitorId: string,
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
      now,
      monitor,
      app: currentApp,
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
  now: Date;
  monitor: typeof heartbeatMonitor.$inferSelect;
  app: typeof app.$inferSelect;
  secretUrl: string;
}) =>
  ({
    type: input.eventType,
    timestamp: input.now.toISOString(),
    app: {
      id: input.app.id,
      name: input.app.name,
    },
    heartbeat: {
      id: input.monitor.id,
      name: input.monitor.name,
      expectedEverySeconds: input.monitor.expectedEverySeconds,
      graceSeconds: input.monitor.graceSeconds,
      lastCheckInAt: input.monitor.lastCheckInAt?.toISOString() ?? null,
      lastMissedAt: input.monitor.lastMissedAt?.toISOString() ?? null,
      lastRecoveredAt: input.monitor.lastRecoveredAt?.toISOString() ?? null,
      pingUrl: input.secretUrl,
    },
  }) satisfies Record<string, unknown>;

const buildHeartbeatUrl = (ingestBaseUrl: string, secretToken: string) =>
  new URL(
    `/v1/heartbeats/${encodeURIComponent(secretToken)}`,
    ingestBaseUrl,
  ).toString();

const uniqueValues = <T>(values: T[]) => [...new Set(values)];

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
