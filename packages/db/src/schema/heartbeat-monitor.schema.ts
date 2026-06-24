import { index, integer, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { relations } from 'drizzle-orm/relations';
import { app } from './app.schema.js';
import { heartbeatMonitorDestination } from './index.js';
import { user } from './user.schema.js';

const heartbeatMonitorStatus = pgEnum('heartbeat_monitor_status', [
  'healthy',
  'grace',
  'missed',
  'never_received'
]);

const heartbeatMonitor = pgTable(
  'heartbeat_monitor',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    token: text('token').notNull().unique(),
    expectedEverySeconds: integer('expected_every_seconds').notNull(),
    graceSeconds: integer('grace_seconds').notNull(),
    lastCheckInAt: timestamp('last_check_in_at'),
    status: heartbeatMonitorStatus('status').notNull().default('never_received'),
    pausedAt: timestamp('paused_at'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('heartbeat_monitor_app_id_idx').on(table.appId),
    index('heartbeat_monitor_app_status_idx').on(table.appId, table.status),
  ]
);

const heartbeatMonitorRelations = relations(
  heartbeatMonitor,
  ({ many }) => ({
    destinations: many(heartbeatMonitorDestination),
  }),
);

export { heartbeatMonitor, heartbeatMonitorRelations, heartbeatMonitorStatus };
