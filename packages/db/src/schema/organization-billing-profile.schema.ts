import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { organization } from './organization.schema.js';

const organizationBillingProfile = pgTable('organization_billing_profile', {
  organizationId: text('organization_id')
    .primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  billingEmail: text('billing_email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
});

const organizationBillingProfileRelations = relations(organizationBillingProfile, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationBillingProfile.organizationId],
    references: [organization.id]
  })
}));

export { organizationBillingProfile, organizationBillingProfileRelations };
