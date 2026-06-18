import { index, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

import { relations } from 'drizzle-orm/relations';
import { heartbeatMonitor } from './heartbeat-monitor.schema.js';
import { notificationDestination } from './notification-destination.schema.js';

const heartbeatMonitorDestination = pgTable(
  'heartbeat_monitor_destination',
  {
    heartbeatMonitorId: text('heartbeat_monitor_id')
      .notNull()
      .references(() => heartbeatMonitor.id, { onDelete: 'cascade' }),
    destinationId: text('destination_id')
      .notNull()
      .references(() => notificationDestination.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.heartbeatMonitorId, table.destinationId],
      name: 'heartbeat_monitor_destination_pk'
    }),
    index('heartbeat_monitor_destination_destination_id_idx').on(table.destinationId)
  ]
);

const heartbeatMonitorDestinationRelations = relations(
  heartbeatMonitorDestination,
  ({ one }) => ({
    heartbeatMonitor: one(heartbeatMonitor, {
      fields: [heartbeatMonitorDestination.heartbeatMonitorId],
      references: [heartbeatMonitor.id],
    }),

    destination: one(notificationDestination, {
      fields: [heartbeatMonitorDestination.destinationId],
      references: [notificationDestination.id],
    }),
  }),
);

export { heartbeatMonitorDestination, heartbeatMonitorDestinationRelations };

