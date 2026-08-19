import { PLANS } from "$lib/constants";
import { eq, sql, type DB } from "@repo/db";
import { organization, scoutCreditGrant } from "@repo/db/schema";
import { genId } from "@repo/utils";

const SCOUT_CREDIT_POLICY_VERSION = 1;

const calculateScoutCredits = (usage: {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}) =>
  Math.max(
    1,
    Math.ceil(
      usage.totalTokens ??
        Math.max(0, usage.inputTokens ?? 0) +
          Math.max(0, usage.outputTokens ?? 0),
    ),
  );

const allocateScoutCredits = (
  grants: Array<{ id: string; remainingCredits: number }>,
  credits: number,
) => {
  let remaining = Math.max(0, credits);
  const allocations = [] as Array<{ grantId: string; credits: number }>;

  for (const grant of grants) {
    if (remaining <= 0) break;
    const allocatedCredits = Math.min(
      Math.max(0, grant.remainingCredits),
      remaining,
    );
    if (allocatedCredits <= 0) continue;
    allocations.push({ grantId: grant.id, credits: allocatedCredits });
    remaining -= allocatedCredits;
  }

  return { allocations, unfundedCredits: remaining };
};

const createEnsurePlanGrant =
  ({ db }: { db: DB }) =>
  async (organizationId: string) => {
    const currentOrganization = await db.query.organization.findFirst({
      columns: {
        billingPlan: true,
      },
      with: {
        usage: {
          columns: {
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        },
      },
      where: eq(organization.id, organizationId),
    });

    if (
      !currentOrganization?.usage ||
      !currentOrganization.billingPlan ||
      currentOrganization.billingPlan === "enterprise" ||
      currentOrganization.usage.currentPeriodEnd.getTime() <= Date.now()
    ) {
      return;
    }

    const allowance =
      PLANS[currentOrganization.billingPlan].scoutCreditsPerPeriod;
    const sourceReference = `plan:${organizationId}:${currentOrganization.usage.currentPeriodStart.toISOString()}`;

    await db
      .insert(scoutCreditGrant)
      .values({
        id: genId("scoutg"),
        organizationId,
        source: "plan",
        sourceReference,
        grantedCredits: allowance,
        remainingCredits: allowance,
        validFrom: currentOrganization.usage.currentPeriodStart,
        expiresAt: currentOrganization.usage.currentPeriodEnd,
      })
      .onConflictDoUpdate({
        target: [
          scoutCreditGrant.organizationId,
          scoutCreditGrant.sourceReference,
        ],
        set: {
          grantedCredits: allowance,
          remainingCredits: sql`greatest(${scoutCreditGrant.remainingCredits} + ${allowance} - ${scoutCreditGrant.grantedCredits}, 0)`,
          validFrom: currentOrganization.usage.currentPeriodStart,
          expiresAt: currentOrganization.usage.currentPeriodEnd,
          updatedAt: new Date(),
        },
      });
  };

export {
  allocateScoutCredits,
  calculateScoutCredits,
  createEnsurePlanGrant,
  SCOUT_CREDIT_POLICY_VERSION,
};
