import { sql } from 'drizzle-orm';
import { index, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { incident } from './incident.schema.js';
import { user } from './user.schema.js';

const incidentEventType = pgEnum('incident_event_type', [
  'incident.opened',
  'incident.resolved',
  'incident.dismissed',
  'alert.fired',
  'heartbeat.missed',
  'heartbeat.recovered'
]);

const incidentEvent = pgTable(
  'incident_event',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    incidentId: text('incident_id')
      .notNull()
      .references(() => incident.id, { onDelete: 'cascade' }),
    eventType: incidentEventType('event_type').notNull(),
    occurredAt: timestamp('occurred_at').defaultNow().notNull(),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('incident_event_app_id_idx').on(table.appId),
    index('incident_event_incident_id_occurred_at_idx').on(
      table.incidentId,
      table.occurredAt,
    )
  ],
);

export { incidentEvent, incidentEventType };
