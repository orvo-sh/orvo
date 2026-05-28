import { relations, sql } from 'drizzle-orm';
import {
	check,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';

import { organization, user } from './auth.js';

export const ingestionKeyKind = pgEnum('ingestion_key_kind', ['public', 'private']);

export const ingestionKey = pgTable(
	'ingestion_key',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		kind: ingestionKeyKind('kind').notNull(),
		key: text('key').notNull(),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		lastUsedAt: timestamp('last_used_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		revokedAt: timestamp('revoked_at')
	},
	(table) => [
		index('ingestion_key_organization_id_idx').on(table.organizationId),
		index('ingestion_key_created_by_idx').on(table.createdBy),
		uniqueIndex('ingestion_key_key_uidx').on(table.key),
		uniqueIndex('ingestion_key_one_active_kind_per_org_uidx')
			.on(table.organizationId, table.kind)
			.where(sql`${table.revokedAt} IS NULL`),
		check(
			'ingestion_key_public_prefix_check',
			sql`(${table.kind} <> 'public'::ingestion_key_kind OR ${table.key} LIKE 'pk_%')`
		),
		check(
			'ingestion_key_private_prefix_check',
			sql`(${table.kind} <> 'private'::ingestion_key_kind OR ${table.key} LIKE 'sk_%')`
		)
	]
);

export const ingestionKeyRelations = relations(ingestionKey, ({ one }) => ({
	organization: one(organization, {
		fields: [ingestionKey.organizationId],
		references: [organization.id]
	}),
	createdByUser: one(user, {
		fields: [ingestionKey.createdBy],
		references: [user.id]
	})
}));
