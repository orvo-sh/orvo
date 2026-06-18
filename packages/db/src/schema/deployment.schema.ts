import { relations } from 'drizzle-orm';
import { index, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';

const deploymentStatus = pgEnum('deployment_status', [
  'pending',
  'in_progress',
  'succeeded',
  'failed',
  'rolled_back'
]);

const deploymentCorrelationStrategy = pgEnum('deployment_correlation_strategy', [
  'time_window',
  'explicit_id',
  'service_version'
]);

const deployment = pgTable(
  'deployment',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    serviceName: text('service_name').notNull(),
    environmentName: text('environment_name').notNull(),
    version: text('version'),
    status: deploymentStatus('status').notNull().default('pending'),
    startedAt: timestamp('started_at').notNull(),
    finishedAt: timestamp('finished_at'),
    gitSha: text('git_sha'),
    gitBranch: text('git_branch'),
    gitRepository: text('git_repository'),
    gitActor: text('git_actor'),
    commitMessage: text('commit_message'),
    externalUrl: text('external_url'),
    correlationStrategy: deploymentCorrelationStrategy('correlation_strategy')
      .notNull()
      .default('time_window'),
    deploymentIdAttribute: text('deployment_id_attribute'),
    serviceVersion: text('service_version'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('deployment_app_id_idx').on(table.appId),
    index('deployment_app_started_at_idx').on(table.appId, table.startedAt),
    index('deployment_app_service_env_idx').on(
      table.appId,
      table.serviceName,
      table.environmentName
    ),
    index('deployment_app_status_idx').on(table.appId, table.status)
  ]
);

const deploymentRelations = relations(deployment, ({ one }) => ({
  app: one(app, {
    fields: [deployment.appId],
    references: [app.id]
  })
}));

export { deployment, deploymentCorrelationStrategy, deploymentRelations, deploymentStatus };
