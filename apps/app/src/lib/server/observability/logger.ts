import pino from 'pino';

class Logger {
	private logger: pino.Logger;

	constructor(context: string, options?: { pretty?: boolean; meta?: Record<string, unknown> }) {
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

	debug(message: string, data?: unknown) {
		data ? this.logger.debug(data, message) : this.logger.debug(message);
	}

	info(message: string, data?: unknown) {
		data ? this.logger.info(data, message) : this.logger.info(message);
	}

	warn(message: string, data?: unknown) {
		data ? this.logger.warn(data, message) : this.logger.warn(message);
	}

	error(message: string, error?: Error) {
		error ? this.logger.error(error, message) : this.logger.error(message);
	}

	child(context: string, meta?: Record<string, unknown>) {
		const childWrapper = new Logger(context, { meta });
		childWrapper.logger = this.logger.child({ context, ...meta });
		return childWrapper;
	}
}

export { Logger };
