import type { ClickHouseClient } from '@repo/clickhouse';
import type { Logger } from '@repo/logger';
import { err, ok } from '@repo/utils';
import { z } from 'zod';
import { logTimeFilterSchema, resolveTimeRange } from './logs.service';

class TracesService {
	private logger: Logger;

	constructor(
		private clickhouse: ClickHouseClient,
		logger: Logger
	) {
		this.logger = logger.child('TracesService');
	}

	async getTraces(input: z.infer<typeof getTracesInputSchema>, context: { organizationId: string }) {
		this.logger.info('getTraces: fetching traces', { input, context });

		const validated = getTracesInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const pageSize = validated.data.limit + 1;
			const whereClause = buildWhereClause(context.organizationId, validated.data);
			const cursorClause = validated.data.cursor
				? `WHERE (trace_start_time < ${toDateTime64(new Date(validated.data.cursor.startTime))} OR (trace_start_time = ${toDateTime64(new Date(validated.data.cursor.startTime))} AND trace_id < ${quote(validated.data.cursor.traceId)}))`
				: '';
			const result = await this.clickhouse.query({
				format: 'JSONEachRow',
				query: `
					SELECT
						trace_id,
						name,
						trace_start_time AS start_time,
						trace_end_time AS end_time,
						duration_ns,
						span_count,
						error_count,
						service_names,
						deployment_environments
					FROM (
						SELECT
							trace_id,
							coalesce(nullIf(argMinIf(name, start_time, parent_span_id = ''), ''), argMin(name, start_time)) AS name,
							min(start_time) AS trace_start_time,
							max(end_time) AS trace_end_time,
							toInt64(toUnixTimestamp64Nano(max(end_time)) - toUnixTimestamp64Nano(min(start_time))) AS duration_ns,
							count() AS span_count,
							countIf(status_code = 2) AS error_count,
							arrayFilter(value -> value != '', groupUniqArray(service_name)) AS service_names,
							arrayFilter(value -> value != '', groupUniqArray(deployment_environment)) AS deployment_environments
						FROM traces_raw
						WHERE ${whereClause}
						GROUP BY trace_id
					)
					${cursorClause}
					ORDER BY trace_start_time DESC, trace_id DESC
					LIMIT ${pageSize}
				`
			});
			const rows = (await result.json()) as unknown as RawTraceRow[];
			const hasNextPage = rows.length > validated.data.limit;
			const visibleRows = rows.slice(0, validated.data.limit).map((row) => ({
				...row,
				start_time: normalizeDateTime(row.start_time),
				end_time: normalizeDateTime(row.end_time)
			}));
			const lastRow = visibleRows.at(-1);

			return ok({
				traces: visibleRows,
				nextCursor:
					hasNextPage && lastRow
						? {
							startTime: lastRow.start_time,
							traceId: lastRow.trace_id
						}
						: null
			});
		} catch (error) {
			this.logger.error('getTraces: failed to fetch traces', error as Error);
			return err('Failed to fetch traces.');
		}
	}

	async getTrace(input: z.infer<typeof getTraceInputSchema>, context: { organizationId: string }) {
		this.logger.info('getTrace: fetching trace', { input, context });

		const validated = getTraceInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const result = await this.clickhouse.query({
				format: 'JSONEachRow',
				query: `
					SELECT
						id,
						organization_id,
						ingestion_key_id,
						received_at,
						expires_at,
						trace_id,
						span_id,
						parent_span_id,
						trace_state,
						name,
						kind,
						start_time,
						end_time,
						duration_ns,
						status_code,
						status_message,
						resource_attributes,
						scope_attributes,
						span_attributes,
						resource_schema_url,
						scope_name,
						scope_version,
						scope_schema_url,
						events_json,
						links_json,
						service_name,
						deployment_environment
					FROM traces_raw
					WHERE organization_id = ${quote(context.organizationId)}
						AND trace_id = ${quote(validated.data.traceId)}
					ORDER BY start_time ASC
				`
			});
			const spans = ((await result.json()) as unknown as RawSpanRow[]).map((row) => ({
				...row,
				received_at: normalizeDateTime(row.received_at),
				expires_at: normalizeDateTime(row.expires_at),
				start_time: normalizeDateTime(row.start_time),
				end_time: normalizeDateTime(row.end_time)
			}));

			return ok({ spans });
		} catch (error) {
			this.logger.error('getTrace: failed to fetch trace', error as Error);
			return err('Failed to fetch trace.');
		}
	}
}

const stringArrayFilterSchema = z.array(z.string().trim().min(1).max(255)).max(50).default([]);

const statusCodeFilterSchema = z.array(z.number().int().min(0).max(255)).max(10).default([]);

export const tracesCursorSchema = z.object({
	startTime: z.string().datetime({ offset: true }),
	traceId: z.string().trim().min(1).max(255)
});

export const getTracesInputSchema = z.object({
	time: logTimeFilterSchema,
	search: z.string().trim().max(500).default(''),
	services: stringArrayFilterSchema,
	environments: stringArrayFilterSchema,
	scopes: stringArrayFilterSchema,
	ingestionKeyIds: stringArrayFilterSchema,
	statusCodes: statusCodeFilterSchema,
	limit: z.number().int().min(1).max(500).default(100),
	cursor: tracesCursorSchema.optional()
});

export const getTraceInputSchema = z.object({
	traceId: z.string().trim().min(1).max(255)
});

type RawTraceRow = {
	trace_id: string;
	name: string;
	start_time: string | Date;
	end_time: string | Date;
	duration_ns: number | string;
	span_count: number | string;
	error_count: number | string;
	service_names: string[];
	deployment_environments: string[];
};

type RawSpanRow = {
	id: string;
	organization_id: string;
	ingestion_key_id: string;
	received_at: string | Date;
	expires_at: string | Date;
	trace_id: string;
	span_id: string;
	parent_span_id: string;
	trace_state: string;
	name: string;
	kind: number;
	start_time: string | Date;
	end_time: string | Date;
	duration_ns: number | string;
	status_code: number;
	status_message: string;
	resource_attributes: Record<string, string>;
	scope_attributes: Record<string, string>;
	span_attributes: Record<string, string>;
	resource_schema_url: string;
	scope_name: string;
	scope_version: string;
	scope_schema_url: string;
	events_json: string;
	links_json: string;
	service_name: string;
	deployment_environment: string;
};

const quote = (value: string) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

const toDateTime64 = (value: Date) => `parseDateTime64BestEffort(${quote(value.toISOString())})`;

const normalizeDateTime = (value: string | Date) => {
	if (value instanceof Date) {
		return value.toISOString();
	}

	if (value.includes('T')) {
		return value.endsWith('Z') ? value : `${value}Z`;
	}

	return `${value.replace(' ', 'T')}Z`;
};

const buildInClause = (column: string, values: string[]) =>
	`${column} IN (${values.map((value) => quote(value)).join(', ')})`;

const buildWhereClause = (organizationId: string, input: z.infer<typeof getTracesInputSchema>) => {
	const { startAtUtc, endAtUtc } = resolveTimeRange(input.time);
	const whereClauses = [
		`organization_id = ${quote(organizationId)}`,
		`start_time >= ${toDateTime64(startAtUtc)}`,
		`start_time <= ${toDateTime64(endAtUtc)}`
	];

	if (input.search) {
		whereClauses.push(
			`(positionCaseInsensitiveUTF8(name, ${quote(input.search)}) > 0 OR positionCaseInsensitiveUTF8(trace_id, ${quote(input.search)}) > 0 OR positionCaseInsensitiveUTF8(status_message, ${quote(input.search)}) > 0)`
		);
	}

	if (input.services.length > 0) {
		whereClauses.push(buildInClause('service_name', input.services));
	}

	if (input.environments.length > 0) {
		whereClauses.push(buildInClause('deployment_environment', input.environments));
	}

	if (input.scopes.length > 0) {
		whereClauses.push(buildInClause('scope_name', input.scopes));
	}

	if (input.ingestionKeyIds.length > 0) {
		whereClauses.push(buildInClause('ingestion_key_id', input.ingestionKeyIds));
	}

	if (input.statusCodes.length > 0) {
		whereClauses.push(`status_code IN (${input.statusCodes.join(', ')})`);
	}

	return whereClauses.join(' AND ');
};

export { TracesService };
