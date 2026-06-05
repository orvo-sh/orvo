import { jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { app } from './app.js';
import { user } from './auth.js';

export const dashboardLogView = pgTable(
	'dashboard_log_view',
	{
		id: text('id').primaryKey(),
		appId: text('app_id')
			.notNull()
			.references(() => app.id, { onDelete: 'cascade' }),
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		definition: jsonb('definition').notNull(),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		uniqueIndex('dashboard_log_view_app_id_slug_uidx').on(
			table.appId,
			table.slug
		)
	]
);
