import { relations } from 'drizzle-orm';
import { pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { invitation } from './invitation.schema.js';
import { member } from './member.schema.js';
import { organizationActivation } from './organization-activation.schema.js';
import { organizationUsage } from './organization-usage.schema.js';

const billingPlan = pgEnum('billing_plan', ['starter', 'pro', 'enterprise']);
const billingStatus = pgEnum('billing_status', ['trialing', 'active', 'past_due']);

const organization = pgTable(
  'organization',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logo: text('logo'),
    stripeCustomerId: text('stripe_customer_id'),
    billingPlan: billingPlan('billing_plan'),
    billingStatus: billingStatus('billing_status'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [uniqueIndex('organization_slug_uidx').on(table.slug)]
);

const organizationRelations = relations(organization, ({ many, one }) => ({
  members: many(member),
  invitations: many(invitation),
  activation: one(organizationActivation, {
    fields: [organization.id],
    references: [organizationActivation.organizationId]
  }),
  usage: one(organizationUsage, {
    fields: [organization.id],
    references: [organizationUsage.organizationId]
  })
}));

export { billingPlan, billingStatus, organization, organizationRelations };
