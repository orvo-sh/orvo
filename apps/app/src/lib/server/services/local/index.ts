import { timingSafeEqual } from "node:crypto";

import type { AlertRuleService } from "$lib/server/services/alert-rule";
import { and, eq, type DB } from "@repo/db";
import {
  app,
  ingestionKey,
  invitation,
  member,
  organization,
  organizationUsage,
  user,
} from "@repo/db/schema";
import { err, genId, generateRandomString, ok } from "@repo/utils";
import { ne } from "drizzle-orm";

import { initializeLocalInputSchema } from "./schema";

const legacyLocalEmail = "local@orvo.sh";
let setupReservation: { email: string; expiresAt: number } | null = null;

class LocalService {
  constructor(
    private db: DB,
    private alertRuleService: AlertRuleService,
    private setupToken: string,
  ) {}

  async isClaimed() {
    const [owner] = await this.db
      .select({ id: member.id })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(and(eq(member.role, "owner"), ne(user.email, legacyLocalEmail)))
      .limit(1);
    return Boolean(owner);
  }

  isSetupTokenValid(value: string) {
    if (!value || !this.setupToken) return false;

    const expected = Buffer.from(this.setupToken);
    const actual = Buffer.from(value);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  async getInvitation(id: string) {
    const value = await this.db.query.invitation.findFirst({
      where: and(eq(invitation.id, id), eq(invitation.status, "pending")),
      with: { organization: true },
    });

    if (!value || value.expiresAt <= new Date()) return null;
    return value;
  }

  async authorizeSignup(input: {
    email: string;
    setupToken?: string;
    invitationId?: string;
  }) {
    if (!(await this.isClaimed())) {
      if (!input.setupToken || !this.isSetupTokenValid(input.setupToken)) {
        return false;
      }

      const email = input.email.trim().toLowerCase();
      if (setupReservation && setupReservation.expiresAt > Date.now()) {
        return setupReservation.email === email;
      }

      setupReservation = { email, expiresAt: Date.now() + 5 * 60_000 };
      return true;
    }

    if (!input.invitationId) return false;
    const pendingInvitation = await this.getInvitation(input.invitationId);
    return pendingInvitation?.email.toLowerCase() === input.email.toLowerCase();
  }

  async initializeOwner(input: unknown, context: { userId: string }) {
    const validated = initializeLocalInputSchema.safeParse(input);
    if (
      !validated.success ||
      !this.isSetupTokenValid(validated.data.setupToken)
    ) {
      return err("The setup link is invalid or has expired.");
    }

    const userId = context.userId;
    const owner = await this.db.query.user.findFirst({
      where: eq(user.id, userId),
    });
    if (!owner || owner.email === legacyLocalEmail) {
      return err("A valid signed-in user is required.");
    }

    const existingMembership = await this.db.query.member.findFirst({
      where: eq(member.userId, userId),
      with: { organization: true },
    });
    if (existingMembership) {
      const existingApp = await this.db.query.app.findFirst({
        where: eq(app.organizationId, existingMembership.organizationId),
      });
      return ok({
        organization: existingMembership.organization,
        app: existingApp,
      });
    }

    const [anotherOwner] = await this.db
      .select({ id: member.id })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(
        and(
          eq(member.role, "owner"),
          ne(member.userId, userId),
          ne(user.email, legacyLocalEmail),
        ),
      )
      .limit(1);
    if (anotherOwner) {
      return err("This Orvo Local installation has already been claimed.");
    }

    const result = await this.db.transaction(async (tx) => {
      const legacyUser = await tx.query.user.findFirst({
        where: eq(user.email, legacyLocalEmail),
      });
      const legacyMembership = legacyUser
        ? await tx.query.member.findFirst({
            where: eq(member.userId, legacyUser.id),
            with: { organization: true },
          })
        : null;

      const localOrganization =
        legacyMembership?.organization ??
        (
          await tx
            .insert(organization)
            .values({
              id: genId("org"),
              name: "Local",
              slug: `local-${generateRandomString(10).toLowerCase()}`,
              billingPlan: "starter",
              billingStatus: "active",
              updatedAt: new Date(),
            })
            .returning()
        )[0]!;
      await tx
        .update(organization)
        .set({ billingPlan: "starter", billingStatus: "active" })
        .where(eq(organization.id, localOrganization.id));

      await tx.insert(member).values({
        id: genId("memb"),
        organizationId: localOrganization.id,
        userId,
        role: "owner",
        createdAt: new Date(),
      });

      let localApp = await tx.query.app.findFirst({
        where: eq(app.organizationId, localOrganization.id),
      });
      if (!localApp) {
        [localApp] = await tx
          .insert(app)
          .values({
            id: genId("app"),
            organizationId: localOrganization.id,
            name: "Local",
            createdBy: userId,
            updatedBy: userId,
          })
          .returning();
      } else {
        [localApp] = await tx
          .update(app)
          .set({ createdBy: userId, updatedBy: userId })
          .where(eq(app.id, localApp.id))
          .returning();
      }

      if (
        !(await tx.query.organizationUsage.findFirst({
          where: eq(organizationUsage.organizationId, localOrganization.id),
        }))
      ) {
        await tx.insert(organizationUsage).values({
          id: genId("orgu"),
          organizationId: localOrganization.id,
          logsRetentionDays: 7,
          tracesRetentionDays: 7,
          metricsRetentionDays: 7,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date("9999-12-31T23:59:59.999Z"),
          ingestLimitBytes: 10_000_000_000_000,
        });
      }

      if (
        !(await tx.query.ingestionKey.findFirst({
          where: eq(ingestionKey.appId, localApp!.id),
        }))
      ) {
        await tx.insert(ingestionKey).values({
          id: genId("ingk"),
          appId: localApp!.id,
          name: "Default key",
          key: `ing_${generateRandomString(48)}`,
          createdBy: userId,
        });
      }

      const seededAlerts = await this.alertRuleService.seedDefaultAlertRules(
        { appId: localApp!.id, userId },
        tx,
      );
      if (!seededAlerts.success) throw new Error(seededAlerts.error);

      if (legacyUser) {
        await tx.delete(member).where(eq(member.userId, legacyUser.id));
      }

      return { organization: localOrganization, app: localApp };
    });
    setupReservation = null;
    return ok(result);
  }
}

export { LocalService };
export * from "./schema";
