import { relations, sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { chat } from './chat.schema.js';
import { organization } from './organization.schema.js';
import { user } from './user.schema.js';

const slackUserLink = pgTable(
  'slack_user_link',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull(),
    slackUserId: text('slack_user_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex('slack_user_link_team_user_uidx').on(table.teamId, table.slackUserId),
    index('slack_user_link_user_id_idx').on(table.userId)
  ]
);

const slackLinkState = pgTable(
  'slack_link_state',
  {
    stateHash: text('state_hash').primaryKey(),
    teamId: text('team_id').notNull(),
    slackUserId: text('slack_user_id').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [index('slack_link_state_expires_at_idx').on(table.expiresAt)]
);

const slackScoutThread = pgTable(
  'slack_scout_thread',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull(),
    channelId: text('channel_id').notNull(),
    threadTs: text('thread_ts').notNull(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('slack_scout_thread_location_uidx').on(
      table.teamId,
      table.channelId,
      table.threadTs
    ),
    uniqueIndex('slack_scout_thread_chat_id_uidx').on(table.chatId)
  ]
);

const slackEvent = pgTable(
  'slack_event',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [index('slack_event_created_at_idx').on(table.createdAt)]
);

const slackScoutThreadRelations = relations(slackScoutThread, ({ one }) => ({
  chat: one(chat, { fields: [slackScoutThread.chatId], references: [chat.id] }),
  app: one(app, { fields: [slackScoutThread.appId], references: [app.id] })
}));

export { slackEvent, slackLinkState, slackScoutThread, slackScoutThreadRelations, slackUserLink };
