import { recordError } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";

import type { IncidentService } from "../../incident";
import { toDateTime64 } from "../../shared/query-builders";
import { buildHostIncidentSourceKey, normalizeDateTime } from "../shared";

const createEvaluateHostIncidents = ({
  clickhouse,
  logger,
  incidentService,
}: {
  clickhouse: ClickHouse;
  logger: Logger;
  incidentService: Pick<
    IncidentService,
    "openOrGetIncident" | "recoverSourceIncident" | "resolveOpenIncidentBySourceKey"
  >;
}) => async () => {
  try {
    const now = new Date();
    const discoveryStartAt = new Date(now.getTime() - 24 * 60 * 60_000);
    const result = await clickhouse.query({
      format: "JSONEachRow",
      query: `
        SELECT
          app_id,
          host_id,
          argMax(host_name, time) AS host_name,
          max(time) AS last_seen
        FROM metrics_raw
        WHERE entity_kind = 'host'
          AND host_id != ''
          AND time >= ${toDateTime64(discoveryStartAt)}
          AND time <= ${toDateTime64(now)}
        GROUP BY app_id, host_id
      `,
    });
    const rows = (await result.json()) as Array<{
      app_id: string;
      host_id: string;
      host_name: string;
      last_seen: string;
    }>;

    let opened = 0;
    let resolved = 0;

    for (const row of rows) {
      const lastSeenAt = new Date(normalizeDateTime(row.last_seen));
      const ageMs = now.getTime() - lastSeenAt.getTime();
      const agentDisconnectedKey = buildHostIncidentSourceKey(
        row.host_id,
        "agent_disconnected",
      );
      const offlineKey = buildHostIncidentSourceKey(row.host_id, "offline");

      if (ageMs > 10 * 60_000) {
        if (
          await incidentService.resolveOpenIncidentBySourceKey({
            appId: row.app_id,
            sourceKey: agentDisconnectedKey,
            now,
            metadata: {
              reason: "host_offline_escalated",
            },
          })
        ) {
          resolved += 1;
        }

        const openedIncident = await incidentService.openOrGetIncident({
          appId: row.app_id,
          sourceType: "host",
          sourceId: row.host_id,
          sourceKey: offlineKey,
          type: "host_offline",
          title: "Host offline",
          severity: "critical",
          entityType: "host",
          entityId: row.host_id,
          entityName: row.host_name || row.host_id,
          sourceSnapshot: {
            hostId: row.host_id,
            hostName: row.host_name || row.host_id,
            lastSeenAt: lastSeenAt.toISOString(),
            incidentKind: "offline",
          },
          triggerEventType: "host.offline",
          now,
          lastObservedAt: now,
          triggerMetadata: {
            lastSeenAt: lastSeenAt.toISOString(),
          },
        });

        if (openedIncident.opened) {
          opened += 1;
        }

        continue;
      }

      if (ageMs > 2 * 60_000) {
        if (
          await incidentService.resolveOpenIncidentBySourceKey({
            appId: row.app_id,
            sourceKey: offlineKey,
            now,
            metadata: {
              reason: "host_back_within_offline_threshold",
            },
          })
        ) {
          resolved += 1;
        }

        const openedIncident = await incidentService.openOrGetIncident({
          appId: row.app_id,
          sourceType: "host",
          sourceId: row.host_id,
          sourceKey: agentDisconnectedKey,
          type: "host_agent_disconnected",
          title: "Host agent disconnected",
          severity: "warning",
          entityType: "host",
          entityId: row.host_id,
          entityName: row.host_name || row.host_id,
          sourceSnapshot: {
            hostId: row.host_id,
            hostName: row.host_name || row.host_id,
            lastSeenAt: lastSeenAt.toISOString(),
            incidentKind: "agent_disconnected",
          },
          triggerEventType: "host.agent_disconnected",
          now,
          lastObservedAt: now,
          triggerMetadata: {
            lastSeenAt: lastSeenAt.toISOString(),
          },
        });

        if (openedIncident.opened) {
          opened += 1;
        }

        continue;
      }

      const agentRecovered = await incidentService.recoverSourceIncident({
        appId: row.app_id,
        sourceKey: agentDisconnectedKey,
        now,
        eventType: "host.recovered",
        eventMetadata: {
          hostId: row.host_id,
        },
      });
      const offlineRecovered = await incidentService.recoverSourceIncident({
        appId: row.app_id,
        sourceKey: offlineKey,
        now,
        eventType: "host.recovered",
        eventMetadata: {
          hostId: row.host_id,
        },
      });

      if (agentRecovered.mode === "resolved_open") {
        resolved += 1;
      }
      if (offlineRecovered.mode === "resolved_open") {
        resolved += 1;
      }
    }

    return ok({ opened, resolved });
  } catch (error) {
    recordError(error);
    logger.error("Failed to evaluate host incidents", error as Error);
    return err("Failed to evaluate host incidents.");
  }
};

export { createEvaluateHostIncidents };
