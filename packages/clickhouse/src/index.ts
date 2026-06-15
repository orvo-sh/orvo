import {
	createClient,
	type BaseQueryParams,
	type ClickHouseClient,
	type ClickHouseClientConfigOptions,
	type CommandParams,
	type QueryParams
} from '@clickhouse/client';
import {
	context,
	propagation,
	SpanKind,
	SpanStatusCode,
	trace,
	type Attributes
} from '@opentelemetry/api';

const tracer = trace.getTracer('@repo/clickhouse');

const getClickHouseClient = (config: ClickHouseClientConfigOptions): ClickHouseClient => {
	const client = createClient(config);
	const connectionAttributes = getConnectionAttributes(config.url);

	return new Proxy(client, {
		get(target, prop, receiver) {
			if (prop === 'query') {
				return <Format extends QueryParams['format'] = 'JSON'>(params: QueryParams & { format?: Format }) =>
					runWithSpan(
						'query',
						params,
						{
							...connectionAttributes,
							'db.query.format': params.format ?? 'JSON'
						},
						(nextParams) => target.query(nextParams)
					);
			}

			if (prop === 'command') {
				return (params: CommandParams) =>
					runWithSpan('command', params, connectionAttributes, (nextParams) =>
						target.command(nextParams)
					);
			}

			if (prop === 'exec') {
				return (params: Parameters<ClickHouseClient['exec']>[0]) =>
					runWithSpan('exec', params, connectionAttributes, (nextParams) => target.exec(nextParams));
			}

			if (prop === 'insert') {
				return (params: Parameters<ClickHouseClient['insert']>[0]) =>
					runWithSpan(
						'insert',
						params,
						{
							...connectionAttributes,
							'db.collection.name': params.table,
							'db.query.format': params.format ?? 'JSONCompactEachRow'
						},
						(nextParams) => target.insert(nextParams)
					);
			}

			if (prop === 'ping') {
				return (params?: Parameters<ClickHouseClient['ping']>[0]) =>
					runWithSpan('ping', params, connectionAttributes, (nextParams) => target.ping(nextParams));
			}

			return Reflect.get(target, prop, receiver);
		}
	});
};

const runWithSpan = async <TParams extends BaseQueryParams | undefined, TResult>(
	operation: 'query' | 'command' | 'exec' | 'insert' | 'ping',
	params: TParams,
	attributes: Attributes,
	execute: (params: TParams) => Promise<TResult>
): Promise<TResult> => {
	const span = tracer.startSpan(`clickhouse.${operation}`, {
		kind: SpanKind.CLIENT,
		attributes: {
			'db.system': 'clickhouse',
			'db.operation.name': operation,
			...attributes,
			...getQueryAttributes(params)
		}
	});

	return context.with(trace.setSpan(context.active(), span), async () => {
		try {
			const result = await execute(withTraceHeaders(params));

			if (hasQueryId(result)) {
				span.setAttribute('db.query.id', result.query_id);
			}

			if (hasExecutedFlag(result)) {
				span.setAttribute('db.response.executed', result.executed);
			}

			span.setStatus({ code: SpanStatusCode.OK });

			return result;
		} catch (error) {
			span.recordException(error as Error);
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: error instanceof Error ? error.message : String(error)
			});
			throw error;
		} finally {
			span.end();
		}
	});
};

const withTraceHeaders = <TParams extends BaseQueryParams | undefined>(params: TParams): TParams => {
	if (!params) {
		return params;
	}

	const carrier = { ...(params.http_headers ?? {}) };

	propagation.inject(context.active(), carrier);

	return {
		...params,
		http_headers: carrier
	};
};

const getConnectionAttributes = (urlValue?: string | URL): Attributes => {
	if (!urlValue) {
		return {};
	}

	const url = typeof urlValue === 'string' ? new URL(urlValue) : urlValue;
	const attributes: Attributes = {
		'server.address': url.hostname
	};

	if (url.port) {
		attributes['server.port'] = Number(url.port);
	}

	if (url.pathname && url.pathname !== '/') {
		attributes['url.path'] = url.pathname;
	}

	return attributes;
};

const getQueryAttributes = (params: BaseQueryParams | undefined): Attributes => {
	if (!hasQuery(params)) {
		return {};
	}

	return {
		'db.query.text': normalizeQuery(params.query)
	};
};

const normalizeQuery = (query: string) => query.replace(/\s+/g, ' ').trim().slice(0, 2_048);

const hasQuery = (value: BaseQueryParams | undefined): value is BaseQueryParams & { query: string } =>
	typeof value === 'object' &&
	value !== null &&
	'query' in value &&
	typeof value.query === 'string';

const hasQueryId = (value: unknown): value is { query_id: string } =>
	typeof value === 'object' &&
	value !== null &&
	'query_id' in value &&
	typeof value.query_id === 'string';

const hasExecutedFlag = (value: unknown): value is { executed: boolean } =>
	typeof value === 'object' &&
	value !== null &&
	'executed' in value &&
	typeof value.executed === 'boolean';

export { getClickHouseClient, type ClickHouseClient as ClickHouse };
