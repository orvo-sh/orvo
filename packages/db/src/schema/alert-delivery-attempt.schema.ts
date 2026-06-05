import { jsonb, index, integer, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { alertEvent, alertEventType } from './alert-event.schema.js';
import { alertIncident } from './alert-incident.schema.js';
import { alertRule } from './alert-rule.schema.js';
import { alertWebhookDestination } from './alert-webhook-destination.schema.js';

const alertDeliveryStatus = pgEnum('alert_delivery_status', ['pending', 'succeeded', 'failed']);

const alertDeliveryAttempt = pgTable(
  'alert_delivery_attempt',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    destinationId: text('destination_id')
      .notNull()
      .references(() => alertWebhookDestination.id, { onDelete: 'cascade' }),
    ruleId: text('rule_id').references(() => alertRule.id, { onDelete: 'cascade' }),
    incidentId: text('incident_id').references(() => alertIncident.id, { onDelete: 'cascade' }),
    eventId: text('event_id').references(() => alertEvent.id, { onDelete: 'cascade' }),
    eventType: alertEventType('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: alertDeliveryStatus('status').notNull().default('pending'),
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
    index('alert_delivery_attempt_app_id_idx').on(table.appId),
    index('alert_delivery_attempt_destination_id_idx').on(table.destinationId),
    index('alert_delivery_attempt_status_next_attempt_at_idx').on(table.status, table.nextAttemptAt)
  ]
);

export { alertDeliveryAttempt, alertDeliveryStatus };
