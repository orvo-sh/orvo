import { createCreateBillingPortalSession } from "$lib/server/services/billing/methods/create-billing-portal-session";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createCreateBillingPortalSession", () => {
  const findApp = vi.fn();
  const createBillingPortal = vi.fn();
  const createBillingPortalSession = createCreateBillingPortalSession({
    db: {
      query: { app: { findFirst: findApp } },
    } as never,
    logger: { error: vi.fn() } as never,
    isOrganizationOwner: vi.fn().mockResolvedValue(true),
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
    findApp.mockResolvedValue({ id: "app_billing" });
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
});
