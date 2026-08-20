import { describe, expect, test } from "vitest";

import { calculateChatCredits } from "$lib/server/services/chat-usage";

describe("Chat credits", () => {
  test("weights output tokens according to model cost", () => {
    expect(
      calculateChatCredits({
        inputTokens: 800,
        outputTokens: 200,
        totalTokens: 1_000,
      }),
    ).toBe(2_000);
  });

  test("falls back to the input and output token counts", () => {
    expect(calculateChatCredits({ inputTokens: 125, outputTokens: 75 })).toBe(
      575,
    );
  });

  test("charges at least one credit for a completed operation", () => {
    expect(calculateChatCredits({ totalTokens: 0 })).toBe(1);
  });
});
