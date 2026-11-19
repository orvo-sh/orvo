import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './user.schema.js';

const onboarding = pgTable('onboarding', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  milestone: text('milestone').notNull(),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.milestone] })]);

export { onboarding };
