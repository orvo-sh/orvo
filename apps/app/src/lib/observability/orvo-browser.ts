import { trace } from '@opentelemetry/api';
import { logs as otelLogs, SeverityNumber } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import {
	ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
	ATTR_SERVICE_NAME
} from '@opentelemetry/semantic-conventions';

import {
	PUBLIC_ORVO_OTLP_BASE_URL,
	PUBLIC_ORVO_PUBLIC_INGESTION_KEY
} from '$env/static/public';

let initialized = false;
let browserLogger = otelLogs.getLogger('orvo-app-browser');
let tracer = trace.getTracer('orvo-app-browser');

const selfTelemetryHeader = 'X-Orvo-Self-Telemetry';
const buildLogsUrl = (baseUrl: string) => new URL('/v1/logs', baseUrl).toString();
const buildTracesUrl = (baseUrl: string) => new URL('/v1/traces', baseUrl).toString();

const emitBrowserLog = (
	severityNumber: SeverityNumber,
	severityText: string,
	body: string,
	attributes?: Record<string, string>
) => {
	browserLogger.emit({
		severityNumber,
		severityText,
		body,
		attributes
	});
};

const ensureBrowserTelemetry = () => {
	if (initialized) {
		return Boolean(PUBLIC_ORVO_OTLP_BASE_URL && PUBLIC_ORVO_PUBLIC_INGESTION_KEY);
	}

	initialized = true;

	if (!PUBLIC_ORVO_OTLP_BASE_URL || !PUBLIC_ORVO_PUBLIC_INGESTION_KEY) {
		return false;
	}

	const resource = defaultResource().merge(
		resourceFromAttributes({
			[ATTR_SERVICE_NAME]: 'orvo-app-browser',
			[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: 'browser'
		})
	);

	const headers = {
		Authorization: `Bearer ${PUBLIC_ORVO_PUBLIC_INGESTION_KEY}`,
		[selfTelemetryHeader]: 'true'
	};

	const tracerProvider = new WebTracerProvider({
		resource,
		spanProcessors: [
			new BatchSpanProcessor(
				new OTLPTraceExporter({
					url: buildTracesUrl(PUBLIC_ORVO_OTLP_BASE_URL),
					headers
				})
			)
		]
	});

	tracerProvider.register();
	tracer = trace.getTracer('orvo-app-browser');

	const loggerProvider = new LoggerProvider({
		resource,
		processors: [
			new BatchLogRecordProcessor(
				new OTLPLogExporter({
					url: buildLogsUrl(PUBLIC_ORVO_OTLP_BASE_URL),
					headers
				}),
				{
					scheduledDelayMillis: 1000,
					maxExportBatchSize: 32,
					maxQueueSize: 256
				}
			)
		]
	});

	otelLogs.setGlobalLoggerProvider(loggerProvider);
	browserLogger = otelLogs.getLogger('orvo-app-browser');

	window.addEventListener('error', (event) => {
		emitBrowserLog(SeverityNumber.ERROR, 'ERROR', event.message || 'Unhandled browser error', {
			'app.source': 'browser',
			'error.filename': event.filename ?? '',
			'error.lineno': String(event.lineno ?? ''),
			'error.colno': String(event.colno ?? '')
		});
	});

	window.addEventListener('unhandledrejection', (event) => {
		const reason =
			typeof event.reason === 'string'
				? event.reason
				: event.reason instanceof Error
					? event.reason.message
					: JSON.stringify(event.reason);

		emitBrowserLog(SeverityNumber.ERROR, 'ERROR', 'Unhandled promise rejection', {
			'app.source': 'browser',
			'error.reason': reason
		});
	});

	return true;
};

export const initializeBrowserTelemetry = () => {
	ensureBrowserTelemetry();
};

export const captureBrowserNavigation = (url: URL) => {
	if (!ensureBrowserTelemetry()) {
		return;
	}

	const fullUrl = url.toString();
	const route = url.pathname;

	const span = tracer.startSpan('app.page_view', {
		attributes: {
			'app.source': 'browser',
			'app.route': route,
			'url.full': fullUrl
		}
	});

	span.end();

	emitBrowserLog(SeverityNumber.INFO, 'INFO', 'Browser navigation', {
		'app.source': 'browser',
		'app.route': route,
		'url.full': fullUrl
	});
};
