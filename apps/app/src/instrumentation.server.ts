import { dev } from '$app/environment';
import { ORVO_OTLP_BASE_URL, ORVO_PRIVATE_INGESTION_KEY } from '$env/static/private';
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

let loggerProvider: LoggerProvider | null = null;

if (ORVO_OTLP_BASE_URL && ORVO_PRIVATE_INGESTION_KEY) {
	const { registerOptions } = createAddHookMessageChannel();

	register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);

	const resource = defaultResource().merge(
		resourceFromAttributes({
			[ATTR_SERVICE_NAME]: 'orvo-app-server',
			[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: dev ? 'development' : 'production'
		})
	);

	const sdk = new NodeSDK({
		serviceName: 'orvo-app-server',
		resource,
		traceExporter: new OTLPTraceExporter({
			url: new URL('/v1/traces', ORVO_OTLP_BASE_URL).toString(),
			headers: {
				Authorization: `Bearer ${ORVO_PRIVATE_INGESTION_KEY}`,
				'X-Orvo-Self-Telemetry': 'true'
			}
		}),
		instrumentations: [getNodeAutoInstrumentations()]
	});

	void sdk.start();

	loggerProvider = new LoggerProvider({
		resource,
		processors: [
			new BatchLogRecordProcessor(
				new OTLPLogExporter({
					url: new URL('/v1/logs', ORVO_OTLP_BASE_URL).toString(),
					headers: {
						Authorization: `Bearer ${ORVO_PRIVATE_INGESTION_KEY}`,
						'X-Orvo-Self-Telemetry': 'true'
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
}

export { loggerProvider };
