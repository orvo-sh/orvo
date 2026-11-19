import { expect, test } from "vitest";
import { createEmptyAlertRuleForm } from "$lib/alerts";
import { getRuleSuggestions } from "$lib/alerts/rule-suggestions";

test("an empty draft suggests creating a rule", () => {
  const prompts = getRuleSuggestions(createEmptyAlertRuleForm(), true);
  expect(prompts[0].label).toBe(
    "Help me create a rule for error rates above 5%.",
  );
  expect(prompts[0].prompt).toContain("error rate exceeds 5%");
  expect(
    prompts.every((prompt) => !prompt.label.toLowerCase().includes("review")),
  ).toBe(true);
});

test("any draft configuration changes switch to completion and review prompts", () => {
  for (const patch of [
    { name: "High errors" },
    { metricName: "$request.error_rate" },
    { threshold: 10 },
    {
      scope: {
        ...createEmptyAlertRuleForm().scope,
        services: { include: ["api"], exclude: [] },
      },
    },
    { destinationIds: ["email-1"] },
  ]) {
    expect(
      getRuleSuggestions({ ...createEmptyAlertRuleForm(), ...patch }, true)[0]
        .label,
    ).toBe("Review this draft and suggest improvements.");
  }
  const form = createEmptyAlertRuleForm();
  form.name = "Something";
  expect(getRuleSuggestions(form, true)[0].label).toBe(
    "Review this draft and suggest improvements.",
  );
  form.name = "";
  expect(getRuleSuggestions(form, true)[0].label).toBe(
    "Help me create a rule for error rates above 5%.",
  );
});

test("saved rules suggest modifications, review, and threshold tuning", () => {
  expect(
    getRuleSuggestions(createEmptyAlertRuleForm(), false).map(
      (item) => item.label,
    ),
  ).toEqual([
    "Help me change what this rule monitors.",
    "Review this rule’s condition, filters, and notifications.",
    "Recommend a threshold based on recent metrics.",
  ]);
});
