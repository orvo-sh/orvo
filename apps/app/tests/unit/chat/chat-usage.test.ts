import { describe, expect, test } from "vitest";

import { calculateChatCredits } from "$lib/server/services/chat-usage";

describe("Chat credits", () => {
  test("charges one credit for each provider-reported token", () => {
    expect(
      calculateChatCredits({
        inputTokens: 800,
        outputTokens: 200,
        totalTokens: 1_000,
      }),
    ).toBe(1_000);
  });

  test("falls back to the input and output token counts", () => {
    expect(calculateChatCredits({ inputTokens: 125, outputTokens: 75 })).toBe(
      200,
    );
  });

  test("charges at least one credit for a completed operation", () => {
    expect(calculateChatCredits({ totalTokens: 0 })).toBe(1);
  });
});
