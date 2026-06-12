import type { Auth } from "$lib/server/auth";
import type { Email } from "$lib/server/email";
import type { DB } from "@repo/db";
import {
  member,
  organization,
  organizationUsage,
  subscription,
  user,
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
type BillingPlanKey = "none" | "starter" | "pro" | "enterprise";
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
  private static plans = {
    none: {
      key: "none",
      name: "No plan",
      priceLabel: null,
      retentionDays: {
        logs: 0,
        metrics: 0,
        traces: 0,
      },
      includedGbPerSignal: {
        logs: 0,
        metrics: 0,
        traces: 0,
      },
      overagePricePerGb: null,
    },
    starter: {
      key: "starter",
      name: "Starter",
      priceLabel: "$19 / month",
      retentionDays: {
        logs: 14,
        metrics: 14,
        traces: 14,
      },
      includedGbPerSignal: {
        logs: 50,
        metrics: 50,
        traces: 50,
      },
      overagePricePerGb: null,
    },
    pro: {
      key: "pro",
      name: "Pro",
      priceLabel: "$49 / month",
      retentionDays: {
        logs: 30,
        metrics: 30,
        traces: 30,
      },
      includedGbPerSignal: {
        logs: 150,
        metrics: 150,
        traces: 150,
      },
      overagePricePerGb: 0.32,
    },
    enterprise: {
      key: "enterprise",
      name: "Enterprise",
      priceLabel: "Custom",
      retentionDays: {
        logs: 30,
        metrics: 30,
        traces: 30,
      },
      includedGbPerSignal: {
        logs: 0,
        metrics: 0,
        traces: 0,
      },
      overagePricePerGb: null,
    },
  } as const satisfies Record<BillingPlanKey, BillingPlan>;

  private static getIncludedBytesForPlan(
    planKey: BillingPlanKey,
    signal: BillingSignal,
  ) {
    return (
      BillingService.plans[planKey].includedGbPerSignal[signal] * BYTES_PER_GB
    );
  }

  private logger: Logger;

  constructor(
    private db: DB,
    logger: Logger,
    private email: Email,
    private stripeClient: Stripe,
  ) {
    this.logger = logger.child("BillingService");
  }

  getPlans() {
    return ok([
      BillingService.plans.starter,
      BillingService.plans.pro,
      BillingService.plans.enterprise,
    ]);
  }

  async getBillingState(context: { organizationId: string; userId: string }) {
    this.logger.info("getBillingState: fetching billing state", { context });

    try {
      const [isOwner, currentOrganization, currentSubscription, currentUsage] =
        await Promise.all([
          this.isOrganizationOwner(context.organizationId, context.userId),
          this.db.query.organization.findFirst({
            where: eq(organization.id, context.organizationId),
          }),
          this.getCurrentSubscription(context.organizationId),
          this.db.query.organizationUsage.findFirst({
            where: eq(organizationUsage.organizationId, context.organizationId),
          }),
        ]);

      const planKey = resolvePlanKey(
        currentOrganization?.billingPlan ?? currentSubscription?.plan,
        currentOrganization?.billingStatus ?? currentSubscription?.status,
      );
      const totalIncludedBytes =
        currentUsage?.ingestLimitBytes ??
        billingSignals.reduce(
          (total, signal) =>
            total + BillingService.getIncludedBytesForPlan(planKey, signal),
          0,
        );
      const usage = billingSignals.map((signal) => {
        const usedBytes = readUsageBytes(currentUsage, signal);
        const includedBytes =
          currentUsage?.ingestLimitBytes ??
          BillingService.getIncludedBytesForPlan(planKey, signal);
        const overageBytes = Math.max(usedBytes - includedBytes, 0);
        const usagePercent =
          includedBytes > 0
            ? Math.min(Math.round((usedBytes / includedBytes) * 100), 100)
            : 0;

        return {
          signal,
          includedBytes,
          usedBytes,
          overageBytes,
          usagePercent,
          retentionDays: readRetentionDays(currentUsage, signal),
        };
      });
      const totalUsedBytes = usage.reduce(
        (total, item) => total + item.usedBytes,
        0,
      );
      const totalOverageBytes = Math.max(totalUsedBytes - totalIncludedBytes, 0);
      const totalUsagePercent =
        totalIncludedBytes > 0
          ? Math.min(Math.round((totalUsedBytes / totalIncludedBytes) * 100), 100)
          : 0;

      return ok({
        isOwner,
        salesEmail: "team@orvo.sh",
        billingEmail: currentOrganization?.billingEmail ?? null,
        subscription: currentSubscription
          ? {
            plan: currentSubscription.plan,
            status: currentSubscription.status,
            trialStart: currentSubscription.trialStart,
            trialEnd: currentSubscription.trialEnd,
            periodStart: currentSubscription.periodStart,
            periodEnd: currentSubscription.periodEnd,
            cancelAtPeriodEnd: currentSubscription.cancelAtPeriodEnd,
          }
          : null,
        entitlements: {
          planKey,
          source: currentOrganization?.billingPlan ? "billing" : "default",
        },
        currentPeriod: currentUsage
          ? {
            start: currentUsage.currentPeriodStart,
            end: currentUsage.currentPeriodEnd,
          }
          : null,
        allowance: {
          includedBytes: totalIncludedBytes,
          usedBytes: totalUsedBytes,
          overageBytes: totalOverageBytes,
          usagePercent: totalUsagePercent,
        },
        plans: [
          BillingService.plans.starter,
          BillingService.plans.pro,
          BillingService.plans.enterprise,
        ],
        usage,
      });
    } catch (error) {
      this.logger.error(
        "getBillingState: failed to fetch billing state",
        error as Error,
      );
      return err("Failed to load billing state.");
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

  async onTrialExpired(context: { organizationId: string }) {
    //TODO: send an email to the owners telling them to bill. Change plan-status over to overdue too
  }

  async onSubscriptionCompleted(context: { organizationId: string }) {
    // TODO: send an email thanking the user and update the usage, reset any usage and set entitlements according to plan
    // use stripe client to check if indeed the org there actually completed the transaction. We dont trust webhooks.
  }

  async onSubscriptonChanged(context: { organizationId: string }) {
    //TODO: get from stripe what the new subscription is and change whatever needs to change
    // reset limits
  }

  async onSubscriptionDeleted(context: { organizationId: string }) {
    //TODO: do the things
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

      const currentOrganization = await this.db.query.organization.findFirst({
        where: eq(organization.id, context.organizationId),
      });
      if (!currentOrganization) {
        return err("Organization not found.");
      }

      await this.db
        .update(organization)
        .set({
          billingEmail: validated.data.billingEmail,
        })
        .where(eq(organization.id, context.organizationId));

      if (this.stripeClient && currentOrganization.stripeCustomerId) {
        await this.stripeClient.customers.update(
          currentOrganization.stripeCustomerId,
          {
            email: validated.data.billingEmail,
          },
        );
      }

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "updateBillingEmail: failed to update billing email",
        error as Error,
      );
      return err("Failed to update billing email.");
    }
  }

  async bootstrapOrganizationBillingState(context: {
    organizationId: string;
    userId: string;
  }) {
    this.logger.info(
      "bootstrapOrganizationBillingState: bootstrapping billing state",
      { context },
    );

    try {
      const [createdOrganization, createdByUser] = await Promise.all([
        this.db.query.organization.findFirst({
          where: eq(organization.id, context.organizationId),
        }),
        this.db.query.user.findFirst({
          where: eq(user.id, context.userId),
        }),
      ]);

      if (!createdOrganization || !createdByUser) return;

      await this.db
        .update(organization)
        .set({
          billingEmail: createdByUser.email,
        })
        .where(eq(organization.id, context.organizationId));

      await this.syncOrganizationUsageLimits({
        organizationId: context.organizationId,
        plan: "none",
        status: "inactive",
      });

      if (createdOrganization.stripeCustomerId) return;

      const stripeCustomer = await this.stripeClient.customers.create({
        name: createdOrganization.name,
        email: createdByUser.email,
        metadata: {
          organizationId: createdOrganization.id,
        },
      });

      await this.db
        .update(organization)
        .set({
          stripeCustomerId: stripeCustomer.id,
        })
        .where(eq(organization.id, createdOrganization.id));
    } catch (error) {
      this.logger.error(
        "bootstrapOrganizationBillingState: failed to bootstrap billing state",
        error as Error,
      );
      throw error;
    }
  }

  async syncOrganizationUsageLimits(input: {
    organizationId: string;
    plan: string | null | undefined;
    status: string | null | undefined;
  }) {
    this.logger.info(
      "syncOrganizationUsageLimits: syncing organization usage limits",
      { input },
    );

    try {
      const planKey = resolvePlanKey(input.plan, input.status);
      const plan = BillingService.plans[planKey];
      const currentSubscription = await this.getCurrentSubscription(
        input.organizationId,
      );
      const currentPeriodStart = currentSubscription?.periodStart ?? new Date();
      const currentPeriodEnd =
        currentSubscription?.periodEnd ??
        currentSubscription?.trialEnd ??
        addDays(currentPeriodStart, 30);
      const ingestLimitBytes = billingSignals.reduce(
        (total, signal) =>
          total + BillingService.getIncludedBytesForPlan(planKey, signal),
        0,
      );

      await this.db
        .update(organization)
        .set({
          billingPlan: planKey === "none" ? null : planKey,
          billingStatus: resolveOrganizationBillingStatus(input.status),
        })
        .where(eq(organization.id, input.organizationId));

      await this.db
        .insert(organizationUsage)
        .values({
          id: genId("orgu"),
          organizationId: input.organizationId,
          logsRetentionDays: plan.retentionDays.logs,
          tracesRetentionDays: plan.retentionDays.traces,
          metricsRetentionDays: plan.retentionDays.metrics,
          currentPeriodStart,
          currentPeriodEnd,
          ingestLimitBytes,
        })
        .onConflictDoUpdate({
          target: organizationUsage.organizationId,
          set: {
            logsRetentionDays: plan.retentionDays.logs,
            tracesRetentionDays: plan.retentionDays.traces,
            metricsRetentionDays: plan.retentionDays.metrics,
            currentPeriodStart,
            currentPeriodEnd,
            ingestLimitBytes,
          },
        });
    } catch (error) {
      this.logger.error(
        "syncOrganizationUsageLimits: failed to sync organization usage limits",
        error as Error,
      );
      throw error;
    }
  }

  async queueNotification(
    input: z.infer<typeof queueBillingNotificationInputSchema>,
    context: { organizationId: string },
  ) {
    this.logger.info("queueNotification: sending billing notification", {
      input,
      context,
    });

    const validated = queueBillingNotificationInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      await this.sendBillingNotificationEmail(
        validated.data.kind,
        validated.data.payload,
        context,
      );

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "queueNotification: failed to send billing notification",
        error as Error,
      );
      return err("Failed to send billing notification.");
    }
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

  private async sendBillingNotificationEmail(
    kind: string,
    payload: Record<string, string>,
    context: { organizationId: string },
  ) {
    const [currentOrganization, owners] = await Promise.all([
      this.db.query.organization.findFirst({
        where: eq(organization.id, context.organizationId),
      }),
      this.db
        .select({
          email: user.email,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(member.organizationId, context.organizationId),
            eq(member.role, "owner"),
          ),
        ),
    ]);

    if (!currentOrganization) {
      return;
    }

    const recipients = new Set<string>();
    if (currentOrganization.billingEmail) {
      recipients.add(currentOrganization.billingEmail);
    }
    for (const owner of owners) {
      recipients.add(owner.email);
    }

    if (recipients.size === 0) {
      return;
    }

    const emailPayload = buildBillingEmail(
      kind,
      payload,
      currentOrganization.name,
    );
    if (!emailPayload) {
      return;
    }

    for (const recipient of recipients) {
      const { subject, ...templateInput } = emailPayload;
      await this.email.sendEmail({
        to: recipient,
        subject,
        ...templateInput,
      });
    }
  }
}

const getBillingStateInputSchema = z.object({});

const createBillingPortalInputSchema = z.object({});

const updateBillingEmailInputSchema = z.object({
  billingEmail: z.string().trim().email().max(255),
});

const queueBillingNotificationInputSchema = z.object({
  kind: z.string().trim().min(1).max(64),
  payload: z.record(z.string(), z.string()),
});

const resolvePlanKey = (
  plan: string | null | undefined,
  status: string | null | undefined,
): BillingPlanKey => {
  if (!billingStatusHasAccess(status)) {
    return "none";
  }

  return plan === "enterprise"
    ? "enterprise"
    : plan === "pro"
      ? "pro"
      : plan === "starter"
        ? "starter"
        : "none";
};

const resolveOrganizationBillingStatus = (
  status: string | null | undefined,
): "trialing" | "active" | "past_due" | null => {
  if (status === "trialing" || status === "active" || status === "past_due") {
    return status;
  }

  return null;
};

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
  updateBillingEmailInputSchema
};

