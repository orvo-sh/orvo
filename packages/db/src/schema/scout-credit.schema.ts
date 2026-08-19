import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { chat } from './chat.schema.js';
import { organization } from './organization.schema.js';
import { user } from './user.schema.js';

const scoutCreditGrantSource = pgEnum('scout_credit_grant_source', [
  'plan',
  'purchase',
  'adjustment'
]);

const scoutCreditGrant = pgTable(
  'scout_credit_grant',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    source: scoutCreditGrantSource('source').notNull(),
    sourceReference: text('source_reference').notNull(),
    grantedCredits: bigint('granted_credits', { mode: 'number' }).notNull(),
    remainingCredits: bigint('remaining_credits', { mode: 'number' }).notNull(),
    validFrom: timestamp('valid_from').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex('scout_credit_grant_organization_source_reference_uidx').on(
      table.organizationId,
      table.sourceReference
    ),
    index('scout_credit_grant_organization_expiry_idx').on(table.organizationId, table.expiresAt)
  ]
);

const scoutUsage = pgTable(
  'scout_usage',
  {
    id: text('id').primaryKey(),
    operationId: text('operation_id').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    appId: text('app_id').references(() => app.id, { onDelete: 'set null' }),
    chatId: text('chat_id').references(() => chat.id, { onDelete: 'set null' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    model: text('model').notNull(),
    policyVersion: integer('policy_version').notNull(),
    inputTokens: bigint('input_tokens', { mode: 'number' }).default(0).notNull(),
    outputTokens: bigint('output_tokens', { mode: 'number' }).default(0).notNull(),
    reasoningTokens: bigint('reasoning_tokens', { mode: 'number' }).default(0).notNull(),
    totalTokens: bigint('total_tokens', { mode: 'number' }).default(0).notNull(),
    credits: bigint('credits', { mode: 'number' }).notNull(),
    unfundedCredits: bigint('unfunded_credits', { mode: 'number' }).default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('scout_usage_operation_id_uidx').on(table.operationId),
    index('scout_usage_organization_created_at_idx').on(table.organizationId, table.createdAt),
    index('scout_usage_chat_id_idx').on(table.chatId)
  ]
);

const scoutUsageAllocation = pgTable(
  'scout_usage_allocation',
  {
    usageId: text('usage_id')
      .notNull()
      .references(() => scoutUsage.id, { onDelete: 'cascade' }),
    grantId: text('grant_id')
      .notNull()
      .references(() => scoutCreditGrant.id, { onDelete: 'restrict' }),
    credits: bigint('credits', { mode: 'number' }).notNull()
  },
  (table) => [primaryKey({ columns: [table.usageId, table.grantId] })]
);

export { scoutCreditGrant, scoutCreditGrantSource, scoutUsage, scoutUsageAllocation };
