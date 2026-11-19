import {
  createEmptyAlertRuleForm,
  getAlertRuleFormFingerprint,
  type AlertRuleFormValue,
} from "$lib/alerts";

const getRuleSuggestions = (form: AlertRuleFormValue, isDraft: boolean) => {
  if (!isDraft)
    return [
      {
        label: "Help me change what this rule monitors.",
        prompt:
          "Modify this rule. Ask what I want to change, then update the existing rule.",
      },
      {
        label: "Review this rule’s condition, filters, and notifications.",
        prompt:
          "Review this rule's condition, filters, and notifications. Explain any issues before making changes.",
      },
      {
        label: "Recommend a threshold based on recent metrics.",
        prompt:
          "Recommend a threshold based on recent metrics. Explain it before changing this rule.",
      },
    ];
  const empty =
    getAlertRuleFormFingerprint({ ...form, name: form.name.trim() }) ===
    getAlertRuleFormFingerprint(createEmptyAlertRuleForm());
  return empty
    ? [
        {
          label: "Help me create a rule for error rates above 5%.",
          prompt:
            "Create a rule that alerts when error rate exceeds 5% over 5 minutes.",
        },
        {
          label: "Help me alert when p95 request duration exceeds 1 second.",
          prompt:
            "Create a rule that alerts when p95 request duration exceeds 1 second over 5 minutes.",
        },
        {
          label: "Suggest an alert rule based on my app’s metrics.",
          prompt:
            "Suggest a useful alert rule based on this app's metrics. Explain it before creating the rule.",
        },
      ]
    : [
        {
          label: "Review this draft and suggest improvements.",
          prompt:
            "Review this draft rule's current condition, filters, and notifications. Explain anything missing or worth changing.",
        },
        {
          label: "Help me finish this draft without losing my changes.",
          prompt:
            "Finish this draft, preserving my changes. Ask for missing information before saving.",
        },
        {
          label: "Check whether this threshold and these filters make sense.",
          prompt:
            "Check this draft's threshold and filters against available metrics. Recommend changes before applying them.",
        },
      ];
};

export { getRuleSuggestions };
