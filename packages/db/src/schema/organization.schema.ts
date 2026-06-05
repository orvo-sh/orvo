import { relations } from 'drizzle-orm';

import { invitation } from './invitation.table.js';
import { member } from './member.table.js';
import { organization } from './organization.table.js';

const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation)
}));

export { organization, organizationRelations };
