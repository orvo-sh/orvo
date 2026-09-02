import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { organization } from './organization.schema.js';
import { user } from './user.schema.js';

const slackOauthState = pgTable(
  'slack_oauth_state',
  {
    stateHash: text('state_hash').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [index('slack_oauth_state_expires_at_idx').on(table.expiresAt)]
);

export { slackOauthState };
