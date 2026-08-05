import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { ingestionKey } from './ingestion-key.schema.js';

const agentInstallation = pgTable(
  'agent_installation',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    ingestionKeyId: text('ingestion_key_id')
      .notNull()
      .references(() => ingestionKey.id, { onDelete: 'cascade' }),
    hostId: text('host_id').notNull(),
    hostName: text('host_name').notNull(),
    operatingSystem: text('operating_system').notNull(),
    architecture: text('architecture').notNull(),
    agentVersion: text('agent_version').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('agent_installation_app_id_idx').on(table.appId),
    uniqueIndex('agent_installation_ingestion_key_id_uidx').on(table.ingestionKeyId),
    uniqueIndex('agent_installation_app_host_uidx').on(table.appId, table.hostId)
  ]
);

export { agentInstallation };
