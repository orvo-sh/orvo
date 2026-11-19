import { index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { app } from './app.schema.js';
import { user } from './user.schema.js';

const dashboard = pgTable(
  'dashboard',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    panels: jsonb('panels').notNull().default([]),
    timeRange: text('time_range').notNull().default('last_hour'),
    revision: integer('revision').notNull().default(1),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [index('dashboard_app_id_idx').on(table.appId)]
);

const dashboardPin = pgTable(
  'dashboard_pin',
  {
    dashboardId: text('dashboard_id')
      .notNull()
      .references(() => dashboard.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.dashboardId, table.userId] }),
    index('dashboard_pin_user_id_idx').on(table.userId)
  ]
);

export { dashboard, dashboardPin };
