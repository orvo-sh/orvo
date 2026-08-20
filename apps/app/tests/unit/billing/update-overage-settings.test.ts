import { createUpdateOverageSettings } from "$lib/server/services/billing/methods/update-overage-settings";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createUpdateOverageSettings", () => {
  const findOrganization = vi.fn();
  const returning = vi.fn();
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const isOrganizationOwner = vi.fn();
  const updateOverageSettings = createUpdateOverageSettings({
    db: {
      query: { organization: { findFirst: findOrganization } },
      update: vi.fn(() => ({ set })),
    } as never,
    logger: { error: vi.fn() } as never,
    isOrganizationOwner,
  });
  const input = {
    ingestOverageEnabled: true,
    ingestOverageBudgetCents: 2_500,
    scoutOverageEnabled: true,
    scoutOverageBudgetCents: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isOrganizationOwner.mockResolvedValue(true);
    findOrganization.mockResolvedValue({
      billingPlan: "pro",
      billingStatus: "active",
    });
    returning.mockResolvedValue([{ id: "orgu_billing" }]);
  });

  test("saves owner-controlled overage preferences", async () => {
    const result = await updateOverageSettings(input, {
      organizationId: "org_billing",
      userId: "usr_owner",
    });

    expect(result).toEqual({ success: true, data: null });
    expect(set).toHaveBeenCalledWith(input);
  });

  test("rejects non-owners", async () => {
    isOrganizationOwner.mockResolvedValue(false);

    const result = await updateOverageSettings(input, {
      organizationId: "org_billing",
      userId: "usr_member",
    });

    expect(result).toEqual({
      success: false,
      error: "Only organization owners can manage overages.",
    });
    expect(set).not.toHaveBeenCalled();
  });

  test("rejects trial subscriptions", async () => {
    findOrganization.mockResolvedValue({
      billingPlan: "pro",
      billingStatus: "trialing",
    });

    const result = await updateOverageSettings(input, {
      organizationId: "org_billing",
      userId: "usr_owner",
    });

    expect(result).toEqual({
      success: false,
      error: "Overages can only be enabled for an active Pro subscription.",
    });
    expect(set).not.toHaveBeenCalled();
  });
});
