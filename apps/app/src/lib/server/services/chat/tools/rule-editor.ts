import { tool } from "ai";
import { z } from "zod";
import {
  ruleEditorDescriptorSchema,
  ruleEditorToolSchemas,
} from "$lib/alerts/editor-schema";

const createRuleEditorTools = (
  editor: z.infer<typeof ruleEditorDescriptorSchema>,
) => {
  const target = {
    editorId: z.literal(editor.editorId),
    ruleId: z.literal(editor.ruleId),
  };
  return {
    get_rule_editor: tool({
      description:
        "Read the live unsaved rule form, active tab, available notification destinations, and revision. Read this before editing. All editor calls must run sequentially; use the revision returned by the previous call.",
      inputSchema: ruleEditorToolSchemas.get_rule_editor.extend(target),
    }),
    edit_rule_condition: tool({
      description:
        "Update several condition fields in the visible rule editor and reveal Condition. Omitted fields stay unchanged. Metric metadata is fetched automatically. Does not save. Returns the new revision and state.",
      inputSchema: ruleEditorToolSchemas.edit_rule_condition.extend(target),
    }),
    edit_rule_filters: tool({
      description:
        "Update filters in the visible editor and reveal Filters. Omitted filter groups stay unchanged; supplied groups replace their include/exclude arrays. Supplied metricAttributeFilters replaces that map. Skip this action when no filters are needed. Does not save.",
      inputSchema: ruleEditorToolSchemas.edit_rule_filters.extend(target),
    }),
    edit_rule_notifications: tool({
      description:
        "Select notification destination IDs in the editor and reveal Notifications. Replaces the selected list. Read the editor first to find existing destinations. Does not save.",
      inputSchema: ruleEditorToolSchemas.edit_rule_notifications.extend(target),
    }),
    create_notification_destination: tool({
      description:
        "Create an email or webhook notification destination for the current app, refresh the visible list, select the new destination, and reveal Notifications. Reuse existing destinations where appropriate. Only create when requested; ask for missing webhook URLs or recipients. Slack requires the existing integration connection flow. Does not send a test notification or save the rule.",
      inputSchema:
        ruleEditorToolSchemas.create_notification_destination.extend(target),
    }),
    save_rule: tool({
      description:
        "Validate and save exactly the current visible rule form. Use when the user asks to create, configure, update, or save a rule; leave unsaved when they ask for a draft or suggestion. Do not ask for redundant confirmation. Use the latest revision. Returns saved state or a validation error.",
      inputSchema: ruleEditorToolSchemas.save_rule.extend(target),
    }),
  };
};
export { createRuleEditorTools };
