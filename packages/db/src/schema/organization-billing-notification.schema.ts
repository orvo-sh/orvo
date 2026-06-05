import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { organization } from './organization.schema.js';

const organizationBillingNotification = pgTable(
  'organization_billing_notification',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    status: text('status').default('pending').notNull(),
    payload: text('payload').notNull(),
    attemptCount: integer('attempt_count').default(0).notNull(),
    nextAttemptAt: timestamp('next_attempt_at').defaultNow().notNull(),
    sentAt: timestamp('sent_at'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('organization_billing_notification_status_idx').on(table.status),
    index('organization_billing_notification_next_attempt_at_idx').on(table.nextAttemptAt),
    index('organization_billing_notification_organization_id_idx').on(table.organizationId)
  ]
);

const organizationBillingNotificationRelations = relations(
  organizationBillingNotification,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationBillingNotification.organizationId],
      references: [organization.id]
    })
  })
);

export { organizationBillingNotification, organizationBillingNotificationRelations };
