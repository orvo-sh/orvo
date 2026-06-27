import { Instrument } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import {
  incident,
  incidentEvent,
  notificationDelivery,
  notificationDestination,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

@Instrument({ prefix: "incident" })
class IncidentService {
  private logger: Logger;

  constructor(
    private db: DB,
    logger: Logger,
  ) {
    this.logger = logger.child("IncidentService");
  }

  async listIncidents(
    input: z.infer<typeof listIncidentsInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("listIncidents: listing incidents", { input, context });

    const validated = listIncidentsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const whereClauses = [eq(incident.appId, context.appId)];

      if (validated.data.status !== "all") {
        whereClauses.push(eq(incident.status, validated.data.status));
      }

      if (validated.data.sourceType) {
        whereClauses.push(eq(incident.sourceType, validated.data.sourceType));
      }

      if (validated.data.sourceId) {
        whereClauses.push(eq(incident.sourceId, validated.data.sourceId));
      }

      if (validated.data.entityId) {
        whereClauses.push(eq(incident.entityId, validated.data.entityId));
      }

      const incidents = await this.db.query.incident.findMany({
        where: and(...whereClauses),
        orderBy: [desc(incident.openedAt)],
        limit: validated.data.limit,
      });

      return ok({
        incidents: incidents.map((row) => ({
          ...row,
          sourceSnapshot: normalizeSourceSnapshot(row.sourceSnapshot),
        })),
      });
    } catch (error) {
      this.logger.error(
        "listIncidents: failed to list incidents",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to load incidents.");
    }
  }

  async getOpenIncidents(
    input: z.infer<typeof getOpenIncidentsInputSchema>,
    context: { appId: string },
  ) {
    return this.listIncidents(
      {
        ...input,
        status: "open",
      },
      context,
    );
  }

  async getIncidentDetail(
    input: z.infer<typeof getIncidentInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info("getIncidentDetail: loading incident detail", {
      input,
      context,
    });

    const validated = getIncidentInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const row = await this.db.query.incident.findFirst({
        where: and(
          eq(incident.id, validated.data),
          eq(incident.appId, context.appId),
        ),
      });

      if (!row) {
        return err("Incident not found.");
      }

      const [events, deliveries] = await Promise.all([
        this.db.query.incidentEvent.findMany({
          where: eq(incidentEvent.incidentId, row.id),
          orderBy: [asc(incidentEvent.occurredAt)],
        }),
        this.db
          .select({
            delivery: notificationDelivery,
            destinationName: notificationDestination.name,
            destinationKind: notificationDestination.kind,
          })
          .from(notificationDelivery)
          .leftJoin(
            notificationDestination,
            eq(notificationDelivery.destinationId, notificationDestination.id),
          )
          .where(eq(notificationDelivery.incidentId, row.id))
          .orderBy(notificationDelivery.createdAt),
      ]);

      return ok({
        incident: {
          ...row,
          sourceSnapshot: normalizeSourceSnapshot(row.sourceSnapshot),
        },
        events: events.map((event) => ({
          ...event,
          metadata: normalizeSourceSnapshot(event.metadata),
        })),
        deliveries: deliveries.map(({ delivery, destinationKind, destinationName }) => ({
          ...delivery,
          destinationName,
          destinationKind,
        })),
      });
    } catch (error) {
      this.logger.error(
        "getIncidentDetail: failed to load incident detail",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to load incident.");
    }
  }

  async resolveIncident(
    input: z.infer<typeof resolveIncidentInputSchema>,
    context: { appId: string; userId: string },
  ) {
    this.logger.info("resolveIncident: resolving incident", { input, context });

    const validated = resolveIncidentInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const existing = await this.db.query.incident.findFirst({
        where: and(
          eq(incident.id, validated.data),
          eq(incident.appId, context.appId),
          eq(incident.status, "open"),
        ),
      });

      if (!existing) {
        return err("Incident not found.");
      }

      const now = new Date();

      await this.db.transaction(async (tx) => {
        await tx
          .update(incident)
          .set({
            status: "resolved",
            resolvedAt: now,
          })
          .where(eq(incident.id, existing.id));

        await tx.insert(incidentEvent).values({
          id: genId("inev"),
          appId: existing.appId,
          incidentId: existing.id,
          eventType: "incident.resolved",
          occurredAt: now,
          actorUserId: context.userId,
          metadata: {
            manual: true,
          },
        });
      });

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "resolveIncident: failed to resolve incident",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to resolve incident.");
    }
  }

  async dismissIncident(
    input: z.infer<typeof dismissIncidentInputSchema>,
    context: { appId: string; userId: string },
  ) {
    this.logger.info("dismissIncident: dismissing incident", { input, context });

    const validated = dismissIncidentInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const existing = await this.db.query.incident.findFirst({
        where: and(
          eq(incident.id, validated.data.id),
          eq(incident.appId, context.appId),
          eq(incident.status, "open"),
        ),
      });

      if (!existing) {
        return err("Incident not found.");
      }

      const now = new Date();

      await this.db.transaction(async (tx) => {
        await tx
          .update(incident)
          .set({
            status: "dismissed",
            dismissedAt: now,
            dismissedReason: validated.data.reason,
            dismissedReasonText: validated.data.reasonText ?? null,
            dismissedBy: context.userId,
            suppressedUntilRecovered: true,
          })
          .where(eq(incident.id, existing.id));

        await tx.insert(incidentEvent).values({
          id: genId("inev"),
          appId: existing.appId,
          incidentId: existing.id,
          eventType: "incident.dismissed",
          occurredAt: now,
          actorUserId: context.userId,
          metadata: {
            reason: validated.data.reason,
            reasonText: validated.data.reasonText ?? null,
          },
        });
      });

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "dismissIncident: failed to dismiss incident",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to dismiss incident.");
    }
  }

  async openOrGetIncident(
    input: OpenIncidentInput,
    tx?: Tx,
  ) {
    const database = tx ?? this.db;
    const existing = await database.query.incident.findFirst({
      where: and(
        eq(incident.appId, input.appId),
        eq(incident.sourceKey, input.sourceKey),
        eq(incident.status, "open"),
      ),
    });

    if (existing) {
      return {
        opened: false,
        suppressed: false,
        incident: existing,
      };
    }

    const latest = await database.query.incident.findFirst({
      where: and(
        eq(incident.appId, input.appId),
        eq(incident.sourceKey, input.sourceKey),
      ),
      orderBy: [desc(incident.openedAt)],
    });

    if (latest?.status === "dismissed" && latest.suppressedUntilRecovered) {
      return {
        opened: false,
        suppressed: true,
        incident: latest,
      };
    }

    const now = input.now ?? new Date();
    const incidentId = input.id ?? genId("inc");

    await database.insert(incident).values({
      id: incidentId,
      appId: input.appId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceKey: input.sourceKey,
      type: input.type,
      title: input.title,
      severity: input.severity,
      status: "open",
      serviceName: input.serviceName ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      entityName: input.entityName ?? null,
      sourceSnapshot: input.sourceSnapshot,
      openedAt: now,
      lastObservedAt: input.lastObservedAt ?? now,
      lastObservedValue: input.lastObservedValue ?? null,
      lastNotifiedAt: input.lastNotifiedAt ?? null,
      renotifyCount: input.renotifyCount ?? 0,
    });

    await database.insert(incidentEvent).values([
      {
        id: genId("inev"),
        appId: input.appId,
        incidentId,
        eventType: "incident.opened",
        occurredAt: now,
        metadata: input.openMetadata ?? {},
      },
      {
        id: genId("inev"),
        appId: input.appId,
        incidentId,
        eventType: input.triggerEventType,
        occurredAt: now,
        metadata: input.triggerMetadata ?? {},
      },
    ]);

    const created = await database.query.incident.findFirst({
      where: eq(incident.id, incidentId),
    });

    if (!created) {
      throw new Error("Failed to load created incident.");
    }

    return {
      opened: true,
      suppressed: false,
      incident: created,
    };
  }

  async touchIncident(
    input: {
      id: string;
      appId: string;
      lastObservedAt: Date;
      lastObservedValue?: number | null;
      lastNotifiedAt?: Date | null;
      renotifyCount?: number;
      eventType?: z.infer<typeof incidentEventTypeSchema>;
      eventMetadata?: Record<string, unknown>;
    },
    tx?: Tx,
  ) {
    const database = tx ?? this.db;
    const updateValues: {
      lastObservedAt: Date;
      lastObservedValue?: number | null;
      lastNotifiedAt?: Date | null;
      renotifyCount?: number;
    } = {
      lastObservedAt: input.lastObservedAt,
    };

    if (input.lastObservedValue !== undefined) {
      updateValues.lastObservedValue = input.lastObservedValue;
    }

    if (input.lastNotifiedAt !== undefined) {
      updateValues.lastNotifiedAt = input.lastNotifiedAt;
    }

    if (input.renotifyCount !== undefined) {
      updateValues.renotifyCount = input.renotifyCount;
    }

    await database
      .update(incident)
      .set(updateValues)
      .where(and(eq(incident.id, input.id), eq(incident.appId, input.appId)));

    if (input.eventType) {
      await database.insert(incidentEvent).values({
        id: genId("inev"),
        appId: input.appId,
        incidentId: input.id,
        eventType: input.eventType,
        occurredAt: input.lastObservedAt,
        metadata: input.eventMetadata ?? {},
      });
    }
  }

  async recoverSourceIncident(
    input: {
      appId: string;
      sourceKey: string;
      now: Date;
      eventType: z.infer<typeof incidentEventTypeSchema>;
      eventMetadata?: Record<string, unknown>;
      lastObservedValue?: number | null;
    },
    tx?: Tx,
  ) {
    const database = tx ?? this.db;
    const latest = await database.query.incident.findFirst({
      where: and(
        eq(incident.appId, input.appId),
        eq(incident.sourceKey, input.sourceKey),
      ),
      orderBy: [desc(incident.openedAt)],
    });

    if (!latest) {
      return { mode: "none" as const, incident: null };
    }

    if (latest.status === "open") {
      await database
        .update(incident)
        .set({
          status: "resolved",
          resolvedAt: input.now,
          lastObservedAt: input.now,
          lastObservedValue: input.lastObservedValue ?? null,
        })
        .where(eq(incident.id, latest.id));

      await database.insert(incidentEvent).values([
        {
          id: genId("inev"),
          appId: latest.appId,
          incidentId: latest.id,
          eventType: input.eventType,
          occurredAt: input.now,
          metadata: input.eventMetadata ?? {},
        },
        {
          id: genId("inev"),
          appId: latest.appId,
          incidentId: latest.id,
          eventType: "incident.resolved",
          occurredAt: input.now,
          metadata: {
            automatic: true,
          },
        },
      ]);

      return {
        mode: "resolved_open" as const,
        incident: {
          ...latest,
          status: "resolved" as const,
          resolvedAt: input.now,
        },
      };
    }

    if (latest.status === "dismissed" && latest.suppressedUntilRecovered) {
      await database
        .update(incident)
        .set({
          suppressedUntilRecovered: false,
          lastObservedAt: input.now,
          lastObservedValue: input.lastObservedValue ?? null,
        })
        .where(eq(incident.id, latest.id));

      await database.insert(incidentEvent).values({
        id: genId("inev"),
        appId: latest.appId,
        incidentId: latest.id,
        eventType: input.eventType,
        occurredAt: input.now,
        metadata: {
          ...(input.eventMetadata ?? {}),
          clearedDismissalSuppression: true,
        },
      });

      return {
        mode: "cleared_dismissed_suppression" as const,
        incident: {
          ...latest,
          suppressedUntilRecovered: false,
        },
      };
    }

    return {
      mode: "noop" as const,
      incident: latest,
    };
  }

  async resolveOpenIncidentBySourceKey(
    input: {
      appId: string;
      sourceKey: string;
      now: Date;
      actorUserId?: string;
      metadata?: Record<string, unknown>;
      lastObservedValue?: number | null;
    },
    tx?: Tx,
  ) {
    const database = tx ?? this.db;
    const existing = await database.query.incident.findFirst({
      where: and(
        eq(incident.appId, input.appId),
        eq(incident.sourceKey, input.sourceKey),
        eq(incident.status, "open"),
      ),
    });

    if (!existing) {
      return null;
    }

    await database
      .update(incident)
      .set({
        status: "resolved",
        resolvedAt: input.now,
        lastObservedAt: input.now,
        lastObservedValue: input.lastObservedValue ?? existing.lastObservedValue,
      })
      .where(eq(incident.id, existing.id));

    await database.insert(incidentEvent).values({
      id: genId("inev"),
      appId: existing.appId,
      incidentId: existing.id,
      eventType: "incident.resolved",
      occurredAt: input.now,
      actorUserId: input.actorUserId,
      metadata: input.metadata ?? {},
    });

    return {
      ...existing,
      status: "resolved" as const,
      resolvedAt: input.now,
    };
  }

  async getOpenIncidentCountBySourceIds(input: {
    appId: string;
    sourceType: z.infer<typeof incidentSourceTypeSchema>;
    sourceIds: string[];
  }) {
    if (input.sourceIds.length === 0) {
      return new Map<string, number>();
    }

    const rows = await this.db
      .select({
        sourceId: incident.sourceId,
        count: sql<number>`count(*)`,
      })
      .from(incident)
      .where(
        and(
          eq(incident.appId, input.appId),
          eq(incident.sourceType, input.sourceType),
          eq(incident.status, "open"),
          inArray(incident.sourceId, input.sourceIds),
        ),
      )
      .groupBy(incident.sourceId);

    return new Map(rows.map((row) => [row.sourceId, Number(row.count)]));
  }
}

const incidentStatusSchema = z.enum(["all", "open", "resolved", "dismissed"]);
const incidentSourceTypeSchema = z.enum(["alert", "heartbeat", "host"]);
const incidentSeveritySchema = z.enum(["critical", "warning", "info"]);
const incidentEntityTypeSchema = z.enum(["app", "host", "container"]);
const incidentTypeSchema = z.enum([
  "alert_threshold",
  "heartbeat_missed",
  "host_agent_disconnected",
  "host_offline",
]);
const incidentEventTypeSchema = z.enum([
  "incident.opened",
  "incident.resolved",
  "incident.dismissed",
  "alert.fired",
  "heartbeat.missed",
  "heartbeat.recovered",
  "host.agent_disconnected",
  "host.offline",
  "host.recovered",
]);

const listIncidentsInputSchema = z.object({
  status: incidentStatusSchema.default("all"),
  sourceType: incidentSourceTypeSchema.optional(),
  sourceId: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(500).default(200),
});

const getOpenIncidentsInputSchema = listIncidentsInputSchema.pick({
  sourceType: true,
  sourceId: true,
  entityId: true,
  limit: true,
});

const getIncidentInputSchema = z.string().trim().min(1);
const resolveIncidentInputSchema = z.string().trim().min(1);
const dismissIncidentInputSchema = z
  .object({
    id: z.string().trim().min(1),
    reason: z.enum(["expected", "false_positive", "not_actionable", "other"]),
    reasonText: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.reason === "other" && !value.reasonText) {
      ctx.addIssue({
        code: "custom",
        message: "Provide a dismissal reason.",
        path: ["reasonText"],
      });
    }
  });

type OpenIncidentInput = {
  id?: string;
  appId: string;
  sourceType: z.infer<typeof incidentSourceTypeSchema>;
  sourceId: string;
  sourceKey: string;
  type: z.infer<typeof incidentTypeSchema>;
  title: string;
  severity: z.infer<typeof incidentSeveritySchema>;
  serviceName?: string | null;
  entityType: z.infer<typeof incidentEntityTypeSchema>;
  entityId: string;
  entityName?: string | null;
  sourceSnapshot: Record<string, unknown>;
  triggerEventType: z.infer<typeof incidentEventTypeSchema>;
  now?: Date;
  lastObservedAt?: Date;
  lastObservedValue?: number | null;
  lastNotifiedAt?: Date | null;
  renotifyCount?: number;
  openMetadata?: Record<string, unknown>;
  triggerMetadata?: Record<string, unknown>;
};

const normalizeSourceSnapshot = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export {
  dismissIncidentInputSchema,
  getIncidentInputSchema,
  getOpenIncidentsInputSchema,
  IncidentService,
  incidentEntityTypeSchema,
  incidentEventTypeSchema,
  incidentSeveritySchema,
  incidentSourceTypeSchema,
  incidentStatusSchema,
  incidentTypeSchema,
  listIncidentsInputSchema,
  resolveIncidentInputSchema,
};
