import { createGetOrganizationAccessState } from "$lib/server/services/billing/methods/get-organization-access-state";
import { describe, expect, test, vi } from "vitest";

describe("createGetOrganizationAccessState", () => {
  test("denies paid access but reports past-due status for billing recovery", async () => {
    const getOrganizationAccessState = createGetOrganizationAccessState({
      db: {
        query: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({ billingStatus: "past_due" }),
          },
        },
      } as never,
      logger: { error: vi.fn() } as never,
      getCurrentSubscription: vi.fn().mockResolvedValue(null),
    });

    const result = await getOrganizationAccessState({
      organizationId: "org_cartlane",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        hasAccess: false,
        billingStatus: "past_due",
        trialExpired: false,
        subscription: null,
      });
    }
  });
});
