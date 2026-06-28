type TestLogger = {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, error?: unknown) => void;
  child: (context: string, meta?: Record<string, unknown>) => TestLogger;
};

const noop = () => {};

const createTestLogger = (): TestLogger => {
  const logger: TestLogger = {
    debug: noop,
    info: noop,
    warn: (message, data) => {
      if (process.env.TEST_LOG_VERBOSE === "true") {
        console.warn(`[test] ${message}`, data ?? "");
      }
    },
    error: (message, error) => {
      console.error(`[test] ${message}`, error ?? "");
    },
    child: () => logger,
  };
  return logger;
};

export { createTestLogger, type TestLogger };
