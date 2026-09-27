import { createReconcileSubscriptions } from "$lib/server/services/billing/methods/reconcile-subscriptions";
import { describe, expect, test, vi } from "vitest";

const setup = (candidates: Record<string, unknown>[]) => {
  const sync = vi.fn();
  const error = vi.fn();
  const reconcile = createReconcileSubscriptions({
    db: {
      query: {
        organization: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              {
                id: "org_cartlane",
                stripeCustomerId: "cus_shared",
                billingPlan: "pro",
              },
            ]),
        },
      },
    } as never,
    stripe: {
      subscriptions: {
        list: vi.fn(() =>
          (async function* () {
            for (const candidate of candidates) yield candidate;
          })(),
        ),
      },
    } as never,
    logger: { child: vi.fn(() => ({ error })) } as never,
    config: { proPriceId: "price_pro" },
    getCurrentSubscription: vi
      .fn()
      .mockResolvedValue({
        stripeSubscriptionId: "sub_old",
        status: "trialing",
      }),
    syncStripeSubscriptionState: sync,
  });
  return { reconcile, sync, error };
};

const subscription = (values: Record<string, unknown> = {}) => ({
  id: "sub_current",
  status: "active",
  created: 100,
  metadata: { referenceId: "org_cartlane" },
  items: { data: [{ price: { id: "price_pro" } }] },
  ...values,
});

describe("reconcileSubscriptions", () => {
  test("recovers the current subscription without adopting another organization's plan", async () => {
    const current = subscription();
    const { reconcile, sync } = setup([
      subscription({ metadata: { referenceId: "org_sopeasy" } }),
      current,
      subscription({ id: "sub_old", status: "canceled" }),
    ]);
    await reconcile();
    expect(sync).toHaveBeenCalledExactlyOnceWith({
      organizationId: "org_cartlane",
      plan: "pro",
      stripeSubscription: current,
    });
  });

  test("applies cancellation when the known subscription has ended", async () => {
    const canceled = subscription({ id: "sub_old", status: "canceled" });
    const { reconcile, sync } = setup([canceled]);
    await reconcile();
    expect(sync).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscription: canceled }),
    );
  });

  test.each([
    [subscription({ metadata: { referenceId: "org_sopeasy" } })],
    [subscription({ items: { data: [{ price: { id: "price_other" } }] } })],
    [subscription(), subscription({ id: "sub_second" })],
  ])(
    "fails safely for ambiguous or mismatched Stripe data",
    async (...candidates) => {
      const { reconcile, sync, error } = setup(candidates);
      await expect(reconcile()).rejects.toThrow(
        "Failed to reconcile Stripe subscriptions",
      );
      expect(sync).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalled();
    },
  );
});
