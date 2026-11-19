import {
  createEmptyAlertRuleForm,
  getAlertRuleFormFingerprint,
} from "$lib/alerts";
import { expect, test } from "vitest";

test("detects edits and treats reverting every field as unchanged", () => {
  const form = createEmptyAlertRuleForm();
  const initial = getAlertRuleFormFingerprint(form);
  form.name = "High errors";
  expect(getAlertRuleFormFingerprint(form)).not.toBe(initial);
  form.name = "";
  form.threshold = 20;
  expect(getAlertRuleFormFingerprint(form)).not.toBe(initial);
  form.threshold = 5;
  expect(getAlertRuleFormFingerprint(form)).toBe(initial);
});

test("scope and destination order do not create unsaved changes", () => {
  const form = createEmptyAlertRuleForm();
  form.scope.services.include = ["api", "worker"];
  form.destinationIds = ["a", "b"];
  const initial = getAlertRuleFormFingerprint(form);
  form.scope.services.include.reverse();
  form.destinationIds.reverse();
  expect(getAlertRuleFormFingerprint(form)).toBe(initial);
});

test("tracks custom metric edits while ignoring attribute insertion order", () => {
  const form = createEmptyAlertRuleForm();
  form.metricName = "queue.depth";
  form.metricAttributeFilters = {
    queue: { include: ["checkout", "payments"], exclude: [] },
    region: { include: ["eu"], exclude: [] },
  };
  const initial = getAlertRuleFormFingerprint(form);
  form.metricAttributeFilters = {
    region: { include: ["eu"], exclude: [] },
    queue: { include: ["payments", "checkout"], exclude: [] },
  };
  expect(getAlertRuleFormFingerprint(form)).toBe(initial);
  form.metricAttributeFilters.region.include.push("us");
  expect(getAlertRuleFormFingerprint(form)).not.toBe(initial);
});
