import { createGetOrganizationAccessState } from "$lib/server/services/billing/methods/get-organization-access-state";
import { describe, expect, test, vi } from "vitest";

describe("createGetOrganizationAccessState", () => {
  test("keeps billing recovery available when Stripe reconciliation fails", async () => {
    const staleSubscription = {
      status: "trialing",
      trialEnd: new Date(0),
      updatedAt: new Date(0),
    };
    const getAccess = createGetOrganizationAccessState({
      db: {
        query: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({ billingStatus: "trialing" }),
          },
        },
      } as never,
      logger: { error: vi.fn() } as never,
      getCurrentSubscription: vi.fn().mockResolvedValue(staleSubscription),
      reconcileSubscriptions: vi
        .fn()
        .mockRejectedValue(new Error("Ownership mismatch")),
    });
    expect(await getAccess({ organizationId: "org_cartlane" })).toMatchObject({
      success: true,
      data: {
        hasAccess: false,
        trialExpired: true,
        subscription: staleSubscription,
      },
    });
  });
  test("refreshes an expired local trial before denying an active Stripe subscription", async () => {
    const reconcileSubscriptions = vi.fn().mockResolvedValue(undefined);
    const getCurrentSubscription = vi
      .fn()
      .mockResolvedValueOnce({
        status: "trialing",
        trialEnd: new Date(0),
        updatedAt: new Date(0),
      })
      .mockResolvedValueOnce({ status: "active", trialEnd: new Date(0) });
    const getAccess = createGetOrganizationAccessState({
      db: {
        query: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({ billingStatus: "trialing" }),
          },
        },
      } as never,
      logger: { error: vi.fn() } as never,
      getCurrentSubscription,
      reconcileSubscriptions,
    });
    const result = await getAccess({ organizationId: "org_cartlane" });
    expect(reconcileSubscriptions).toHaveBeenCalledWith({
      organizationId: "org_cartlane",
    });
    expect(result).toMatchObject({
      success: true,
      data: { hasAccess: true, trialExpired: false, billingStatus: "active" },
    });
  });

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
