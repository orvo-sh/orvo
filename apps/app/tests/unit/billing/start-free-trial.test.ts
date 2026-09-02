import { createStartFreeTrial } from "$lib/server/services/billing/methods/start-free-trial";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createStartFreeTrial", () => {
  const createStripeCustomer = vi.fn();
  const createStripeSubscription = vi.fn();
  const listStripeSubscriptions = vi.fn();
  const syncStripeSubscriptionState = vi.fn();
  const deleteWhere = vi.fn();
  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const tx = {
    execute: vi.fn(),
    query: {
      organization: {
        findFirst: vi.fn(),
      },
    },
    delete: vi.fn(() => ({ where: deleteWhere })),
    update: vi.fn(() => ({ set: updateSet })),
  };
  const db = {
    transaction: vi.fn((callback) => callback(tx)),
  };
  const startFreeTrial = createStartFreeTrial({
    db: db as never,
    logger: { error: vi.fn() } as never,
    stripe: {
      customers: { create: createStripeCustomer },
      subscriptions: {
        create: createStripeSubscription,
        list: listStripeSubscriptions,
      },
    } as never,
    config: {
      proPriceId: "price_pro",
      ingestOveragePriceId: "price_ingest",
      scoutOveragePriceId: "price_scout",
      trialDays: 14,
    },
    isOrganizationOwner: vi.fn().mockResolvedValue(true),
    syncStripeSubscriptionState,
  });
  const context = {
    organizationId: "org_billing",
    userId: "usr_owner",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tx.query.organization.findFirst.mockResolvedValue({
      id: "org_billing",
      name: "Billing organization",
      stripeCustomerId: "cus_billing",
    });
    listStripeSubscriptions.mockResolvedValue({ data: [] });
    createStripeCustomer.mockResolvedValue({ id: "cus_new" });
    createStripeSubscription.mockResolvedValue({
      id: "sub_direct",
      status: "trialing",
    });
    deleteWhere.mockResolvedValue(undefined);
    updateWhere.mockResolvedValue(undefined);
    syncStripeSubscriptionState.mockResolvedValue(undefined);
  });

  test("creates and synchronizes the Pro trial without Checkout", async () => {
    const result = await startFreeTrial({ plan: "pro" }, context);

    expect(result).toEqual({
      success: true,
      data: { id: "sub_direct" },
    });
    expect(createStripeCustomer).not.toHaveBeenCalled();
    expect(createStripeSubscription).toHaveBeenCalledWith(
      {
        customer: "cus_billing",
        items: [
          { price: "price_pro" },
          { price: "price_ingest" },
          { price: "price_scout" },
        ],
        trial_period_days: 14,
        metadata: {
          userId: "usr_owner",
          referenceId: "org_billing",
        },
        trial_settings: {
          end_behavior: {
            missing_payment_method: "cancel",
          },
        },
      },
      { idempotencyKey: "orvo-subscription-trial-org_billing" },
    );
    expect(syncStripeSubscriptionState).toHaveBeenCalledWith({
      organizationId: "org_billing",
      plan: "pro",
      stripeSubscription: {
        id: "sub_direct",
        status: "trialing",
      },
    });
  });

  test("replaces a customer id left behind by another Stripe account", async () => {
    listStripeSubscriptions.mockRejectedValue({ code: "resource_missing" });

    const result = await startFreeTrial({ plan: "pro" }, context);

    expect(result.success).toBe(true);
    expect(updateSet).toHaveBeenNthCalledWith(1, { stripeCustomerId: null });
    expect(createStripeCustomer).toHaveBeenCalledWith(
      {
        name: "Billing organization",
        metadata: {
          organizationId: "org_billing",
          customerType: "organization",
        },
      },
      { idempotencyKey: "orvo-customer-org_billing" },
    );
    expect(updateSet).toHaveBeenNthCalledWith(2, {
      stripeCustomerId: "cus_new",
    });
    expect(createStripeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_new" }),
      expect.anything(),
    );
  });

  test.each(["active", "trialing", "incomplete", "past_due"])(
    "blocks direct provisioning when Stripe already has a %s subscription",
    async (status) => {
      listStripeSubscriptions.mockResolvedValue({ data: [{ status }] });

      const result = await startFreeTrial({ plan: "pro" }, context);

      expect(result).toEqual({
        success: false,
        error: "This organization already has a subscription.",
      });
      expect(createStripeSubscription).not.toHaveBeenCalled();
      expect(syncStripeSubscriptionState).not.toHaveBeenCalled();
    },
  );
});
