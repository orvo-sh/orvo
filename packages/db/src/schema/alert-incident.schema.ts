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
const alertIncidentEntityType = pgEnum('alert_incident_entity_type', ['app', 'container']);

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
    entityType: alertIncidentEntityType('entity_type').notNull().default('app'),
    entityId: text('entity_id').notNull().default(''),
    entityName: text('entity_name'),
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
    index('alert_incident_entity_type_entity_id_idx').on(table.entityType, table.entityId),
    uniqueIndex('alert_incident_one_open_per_rule_entity_uidx')
      .on(table.ruleId, table.entityType, table.entityId)
      .where(sql`${table.status} = 'open'`)
  ]
);

export { alertIncident, alertIncidentEntityType, alertIncidentStatus };
