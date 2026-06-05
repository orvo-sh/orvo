import { index, pgEnum, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { alertIncident } from './alert-incident.schema.js';
import { alertRule } from './alert-rule.schema.js';

const alertEventType = pgEnum('alert_event_type', ['opened', 'renotified', 'resolved', 'test']);

const alertEvent = pgTable(
  'alert_event',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    ruleId: text('rule_id').references(() => alertRule.id, { onDelete: 'cascade' }),
    incidentId: text('incident_id').references(() => alertIncident.id, { onDelete: 'cascade' }),
    eventType: alertEventType('event_type').notNull(),
    windowStartAt: timestamp('window_start_at'),
    windowEndAt: timestamp('window_end_at'),
    observedValue: real('observed_value'),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('alert_event_app_id_idx').on(table.appId),
    index('alert_event_rule_id_idx').on(table.ruleId),
    index('alert_event_incident_id_idx').on(table.incidentId)
  ]
);

export { alertEvent, alertEventType };
