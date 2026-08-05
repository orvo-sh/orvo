import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { organization } from './organization.schema.js';
import { user } from './user.schema.js';

const chatContextKind = pgEnum('chat_context_kind', [
  'trace',
  'log',
  'metric',
  'incident',
  'heartbeat'
]);
const chatMessageRole = pgEnum('chat_message_role', ['system', 'user', 'assistant']);

const chat = pgTable(
  'chat',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New chat'),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('chat_app_id_created_by_updated_at_idx').on(
      table.appId,
      table.createdBy,
      table.updatedAt
    ),
    index('chat_organization_id_idx').on(table.organizationId)
  ]
);

const chatContext = pgTable(
  'chat_context',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    kind: chatContextKind('kind').notNull(),
    resourceId: text('resource_id').notNull(),
    label: text('label').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('chat_context_chat_id_idx').on(table.chatId),
    uniqueIndex('chat_context_chat_kind_resource_uidx').on(
      table.chatId,
      table.kind,
      table.resourceId
    )
  ]
);

const chatMessage = pgTable(
  'chat_message',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    role: chatMessageRole('role').notNull(),
    parts: jsonb('parts').$type<Array<Record<string, unknown>>>().notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('chat_message_chat_id_position_uidx').on(table.chatId, table.position),
    index('chat_message_chat_id_idx').on(table.chatId)
  ]
);

export { chat, chatContext, chatContextKind, chatMessage, chatMessageRole };
