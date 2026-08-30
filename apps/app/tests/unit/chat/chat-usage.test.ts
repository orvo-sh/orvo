import { describe, expect, test } from "vitest";

import { calculateChatCredits } from "$lib/server/services/chat-usage";

describe("Chat credits", () => {
  test("weights output tokens according to model cost", () => {
    expect(
      calculateChatCredits({
        inputTokens: 10_000,
        outputTokens: 2_000,
        totalTokens: 12_000,
      }),
    ).toBe(3);
  });

  test("falls back to the input and output token counts", () => {
    expect(
      calculateChatCredits({ inputTokens: 10_000, outputTokens: 2_000 }),
    ).toBe(3);
  });

  test("uses total tokens when detailed counts are unavailable", () => {
    expect(calculateChatCredits({ totalTokens: 12_000 })).toBe(2);
  });

  test("charges at least one credit for a completed operation", () => {
    expect(calculateChatCredits({ totalTokens: 0 })).toBe(1);
  });
});
