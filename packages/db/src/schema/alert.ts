import { sql } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	real,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { organization, user } from './auth.js';

const emptyTextArray = sql`'{}'::text[]`;

const alertSignalType = pgEnum('alert_signal_type', [
	'error_rate',
	'latency_p95_ms',
	'latency_p99_ms',
	'apdex',
	'throughput_per_min',
	'availability_percent'
]);

const alertComparator = pgEnum('alert_comparator', ['gt', 'gte', 'lt', 'lte']);

const alertIncidentStatus = pgEnum('alert_incident_status', ['open', 'resolved']);

const alertEventType = pgEnum('alert_event_type', ['opened', 'renotified', 'resolved', 'test']);

const alertDeliveryStatus = pgEnum('alert_delivery_status', ['pending', 'succeeded', 'failed']);

const alertWebhookDestination = pgTable(
	'alert_webhook_destination',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		url: text('url').notNull(),
		headersEncrypted: text('headers_encrypted').notNull(),
		isEnabled: boolean('is_enabled').notNull().default(true),
		lastTestedAt: timestamp('last_tested_at'),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('alert_webhook_destination_organization_id_idx').on(table.organizationId),
		index('alert_webhook_destination_created_by_idx').on(table.createdBy)
	]
);

const alertRule = pgTable(
	'alert_rule',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		signalType: alertSignalType('signal_type').notNull(),
		comparator: alertComparator('comparator').notNull(),
		threshold: real('threshold').notNull(),
		windowMinutes: integer('window_minutes').notNull(),
		renotifyMinutes: integer('renotify_minutes'),
		apdexTargetMs: integer('apdex_target_ms'),
		scopeServicesInclude: text('scope_services_include').array().notNull().default(emptyTextArray),
		scopeServicesExclude: text('scope_services_exclude').array().notNull().default(emptyTextArray),
		scopeSpanNamesInclude: text('scope_span_names_include').array().notNull().default(emptyTextArray),
		scopeSpanNamesExclude: text('scope_span_names_exclude').array().notNull().default(emptyTextArray),
		scopeEnvironmentsInclude: text('scope_environments_include')
			.array()
			.notNull()
			.default(emptyTextArray),
		scopeEnvironmentsExclude: text('scope_environments_exclude')
			.array()
			.notNull()
			.default(emptyTextArray),
		scopeScopesInclude: text('scope_scopes_include').array().notNull().default(emptyTextArray),
		scopeScopesExclude: text('scope_scopes_exclude').array().notNull().default(emptyTextArray),
		isEnabled: boolean('is_enabled').notNull().default(true),
		lastTriggeredAt: timestamp('last_triggered_at'),
		lastResolvedAt: timestamp('last_resolved_at'),
		nextEvaluationAt: timestamp('next_evaluation_at').defaultNow().notNull(),
		lastEvaluatedAt: timestamp('last_evaluated_at'),
		evaluationLeaseToken: text('evaluation_lease_token'),
		evaluationLeaseExpiresAt: timestamp('evaluation_lease_expires_at'),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('alert_rule_organization_id_idx').on(table.organizationId),
		index('alert_rule_next_evaluation_at_idx').on(table.nextEvaluationAt),
		index('alert_rule_enabled_next_evaluation_at_idx').on(table.isEnabled, table.nextEvaluationAt)
	]
);

const alertRuleDestination = pgTable(
	'alert_rule_destination',
	{
		ruleId: text('rule_id')
			.notNull()
			.references(() => alertRule.id, { onDelete: 'cascade' }),
		destinationId: text('destination_id')
			.notNull()
			.references(() => alertWebhookDestination.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		primaryKey({ columns: [table.ruleId, table.destinationId], name: 'alert_rule_destination_pk' }),
		index('alert_rule_destination_destination_id_idx').on(table.destinationId)
	]
);

const alertIncident = pgTable(
	'alert_incident',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		ruleId: text('rule_id')
			.notNull()
			.references(() => alertRule.id, { onDelete: 'cascade' }),
		status: alertIncidentStatus('status').notNull().default('open'),
		openedAt: timestamp('opened_at').defaultNow().notNull(),
		resolvedAt: timestamp('resolved_at'),
		lastObservedAt: timestamp('last_observed_at').defaultNow().notNull(),
		lastObservedValue: real('last_observed_value'),
		lastNotifiedAt: timestamp('last_notified_at'),
		renotifyCount: integer('renotify_count').notNull().default(0),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('alert_incident_organization_id_idx').on(table.organizationId),
		index('alert_incident_rule_id_idx').on(table.ruleId),
		uniqueIndex('alert_incident_one_open_per_rule_uidx')
			.on(table.ruleId)
			.where(sql`${table.status} = 'open'`)
	]
);

const alertEvent = pgTable(
	'alert_event',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		ruleId: text('rule_id').references(() => alertRule.id, { onDelete: 'cascade' }),
		incidentId: text('incident_id').references(() => alertIncident.id, { onDelete: 'cascade' }),
		eventType: alertEventType('event_type').notNull(),
		windowStartAt: timestamp('window_start_at'),
		windowEndAt: timestamp('window_end_at'),
		observedValue: real('observed_value'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('alert_event_organization_id_idx').on(table.organizationId),
		index('alert_event_rule_id_idx').on(table.ruleId),
		index('alert_event_incident_id_idx').on(table.incidentId)
	]
);

const alertDeliveryAttempt = pgTable(
	'alert_delivery_attempt',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		destinationId: text('destination_id')
			.notNull()
			.references(() => alertWebhookDestination.id, { onDelete: 'cascade' }),
		ruleId: text('rule_id').references(() => alertRule.id, { onDelete: 'cascade' }),
		incidentId: text('incident_id').references(() => alertIncident.id, { onDelete: 'cascade' }),
		eventId: text('event_id').references(() => alertEvent.id, { onDelete: 'cascade' }),
		eventType: alertEventType('event_type').notNull(),
		payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
		status: alertDeliveryStatus('status').notNull().default('pending'),
		attemptNumber: integer('attempt_number').notNull().default(0),
		nextAttemptAt: timestamp('next_attempt_at').defaultNow().notNull(),
		lastAttemptAt: timestamp('last_attempt_at'),
		deliveredAt: timestamp('delivered_at'),
		httpStatus: integer('http_status'),
		errorMessage: text('error_message'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('alert_delivery_attempt_organization_id_idx').on(table.organizationId),
		index('alert_delivery_attempt_destination_id_idx').on(table.destinationId),
		index('alert_delivery_attempt_status_next_attempt_at_idx').on(table.status, table.nextAttemptAt)
	]
);

export {
	alertComparator,
	alertDeliveryAttempt,
	alertDeliveryStatus,
	alertEvent,
	alertEventType,
	alertIncident,
	alertIncidentStatus,
	alertRule,
	alertRuleDestination,
	alertSignalType,
	alertWebhookDestination
};
