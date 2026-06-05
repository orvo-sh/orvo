import { jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { user } from './user.schema.js';

const dashboardLogView = pgTable(
  'dashboard_log_view',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    filters: jsonb('filters').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [uniqueIndex('dashboard_log_view_user_name_uidx').on(table.userId, table.name)]
);

export { dashboardLogView };
