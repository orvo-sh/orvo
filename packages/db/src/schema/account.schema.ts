import { relations } from 'drizzle-orm';

import { account } from './account.table.js';
import { user } from './user.table.js';

const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id]
  })
}));

export { account, accountRelations };
