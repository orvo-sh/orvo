import { relations, sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { organization } from './organization.schema.js';
import { user } from './user.schema.js';

const assistantChat = pgTable(
  'assistant_chat',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New chat'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('assistant_chat_organization_id_idx').on(table.organizationId),
    index('assistant_chat_app_id_idx').on(table.appId),
    index('assistant_chat_created_by_idx').on(table.createdBy),
    index('assistant_chat_updated_at_idx').on(table.updatedAt)
  ]
);

const assistantMessage = pgTable(
  'assistant_message',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id')
      .notNull()
      .references(() => assistantChat.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    role: text('role').notNull(),
    content: text('content').notNull().default(''),
    parts: jsonb('parts')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('assistant_message_chat_id_idx').on(table.chatId),
    index('assistant_message_created_at_idx').on(table.createdAt)
  ]
);

const assistantChatRelations = relations(assistantChat, ({ many, one }) => ({
  app: one(app, {
    fields: [assistantChat.appId],
    references: [app.id]
  }),
  organization: one(organization, {
    fields: [assistantChat.organizationId],
    references: [organization.id]
  }),
  createdByUser: one(user, {
    fields: [assistantChat.createdBy],
    references: [user.id]
  }),
  updatedByUser: one(user, {
    fields: [assistantChat.updatedBy],
    references: [user.id]
  }),
  messages: many(assistantMessage)
}));

const assistantMessageRelations = relations(assistantMessage, ({ one }) => ({
  chat: one(assistantChat, {
    fields: [assistantMessage.chatId],
    references: [assistantChat.id]
  })
}));

export {
  assistantChat,
  assistantChatRelations,
  assistantMessage,
  assistantMessageRelations
};
