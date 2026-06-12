import {
	createClient,
	type ClickHouseClient,
	type ClickHouseClientConfigOptions
} from '@clickhouse/client';

const getClickHouseClient = (config: ClickHouseClientConfigOptions): ClickHouseClient =>
	createClient(config);

export { getClickHouseClient, type ClickHouseClient as ClickHouse };

