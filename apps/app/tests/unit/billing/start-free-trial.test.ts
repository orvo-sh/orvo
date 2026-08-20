import { createStartFreeTrial } from "$lib/server/services/billing/methods/start-free-trial";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createStartFreeTrial", () => {
  const upgradeSubscription = vi.fn();
  const listStripeSubscriptions = vi.fn();
  const deleteWhere = vi.fn();
  const tx = {
    execute: vi.fn(),
    query: {
      organization: {
        findFirst: vi.fn(),
      },
    },
    delete: vi.fn(() => ({ where: deleteWhere })),
  };
  const db = {
    transaction: vi.fn((callback) => callback(tx)),
  };
  const startFreeTrial = createStartFreeTrial({
    db: db as never,
    logger: { error: vi.fn() } as never,
    stripe: {
      subscriptions: { list: listStripeSubscriptions },
    } as never,
    isOrganizationOwner: vi.fn().mockResolvedValue(true),
  });
  const context = {
    organizationId: "org_billing",
    userId: "usr_owner",
    headers: new Headers(),
    origin: "https://orvo.test",
    authService: {
      api: { upgradeSubscription },
    } as never,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tx.query.organization.findFirst.mockResolvedValue({
      stripeCustomerId: "cus_billing",
    });
    listStripeSubscriptions.mockResolvedValue({ data: [] });
    deleteWhere.mockResolvedValue(undefined);
    upgradeSubscription.mockResolvedValue({
      url: "https://checkout.stripe.test/session",
    });
  });

  test("opens one managed checkout for a resubscription", async () => {
    const result = await startFreeTrial({ plan: "pro" }, context);

    expect(result).toEqual({
      success: true,
      data: { url: "https://checkout.stripe.test/session" },
    });
    expect(upgradeSubscription).toHaveBeenCalledOnce();
    expect(upgradeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          plan: "pro",
          customerType: "organization",
          referenceId: "org_billing",
          disableRedirect: true,
        }),
      }),
    );
  });

  test.each(["active", "trialing", "incomplete", "past_due"])(
    "blocks checkout when Stripe already has a %s subscription",
    async (status) => {
      listStripeSubscriptions.mockResolvedValue({ data: [{ status }] });

      const result = await startFreeTrial({ plan: "pro" }, context);

      expect(result).toEqual({
        success: false,
        error: "This organization already has a subscription.",
      });
      expect(upgradeSubscription).not.toHaveBeenCalled();
    },
  );
});
