import { SpanStatusCode, trace, type Span } from "@opentelemetry/api";

const tracer = trace.getTracer("orvo-app");

const NO_TRACE_METADATA = Symbol("orvo:no-trace");
const TRACE_WRAPPED_METADATA = Symbol("orvo:trace-wrapped");

type InstrumentOptions = {
  prefix?: string;
  ignore?: string[];
};

type TraceOptions =
  | string
  | {
      name?: string;
      attributes?: (
        ...args: unknown[]
      ) => Record<string, string | number | boolean | null | undefined>;
    };

type Method = (this: unknown, ...args: unknown[]) => unknown;

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

const recordSpanError = (span: Span, error: unknown) => {
  const resolvedError = toError(error);

  span.recordException(resolvedError);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: resolvedError.message,
  });
};

const recordError = (error: unknown) => {
  const span = trace.getActiveSpan();
  if (!span) {
    return;
  }

  recordSpanError(span, error);
};

const wrapMethod = (
  original: Method,
  spanName: string,
  getAttributes?: (
    ...args: unknown[]
  ) => Record<string, string | number | boolean | null | undefined>,
) => {
  const wrapped = function (this: unknown, ...args: unknown[]) {
    return tracer.startActiveSpan(spanName, (span) => {
      try {
        const attributes = getAttributes?.(...args);

        if (attributes) {
          for (const [key, value] of Object.entries(attributes)) {
            if (value !== undefined && value !== null) {
              span.setAttribute(key, value);
            }
          }
        }

        const result = original.apply(this, args);

        if (result instanceof Promise) {
          return result
            .then((value) => {
              span.setStatus({ code: SpanStatusCode.OK });
              return value;
            })
            .catch((error) => {
              recordSpanError(span, error);
              throw error;
            })
            .finally(() => {
              span.end();
            });
        }

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        return result;
      } catch (error) {
        recordSpanError(span, error);
        span.end();
        throw error;
      }
    });
  };

  Reflect.defineProperty(wrapped, TRACE_WRAPPED_METADATA, {
    value: true,
    enumerable: false,
  });

  return wrapped;
};

const Trace = (options?: TraceOptions) =>
  (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const original = descriptor.value;
    if (typeof original !== "function") {
      return descriptor;
    }

    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const spanName =
      typeof options === "string"
        ? options
        : options?.name ?? `${className}.${methodName}`;
    const getAttributes =
      typeof options === "object" ? options.attributes : undefined;

    descriptor.value = wrapMethod(original, spanName, getAttributes);
    return descriptor;
  };

const NoTrace = () =>
  (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    if (typeof descriptor.value === "function") {
      Reflect.defineProperty(descriptor.value, NO_TRACE_METADATA, {
        value: true,
        enumerable: false,
      });
    }

    return descriptor;
  };

const Instrument = (options: InstrumentOptions = {}) =>
  <T extends new (...args: any[]) => object>(constructor: T) => {
    const prototype = constructor.prototype;
    const ignored = new Set(options.ignore ?? []);

    for (const key of Object.getOwnPropertyNames(prototype)) {
      if (key === "constructor") {
        continue;
      }

      if (ignored.has(key)) {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
      if (!descriptor || typeof descriptor.value !== "function") {
        continue;
      }

      const original = descriptor.value as Method & {
        [NO_TRACE_METADATA]?: boolean;
        [TRACE_WRAPPED_METADATA]?: boolean;
      };

      if (original[NO_TRACE_METADATA] || original[TRACE_WRAPPED_METADATA]) {
        continue;
      }

      const spanName = options.prefix
        ? `${options.prefix}.${key}`
        : `${constructor.name}.${key}`;

      descriptor.value = wrapMethod(original, spanName);
      Object.defineProperty(prototype, key, descriptor);
    }

    return constructor;
  };

export { Instrument, NoTrace, recordError, Trace };
