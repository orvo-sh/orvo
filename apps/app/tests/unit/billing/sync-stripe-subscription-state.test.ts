import { createSyncStripeSubscriptionState } from "$lib/server/services/billing/shared";
import { describe, expect, test, vi } from "vitest";

describe("createSyncStripeSubscriptionState", () => {
  test("upserts the Stripe subscription and aligns organization billing state", async () => {
    const subscriptionValues = vi.fn();
    const subscriptionUpsert = vi.fn();
    const organizationUpdates: Record<string, unknown>[] = [];
    const usageUpdates: Record<string, unknown>[] = [];
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn((values) => {
          subscriptionValues(values);
          return { onConflictDoUpdate: subscriptionUpsert };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values) => {
          const updates = values.currentPeriodStart
            ? usageUpdates
            : organizationUpdates;
          updates.push(values);
          return { where: vi.fn().mockResolvedValue(undefined) };
        }),
      })),
      query: {
        organizationUsage: {
          findFirst: vi.fn().mockResolvedValue({
            currentPeriodStart: new Date("2026-06-06T07:44:55.000Z"),
          }),
        },
      },
    };
    const sync = createSyncStripeSubscriptionState({
      db: {
        transaction: vi.fn((operation) => operation(tx)),
      } as never,
      config: { trialDays: 14 },
    });

    await sync({
      organizationId: "org_cartlane",
      plan: "pro",
      stripeSubscription: {
        id: "sub_cartlane",
        customer: "cus_cartlane",
        status: "trialing",
        trial_start: 1_788_767_095,
        trial_end: 1_789_976_695,
        cancel_at_period_end: false,
        cancel_at: null,
        canceled_at: null,
        ended_at: null,
        schedule: null,
        items: {
          data: [
            {
              current_period_start: 1_788_767_095,
              current_period_end: 1_789_976_695,
              quantity: 1,
              price: { recurring: { interval: "month" } },
            },
          ],
        },
      } as never,
    });

    expect(subscriptionValues).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: "org_cartlane",
        stripeCustomerId: "cus_cartlane",
        stripeSubscriptionId: "sub_cartlane",
        status: "trialing",
        periodEnd: new Date(1_789_976_695 * 1_000),
        trialEnd: new Date(1_789_976_695 * 1_000),
      }),
    );
    expect(subscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.anything(),
        set: expect.objectContaining({ status: "trialing" }),
      }),
    );
    expect(organizationUpdates).toEqual([
      { billingPlan: "pro", billingStatus: "trialing" },
    ]);
    expect(usageUpdates[0]).toMatchObject({
      currentPeriodStart: new Date(1_788_767_095 * 1_000),
      currentPeriodEnd: new Date(1_789_976_695 * 1_000),
      logsIngestedBytes: 0,
      stripeIngestBytesReported: 0,
    });
  });
});
