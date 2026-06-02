import { logs as otelLogs } from '@opentelemetry/api-logs';
import { type LoggerProvider } from '@opentelemetry/sdk-logs';
import pino from 'pino';

class Logger {
	private logger: pino.Logger;
	private loggerProvider: LoggerProvider | null;
	private otelLogger: ReturnType<typeof otelLogs.getLogger> | null;

	constructor(
		private context: string,
		options?: {
			meta?: Record<string, unknown>;
			pretty?: boolean;
			loggerProvider?: LoggerProvider | null;
		},
		logger?: pino.Logger
	) {
		this.logger =
			logger ??
			pino({
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
					: undefined
			});
		this.loggerProvider = options?.loggerProvider ?? null;
		this.otelLogger = this.loggerProvider?.getLogger('orvo-server-logger') ?? null;
	}

	debug = (message: string, data?: unknown) => {
		this.write('DEBUG', message, data);
	};

	info = (message: string, data?: unknown) => {
		this.write('INFO', message, data);
	};

	warn = (message: string, data?: unknown) => {
		this.write('WARN', message, data);
	};

	error = (message: string, data?: unknown) => {
		this.write('ERROR', message, data);
	};

	child = (context: string, meta?: Record<string, unknown>) =>
		new Logger(context, {
			loggerProvider: this.loggerProvider
		}, this.logger.child({ context, ...meta }));

	private write = (severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, data?: unknown) => {
		switch (severity) {
			case 'DEBUG':
				data ? this.logger.debug(data, message) : this.logger.debug(message);
				break;
			case 'INFO':
				data ? this.logger.info(data, message) : this.logger.info(message);
				break;
			case 'WARN':
				data ? this.logger.warn(data, message) : this.logger.warn(message);
				break;
			case 'ERROR':
				if (data instanceof Error) {
					this.logger.error(data, message);
				} else {
					data ? this.logger.error(data, message) : this.logger.error(message);
				}
				break;
		}

		this.otelLogger?.emit({
			severityText: severity,
			body: message,
			attributes: {
				context: this.context,
				...(data instanceof Error
					? {
							'error.message': data.message,
							'error.name': data.name,
							'error.stack': data.stack ?? ''
						}
					: data && typeof data === 'object' && !Array.isArray(data)
						? Object.fromEntries(
								Object.entries(data).map(([key, value]) => [
									key,
									typeof value === 'string' ||
									typeof value === 'number' ||
									typeof value === 'boolean'
										? value
										: value instanceof Error
											? value.message
											: value === null || value === undefined
												? ''
												: JSON.stringify(value)
								])
							)
						: {})
			}
		});
	};
}

export { Logger };
