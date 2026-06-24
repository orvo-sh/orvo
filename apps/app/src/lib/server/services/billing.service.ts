import { PLANS } from "$lib/constants";
import type { Auth } from "$lib/server/auth";
import type { Email } from "$lib/server/email";
import type { Subscription } from "@better-auth/stripe";
import type { DB } from "@repo/db";
import {
  member,
  organization,
  organizationUsage,
  subscription,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, desc, eq } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";

const BYTES_PER_GB = 1_000_000_000;
const billingSignals = ["logs", "metrics", "traces"] as const;
const billingStatusesWithAccess = ["active", "trialing"] as const;

type BillingSignal = (typeof billingSignals)[number];
type BillingPlanKey = "starter" | "pro" | "enterprise";
type BillingAccessStatus = (typeof billingStatusesWithAccess)[number];
type BillingPlan = {
  key: BillingPlanKey;
  name: string;
  priceLabel: string | null;
  retentionDays: Record<BillingSignal, number>;
  includedGbPerSignal: Record<BillingSignal, number>;
  overagePricePerGb: number | null;
};

class BillingService {
  constructor(
    private db: DB,
    private logger: Logger,
    private email: Email,
    private stripe: Stripe,
    private config: {
      starterPriceId: string;
      proPriceId: string;
      trialDays: number;
    },
  ) {
    this.logger = logger.child("BillingService");
  }

  async getBillingState(context: { organizationId: string }) {
    this.logger.info("getBillingState: getting organization billing state", {
      context,
    });

    try {
      const [organization, currentSubscription] = await Promise.all([
        this.db.query.organization.findFirst({
          columns: {
            billingPlan: true,
            billingStatus: true,
          },
          with: {
            usage: {
              columns: {
                createdAt: false,
                id: false,
                organizationId: false,
                updatedAt: false,
              },
            },
          },
          where: ({ id }, { eq }) => {
            return eq(id, context.organizationId);
          },
        }),
        this.getCurrentSubscription(context.organizationId),
      ]);

      if (!organization) return err("No organization found.");

      return ok({
        billingPlan: organization.billingPlan,
        billingStatus: organization.billingStatus,
        trialStart: currentSubscription?.trialStart ?? null,
        trialEnd: currentSubscription?.trialEnd ?? null,
        ...organization.usage,
      });
    } catch (error) {
      this.logger.error(
        "getBillingState: an error occured while getting billing state",
        error as Error,
      );
      return err("Failed to get billing state");
    }
  }

  async getOrganizationAccessState(context: { organizationId: string }) {
    this.logger.info(
      "getOrganizationAccessState: checking organization access",
      { context },
    );

    try {
      const [currentOrganization, currentSubscription] = await Promise.all([
        this.db.query.organization.findFirst({
          where: eq(organization.id, context.organizationId),
        }),
        this.getCurrentSubscription(context.organizationId),
      ]);

      return ok({
        hasAccess: billingStatusHasAccess(
          currentOrganization?.billingStatus ?? currentSubscription?.status,
        ),
        subscription: currentSubscription,
      });
    } catch (error) {
      this.logger.error(
        "getOrganizationAccessState: failed to check organization access",
        error as Error,
      );
      return err("Failed to check billing access.");
    }
  }

  async createBillingPortalSession(
    _contextInput: z.infer<typeof createBillingPortalInputSchema>,
    context: {
      organizationId: string;
      userId: string;
      headers: Headers;
      origin: string;
      authService: Auth;
    },
  ) {
    this.logger.info(
      "createBillingPortalSession: creating billing portal session",
      { context },
    );

    try {
      if (
        !(await this.isOrganizationOwner(
          context.organizationId,
          context.userId,
        ))
      ) {
        return err("Only organization owners can manage billing.");
      }

      const returnUrl = new URL("/settings/billing", context.origin).toString();
      const result = await (context.authService.api as any).createBillingPortal(
        {
          body: {
            customerType: "organization",
            referenceId: context.organizationId,
            returnUrl,
            disableRedirect: true,
          },
          headers: context.headers,
        },
      );

      const portalUrl = readRedirectUrl(result);
      if (!portalUrl) {
        return err("Failed to open billing management.");
      }

      return ok({ url: portalUrl });
    } catch (error) {
      this.logger.error(
        "createBillingPortalSession: failed to create billing portal session",
        error as Error,
      );
      return err("Failed to open billing management.");
    }
  }

  async updateBillingEmail(
    input: z.infer<typeof updateBillingEmailInputSchema>,
    context: { organizationId: string; userId: string },
  ) {
    this.logger.info("updateBillingEmail: updating billing email", {
      input,
      context,
    });

    const validated = updateBillingEmailInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      if (
        !(await this.isOrganizationOwner(
          context.organizationId,
          context.userId,
        ))
      ) {
        return err("Only organization owners can manage billing.");
      }

      return err("Billing email updates are not available yet.");
    } catch (error) {
      this.logger.error(
        "updateBillingEmail: failed to update billing email",
        error as Error,
      );
      return err("Failed to update billing email.");
    }
  }

  async startFreeTrial(
    input: z.infer<typeof startFreeTrialInputSchema>,
    context: { organizationId: string; userId: string },
  ) {
    this.logger.info("startFreeTrial: starting free trial", { input, context });

    const validated = startFreeTrialInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      if (
        !(await this.isOrganizationOwner(
          context.organizationId,
          context.userId,
        ))
      ) {
        return err("Only organization owners can start a trial.");
      }

      const currentOrganization = await this.db.query.organization.findFirst({
        where: eq(organization.id, context.organizationId),
      });

      if (!currentOrganization) {
        return err("Organization not found.");
      }

      const currentSubscription = await this.getCurrentSubscription(
        context.organizationId,
      );

      if (
        currentSubscription &&
        ["trialing", "active", "past_due", "paused", "unpaid"].includes(
          currentSubscription.status,
        )
      ) {
        return err("This organization already has a subscription.");
      }

      let stripeCustomerId = currentOrganization.stripeCustomerId;
      if (!stripeCustomerId) {
        const stripeCustomer = await this.stripe.customers.create({
          name: currentOrganization.name,
          metadata: {
            organizationId: currentOrganization.id,
            customerType: "organization",
          },
        });

        stripeCustomerId = stripeCustomer.id;

        await this.db
          .update(organization)
          .set({ stripeCustomerId })
          .where(eq(organization.id, currentOrganization.id));
      }

      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: this.readStripePriceId(validated.data.plan) }],
        trial_period_days: this.config.trialDays,
        metadata: {
          userId: context.userId,
          referenceId: context.organizationId,
        },
        trial_settings: {
          end_behavior: {
            missing_payment_method: "cancel",
          },
        },
      });

      await this.syncStripeSubscriptionState({
        organizationId: context.organizationId,
        plan: validated.data.plan,
        stripeSubscription,
      });

      return ok({ id: stripeSubscription.id });
    } catch (error) {
      this.logger.error(
        "startFreeTrial: failed to start free trial",
        error as Error,
      );
      return err("Failed to start the free trial.");
    }
  }

  async onSubscriptionCreated(subscription: Subscription) {
    this.logger.info("onSubscriptionCreated: syncing subscription activation", {
      subscription,
    });

    try {
      if (!subscription.stripeSubscriptionId) {
        return err("Subscription is missing a Stripe subscription id.");
      }

      const stripeSubscription = await this.stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
      );

      await this.syncStripeSubscriptionState({
        organizationId: subscription.referenceId,
        plan: subscription.plan as "starter" | "pro",
        stripeSubscription,
      });

      return ok(null);
    } catch (error) {
      this.logger.error(
        "onSubscriptionCreated: failed to sync subscription",
        error as Error,
      );
      return err("Failed to activate subscription.");
    }
  }

  async onSubscriptonChanged(context: { organizationId: string }) {
    //TODO: get from stripe what the new subscription is and change whatever needs to change
    // reset limits
  }

  async onTrialExpired(context: { organizationId: string }) {
    //TODO: send an email to the owners telling them to bill. Change plan-status over to overdue too
  }

  async onSubscriptionDeleted(context: { organizationId: string }) {
    //TODO: do the things
  }

  private async isOrganizationOwner(organizationId: string, userId: string) {
    const currentMember = await this.db.query.member.findFirst({
      where: and(
        eq(member.organizationId, organizationId),
        eq(member.userId, userId),
      ),
    });

    return currentMember?.role === "owner";
  }

  private async getCurrentSubscription(organizationId: string) {
    const subscriptions = await this.db.query.subscription.findMany({
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
  }

  private async getVerifiedStripeSubscription(
    stripeCustomerId: string | null,
    stripeSubscriptionId: string | null,
  ) {
    if (stripeSubscriptionId) {
      const stripeSubscription =
        await this.stripe.subscriptions.retrieve(stripeSubscriptionId);

      if (
        stripeSubscription.status === "active" ||
        stripeSubscription.status === "trialing"
      ) {
        return stripeSubscription;
      }
    }

    if (!stripeCustomerId) {
      return null;
    }

    const stripeSubscriptions = await this.stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 10,
    });

    return (
      stripeSubscriptions.data.find(
        (candidate) =>
          candidate.status === "active" || candidate.status === "trialing",
      ) ?? null
    );
  }

  private async getBillingRecipients(
    organizationId: string,
    billingEmail: string | null,
  ) {
    const owners = await this.db.query.member.findMany({
      where: and(
        eq(member.organizationId, organizationId),
        eq(member.role, "owner"),
      ),
      with: {
        user: true,
      },
    });

    return [
      ...new Set([
        billingEmail,
        ...owners.map((owner) => owner.user?.email ?? null),
      ]),
    ].filter((email): email is string => typeof email === "string");
  }

  private readStripePriceId(plan: "starter" | "pro") {
    return plan === "starter"
      ? this.config.starterPriceId
      : this.config.proPriceId;
  }

  private async syncStripeSubscriptionState(context: {
    organizationId: string;
    plan: "starter" | "pro";
    stripeSubscription: Stripe.Subscription;
  }) {
    const plan = {
      starter: PLANS.starter,
      pro: PLANS.pro,
    }[context.plan];

    const periodStart = readStripeSubscriptionPeriodStart(
      context.stripeSubscription,
    );
    const periodEnd = readStripeSubscriptionPeriodEnd(
      context.stripeSubscription,
    );
    const fallbackStart =
      context.stripeSubscription.trial_start ?? Math.floor(Date.now() / 1000);
    const fallbackEnd =
      context.stripeSubscription.trial_end ??
      addDays(new Date(), this.config.trialDays).getTime() / 1000;

    await this.db.transaction(async (tx) => {
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

      const currentOrganizationUsage =
        await tx.query.organizationUsage.findFirst({
          where: eq(organizationUsage.organizationId, context.organizationId),
        });

      const organizationUsageValues = {
        logsRetentionDays: plan.retentionDays.logs,
        tracesRetentionDays: plan.retentionDays.traces,
        metricsRetentionDays: plan.retentionDays.metrics,
        currentPeriodStart: new Date((periodStart ?? fallbackStart) * 1000),
        currentPeriodEnd: new Date((periodEnd ?? fallbackEnd) * 1000),
        ingestLimitBytes: plan.ingestLimitBytes,
      };

      if (currentOrganizationUsage) {
        await tx
          .update(organizationUsage)
          .set(organizationUsageValues)
          .where(eq(organizationUsage.organizationId, context.organizationId));
      } else {
        await tx.insert(organizationUsage).values({
          id: genId("orgu"),
          organizationId: context.organizationId,
          ...organizationUsageValues,
        });
      }
    });
  }
}

const getBillingStateInputSchema = z.object({});

const createBillingPortalInputSchema = z.object({});

const startFreeTrialInputSchema = z.object({
  plan: z.enum(["starter", "pro"]),
});

const updateBillingEmailInputSchema = z.object({
  billingEmail: z.string().trim().email().max(255),
});

const queueBillingNotificationInputSchema = z.object({
  kind: z.string().trim().min(1).max(64),
  payload: z.record(z.string(), z.string()),
});

const billingStatusHasAccess = (
  status: string | null | undefined,
): status is BillingAccessStatus =>
  typeof status === "string" &&
  (billingStatusesWithAccess as readonly string[]).includes(status);

const readUsageBytes = (
  usage: Awaited<ReturnType<DB["query"]["organizationUsage"]["findFirst"]>>,
  signal: BillingSignal,
) => {
  if (!usage) return 0;
  if (signal === "logs") return usage.logsIngestedBytes;
  if (signal === "metrics") return usage.metricsIngestedBytes;
  return usage.tracesIngestedBytes;
};

const readRetentionDays = (
  usage: Awaited<ReturnType<DB["query"]["organizationUsage"]["findFirst"]>>,
  signal: BillingSignal,
) => {
  if (!usage) return 0;
  if (signal === "logs") return usage.logsRetentionDays;
  if (signal === "metrics") return usage.metricsRetentionDays;
  return usage.tracesRetentionDays;
};

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

const buildBillingEmail = (
  kind: string,
  payload: Record<string, string>,
  organizationName: string,
):
  | {
      subject: string;
      template: "billing-subscription-completed";
      props: {
        organizationName: string;
        planName: string;
      };
    }
  | {
      subject: string;
      template: "billing-trial-started";
      props: {
        organizationName: string;
        trialEnd: string;
      };
    }
  | {
      subject: string;
      template: "billing-trial-will-end";
      props: {
        organizationName: string;
        trialEnd: string;
      };
    }
  | {
      subject: string;
      template: "billing-trial-expired";
      props: {
        organizationName: string;
      };
    }
  | null => {
  switch (kind) {
    case "trial_started":
      return {
        subject: `${organizationName} trial started`,
        template: "billing-trial-started" as const,
        props: {
          organizationName,
          trialEnd: formatDate(payload.trialEnd),
        },
      };
    case "subscription_completed":
      return {
        subject: `${organizationName} subscription confirmed`,
        template: "billing-subscription-completed" as const,
        props: {
          organizationName,
          planName: payload.planName ?? "paid",
        },
      };
    case "trial_will_end":
      return {
        subject: `${organizationName} trial ends soon`,
        template: "billing-trial-will-end" as const,
        props: {
          organizationName,
          trialEnd: formatDate(payload.trialEnd),
        },
      };
    case "trial_expired":
      return {
        subject: `${organizationName} trial ended`,
        template: "billing-trial-expired" as const,
        props: {
          organizationName,
        },
      };
    default:
      return null;
  }
};

const formatDate = (value: string | undefined) => {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleDateString();
};

export {
  BillingService,
  createBillingPortalInputSchema,
  getBillingStateInputSchema,
  queueBillingNotificationInputSchema,
  startFreeTrialInputSchema,
  updateBillingEmailInputSchema,
};
