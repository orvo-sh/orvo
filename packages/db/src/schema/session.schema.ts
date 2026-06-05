import { relations } from 'drizzle-orm';

import { session } from './session.table.js';
import { user } from './user.table.js';

const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id]
  })
}));

export { session, sessionRelations };
