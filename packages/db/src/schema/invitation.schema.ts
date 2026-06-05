import { relations } from 'drizzle-orm';

import { invitation } from './invitation.table.js';
import { organization } from './organization.table.js';
import { user } from './user.table.js';

const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id]
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id]
  })
}));

export { invitation, invitationRelations };
