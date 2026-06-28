import { z } from "zod";

const incidentStatusSchema = z.enum(["all", "open", "resolved", "dismissed"]);
const incidentSourceTypeSchema = z.enum(["alert", "heartbeat"]);
const incidentSeveritySchema = z.enum(["critical", "warning", "info"]);
const incidentEntityTypeSchema = z.enum(["app", "container"]);
const incidentTypeSchema = z.enum(["alert_threshold", "heartbeat_missed"]);
const incidentEventTypeSchema = z.enum([
  "incident.opened",
  "incident.resolved",
  "incident.dismissed",
  "alert.fired",
  "heartbeat.missed",
  "heartbeat.recovered",
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

export {
  dismissIncidentInputSchema,
  getIncidentInputSchema,
  getOpenIncidentsInputSchema,
  incidentEntityTypeSchema,
  incidentEventTypeSchema,
  incidentSeveritySchema,
  incidentSourceTypeSchema,
  incidentStatusSchema,
  incidentTypeSchema,
  listIncidentsInputSchema,
  resolveIncidentInputSchema,
};
