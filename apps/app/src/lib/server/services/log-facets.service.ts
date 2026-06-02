import type { ClickHouseClient } from '@repo/clickhouse';
import type { Logger } from '@repo/logger';
import { err, ok } from '@repo/utils';
import { z } from 'zod';
import { buildWhereClause, logsQueryFiltersSchema, type LogsOmitFacet } from './logs.service';

class LogFacetsService {
	private logger: Logger;

	constructor(
		private clickhouse: ClickHouseClient,
		logger: Logger
	) {
		this.logger = logger.child('LogFacetsService');
	}

	async getLogFacets(
		input: z.infer<typeof getLogFacetsInputSchema>,
		context: { organizationId: string }
	) {
		this.logger.info('getLogFacets: fetching log facets', { input, context });

		const validated = getLogFacetsInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const entries = await Promise.all(
				Object.entries(facetColumns).map(async ([facetKey, facetConfig]) => {
					const whereClause = buildWhereClause(context.organizationId, validated.data, {
						omitFacet: facetConfig.omitFacet
					});
					const result = await this.clickhouse.query({
						format: 'JSONEachRow',
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

export const getLogFacetsInputSchema = logsQueryFiltersSchema.extend({
	maxValuesPerFacet: z.number().int().min(1).max(200).default(50)
});

type LogFacetsResult = {
	levels: RawFacetRow[];
	services: RawFacetRow[];
	environments: RawFacetRow[];
	scopes: RawFacetRow[];
	ingestionKeyIds: RawFacetRow[];
};

type RawFacetRow = {
	value: string;
	count: number;
};

const facetColumns = {
	levels: { column: 'severity_text', omitFacet: 'levels' },
	services: { column: 'service_name', omitFacet: 'services' },
	environments: { column: 'deployment_environment', omitFacet: 'environments' },
	scopes: { column: 'scope_name', omitFacet: 'scopes' },
	ingestionKeyIds: { column: 'ingestion_key_id', omitFacet: 'ingestionKeyIds' }
} satisfies Record<
	keyof LogFacetsResult,
	{
		column: string;
		omitFacet: LogsOmitFacet;
	}
>;

export { LogFacetsService };
