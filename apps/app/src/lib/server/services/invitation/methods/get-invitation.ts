import type { DB } from "@repo/db";
import { and, eq } from "@repo/db";
import { invitation } from "@repo/db/schema";

const createGetInvitation = (db: DB) => async (id: string) => {
  const value = await db.query.invitation.findFirst({
    where: and(eq(invitation.id, id), eq(invitation.status, "pending")),
    with: { organization: true },
  });

  if (!value || value.expiresAt <= new Date()) return null;
  return value;
};

export { createGetInvitation };
