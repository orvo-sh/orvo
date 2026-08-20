import { createOnSubscriptionCreated } from "$lib/server/services/billing/methods/on-subscription-created";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createOnSubscriptionCreated", () => {
  const retrieveSubscription = vi.fn();
  const syncStripeSubscriptionState = vi.fn();
  const onSubscriptionCreated = createOnSubscriptionCreated({
    logger: { error: vi.fn() } as never,
    stripe: {
      subscriptions: { retrieve: retrieveSubscription },
    } as never,
    syncStripeSubscriptionState,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("syncs Pro subscription state from Stripe", async () => {
    const stripeSubscription = { id: "sub_pro", status: "active" };
    retrieveSubscription.mockResolvedValue(stripeSubscription);

    const result = await onSubscriptionCreated({
      plan: "pro",
      referenceId: "org_pro",
      stripeSubscriptionId: "sub_pro",
    } as never);

    expect(result.success).toBe(true);
    expect(syncStripeSubscriptionState).toHaveBeenCalledWith({
      organizationId: "org_pro",
      plan: "pro",
      stripeSubscription,
    });
  });

  test("does not grant Pro entitlements to a legacy plan", async () => {
    const result = await onSubscriptionCreated({
      plan: "starter",
      referenceId: "org_legacy",
      stripeSubscriptionId: "sub_legacy",
    } as never);

    expect(result).toEqual({
      success: false,
      error: "Subscription plan is not supported.",
    });
    expect(retrieveSubscription).not.toHaveBeenCalled();
  });
});
