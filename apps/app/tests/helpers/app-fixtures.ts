import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "@repo/db";
import { genId } from "@repo/utils";
import { organization, app } from "@repo/db/schema";
import type { DB } from "@repo/db";

const clients = new Map<string, ReturnType<typeof postgres>>();

const getTestDb = (url: string): DB => {
  let client = clients.get(url);
  if (!client) {
    client = postgres(url);
    clients.set(url, client);
  }
  return drizzle(client, { schema });
};

const createOrganization = async (
  db: DB,
  overrides: Partial<typeof organization.$inferInsert> = {},
) => {
  const id = overrides.id ?? genId("org");
  const values = {
    id,
    name: overrides.name ?? `Test org ${id}`,
    slug: overrides.slug ?? `test-org-${id}`,
    logo: overrides.logo ?? null,
    stripeCustomerId: overrides.stripeCustomerId ?? null,
    billingPlan: overrides.billingPlan ?? "starter",
    billingStatus: overrides.billingStatus ?? "active",
  };

  const [created] = await db.insert(organization).values(values).returning();
  return created;
};

const createApp = async (
  db: DB,
  input: Partial<typeof app.$inferInsert> & { organizationId: string },
) => {
  const id = input.id ?? genId("app");
  const values = {
    id,
    organizationId: input.organizationId,
    name: input.name ?? `Test app ${id}`,
    createdBy: input.createdBy ?? null,
    updatedBy: input.updatedBy ?? null,
  };

  const [created] = await db.insert(app).values(values).returning();
  return created;
};

export { createApp, createOrganization, getTestDb };
