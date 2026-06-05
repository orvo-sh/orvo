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

import { app } from './app.js';
import { user } from './auth.js';

export const ingestionKeyKind = pgEnum('ingestion_key_kind', ['public', 'private']);

export const ingestionKey = pgTable(
	'ingestion_key',
	{
		id: text('id').primaryKey(),
		appId: text('app_id')
			.notNull()
			.references(() => app.id, { onDelete: 'cascade' }),
		kind: ingestionKeyKind('kind').notNull(),
		key: text('key').notNull(),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		lastUsedAt: timestamp('last_used_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		revokedAt: timestamp('revoked_at')
	},
	(table) => [
		index('ingestion_key_app_id_idx').on(table.appId),
		index('ingestion_key_created_by_idx').on(table.createdBy),
		uniqueIndex('ingestion_key_key_uidx').on(table.key),
		uniqueIndex('ingestion_key_one_active_kind_per_app_uidx')
			.on(table.appId, table.kind)
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
	app: one(app, {
		fields: [ingestionKey.appId],
		references: [app.id]
	}),
	createdByUser: one(user, {
		fields: [ingestionKey.createdBy],
		references: [user.id]
	})
}));
