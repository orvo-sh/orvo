import { describe, expect, test } from "vitest";

import {
  allocateScoutCredits,
  calculateScoutCredits,
  SCOUT_CREDIT_POLICY_VERSION,
} from "$lib/server/services/scout-credit";

describe("Scout credits", () => {
  test("charges one credit for each provider-reported token", () => {
    expect(
      calculateScoutCredits({
        inputTokens: 800,
        outputTokens: 200,
        totalTokens: 1_000,
      }),
    ).toBe(1_000);
    expect(SCOUT_CREDIT_POLICY_VERSION).toBe(1);
  });

  test("falls back to the input and output token counts", () => {
    expect(calculateScoutCredits({ inputTokens: 125, outputTokens: 75 })).toBe(
      200,
    );
  });

  test("charges at least one credit for a completed operation", () => {
    expect(calculateScoutCredits({ totalTokens: 0 })).toBe(1);
  });

  test("allocates credits in grant order and reports an uncovered remainder", () => {
    expect(
      allocateScoutCredits(
        [
          { id: "expiring-plan", remainingCredits: 100 },
          { id: "purchased", remainingCredits: 250 },
        ],
        400,
      ),
    ).toEqual({
      allocations: [
        { grantId: "expiring-plan", credits: 100 },
        { grantId: "purchased", credits: 250 },
      ],
      unfundedCredits: 50,
    });
  });
});
