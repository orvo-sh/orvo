import type { DB } from "@repo/db";
import { organization } from "@repo/db/schema";
import { eq } from "drizzle-orm";

const createOnSubscriptionDeleted =
  ({ db }: { db: DB }) =>
  async (context: { organizationId: string }) => {
    await db
      .update(organization)
      .set({ billingStatus: "past_due" })
      .where(eq(organization.id, context.organizationId));
  };

export { createOnSubscriptionDeleted };
