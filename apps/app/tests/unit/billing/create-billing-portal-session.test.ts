import { createCreateBillingPortalSession } from "$lib/server/services/billing/methods/create-billing-portal-session";
import { createOpenBillingFlow } from "$lib/server/services/billing/methods/open-billing-flow";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createCreateBillingPortalSession", () => {
  const findApp = vi.fn();
  const findOrganization = vi.fn();
  const createStripePortalSession = vi.fn();
  const listSubscriptions = vi.fn();
  const listSessions = vi.fn();
  const createCheckout = vi.fn();
  const expireCheckout = vi.fn();
  const retrieveSubscription = vi.fn();
  const createBillingPortal = vi.fn();
  const isOrganizationOwner = vi.fn().mockResolvedValue(true);
  const db = {
    execute: vi.fn(),
    transaction: vi.fn((callback) => callback(db)),
    query: {
      app: { findFirst: findApp },
      organization: { findFirst: findOrganization },
    },
  };
  const stripe = {
    subscriptions: { list: listSubscriptions, retrieve: retrieveSubscription },
    checkout: {
      sessions: {
        list: listSessions,
        create: createCheckout,
        expire: expireCheckout,
      },
    },
    billingPortal: { sessions: { create: createStripePortalSession } },
  };
  const createBillingPortalSession = createCreateBillingPortalSession({
    db: db as never,
    logger: { error: vi.fn() } as never,
    openBillingFlow: createOpenBillingFlow({
      db: db as never,
      stripe: stripe as never,
      config: {
        proPriceId: "price_pro",
        ingestOveragePriceId: "price_ingest",
        scoutOveragePriceId: "price_scout",
      },
    }),
    isOrganizationOwner,
  });
  const context = {
    organizationId: "org_billing",
    userId: "usr_owner",
    headers: new Headers(),
    origin: "https://orvo.test",
    authService: {
      api: { createBillingPortal },
    } as never,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isOrganizationOwner.mockResolvedValue(true);
    findApp.mockResolvedValue({ id: "app_billing" });
    findOrganization.mockResolvedValue({ stripeCustomerId: "cus_billing" });
    listSubscriptions.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield {
          id: "sub_trial",
          status: "trialing",
          trial_end: 4102444800,
          metadata: { referenceId: "org_billing" },
          items: { data: [{ price: { id: "price_pro" } }] },
        };
      },
    });
    listSessions.mockReturnValue({ async *[Symbol.asyncIterator]() {} });
    createCheckout.mockResolvedValue({
      url: "https://checkout.stripe.test/session",
    });
    createStripePortalSession.mockResolvedValue({
      url: "https://billing.stripe.test/payment-method",
    });
    createBillingPortal.mockResolvedValue({
      url: "https://billing.stripe.test/session",
    });
  });

  test("returns to the selected app billing settings", async () => {
    const result = await createBillingPortalSession(
      { appId: "app_billing" },
      context,
    );

    expect(result).toEqual({
      success: true,
      data: { url: "https://billing.stripe.test/session" },
    });
    expect(createBillingPortal).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          returnUrl: "https://orvo.test/a/app_billing/settings/billing",
        }),
      }),
    );
  });

  test("rejects an app outside the active organization", async () => {
    findApp.mockResolvedValue(undefined);

    const result = await createBillingPortalSession(
      { appId: "app_other" },
      context,
    );

    expect(result).toEqual({ success: false, error: "App not found." });
    expect(createBillingPortal).not.toHaveBeenCalled();
  });

  test("opens the focused payment form and returns to billing after saving", async () => {
    const result = await createBillingPortalSession(
      { appId: "app_billing", flow: "payment_method_update" },
      context,
    );

    expect(result).toEqual({
      success: true,
      data: { url: "https://billing.stripe.test/payment-method" },
    });
    expect(createStripePortalSession).toHaveBeenCalledWith({
      customer: "cus_billing",
      return_url: "https://orvo.test/a/app_billing/settings/billing",
      flow_data: {
        type: "payment_method_update",
        after_completion: {
          type: "redirect",
          redirect: {
            return_url:
              "https://orvo.test/api/billing/return?appId=app_billing&returnPath=%2Fa%2Fapp_billing%2Fsettings%2Fbilling&paymentMethodUpdated=1",
          },
        },
      },
    });
    expect(createBillingPortal).not.toHaveBeenCalled();
  });

  test("requires an owner to open the payment form", async () => {
    isOrganizationOwner.mockResolvedValue(false);

    const result = await createBillingPortalSession(
      { appId: "app_billing", flow: "payment_method_update" },
      context,
    );

    expect(result).toEqual({
      success: false,
      error: "Only organization owners can manage billing.",
    });
    expect(createStripePortalSession).not.toHaveBeenCalled();
  });

  test("returns to the originating page on both back and successful completion", async () => {
    await createBillingPortalSession(
      {
        appId: "app_billing",
        flow: "payment_method_update",
        returnPath: "/a/app_billing/logs?search=error&time=last_hour#details",
      },
      context,
    );

    expect(createStripePortalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url:
          "https://orvo.test/a/app_billing/logs?search=error&time=last_hour#details",
        flow_data: expect.objectContaining({
          after_completion: {
            type: "redirect",
            redirect: {
              return_url:
                "https://orvo.test/api/billing/return?appId=app_billing&returnPath=%2Fa%2Fapp_billing%2Flogs%3Fsearch%3Derror%26time%3Dlast_hour%23details&paymentMethodUpdated=1",
            },
          },
        }),
      }),
    );
  });

  test.each([
    "//example.com/a/app_billing/logs",
    "/a/app_other/logs",
    "/a/app_billing_other/logs",
    "/a/app_billing/../../settings",
  ])("rejects an invalid return path (%s)", async (returnPath) => {
    const result = await createBillingPortalSession(
      { appId: "app_billing", flow: "payment_method_update", returnPath },
      context,
    );

    expect(result).toEqual({
      success: false,
      error: "Invalid billing return path.",
    });
    expect(createStripePortalSession).not.toHaveBeenCalled();
    expect(createBillingPortal).not.toHaveBeenCalled();
  });

  test("does not open a payment form without an organization customer", async () => {
    findOrganization.mockResolvedValue({ stripeCustomerId: null });

    const result = await createBillingPortalSession(
      { appId: "app_billing", flow: "payment_method_update" },
      context,
    );

    expect(result.success).toBe(false);
    expect(createStripePortalSession).not.toHaveBeenCalled();
  });

  test("creates paid Checkout after cancellation with Pro only and no new trial", async () => {
    listSubscriptions.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield { id: "sub_old", status: "canceled" };
      },
    });
    const result = await createBillingPortalSession(
      { appId: "app_billing", flow: "payment_method_update" },
      context,
    );
    expect(result).toMatchObject({
      success: true,
      data: { url: "https://checkout.stripe.test/session" },
    });
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        managed_payments: { enabled: true },
        customer: "cus_billing",
        line_items: [{ price: "price_pro", quantity: 1 }],
        subscription_data: {
          metadata: { referenceId: "org_billing", userId: "usr_owner" },
        },
        cancel_url: "https://orvo.test/a/app_billing/settings/billing",
      }),
      {
        idempotencyKey: expect.stringMatching(
          /^orvo-paid-checkout-org_billing-sub_old-[a-f0-9]{64}$/,
        ),
      },
    );
    expect(createStripePortalSession).not.toHaveBeenCalled();
  });

  test.each(["active", "past_due", "unpaid", "incomplete"])(
    "updates the existing %s subscription without creating another",
    async (status) => {
      listSubscriptions.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            status,
            metadata: { referenceId: "org_billing" },
            items: { data: [{ price: { id: "price_pro" } }] },
          };
        },
      });
      expect(
        (
          await createBillingPortalSession(
            { appId: "app_billing", flow: "payment_method_update" },
            context,
          )
        ).success,
      ).toBe(true);
      expect(createCheckout).not.toHaveBeenCalled();
      expect(createStripePortalSession).toHaveBeenCalled();
    },
  );

  test("waits for Stripe to finalize a just-expired trial", async () => {
    listSubscriptions.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield {
          status: "trialing",
          trial_end: 1,
          metadata: { referenceId: "org_billing" },
          items: { data: [{ price: { id: "price_pro" } }] },
        };
      },
    });
    expect(
      (
        await createBillingPortalSession(
          { appId: "app_billing", flow: "payment_method_update" },
          context,
        )
      ).success,
    ).toBe(false);
    expect(createCheckout).not.toHaveBeenCalled();
    expect(createStripePortalSession).not.toHaveBeenCalled();
  });

  test("reuses an open Checkout instead of creating a duplicate", async () => {
    listSubscriptions.mockReturnValue({ async *[Symbol.asyncIterator]() {} });
    listSessions.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield {
          id: "cs_existing",
          managed_payments: { enabled: true },
          mode: "subscription",
          status: "open",
          metadata: {
            referenceId: "org_billing",
            ingestOverageEnabled: "false",
            scoutOverageEnabled: "false",
          },
          success_url:
            "https://orvo.test/api/billing/return?appId=app_billing&returnPath=%2Fa%2Fapp_billing%2Fsettings%2Fbilling",
          url: "https://checkout.stripe.test/existing",
        };
      },
    });
    expect(
      await createBillingPortalSession(
        { appId: "app_billing", flow: "payment_method_update" },
        context,
      ),
    ).toMatchObject({
      success: true,
      data: { url: "https://checkout.stripe.test/existing" },
    });
    expect(createCheckout).not.toHaveBeenCalled();
  });

  test("expires a Checkout from a different page before replacing it", async () => {
    listSubscriptions.mockReturnValue({ async *[Symbol.asyncIterator]() {} });
    listSessions.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield {
          id: "cs_old",
          mode: "subscription",
          status: "open",
          metadata: { referenceId: "org_billing" },
          success_url: "https://orvo.test/old",
        };
      },
    });
    await createBillingPortalSession(
      { appId: "app_billing", flow: "payment_method_update" },
      context,
    );
    expect(expireCheckout).toHaveBeenCalledWith("cs_old");
    expect(createCheckout).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: expect.stringMatching(
        /^orvo-paid-checkout-org_billing-cs_old-[a-f0-9]{64}$/,
      ),
    });
  });

  test("does not race a completed Checkout whose subscription list is stale", async () => {
    listSubscriptions.mockReturnValue({ async *[Symbol.asyncIterator]() {} });
    listSessions.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield {
          mode: "subscription",
          status: "complete",
          subscription: "sub_new",
          metadata: { referenceId: "org_billing" },
        };
      },
    });
    retrieveSubscription.mockResolvedValue({ status: "active" });
    expect(
      (
        await createBillingPortalSession(
          { appId: "app_billing", flow: "payment_method_update" },
          context,
        )
      ).success,
    ).toBe(false);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  test("retries identical Checkout requests with the same key and changes it with the return page", async () => {
    listSubscriptions.mockReturnValue({ async *[Symbol.asyncIterator]() {} });
    const input = {
      appId: "app_billing",
      flow: "payment_method_update" as const,
    };
    await createBillingPortalSession(input, context);
    await createBillingPortalSession(input, context);
    await createBillingPortalSession(
      { ...input, returnPath: "/a/app_billing/logs" },
      context,
    );
    expect(createCheckout.mock.calls[0]![1].idempotencyKey).toBe(
      createCheckout.mock.calls[1]![1].idempotencyKey,
    );
    expect(createCheckout.mock.calls[0]![1].idempotencyKey).not.toBe(
      createCheckout.mock.calls[2]![1].idempotencyKey,
    );
  });

  test("includes only the overages the organization has enabled", async () => {
    findOrganization.mockResolvedValue({
      stripeCustomerId: "cus_billing",
      usage: { ingestOverageEnabled: true, scoutOverageEnabled: false },
    });
    listSubscriptions.mockReturnValue({ async *[Symbol.asyncIterator]() {} });
    await createBillingPortalSession(
      { appId: "app_billing", flow: "payment_method_update" },
      context,
    );
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          { price: "price_pro", quantity: 1 },
          { price: "price_ingest" },
        ],
      }),
      expect.anything(),
    );
  });
});
