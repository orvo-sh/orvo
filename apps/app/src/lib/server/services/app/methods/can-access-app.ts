import type { DB } from "@repo/db";
import { app, member, memberAppAccess } from "@repo/db/schema";
import { and, eq } from "drizzle-orm";

const createCanAccessApp =
  (db: DB) =>
  async (input: { appId: string; organizationId: string; userId: string }) => {
    const membership = await db.query.member.findFirst({
      columns: { id: true, appAccessMode: true },
      where: and(
        eq(member.organizationId, input.organizationId),
        eq(member.userId, input.userId),
      ),
    });
    if (!membership) return false;

    const [targetApp] = await db
      .select({ id: app.id })
      .from(app)
      .where(
        and(
          eq(app.id, input.appId),
          eq(app.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!targetApp) return false;
  if (membership.appAccessMode === "all") return true;

    const [grant] = await db
      .select({ appId: memberAppAccess.appId })
      .from(memberAppAccess)
      .where(
        and(
          eq(memberAppAccess.memberId, membership.id),
          eq(memberAppAccess.appId, input.appId),
        ),
      )
      .limit(1);
    return Boolean(grant);
  };

export { createCanAccessApp };
