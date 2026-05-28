import { logs as otelLogs } from '@opentelemetry/api-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
	ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
	ATTR_SERVICE_NAME
} from '@opentelemetry/semantic-conventions';
import { createAddHookMessageChannel } from 'import-in-the-middle';
import { register } from 'node:module';

const baseUrl = process.env.ORVO_OTLP_BASE_URL;
const ingestionKey = process.env.ORVO_PRIVATE_INGESTION_KEY;
const environment = process.env.NODE_ENV ?? 'development';

if (baseUrl && ingestionKey) {
	const { registerOptions } = createAddHookMessageChannel();

	register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);

	const resource = defaultResource().merge(
		resourceFromAttributes({
			[ATTR_SERVICE_NAME]: 'orvo-app-server',
			[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment
		})
	);

	const sdk = new NodeSDK({
		serviceName: 'orvo-app-server',
		resource,
		traceExporter: new OTLPTraceExporter({
			url: new URL('/v1/traces', baseUrl).toString(),
			headers: {
				Authorization: `Bearer ${ingestionKey}`
			}
		}),
		instrumentations: [getNodeAutoInstrumentations()]
	});

	void sdk.start();

	const loggerProvider = new LoggerProvider({
		resource,
		processors: [
			new BatchLogRecordProcessor(
				new OTLPLogExporter({
					url: new URL('/v1/logs', baseUrl).toString(),
					headers: {
						Authorization: `Bearer ${ingestionKey}`
					}
				}),
				{
					scheduledDelayMillis: 1000,
					maxExportBatchSize: 64,
					maxQueueSize: 512
				}
			)
		]
	});

	otelLogs.setGlobalLoggerProvider(loggerProvider);
}
