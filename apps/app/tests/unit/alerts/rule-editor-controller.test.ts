import { expect, test, vi } from "vitest";
import { createEmptyAlertRuleForm } from "$lib/alerts";
import { createRuleEditorController } from "$lib/alerts/rule-editor-controller";

const setup = () => {
  let form = createEmptyAlertRuleForm();
  let tab = "condition";
  let active = true;
  const destinations = [
    { id: "email-1", name: "Team email", kind: "email", isEnabled: true },
  ];
  const save = vi.fn(async () => ({ success: true }));
  const loadMetric = vi.fn(async () => ({
    type: "gauge",
    unit: "%",
    isMonotonic: false,
  }));
  const refreshDestinations = vi.fn(async () => {});
  const editor = createRuleEditorController({
    editorId: "editor-1",
    ruleId: "rule-1",
    isActive: () => active,
    getForm: () => form,
    setForm: (next) => {
      form = next;
    },
    getTab: () => tab,
    reveal: async (next) => {
      tab = next;
    },
    getDestinations: () => destinations,
    loadMetric,
    refreshDestinations,
    createDestination: async () => {
      destinations.push({
        id: "email-2",
        name: "New email",
        kind: "email",
        isEnabled: true,
      });
      return { success: true, data: { id: "email-2" } };
    },
    save,
  });
  const state = () => ({ form, tab });
  return {
    editor,
    state,
    save,
    loadMetric,
    refreshDestinations,
    change: () => {
      form.name = "User edit";
    },
    close: () => {
      active = false;
    },
  };
};
const target = { editorId: "editor-1", ruleId: "rule-1" };

test("batches tabs, creates and refreshes destinations, and saves the visible form", async () => {
  const { editor, state, save, refreshDestinations } = setup();
  expect(await editor.execute("get_rule_editor", target)).toMatchObject({
    data: { revision: 0 },
  });
  expect(
    await editor.execute("edit_rule_condition", {
      ...target,
      revision: 0,
      condition: {
        name: "High errors",
        metricName: "$request.error_rate",
        threshold: 5,
        windowMinutes: 10,
      },
    }),
  ).toMatchObject({ data: { revision: 1, tab: "condition" } });
  expect(state().form.metricUnit).toBe("%");
  expect(state().form.metricAggregation).toBe("avg");
  expect(
    await editor.execute("edit_rule_filters", {
      ...target,
      revision: 1,
      scope: { services: { include: ["api"], exclude: [] } },
    }),
  ).toMatchObject({ data: { revision: 2, tab: "scope" } });
  expect(
    await editor.execute("create_notification_destination", {
      ...target,
      revision: 2,
      destination: {
        kind: "email",
        name: "New email",
        recipients: ["team@example.com"],
      },
    }),
  ).toMatchObject({
    data: {
      revision: 3,
      tab: "notifications",
      createdDestinationId: "email-2",
    },
  });
  expect(refreshDestinations).toHaveBeenCalledOnce();
  expect(state().form.destinationIds).toEqual(["email-2"]);
  expect(
    await editor.execute("save_rule", { ...target, revision: 3 }),
  ).toMatchObject({ data: { saved: true, savedRevision: 3 } });
  expect(save).toHaveBeenCalledWith(state().form);
  expect(state().form.scope.services.include).toEqual(["api"]);
});

test("partial condition updates preserve fields and impossible percentages do not apply", async () => {
  const { editor, state } = setup();
  await editor.execute("edit_rule_condition", {
    ...target,
    revision: 0,
    condition: {
      metricName: "$request.error_rate",
      threshold: 10,
      name: "Errors",
    },
  });
  await editor.execute("edit_rule_condition", {
    ...target,
    revision: 1,
    condition: { threshold: 15 },
  });
  expect(state().form.name).toBe("Errors");
  expect(state().form.metricName).toBe("$request.error_rate");
  expect(
    await editor.execute("edit_rule_condition", {
      ...target,
      revision: 2,
      condition: { threshold: 102102 },
    }),
  ).toMatchObject({ error: expect.stringContaining("between 0 and 100") });
  expect(state().form.threshold).toBe(15);
});

test("stale or closed editors cannot overwrite user edits or save", async () => {
  const { editor, change, close, save, state } = setup();
  change();
  expect(
    await editor.execute("edit_rule_condition", {
      ...target,
      revision: 0,
      condition: { name: "Scout overwrite" },
    }),
  ).toMatchObject({ error: expect.stringContaining("form changed") });
  expect(state().form.name).toBe("User edit");
  close();
  expect(
    await editor.execute("save_rule", { ...target, revision: 1 }),
  ).toMatchObject({ error: expect.stringContaining("no longer open") });
  expect(save).not.toHaveBeenCalled();
});

test("user edits during metric discovery are preserved", async () => {
  const { editor, change, loadMetric, state } = setup();
  loadMetric.mockImplementationOnce(async () => {
    change();
    return { type: "gauge", unit: "%", isMonotonic: false };
  });
  expect(
    await editor.execute("edit_rule_condition", {
      ...target,
      revision: 0,
      condition: { metricName: "$request.error_rate", name: "Scout name" },
    }),
  ).toMatchObject({ error: expect.stringContaining("form changed") });
  expect(state().form.name).toBe("User edit");
  expect(state().form.metricName).toBeNull();
});

test("notification selection refreshes choices and rejects unknown IDs", async () => {
  const { editor, state, refreshDestinations } = setup();
  expect(
    await editor.execute("edit_rule_notifications", {
      ...target,
      revision: 0,
      destinationIds: ["missing"],
    }),
  ).toMatchObject({ error: expect.stringContaining("unavailable") });
  expect(state().form.destinationIds).toEqual([]);
  expect(
    await editor.execute("edit_rule_notifications", {
      ...target,
      revision: 0,
      destinationIds: ["email-1"],
    }),
  ).toMatchObject({ data: { revision: 1, tab: "notifications" } });
  expect(refreshDestinations).toHaveBeenCalledTimes(2);
});
