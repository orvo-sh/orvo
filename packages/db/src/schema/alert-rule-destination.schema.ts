import { index, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

import { alertRule } from './alert-rule.schema.js';
import { notificationDestination } from './notification-destination.schema.js';

const alertRuleDestination = pgTable(
  'alert_rule_destination',
  {
    ruleId: text('rule_id')
      .notNull()
      .references(() => alertRule.id, { onDelete: 'cascade' }),
    destinationId: text('destination_id')
      .notNull()
      .references(() => notificationDestination.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.ruleId, table.destinationId], name: 'alert_rule_destination_pk' }),
    index('alert_rule_destination_destination_id_idx').on(table.destinationId)
  ]
);

export { alertRuleDestination };
