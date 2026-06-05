import { relations } from 'drizzle-orm';

import { member } from './member.table.js';
import { organization } from './organization.table.js';
import { user } from './user.table.js';

const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id]
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id]
  })
}));

export { member, memberRelations };
