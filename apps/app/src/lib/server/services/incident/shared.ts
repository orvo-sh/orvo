import { z } from "zod";

import {
  incidentEntityTypeSchema,
  incidentEventTypeSchema,
  incidentSeveritySchema,
  incidentSourceTypeSchema,
  incidentTypeSchema,
} from "./schema";

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

export { normalizeSourceSnapshot };
export type { OpenIncidentInput };
