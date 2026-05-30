import pino from 'pino';

type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

type QueuedLogRecord = {
	timestamp: string;
	severityText: LogSeverity;
	severityNumber: number;
	body: string;
	attributes: Record<string, string | number | boolean>;
};

const otlpBaseUrl = process.env.ORVO_OTLP_BASE_URL;
const privateIngestionKey = process.env.ORVO_PRIVATE_INGESTION_KEY;
const deploymentEnvironment = process.env.NODE_ENV ?? 'development';
const shouldShipServerLogs = Boolean(otlpBaseUrl && privateIngestionKey);
const selfTelemetryHeader = 'X-Orvo-Self-Telemetry';

const resourceAttributes = [
	{ key: 'service.name', value: { stringValue: 'orvo-app-server' } },
	{
		key: 'deployment.environment',
		value: { stringValue: deploymentEnvironment }
	}
];

const severityNumberMap: Record<LogSeverity, number> = {
	DEBUG: 5,
	INFO: 9,
	WARN: 13,
	ERROR: 17
};

let queuedLogs: QueuedLogRecord[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

const normalizeAttributeValue = (value: unknown): string | number | boolean => {
	if (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return value;
	}

	if (value instanceof Error) {
		return value.message;
	}

	if (value === null || value === undefined) {
		return '';
	}

	return JSON.stringify(value);
};

const toLogAttributes = (data?: unknown) => {
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(data).map(([key, value]) => [key, normalizeAttributeValue(value)])
	);
};

const flushServerLogs = async () => {
	flushTimeout = null;

	if (!shouldShipServerLogs || queuedLogs.length === 0) {
		return;
	}

	const batch = queuedLogs;
	queuedLogs = [];

	const payload = {
		resourceLogs: [
			{
				resource: {
					attributes: resourceAttributes
				},
				scopeLogs: [
					{
						scope: {
							name: 'orvo-server-logger'
						},
						logRecords: batch.map((record) => ({
							timeUnixNano: String(new Date(record.timestamp).getTime() * 1_000_000),
							severityNumber: record.severityNumber,
							severityText: record.severityText,
							body: {
								stringValue: record.body
							},
							attributes: Object.entries(record.attributes).map(([key, value]) => {
								if (typeof value === 'boolean') {
									return { key, value: { boolValue: value } };
								}

								if (typeof value === 'number') {
									return Number.isInteger(value)
										? { key, value: { intValue: value } }
										: { key, value: { doubleValue: value } };
								}

								return { key, value: { stringValue: value } };
							})
						}))
					}
				]
			}
		]
	};

	try {
		await fetch(new URL('/v1/logs', otlpBaseUrl).toString(), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${privateIngestionKey}`,
				'Content-Type': 'application/json',
				[selfTelemetryHeader]: 'true'
			},
			body: JSON.stringify(payload)
		});
	} catch {
		queuedLogs = [...batch, ...queuedLogs].slice(-500);
	}
};

const queueServerLog = (record: QueuedLogRecord) => {
	if (!shouldShipServerLogs) {
		return;
	}

	queuedLogs.push(record);

	if (queuedLogs.length >= 50) {
		void flushServerLogs();
		return;
	}

	if (!flushTimeout) {
		flushTimeout = setTimeout(() => {
			void flushServerLogs();
		}, 1000);
	}
};

class Logger {
	private logger: pino.Logger;
	private contextName: string;

	constructor(context: string, options?: { pretty?: boolean; meta?: Record<string, unknown> }) {
		this.contextName = context;
		this.logger = pino({
			level: 'debug',
			base: { context, ...options?.meta },
			timestamp: pino.stdTimeFunctions.isoTime,
			transport: options?.pretty
				? {
						target: 'pino-pretty',
						options: {
							colorize: true,
							translateTime: 'SYS:standard',
							ignore: 'hostname,pid'
						}
					}
				: undefined,
			browser: {
				asObject: true
			}
		});
	}

	private emitLog = (severityText: LogSeverity, message: string, data?: unknown) => {
		queueServerLog({
			timestamp: new Date().toISOString(),
			severityText,
			severityNumber: severityNumberMap[severityText],
			body: message,
			attributes: {
				context: this.contextName,
				...toLogAttributes(data)
			}
		});
	};

	debug(message: string, data?: unknown) {
		data ? this.logger.debug(data, message) : this.logger.debug(message);
		this.emitLog('DEBUG', message, data);
	}

	info(message: string, data?: unknown) {
		data ? this.logger.info(data, message) : this.logger.info(message);
		this.emitLog('INFO', message, data);
	}

	warn(message: string, data?: unknown) {
		data ? this.logger.warn(data, message) : this.logger.warn(message);
		this.emitLog('WARN', message, data);
	}

	error(message: string, error?: Error) {
		error ? this.logger.error(error, message) : this.logger.error(message);
		this.emitLog('ERROR', message, error);
	}

	child(context: string, meta?: Record<string, unknown>) {
		const childWrapper = new Logger(context, { meta });
		childWrapper.logger = this.logger.child({ context, ...meta });
		return childWrapper;
	}
}

export { Logger };
