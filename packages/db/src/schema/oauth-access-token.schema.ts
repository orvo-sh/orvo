import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { oauthClient } from './oauth-client.schema.js';
import { oauthRefreshToken } from './oauth-refresh-token.schema.js';
import { session } from './session.schema.js';
import { user } from './user.schema.js';

const oauthAccessToken = pgTable(
  'oauth_access_token',
  {
    id: text('id').primaryKey(),
    token: text('token').unique(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => session.id, { onDelete: 'set null' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    referenceId: text('reference_id'),
    authorizationCodeId: text('authorization_code_id'),
    resources: text('resources').array(),
    requestedUserInfoClaims: text('requested_user_info_claims').array(),
    refreshId: text('refresh_id').references(() => oauthRefreshToken.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at'),
    revoked: timestamp('revoked'),
    confirmation: jsonb('confirmation'),
    scopes: text('scopes').array().notNull()
  },
  (table) => [
    index('oauthAccessToken_clientId_idx').on(table.clientId),
    index('oauthAccessToken_sessionId_idx').on(table.sessionId),
    index('oauthAccessToken_userId_idx').on(table.userId),
    index('oauthAccessToken_authorizationCodeId_idx').on(table.authorizationCodeId),
    index('oauthAccessToken_refreshId_idx').on(table.refreshId)
  ]
);

export { oauthAccessToken };
