import {
	createClient,
	type ClickHouseClient,
	type ClickHouseClientConfigOptions
} from '@clickhouse/client';

export const getClickHouseClient = (config: ClickHouseClientConfigOptions): ClickHouseClient =>
	createClient(config);

export type { ClickHouseClient, ClickHouseClientConfigOptions };
