import { Instrument } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createDismissIncident } from "./methods/dismiss-incident";
import { createGetIncidentDetail } from "./methods/get-incident-detail";
import { createGetOpenIncidentCountBySourceIds } from "./methods/get-open-incident-count-by-source-ids";
import { createListIncidents } from "./methods/list-incidents";
import { createListSourceEvents } from "./methods/list-source-events";
import { createOpenOrGetIncident } from "./methods/open-or-get-incident";
import { createRecoverSourceIncident } from "./methods/recover-source-incident";
import { createResolveIncident } from "./methods/resolve-incident";
import { createResolveOpenIncidentBySourceKey } from "./methods/resolve-open-incident-by-source-key";
import { createTouchIncident } from "./methods/touch-incident";
import {
  dismissIncidentInputSchema,
  getIncidentInputSchema,
  getOpenIncidentsInputSchema,
  incidentEventTypeSchema,
  incidentSourceTypeSchema,
  listIncidentsInputSchema,
  resolveIncidentInputSchema,
} from "./schema";
import type { OpenIncidentInput } from "./shared";

@Instrument({ prefix: "incident" })
class IncidentService {
  private logger: Logger;
  private listIncidentsMethod: ReturnType<typeof createListIncidents>;
  private getIncidentDetailMethod: ReturnType<typeof createGetIncidentDetail>;
  private resolveIncidentMethod: ReturnType<typeof createResolveIncident>;
  private dismissIncidentMethod: ReturnType<typeof createDismissIncident>;
  private openOrGetIncidentMethod: ReturnType<typeof createOpenOrGetIncident>;
  private touchIncidentMethod: ReturnType<typeof createTouchIncident>;
  private recoverSourceIncidentMethod: ReturnType<
    typeof createRecoverSourceIncident
  >;
  private resolveOpenIncidentBySourceKeyMethod: ReturnType<
    typeof createResolveOpenIncidentBySourceKey
  >;
  private getOpenIncidentCountBySourceIdsMethod: ReturnType<
    typeof createGetOpenIncidentCountBySourceIds
  >;
  private listSourceEventsMethod: ReturnType<typeof createListSourceEvents>;

  constructor(db: DB, logger: Logger) {
    this.logger = logger.child("IncidentService");
    this.listIncidentsMethod = createListIncidents({
      db,
      logger: this.logger,
    });
    this.getIncidentDetailMethod = createGetIncidentDetail({
      db,
      logger: this.logger,
    });
    this.resolveIncidentMethod = createResolveIncident({
      db,
      logger: this.logger,
    });
    this.dismissIncidentMethod = createDismissIncident({
      db,
      logger: this.logger,
    });
    this.openOrGetIncidentMethod = createOpenOrGetIncident({
      db,
      logger: this.logger,
    });
    this.touchIncidentMethod = createTouchIncident({
      db,
      logger: this.logger,
    });
    this.recoverSourceIncidentMethod = createRecoverSourceIncident({
      db,
      logger: this.logger,
    });
    this.resolveOpenIncidentBySourceKeyMethod =
      createResolveOpenIncidentBySourceKey({
        db,
        logger: this.logger,
      });
    this.getOpenIncidentCountBySourceIdsMethod =
      createGetOpenIncidentCountBySourceIds({
        db,
        logger: this.logger,
      });
    this.listSourceEventsMethod = createListSourceEvents({
      db,
      logger: this.logger,
    });
  }

  async listIncidents(
    input: z.input<typeof listIncidentsInputSchema>,
    context: { appId: string },
  ) {
    return this.listIncidentsMethod(input, context);
  }

  async getOpenIncidents(
    input: z.input<typeof getOpenIncidentsInputSchema>,
    context: { appId: string },
  ) {
    return this.listIncidentsMethod(
      {
        ...input,
        status: "open",
      },
      context,
    );
  }

  async getIncidentDetail(
    input: z.input<typeof getIncidentInputSchema>,
    context: { appId: string },
  ) {
    return this.getIncidentDetailMethod(input, context);
  }

  async resolveIncident(
    input: z.input<typeof resolveIncidentInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.resolveIncidentMethod(input, context);
  }

  async dismissIncident(
    input: z.input<typeof dismissIncidentInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.dismissIncidentMethod(input, context);
  }

  async openOrGetIncident(input: OpenIncidentInput, tx?: Tx) {
    return this.openOrGetIncidentMethod(input, tx);
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
    return this.touchIncidentMethod(input, tx);
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
    return this.recoverSourceIncidentMethod(input, tx);
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
    return this.resolveOpenIncidentBySourceKeyMethod(input, tx);
  }

  async getOpenIncidentCountBySourceIds(input: {
    appId: string;
    sourceType: z.infer<typeof incidentSourceTypeSchema>;
    sourceIds: string[];
  }) {
    return this.getOpenIncidentCountBySourceIdsMethod(input);
  }

  async listSourceEvents(
    input: {
      sourceType: "alert" | "heartbeat";
      sourceId: string;
      limit: number;
    },
    context: { appId: string },
  ) {
    return this.listSourceEventsMethod(input, context);
  }
}

export * from "./schema";
export { IncidentService };
