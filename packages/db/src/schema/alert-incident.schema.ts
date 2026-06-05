import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { alertRule } from './alert-rule.schema.js';

const alertIncidentStatus = pgEnum('alert_incident_status', ['open', 'resolved']);

const alertIncident = pgTable(
  'alert_incident',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    ruleId: text('rule_id')
      .notNull()
      .references(() => alertRule.id, { onDelete: 'cascade' }),
    status: alertIncidentStatus('status').notNull().default('open'),
    openedAt: timestamp('opened_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
    lastObservedAt: timestamp('last_observed_at').defaultNow().notNull(),
    lastObservedValue: real('last_observed_value'),
    lastNotifiedAt: timestamp('last_notified_at'),
    renotifyCount: integer('renotify_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('alert_incident_app_id_idx').on(table.appId),
    index('alert_incident_rule_id_idx').on(table.ruleId),
    uniqueIndex('alert_incident_one_open_per_rule_uidx')
      .on(table.ruleId)
      .where(sql`${table.status} = 'open'`)
  ]
);

export { alertIncident, alertIncidentStatus };
