import { z } from "zod";
import { alertRuleInputSchema } from "$lib/alert-rule-schema";
import { createNotificationDestinationInputSchema } from "$lib/notification-destination-schema";

const ruleEditorDescriptorSchema = z.object({
  editorId: z.string().min(1).max(100),
  ruleId: z.string().min(1).max(255),
});
const editorTargetSchema = ruleEditorDescriptorSchema.extend({
  revision: z.number().int().nonnegative(),
});
const condition = alertRuleInputSchema.shape;
const editRuleConditionSchema = editorTargetSchema.extend({
  condition: z.object({
    name: condition.name.optional(),
    metricName: condition.metricName.removeDefault().optional(),
    metricAggregation: condition.metricAggregation.removeDefault().optional(),
    comparator: condition.comparator.optional(),
    threshold: condition.threshold
      .describe(
        "Threshold in metric storage units: error rate is 0–100 percent, request duration is milliseconds, and utilization metrics with unit 1 use ratios (80% = 0.8).",
      )
      .optional(),
    windowMinutes: condition.windowMinutes.optional(),
    renotifyMinutes: condition.renotifyMinutes.removeDefault().optional(),
  }),
});
const filters = condition.scope.shape;
const editRuleFiltersSchema = editorTargetSchema.extend({
  scope: z
    .object({
      services: filters.services.removeDefault().optional(),
      environments: filters.environments.removeDefault().optional(),
      scopes: filters.scopes.removeDefault().optional(),
      spanNames: filters.spanNames.removeDefault().optional(),
      containerNames: filters.containerNames.removeDefault().optional(),
    })
    .optional(),
  metricAttributeFilters: condition.metricAttributeFilters
    .removeDefault()
    .optional(),
});
const editRuleNotificationsSchema = editorTargetSchema.extend({
  destinationIds: condition.destinationIds.removeDefault(),
});
const createRuleDestinationSchema = editorTargetSchema.extend({
  destination: createNotificationDestinationInputSchema,
});
const ruleEditorToolSchemas = {
  get_rule_editor: ruleEditorDescriptorSchema,
  edit_rule_condition: editRuleConditionSchema,
  edit_rule_filters: editRuleFiltersSchema,
  edit_rule_notifications: editRuleNotificationsSchema,
  create_notification_destination: createRuleDestinationSchema,
  save_rule: editorTargetSchema,
};
const isRuleEditorTool = (
  name: string,
): name is keyof typeof ruleEditorToolSchemas =>
  Object.hasOwn(ruleEditorToolSchemas, name);

export { ruleEditorDescriptorSchema, ruleEditorToolSchemas, isRuleEditorTool };
