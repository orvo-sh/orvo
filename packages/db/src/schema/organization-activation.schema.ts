import { relations } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { organization } from './organization.schema.js';

const organizationActivation = pgTable('organization_activation', {
  organizationId: text('organization_id')
    .primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  hasViewedTelemetry: boolean('has_viewed_telemetry').default(false).notNull(),
  hasCreatedFirstAlert: boolean('has_created_first_alert').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
    .notNull()
});

const organizationActivationRelations = relations(organizationActivation, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationActivation.organizationId],
    references: [organization.id]
  })
}));

export { organizationActivation, organizationActivationRelations };
