import { isNotNull, relations, sql } from 'drizzle-orm';
import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { heartbeatMonitorDestination } from './index.js';
import { user } from './user.schema.js';

const notificationDestinationKind = pgEnum('notification_destination_kind', [
  'webhook',
  'email',
  'slack'
]);

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
    slackTeamId: text('slack_team_id'),
    slackTeamName: text('slack_team_name'),
    slackChannelId: text('slack_channel_id'),
    slackChannelName: text('slack_channel_name'),
    slackWebhookUrlEncrypted: text('slack_webhook_url_encrypted'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex('notification_destination_one_slack_per_app_uidx')
      .on(table.appId)
      .where(isNotNull(table.slackTeamId))
  ]
);

const notificationDestinationRelations = relations(notificationDestination, ({ many }) => ({
  heartbeatMonitors: many(heartbeatMonitorDestination)
}));

export { notificationDestination, notificationDestinationKind, notificationDestinationRelations };
