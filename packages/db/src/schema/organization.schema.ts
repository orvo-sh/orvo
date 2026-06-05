import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { invitation } from './invitation.schema.js';
import { member } from './member.schema.js';

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

const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation)
}));

export { organization, organizationRelations };
