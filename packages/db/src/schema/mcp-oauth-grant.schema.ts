import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { oauthClient } from './oauth-client.schema.js';
import { organization } from './organization.schema.js';
import { user } from './user.schema.js';

const mcpOauthGrant = pgTable(
  'mcp_oauth_grant',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('mcp_oauth_grant_client_id_idx').on(table.clientId),
    index('mcp_oauth_grant_user_id_idx').on(table.userId),
    index('mcp_oauth_grant_organization_id_idx').on(table.organizationId),
    uniqueIndex('mcp_oauth_grant_client_user_uidx').on(table.clientId, table.userId)
  ]
);

export { mcpOauthGrant };
