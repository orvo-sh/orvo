const calculateChatCredits = (usage: {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}) =>
  Math.max(
    1,
    Math.ceil(
      usage.totalTokens ??
        Math.max(0, usage.inputTokens ?? 0) +
          Math.max(0, usage.outputTokens ?? 0),
    ),
  );

export { calculateChatCredits };
