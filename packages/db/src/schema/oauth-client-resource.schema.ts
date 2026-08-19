import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { oauthClient } from './oauth-client.schema.js';
import { oauthResource } from './oauth-resource.schema.js';

const oauthClientResource = pgTable(
  'oauth_client_resource',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    resourceId: text('resource_id')
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: 'cascade' }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at')
  },
  (table) => [
    index('oauthClientResource_clientId_idx').on(table.clientId),
    index('oauthClientResource_resourceId_idx').on(table.resourceId)
  ]
);

export { oauthClientResource };
