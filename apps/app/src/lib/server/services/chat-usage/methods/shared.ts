const calculateChatCredits = (usage: {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}) => {
  const inputTokens = Math.max(0, usage.inputTokens ?? 0);
  const outputTokens = Math.max(0, usage.outputTokens ?? 0);

  if (inputTokens > 0 || outputTokens > 0) {
    return Math.max(1, Math.ceil(inputTokens + outputTokens * 6));
  }

  return Math.max(1, Math.ceil(usage.totalTokens ?? 0));
};

export { calculateChatCredits };
