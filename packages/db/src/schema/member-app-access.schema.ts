import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { member } from './member.schema.js';

const memberAppAccess = pgTable(
  'member_app_access',
  {
    memberId: text('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [primaryKey({ columns: [table.memberId, table.appId] })]
);

export { memberAppAccess };
