import { createGetBillingState } from "$lib/server/services/billing/methods/get-billing-state";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createGetBillingState", () => {
  const findOrganization = vi.fn();
  const listPaymentMethods = vi.fn();
  const getCurrentSubscription = vi.fn();
  const isOrganizationOwner = vi.fn();
  const getBillingState = createGetBillingState({
    db: {
      query: { organization: { findFirst: findOrganization } },
    } as never,
    logger: { error: vi.fn() } as never,
    stripe: {
      paymentMethods: { list: listPaymentMethods },
    } as never,
    getCurrentSubscription,
    isOrganizationOwner,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    isOrganizationOwner.mockResolvedValue(true);
    findOrganization.mockResolvedValue({
      billingPlan: "starter",
      billingStatus: "trialing",
      stripeCustomerId: "cus_billing",
      usage: null,
    });
    getCurrentSubscription.mockResolvedValue({
      status: "trialing",
      stripeCustomerId: "cus_billing",
      trialStart: new Date("2026-08-01T00:00:00Z"),
      trialEnd: new Date("2026-08-15T00:00:00Z"),
    });
  });

  test("reports an attached Stripe payment method during a trial", async () => {
    listPaymentMethods.mockResolvedValue({ data: [{ id: "pm_billing" }] });

    const result = await getBillingState({ organizationId: "org_billing" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasPaymentMethod).toBe(true);
    }
    expect(listPaymentMethods).toHaveBeenCalledWith({
      customer: "cus_billing",
      limit: 1,
    });
  });

  test("reports a missing Stripe payment method during a trial", async () => {
    listPaymentMethods.mockResolvedValue({ data: [] });

    const result = await getBillingState({ organizationId: "org_billing" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasPaymentMethod).toBe(false);
    }
  });

  test("does not query Stripe for an active subscription", async () => {
    getCurrentSubscription.mockResolvedValue({
      status: "active",
      stripeCustomerId: "cus_billing",
      trialStart: null,
      trialEnd: null,
    });

    const result = await getBillingState({ organizationId: "org_billing" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasPaymentMethod).toBeNull();
    }
    expect(listPaymentMethods).not.toHaveBeenCalled();
  });

  test("reports whether the current user can manage billing", async () => {
    listPaymentMethods.mockResolvedValue({ data: [] });

    const result = await getBillingState({
      organizationId: "org_billing",
      userId: "usr_owner",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.canManageBilling).toBe(true);
    }
    expect(isOrganizationOwner).toHaveBeenCalledWith(
      "org_billing",
      "usr_owner",
    );
  });
});
