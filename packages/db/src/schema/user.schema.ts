import { relations } from 'drizzle-orm';

import { account } from './account.table.js';
import { invitation } from './invitation.table.js';
import { member } from './member.table.js';
import { session } from './session.table.js';
import { user } from './user.table.js';

const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  invitations: many(invitation)
}));

export { user, userRelations };
