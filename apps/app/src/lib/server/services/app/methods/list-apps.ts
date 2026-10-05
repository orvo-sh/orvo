import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { app, member, memberAppAccess } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, asc, eq } from "drizzle-orm";

const createListApps =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (context: { organizationId: string; userId: string }) => {
    try {
      const membership = await db.query.member.findFirst({
        columns: { id: true, appAccessMode: true },
        where: and(
          eq(member.organizationId, context.organizationId),
          eq(member.userId, context.userId),
        ),
      });
      if (!membership) return ok({ apps: [] });

      if (membership.appAccessMode !== "all") {
        const rows = await db
          .select({ app })
          .from(app)
          .innerJoin(memberAppAccess, eq(memberAppAccess.appId, app.id))
          .where(
            and(
              eq(app.organizationId, context.organizationId),
              eq(memberAppAccess.memberId, membership.id),
            ),
          )
          .orderBy(asc(app.createdAt), asc(app.name));
        return ok({ apps: rows.map((row) => row.app) });
      }

      const apps = await db.query.app.findMany({
        where: eq(app.organizationId, context.organizationId),
        orderBy: [asc(app.createdAt), asc(app.name)],
      });

      return ok({ apps });
    } catch (error) {
      recordError(error);
      logger.error("Failed to load apps", error as Error);
      return err("Failed to load apps.");
    }
  };

export { createListApps };
