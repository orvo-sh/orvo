import { PLANS } from "$lib/constants";
import type { DB } from "@repo/db";
import {
  member,
  organization,
  organizationUsage,
  subscription,
} from "@repo/db/schema";
import { genId } from "@repo/utils";
import { and, desc, eq } from "drizzle-orm";
import Stripe from "stripe";

const billingStatusesWithAccess = ["active", "trialing"] as const;

type BillingAccessStatus = (typeof billingStatusesWithAccess)[number];

const billingStatusHasAccess = (
  status: string | null | undefined,
): status is BillingAccessStatus =>
  typeof status === "string" &&
  (billingStatusesWithAccess as readonly string[]).includes(status);

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const readStripeSubscriptionPeriodStart = (
  stripeSubscription: Stripe.Subscription,
) => {
  const currentPeriodStarts = stripeSubscription.items.data
    .map((item) => item.current_period_start)
    .filter((value): value is number => typeof value === "number");

  return currentPeriodStarts.length > 0
    ? Math.min(...currentPeriodStarts)
    : null;
};

const readStripeSubscriptionPeriodEnd = (
  stripeSubscription: Stripe.Subscription,
) => {
  const currentPeriodEnds = stripeSubscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");

  return currentPeriodEnds.length > 0 ? Math.max(...currentPeriodEnds) : null;
};

const readRedirectUrl = (result: unknown) => {
  if (typeof result !== "object" || result === null) {
    return null;
  }

  if ("url" in result && typeof result.url === "string") {
    return result.url;
  }

  if (
    "data" in result &&
    typeof result.data === "object" &&
    result.data !== null &&
    "url" in result.data &&
    typeof result.data.url === "string"
  ) {
    return result.data.url;
  }

  return null;
};

const createIsOrganizationOwner = ({
  db,
}: {
  db: DB;
}) => async (organizationId: string, userId: string) => {
  const currentMember = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, organizationId),
      eq(member.userId, userId),
    ),
  });

  return currentMember?.role === "owner";
};

const createGetCurrentSubscription = ({
  db,
}: {
  db: DB;
}) => async (organizationId: string) => {
  const subscriptions = await db.query.subscription.findMany({
    where: eq(subscription.referenceId, organizationId),
    orderBy: [desc(subscription.periodEnd), desc(subscription.trialEnd)],
  });

  return (
    subscriptions.find((candidate) =>
      [
        "active",
        "trialing",
        "paused",
        "past_due",
        "unpaid",
        "incomplete",
      ].includes(candidate.status),
    ) ??
    subscriptions[0] ??
    null
  );
};

const createReadStripePriceId = ({
  config,
}: {
  config: { starterPriceId: string; proPriceId: string };
}) => (plan: "starter" | "pro") =>
  plan === "starter" ? config.starterPriceId : config.proPriceId;

const createSyncStripeSubscriptionState = ({
  db,
  config,
}: {
  db: DB;
  config: { trialDays: number };
}) => async (context: {
  organizationId: string;
  plan: "starter" | "pro";
  stripeSubscription: Stripe.Subscription;
}) => {
  const plan = {
    starter: PLANS.starter,
    pro: PLANS.pro,
  }[context.plan];

  const periodStart = readStripeSubscriptionPeriodStart(
    context.stripeSubscription,
  );
  const periodEnd = readStripeSubscriptionPeriodEnd(context.stripeSubscription);
  const fallbackStart =
    context.stripeSubscription.trial_start ?? Math.floor(Date.now() / 1000);
  const fallbackEnd =
    context.stripeSubscription.trial_end ??
    addDays(new Date(), config.trialDays).getTime() / 1000;

  await db.transaction(async (tx) => {
    await tx
      .update(organization)
      .set({
        billingPlan: context.plan,
        billingStatus:
          context.stripeSubscription.status === "active"
            ? "active"
            : "trialing",
      })
      .where(eq(organization.id, context.organizationId));

    const currentOrganizationUsage = await tx.query.organizationUsage.findFirst({
      columns: { currentPeriodStart: true },
      where: eq(organizationUsage.organizationId, context.organizationId),
    });
    const newPeriodStart = new Date((periodStart ?? fallbackStart) * 1000);
    const periodChanged =
      currentOrganizationUsage?.currentPeriodStart.getTime() !==
      newPeriodStart.getTime();

    const organizationUsageValues = {
      logsRetentionDays: plan.retentionDays.logs,
      tracesRetentionDays: plan.retentionDays.traces,
      metricsRetentionDays: plan.retentionDays.metrics,
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: new Date((periodEnd ?? fallbackEnd) * 1000),
      ingestLimitBytes: plan.ingestLimitBytes,
      chatCreditsIncluded: plan.chatCreditsIncluded,
    };

    if (currentOrganizationUsage) {
      await tx
        .update(organizationUsage)
        .set({
          ...organizationUsageValues,
          ...(periodChanged
            ? {
                logsIngestedBytes: 0,
                tracesIngestedBytes: 0,
                metricsIngestedBytes: 0,
                chatCreditsUsed: 0,
                notified70At: null,
                notified85At: null,
                notified100At: null,
              }
            : {}),
        })
        .where(eq(organizationUsage.organizationId, context.organizationId));
    } else {
      await tx.insert(organizationUsage).values({
        id: genId("orgu"),
        organizationId: context.organizationId,
        ...organizationUsageValues,
      });
    }
  });
};

export {
  billingStatusHasAccess,
  createGetCurrentSubscription,
  createIsOrganizationOwner,
  createReadStripePriceId,
  createSyncStripeSubscriptionState,
  readRedirectUrl,
};
