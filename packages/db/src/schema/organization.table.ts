import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

const organization = pgTable(
  'organization',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logo: text('logo'),
    stripeCustomerId: text('stripe_customer_id'),
    createdAt: timestamp('created_at').notNull(),
    metadata: text('metadata')
  },
  (table) => [uniqueIndex('organization_slug_uidx').on(table.slug)]
);

export { organization };
