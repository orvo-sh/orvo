import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { organization } from './organization.schema.js';
import { user } from './user.schema.js';

const app = pgTable(
  'app',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    logsFirstReceivedAt: timestamp('logs_first_received_at'),
    tracesFirstReceivedAt: timestamp('traces_first_received_at'),
    metricsFirstReceivedAt: timestamp('metrics_first_received_at'),
    heartbeatsFirstReceivedAt: timestamp('heartbeats_first_received_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('app_organization_id_idx').on(table.organizationId),
    index('app_created_by_idx').on(table.createdBy),
    uniqueIndex('app_org_name_uidx').on(table.organizationId, table.name)
  ]
);

const appRelations = relations(app, ({ one }) => ({
  organization: one(organization, {
    fields: [app.organizationId],
    references: [organization.id]
  }),
  createdByUser: one(user, {
    fields: [app.createdBy],
    references: [user.id]
  }),
  updatedByUser: one(user, {
    fields: [app.updatedBy],
    references: [user.id]
  })
}));

export { app, appRelations };
