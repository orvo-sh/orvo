import { createCompleteBillingFlow } from "$lib/server/services/billing/methods/complete-billing-flow";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("complete billing recovery", () => {
  const findApp = vi.fn();
  const isOrganizationOwner = vi.fn();
  const reconcileSubscriptions = vi.fn();
  const getCurrentSubscription = vi.fn();
  const retrieveSubscription = vi.fn();
  const retrieveCustomer = vi.fn();
  const updateSubscription = vi.fn();
  const updateInvoice = vi.fn();
  const complete = createCompleteBillingFlow({
    db: { query: { app: { findFirst: findApp } } } as never,
    logger: { error: vi.fn() } as never,
    stripe: {
      customers: { retrieve: retrieveCustomer },
      subscriptions: {
        retrieve: retrieveSubscription,
        update: updateSubscription,
      },
      invoices: { update: updateInvoice },
    } as never,
    isOrganizationOwner,
    reconcileSubscriptions,
    getCurrentSubscription,
  });
  const input = {
    appId: "app_billing",
    returnPath: "/a/app_billing/logs?search=error#details",
  };
  const context = {
    organizationId: "org_billing",
    userId: "usr_owner",
    origin: "https://orvo.test",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    findApp.mockResolvedValue({ id: "app_billing" });
    isOrganizationOwner.mockResolvedValue(true);
    reconcileSubscriptions.mockResolvedValue(undefined);
    getCurrentSubscription.mockResolvedValue({
      status: "active",
      stripeSubscriptionId: "sub_new",
    });
  });

  test("reconciles Stripe before returning to the original page even without a webhook", async () => {
    expect(await complete(input, context)).toEqual({
      success: true,
      data: {
        url: "https://orvo.test/a/app_billing/logs?search=error#details",
      },
    });
    expect(reconcileSubscriptions).toHaveBeenCalledWith({
      organizationId: "org_billing",
    });
    expect(reconcileSubscriptions.mock.invocationCallOrder[0]).toBeLessThan(
      getCurrentSubscription.mock.invocationCallOrder[0]!,
    );
  });

  test.each(["past_due", "unpaid", "incomplete"])(
    "collects the existing invoice for a %s subscription",
    async (status) => {
      getCurrentSubscription.mockResolvedValue({
        status,
        stripeSubscriptionId: "sub_existing",
      });
      retrieveSubscription.mockResolvedValue({
        latest_invoice: {
          status: "open",
          hosted_invoice_url: "https://invoice.stripe.test/pay",
        },
      });
      expect(await complete(input, context)).toEqual({
        success: true,
        data: { url: "https://invoice.stripe.test/pay" },
      });
      expect(retrieveSubscription).toHaveBeenCalledWith("sub_existing", {
        expand: ["latest_invoice"],
      });
    },
  );

  test("does not claim payment succeeded when Stripe cannot be verified", async () => {
    reconcileSubscriptions.mockRejectedValue(new Error("Stripe unavailable"));
    expect((await complete(input, context)).success).toBe(false);
    expect(getCurrentSubscription).not.toHaveBeenCalled();
  });

  test("uses the newly saved customer card for the subscription and existing invoice", async () => {
    getCurrentSubscription.mockResolvedValue({
      status: "past_due",
      stripeSubscriptionId: "sub_existing",
      stripeCustomerId: "cus_billing",
    });
    retrieveCustomer.mockResolvedValue({
      invoice_settings: { default_payment_method: "pm_new" },
    });
    retrieveSubscription.mockResolvedValue({
      latest_invoice: {
        id: "in_existing",
        status: "open",
        hosted_invoice_url: "https://invoice.stripe.test/pay",
      },
    });
    expect(
      (await complete({ ...input, paymentMethodUpdated: true }, context))
        .success,
    ).toBe(true);
    expect(updateSubscription).toHaveBeenCalledWith("sub_existing", {
      default_payment_method: "pm_new",
    });
    expect(updateInvoice).toHaveBeenCalledWith("in_existing", {
      default_payment_method: "pm_new",
    });
  });

  test("does not overwrite the payment method selected in paid Checkout", async () => {
    await complete(input, context);
    expect(retrieveCustomer).not.toHaveBeenCalled();
    expect(updateSubscription).not.toHaveBeenCalled();
  });

  test("leaves Managed Payments card updates to the portal", async () => {
    getCurrentSubscription.mockResolvedValue({
      status: "past_due",
      stripeSubscriptionId: "sub_managed",
      stripeCustomerId: "cus_billing",
    });
    retrieveSubscription.mockResolvedValue({
      managed_payments: { enabled: true },
      latest_invoice: {
        id: "in_managed",
        status: "open",
        hosted_invoice_url: "https://invoice.stripe.test/pay",
      },
    });
    expect(
      await complete({ ...input, paymentMethodUpdated: true }, context),
    ).toEqual({
      success: true,
      data: { url: "https://invoice.stripe.test/pay" },
    });
    expect(retrieveCustomer).not.toHaveBeenCalled();
    expect(updateSubscription).not.toHaveBeenCalled();
    expect(updateInvoice).not.toHaveBeenCalled();
  });

  test("a canceled subscription stays canceled after saving a card", async () => {
    getCurrentSubscription.mockResolvedValue({ status: "canceled" });
    expect((await complete(input, context)).success).toBe(true);
    expect(retrieveSubscription).not.toHaveBeenCalled();
  });

  test("rejects non-owners before reconciliation", async () => {
    isOrganizationOwner.mockResolvedValue(false);
    expect((await complete(input, context)).success).toBe(false);
    expect(reconcileSubscriptions).not.toHaveBeenCalled();
  });

  test("rejects another app and external return paths", async () => {
    findApp.mockResolvedValue(undefined);
    expect((await complete(input, context)).success).toBe(false);
    findApp.mockResolvedValue({ id: "app_billing" });
    expect(
      (await complete({ ...input, returnPath: "//example.com" }, context))
        .success,
    ).toBe(false);
    expect(reconcileSubscriptions).not.toHaveBeenCalled();
  });
});
