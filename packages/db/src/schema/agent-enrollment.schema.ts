import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { user } from './user.schema.js';

const agentEnrollment = pgTable(
  'agent_enrollment',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    tokenHash: text('token_hash').notNull(),
    environment: text('environment').notNull().default('production'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at').notNull(),
    redeemedAt: timestamp('redeemed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('agent_enrollment_app_id_idx').on(table.appId),
    uniqueIndex('agent_enrollment_token_hash_uidx').on(table.tokenHash)
  ]
);

export { agentEnrollment };
