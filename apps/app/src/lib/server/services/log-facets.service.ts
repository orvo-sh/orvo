import type { ClickHouseClient } from '@repo/clickhouse';
import { z } from 'zod';
import type { Logger } from '$lib/server/observability/logger';
import { buildWhereClause, logsQueryFiltersSchema, type LogsOmitFacet } from './logs.service';
import { err, ok, type ServiceResult } from './result';

export const getLogFacetsInputSchema = logsQueryFiltersSchema.extend({
	maxValuesPerFacet: z.number().int().min(1).max(200).default(50)
});

export type GetLogFacetsInput = z.infer<typeof getLogFacetsInputSchema>;

export type LogFacetOption = {
	value: string;
	count: number;
};

export type LogFacetsResult = {
	levels: LogFacetOption[];
	services: LogFacetOption[];
	environments: LogFacetOption[];
	scopes: LogFacetOption[];
	ingestionKeyIds: LogFacetOption[];
	contentTypes: LogFacetOption[];
	contentEncodings: LogFacetOption[];
	remoteAddrs: LogFacetOption[];
	userAgents: LogFacetOption[];
};

type FacetKey = keyof Omit<LogFacetsResult, never>;
type RawFacetRow = {
	value: string;
	count: number;
};

const facetColumns: Record<
	FacetKey,
	{
		column: string;
		omitFacet: LogsOmitFacet;
	}
> = {
	levels: { column: 'severity_text', omitFacet: 'levels' },
	services: { column: 'service_name', omitFacet: 'services' },
	environments: { column: 'deployment_environment', omitFacet: 'environments' },
	scopes: { column: 'scope_name', omitFacet: 'scopes' },
	ingestionKeyIds: { column: 'ingestion_key_id', omitFacet: 'ingestionKeyIds' },
	contentTypes: { column: 'content_type', omitFacet: 'contentTypes' },
	contentEncodings: { column: 'content_encoding', omitFacet: 'contentEncodings' },
	remoteAddrs: { column: 'remote_addr', omitFacet: 'remoteAddrs' },
	userAgents: { column: 'user_agent', omitFacet: 'userAgents' }
};

class LogFacetsService {
	private logger: Logger;

	constructor(
		private clickhouse: ClickHouseClient,
		logger: Logger
	) {
		this.logger = logger.child('LogFacetsService');
	}

	async getLogFacets(
		organizationId: string,
		input: GetLogFacetsInput
	): Promise<ServiceResult<LogFacetsResult>> {
		this.logger.info('getLogFacets: fetching log facets', { organizationId, input });

		const validated = getLogFacetsInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const entries = await Promise.all(
				Object.entries(facetColumns).map(async ([facetKey, facetConfig]) => {
					const whereClause = buildWhereClause(organizationId, validated.data, {
						omitFacet: facetConfig.omitFacet
					});
					const result = await this.clickhouse.query({
						query: `
							SELECT
								${facetConfig.column} AS value,
								count() AS count
							FROM logs_raw
							WHERE ${whereClause}
								AND ${facetConfig.column} != ''
							GROUP BY value
							ORDER BY count DESC, value ASC
							LIMIT ${validated.data.maxValuesPerFacet}
							FORMAT JSONEachRow
						`
					});

					return [facetKey, (await result.json()) as unknown as RawFacetRow[]] as const;
				})
			);

			return ok(Object.fromEntries(entries) as LogFacetsResult);
		} catch (error) {
			this.logger.error('getLogFacets: failed to fetch log facets', error as Error);
			return err('Failed to fetch log facets.');
		}
	}
}

export { LogFacetsService };
