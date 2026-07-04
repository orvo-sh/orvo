import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { organization } from './organization.schema.js';
import { user } from './user.schema.js';

const mcpToken = pgTable(
  'mcp_token',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    tokenPrefix: text('token_prefix').notNull(),
    tokenHash: text('token_hash').notNull(),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    allowedAppIds: text('allowed_app_ids')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    lastUsedAt: timestamp('last_used_at'),
    lastUsedIp: text('last_used_ip'),
    lastUsedUserAgent: text('last_used_user_agent'),
    expiresAt: timestamp('expires_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('mcp_token_organization_id_idx').on(table.organizationId),
    index('mcp_token_created_by_idx').on(table.createdBy),
    uniqueIndex('mcp_token_token_prefix_uidx').on(table.tokenPrefix)
  ]
);

export { mcpToken };
