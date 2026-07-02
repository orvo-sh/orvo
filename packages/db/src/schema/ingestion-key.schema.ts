import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { user } from './user.schema.js';

const ingestionKey = pgTable(
  'ingestion_key',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    key: text('key').notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    revokedAt: timestamp('revoked_at')
  },
  (table) => [
    index('ingestion_key_app_id_idx').on(table.appId),
    index('ingestion_key_created_by_idx').on(table.createdBy),
    uniqueIndex('ingestion_key_key_uidx').on(table.key)
  ]
);

const ingestionKeyRelations = relations(ingestionKey, ({ one }) => ({
  app: one(app, {
    fields: [ingestionKey.appId],
    references: [app.id]
  }),
  createdByUser: one(user, {
    fields: [ingestionKey.createdBy],
    references: [user.id]
  })
}));

export { ingestionKey, ingestionKeyRelations };
