import type { AlertRuleFormValue } from "$lib/alerts";
import { getAlertRuleFormFingerprint } from "$lib/alerts";
import {
  getDefaultMetricAggregation,
  getMetricAggregationOptions,
  getMetricThresholdError,
} from "$lib/metric-definitions";
import { isRuleEditorTool, ruleEditorToolSchemas } from "./editor-schema";

const createRuleEditorController = (options: {
  editorId: string;
  ruleId: string;
  isActive: () => boolean;
  getForm: () => AlertRuleFormValue;
  setForm: (form: AlertRuleFormValue) => void;
  getTab: () => string;
  reveal: (
    tab: "condition" | "scope" | "notifications",
    fields: string[],
  ) => Promise<void>;
  getDestinations: () => Array<{
    id: string;
    name: string;
    kind: string;
    isEnabled: boolean;
  }>;
  loadMetric: (
    name: string,
  ) => Promise<{ type: string; unit: string; isMonotonic: boolean } | null>;
  refreshDestinations: () => Promise<void>;
  createDestination: (
    input: unknown,
  ) => Promise<{ success: boolean; data?: { id: string }; error?: string }>;
  save: (
    form: AlertRuleFormValue,
  ) => Promise<{ success: boolean; error?: string }>;
}) => {
  let revision = 0;
  let fingerprint = getAlertRuleFormFingerprint(options.getForm());
  let busy = false;
  const snapshot = () => {
    const form = structuredClone(options.getForm());
    const current = getAlertRuleFormFingerprint(form);
    if (current !== fingerprint) {
      fingerprint = current;
      revision++;
    }
    return {
      editorId: options.editorId,
      ruleId: options.ruleId,
      revision,
      tab: options.getTab(),
      form,
      destinations: options.getDestinations(),
    };
  };
  const execute = async (name: string, input: unknown) => {
    if (!isRuleEditorTool(name)) return { error: "Unknown editor action." };
    const parsed = ruleEditorToolSchemas[name].safeParse(input);
    if (!parsed.success) return { error: parsed.error.message };
    const target = parsed.data;
    if (
      !options.isActive() ||
      target.editorId !== options.editorId ||
      target.ruleId !== options.ruleId
    )
      return {
        error:
          "The target rule editor is no longer open. Stop editing this page.",
      };
    if (busy)
      return {
        error:
          "Another editor action is running. Run editor actions sequentially.",
      };
    if (name === "get_rule_editor") return { data: snapshot() };
    const expectedRevision = "revision" in target ? target.revision : -1;
    const assertCurrent = () => {
      if (!options.isActive())
        throw new Error(
          "The target editor was closed. Stop editing this page.",
        );
      if (snapshot().revision !== expectedRevision)
        throw new Error(
          "The form changed since you read it. Read get_rule_editor again and preserve the user's changes.",
        );
    };
    busy = true;
    let createdDestinationId: string | undefined;
    try {
      assertCurrent();
      const next = structuredClone(options.getForm());
      if (name === "edit_rule_condition") {
        const { condition } =
          ruleEditorToolSchemas.edit_rule_condition.parse(input);
        const previousMetric = next.metricName;
        Object.assign(next, condition);
        if (condition.metricName) {
          const metric = await options.loadMetric(condition.metricName);
          assertCurrent();
          if (!metric)
            throw new Error("Metric not found. Choose an available metric.");
          next.metricType = metric.type;
          next.metricUnit = metric.unit;
          next.metricIsMonotonic = metric.isMonotonic;
          if (
            condition.metricAggregation === undefined &&
            previousMetric !== next.metricName
          )
            next.metricAggregation = getDefaultMetricAggregation({
              name: condition.metricName,
              ...metric,
            });
        }
        if (
          next.metricName &&
          next.metricAggregation &&
          !getMetricAggregationOptions({
            name: next.metricName,
            type: next.metricType ?? "gauge",
            isMonotonic: next.metricIsMonotonic,
          }).some((option) => option.value === next.metricAggregation)
        )
          throw new Error("Choose an aggregation supported by this metric.");
        const error = getMetricThresholdError(
          {
            name: next.metricName,
            type: next.metricType,
            unit: next.metricUnit,
            isMonotonic: next.metricIsMonotonic,
            aggregation: next.metricAggregation,
          },
          next.threshold,
        );
        if (error) throw new Error(error);
        options.setForm(next);
        await options.reveal("condition", Object.keys(condition));
      } else if (name === "edit_rule_filters") {
        const patch = ruleEditorToolSchemas.edit_rule_filters.parse(input);
        if (patch.scope) Object.assign(next.scope, patch.scope);
        if (patch.metricAttributeFilters !== undefined)
          next.metricAttributeFilters = patch.metricAttributeFilters;
        options.setForm(next);
        await options.reveal("scope", ["scope"]);
      } else if (name === "edit_rule_notifications") {
        const { destinationIds } =
          ruleEditorToolSchemas.edit_rule_notifications.parse(input);
        await options.refreshDestinations();
        assertCurrent();
        if (
          destinationIds.some(
            (id) =>
              !options
                .getDestinations()
                .some(
                  (destination) =>
                    destination.id === id && destination.isEnabled,
                ),
          )
        )
          throw new Error(
            "One or more destinations are unavailable or disabled. Read get_rule_editor again.",
          );
        next.destinationIds = [...new Set(destinationIds)];
        options.setForm(next);
        await options.reveal("notifications", ["destinationIds"]);
      } else if (name === "create_notification_destination") {
        const { destination } =
          ruleEditorToolSchemas.create_notification_destination.parse(input);
        const created = await options.createDestination(destination);
        if (!created.success || !created.data)
          throw new Error(
            created.error ?? "Could not create notification destination.",
          );
        createdDestinationId = created.data.id;
        await options.refreshDestinations();
        assertCurrent();
        if (destination.isEnabled) {
          next.destinationIds = [
            ...new Set([...next.destinationIds, created.data.id]),
          ];
          options.setForm(next);
        }
        await options.reveal("notifications", ["destinationIds"]);
        return {
          data: { ...snapshot(), createdDestinationId: created.data.id },
        };
      } else if (name === "save_rule") {
        const result = await options.save(next);
        if (!result.success)
          throw new Error(result.error ?? "Could not save rule.");
        return {
          data: { ...snapshot(), saved: true, savedRevision: expectedRevision },
        };
      }
      return { data: snapshot() };
    } catch (error) {
      return {
        error: `${error instanceof Error ? error.message : "Editor action failed."}${createdDestinationId ? ` Destination ${createdDestinationId} was already created; do not create it again. Refresh the editor and select it.` : ""}`,
        data: {
          ...snapshot(),
          ...(createdDestinationId ? { createdDestinationId } : {}),
        },
      };
    } finally {
      busy = false;
    }
  };
  return { editorId: options.editorId, ruleId: options.ruleId, execute };
};

export { createRuleEditorController };
