import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { user } from './user.schema.js';

const alertWebhookDestination = pgTable(
  'alert_webhook_destination',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    headersEncrypted: text('headers_encrypted').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(true),
    lastTestedAt: timestamp('last_tested_at'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('alert_webhook_destination_app_id_idx').on(table.appId),
    index('alert_webhook_destination_created_by_idx').on(table.createdBy)
  ]
);

export { alertWebhookDestination };
