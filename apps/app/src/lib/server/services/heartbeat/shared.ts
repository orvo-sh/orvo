import type { DB, Tx } from "@repo/db";
import {
  app,
  heartbeatMonitor,
  heartbeatMonitorDestination,
  notificationDelivery,
  notificationDestination,
} from "@repo/db/schema";
import { err, genId, ok } from "@repo/utils";
import { and, eq, inArray } from "drizzle-orm";
import type { IncidentService } from "../incident";

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

const createLoadDestinations = ({
  db,
}: {
  db: DB;
}) => async (
  appId: string,
  destinationIds: string[],
) => {
  if (destinationIds.length === 0) {
    return ok({ destinations: [] });
  }

  const destinations = await db.query.notificationDestination.findMany({
    where: and(
      eq(notificationDestination.appId, appId),
      inArray(notificationDestination.id, destinationIds),
    ),
  });

  if (destinations.length !== destinationIds.length) {
    return err("One or more notification destinations could not be found.");
  }

  return ok({ destinations });
};

const createOpenHeartbeatIncident = ({
  db,
  incidentService,
  config,
}: {
  db: DB;
  incidentService: Pick<IncidentService, "openOrGetIncident">;
  config: { ingestBaseUrl: string };
}) => async (
  currentDb: DB | Tx,
  heartbeatMonitorId: string,
  now: Date,
) => {
  const monitor = await currentDb.query.heartbeatMonitor.findFirst({
    where: eq(heartbeatMonitor.id, heartbeatMonitorId),
  });

  if (!monitor) {
    return null;
  }

  const currentApp = await currentDb.query.app.findFirst({
    where: eq(app.id, monitor.appId),
  });
  if (!currentApp) {
    return null;
  }

  const incidentInput = {
    appId: currentApp.id,
    sourceType: "heartbeat" as const,
    sourceId: monitor.id,
    sourceKey: buildHeartbeatIncidentSourceKey(monitor.id),
    type: "heartbeat_missed" as const,
    title: monitor.name,
    severity: "critical" as const,
    serviceName: null,
    entityType: "app" as const,
    entityId: currentApp.id,
    entityName: currentApp.name,
    sourceSnapshot: {
      appName: currentApp.name,
      heartbeatMonitorId: monitor.id,
      heartbeatName: monitor.name,
      expectedEverySeconds: monitor.expectedEverySeconds,
      graceSeconds: monitor.graceSeconds,
      lastCheckInAt: monitor.lastCheckInAt?.toISOString() ?? null,
      pingUrl: buildHeartbeatUrl(config.ingestBaseUrl, monitor.token),
    },
    triggerEventType: "heartbeat.missed" as const,
    now,
    lastObservedAt: now,
    lastNotifiedAt: now,
    openMetadata: {
      heartbeatMonitorId: monitor.id,
    },
    triggerMetadata: {
      heartbeatMonitorId: monitor.id,
    },
  };

  if (currentDb === db) {
    return incidentService.openOrGetIncident(incidentInput);
  }

  return incidentService.openOrGetIncident(incidentInput, currentDb as Tx);
};

const createInsertHeartbeatDeliveries = ({
  config,
}: {
  config: { appBaseUrl: string; ingestBaseUrl: string };
}) => async (
  currentDb: DB | Tx,
  heartbeatMonitorId: string,
  incidentId: string,
  eventType: "heartbeat.missed" | "heartbeat.recovered",
  now: Date,
) => {
  const monitor = await currentDb.query.heartbeatMonitor.findFirst({
    where: eq(heartbeatMonitor.id, heartbeatMonitorId),
  });

  if (!monitor) {
    return;
  }

  const currentApp = await currentDb.query.app.findFirst({
    where: eq(app.id, monitor.appId),
  });
  if (!currentApp) {
    return;
  }

  const links = await currentDb.query.heartbeatMonitorDestination.findMany({
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
    appBaseUrl: config.appBaseUrl,
    secretUrl: buildHeartbeatUrl(config.ingestBaseUrl, monitor.token),
  });

  await currentDb.insert(notificationDelivery).values(
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
};

export {
  buildHeartbeatEventPayload,
  buildHeartbeatIncidentSourceKey,
  buildHeartbeatUrl,
  createInsertHeartbeatDeliveries,
  createLoadDestinations,
  createOpenHeartbeatIncident,
  resolveHeartbeatStatus,
  uniqueValues,
};
