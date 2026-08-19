import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const oauthClientAssertion = pgTable('oauth_client_assertion', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull()
});

export { oauthClientAssertion };
