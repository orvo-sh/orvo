import { index, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { incident } from './incident.schema.js';
import { notificationDestination } from './notification-destination.schema.js';

const notificationSourceKind = pgEnum('notification_source_kind', ['heartbeat', 'alert']);
const notificationEventType = pgEnum('notification_event_type', [
  'heartbeat.missed',
  'heartbeat.recovered',
  'alert.opened',
  'alert.renotified',
  'alert.resolved',
  'destination.test'
]);
const notificationDeliveryStatus = pgEnum('notification_delivery_status', [
  'pending',
  'succeeded',
  'failed'
]);

const notificationDelivery = pgTable(
  'notification_delivery',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    destinationId: text('destination_id')
      .notNull()
      .references(() => notificationDestination.id, { onDelete: 'cascade' }),
    incidentId: text('incident_id').references(() => incident.id, {
      onDelete: 'cascade',
    }),
    sourceKind: notificationSourceKind('source_kind').notNull(),
    sourceId: text('source_id').notNull(),
    eventType: notificationEventType('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: notificationDeliveryStatus('status').notNull().default('pending'),
    attemptNumber: integer('attempt_number').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at').defaultNow().notNull(),
    lastAttemptAt: timestamp('last_attempt_at'),
    deliveredAt: timestamp('delivered_at'),
    httpStatus: integer('http_status'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('notification_delivery_app_id_idx').on(table.appId),
    index('notification_delivery_destination_id_idx').on(table.destinationId),
    index('notification_delivery_incident_id_idx').on(table.incidentId),
    index('notification_delivery_status_next_attempt_at_idx').on(table.status, table.nextAttemptAt),
    index('notification_delivery_source_idx').on(table.sourceKind, table.sourceId)
  ]
);

export {
  notificationDelivery,
  notificationDeliveryStatus,
  notificationEventType,
  notificationSourceKind
};
