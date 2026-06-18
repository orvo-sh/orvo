import { relations, sql } from 'drizzle-orm';
import { boolean, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { heartbeatMonitorDestination } from './index.js';
import { user } from './user.schema.js';

const notificationDestinationKind = pgEnum('notification_destination_kind', ['webhook', 'email']);

const notificationDestination = pgTable(
  'notification_destination',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: notificationDestinationKind('kind').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(true),
    webhookUrl: text('webhook_url'),
    webhookHeadersEncrypted: text('webhook_headers_encrypted'),
    emailRecipients: text('email_recipients')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  }
);

const notificationDestinationRelations = relations(
  notificationDestination,
  ({ many }) => ({
    heartbeatMonitors: many(heartbeatMonitorDestination),
  }),
);

export { notificationDestination, notificationDestinationKind, notificationDestinationRelations };

