import type { UIMessage } from "ai";

const asRecord = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;

const truncate = (value: unknown, limit: number) =>
  typeof value === "string" && value.length > limit
    ? `${value.slice(0, limit)}…`
    : value;

const defined = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );

const compactValue = (
  value: unknown,
  options: { depth?: number; maxDepth?: number; maxEntries?: number } = {},
): unknown => {
  const depth = options.depth ?? 0;
  const maxDepth = options.maxDepth ?? 3;
  const maxEntries = options.maxEntries ?? 16;
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return truncate(value, 600);
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (depth >= maxDepth) return "[omitted]";
  if (Array.isArray(value)) {
    return value
      .slice(0, maxEntries)
      .map((item) =>
        compactValue(item, { depth: depth + 1, maxDepth, maxEntries }),
      );
  }
  const record = asRecord(value);
  if (!record) return String(value);
  return Object.fromEntries(
    Object.entries(record)
      .slice(0, maxEntries)
      .map(([key, item]) => [
        key,
        compactValue(item, { depth: depth + 1, maxDepth, maxEntries }),
      ]),
  );
};

const compactAttributes = (value: unknown, limit = 16) => {
  const record = asRecord(value);
  if (!record) return undefined;
  const diagnosticAttribute =
    /(?:error|exception|http|url|db\.|rpc|messaging|server\.|client\.|network\.|service\.|deployment\.)/i;
  const entries = Object.entries(record)
    .sort(([left], [right]) => {
      const leftPriority = diagnosticAttribute.test(left) ? 1 : 0;
      const rightPriority = diagnosticAttribute.test(right) ? 1 : 0;
      return rightPriority - leftPriority;
    })
    .slice(0, limit);
  if (!entries.length) return undefined;
  return Object.fromEntries(
    entries.map(([key, item]) => [key, truncate(String(item), 200)]),
  );
};

const compactLog = (value: unknown, detailed = false) => {
  const log = asRecord(value);
  if (!log) return null;
  return defined({
    id: log.id,
    timestamp: log.timestamp,
    severity: log.severity ?? log.severity_text ?? log.severity_number,
    service: log.service ?? log.service_name,
    environment: log.environment ?? log.deployment_environment,
    body: truncate(log.body, detailed ? 4_000 : 700),
    traceId: log.traceId || log.trace_id || undefined,
    spanId: log.spanId || log.span_id || undefined,
    ...(detailed
      ? {
          logAttributes: compactAttributes(
            log.logAttributes ?? log.log_attributes,
            24,
          ),
          resourceAttributes: compactAttributes(
            log.resourceAttributes ?? log.resource_attributes,
            16,
          ),
          scope:
            log.scope ??
            (log.scope_name || log.scope_version
              ? defined({ name: log.scope_name, version: log.scope_version })
              : undefined),
        }
      : {}),
  });
};

const compactTraceSummary = (value: unknown) => {
  const trace = asRecord(value);
  if (!trace) return null;
  return defined({
    id: trace.id,
    traceId: trace.traceId ?? trace.trace_id,
    name: trace.display_name || trace.name,
    start: trace.start ?? trace.start_time,
    durationNs: trace.durationNs ?? trace.duration_ns,
    spans: trace.spans ?? trace.span_count,
    errors: trace.errors ?? trace.error_count,
    services: trace.services ?? trace.service_names,
    environments: trace.environments ?? trace.deployment_environments,
  });
};

const parseTelemetryArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const compactSpan = (value: unknown) => {
  const span = asRecord(value);
  if (!span) return null;
  const events = parseTelemetryArray(span.events_json).slice(0, 3);
  const spanEvents = events.length
    ? events
    : Array.isArray(span.events)
      ? span.events
      : [];
  const links = parseTelemetryArray(span.links_json);
  return defined({
    id: span.id ?? span.span_id,
    parentId: span.parentId ?? span.parent_span_id ?? undefined,
    name: span.name,
    service: span.service ?? span.service_name,
    environment: span.environment ?? span.deployment_environment,
    kind: span.kind,
    start: span.start ?? span.start_time,
    durationNs: Number(span.durationNs ?? span.duration_ns ?? 0),
    status: span.status ?? span.status_code,
    statusMessage:
      truncate(span.statusMessage ?? span.status_message, 500) || undefined,
    scope:
      span.scope ??
      (span.scope_name || span.scope_version
        ? defined({ name: span.scope_name, version: span.scope_version })
        : undefined),
    attributes: compactAttributes(span.attributes ?? span.span_attributes, 6),
    events: spanEvents.length
      ? spanEvents.slice(0, 3).map((item) => {
          const event = asRecord(item);
          return defined({
            name: event?.name,
            time:
              event?.time ??
              event?.timestamp ??
              event?.time_unix_nano ??
              event?.timeUnixNano,
            attributes: compactAttributes(event?.attributes, 6),
          });
        })
      : undefined,
    linkCount: (span.linkCount ?? links.length) || undefined,
  });
};

const compactTrace = (value: unknown) => {
  const data = asRecord(value);
  const spans = Array.isArray(data?.spans) ? data.spans : [];
  const ranked = spans
    .map((span, index) => ({ span, index, row: asRecord(span) }))
    .sort((left, right) => {
      const leftStatus = left.row?.status ?? left.row?.status_code ?? 0;
      const rightStatus = right.row?.status ?? right.row?.status_code ?? 0;
      const leftPriority = !(left.row?.parentId ?? left.row?.parent_span_id)
        ? 2
        : Number(leftStatus) === 2 ||
            String(leftStatus).toLowerCase() === "error"
          ? 1
          : 0;
      const rightPriority = !(right.row?.parentId ?? right.row?.parent_span_id)
        ? 2
        : Number(rightStatus) === 2 ||
            String(rightStatus).toLowerCase() === "error"
          ? 1
          : 0;
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;
      return (
        Number(right.row?.durationNs ?? right.row?.duration_ns ?? 0) -
        Number(left.row?.durationNs ?? left.row?.duration_ns ?? 0)
      );
    })
    .slice(0, 50)
    .sort((left, right) => left.index - right.index)
    .map(({ span }) => compactSpan(span))
    .filter(Boolean);

  return {
    traceId: data?.traceId ?? asRecord(spans[0])?.trace_id,
    spanCount: data?.spanCount ?? spans.length,
    spans: ranked,
    truncated: Boolean(data?.truncated) || spans.length > ranked.length,
  };
};

const compactIncident = (value: unknown, detailed = false) => {
  const incident = asRecord(value);
  if (!incident) return null;
  return defined({
    id: incident.id,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    type: incident.type,
    sourceType: incident.sourceType,
    sourceId: incident.sourceId,
    service: incident.service ?? incident.serviceName,
    entityType: incident.entityType,
    entityId: incident.entityId || undefined,
    entityName: incident.entityName || undefined,
    openedAt: incident.openedAt,
    resolvedAt: incident.resolvedAt || undefined,
    lastObservedAt: incident.lastObservedAt,
    lastObservedValue: incident.lastObservedValue ?? undefined,
    ...(detailed
      ? {
          details: compactValue(incident.details ?? incident.sourceSnapshot, {
            maxDepth: 2,
            maxEntries: 12,
          }),
        }
      : {}),
  });
};

const compactHeartbeat = (value: unknown, detailed = false) => {
  const monitor = asRecord(value);
  if (!monitor) return null;
  return defined({
    id: monitor.id,
    name: monitor.name,
    status: monitor.status,
    paused: monitor.paused ?? monitor.isPaused,
    expectedEverySeconds: monitor.expectedEverySeconds,
    graceSeconds: monitor.graceSeconds,
    lastCheckInAt: monitor.lastCheckInAt || undefined,
    ...(detailed
      ? {
          destinations: compactValue(monitor.destinations, {
            maxDepth: 2,
            maxEntries: 10,
          }),
        }
      : {}),
  });
};

const compactMetrics = (value: unknown) => {
  const data = asRecord(value);
  const window = asRecord(data?.window);
  if (data && window) {
    const compactSeries = Array.isArray(data?.series) ? data.series : [];
    return {
      window: compactValue(window, { maxDepth: 2, maxEntries: 5 }),
      catalog: Array.isArray(data.catalog)
        ? data.catalog
            .slice(0, 20)
            .map((item) => compactValue(item, { maxDepth: 2, maxEntries: 8 }))
        : [],
      series: compactSeries.slice(0, 8).map((item) => {
        const row = asRecord(item);
        return defined({
          name: truncate(row?.name, 255),
          points: row?.points,
          values: Array.isArray(row?.values)
            ? row.values
                .slice(0, 60)
                .map((point) =>
                  typeof point === "number" || point === null ? point : null,
                )
            : [],
        });
      }),
    };
  }
  const catalog = Array.isArray(data?.catalog) ? data.catalog : [];
  const series = Array.isArray(data?.series) ? data.series : [];
  const firstBuckets = asRecord(series[0])?.buckets;
  const buckets = Array.isArray(firstBuckets) ? firstBuckets : [];
  const firstBucket = asRecord(buckets[0]);
  const secondBucket = asRecord(buckets[1]);
  const bucketSeconds =
    firstBucket?.startAtUtc && secondBucket?.startAtUtc
      ? (new Date(String(secondBucket.startAtUtc)).getTime() -
          new Date(String(firstBucket.startAtUtc)).getTime()) /
        1_000
      : undefined;

  return defined({
    window: defined({
      start: data?.startAtUtc,
      end: data?.endAtUtc,
      bucketSeconds,
    }),
    catalog: catalog.slice(0, 20).map((item) => {
      const metric = asRecord(item);
      return metric
        ? defined({
            name: metric.name,
            type: metric.type,
            unit: metric.unit,
            description: truncate(metric.description, 300),
            lastValue: metric.lastValue,
            points: metric.points,
          })
        : null;
    }),
    series: series.slice(0, 8).map((item) => {
      const row = asRecord(item);
      const rowBuckets = Array.isArray(row?.buckets) ? row.buckets : [];
      return {
        name: row?.name,
        points: row?.points,
        values: rowBuckets.map((bucket) => asRecord(bucket)?.value ?? null),
      };
    }),
  });
};

const compactServiceGraph = (value: unknown) => {
  const data = asRecord(value);
  return {
    window:
      data?.window ?? defined({ start: data?.startAtUtc, end: data?.endAtUtc }),
    nodes: Array.isArray(data?.nodes) ? data.nodes.slice(0, 50) : [],
    edges: Array.isArray(data?.edges) ? data.edges.slice(0, 100) : [],
  };
};

const compactToolOutput = (toolName: string, value: unknown) => {
  const output = asRecord(value);
  if (!output) return compactValue(value);
  if (output.error) return { error: truncate(output.error, 500) };
  const data = asRecord(output.data);

  switch (toolName) {
    case "list_apps":
      return compactValue(value, { maxDepth: 5, maxEntries: 25 });
    case "search_logs":
      return {
        data: {
          logs: Array.isArray(data?.logs)
            ? data.logs.slice(0, 25).map((log) => compactLog(log))
            : [],
          nextCursor: data?.nextCursor ?? null,
        },
      };
    case "get_log":
      return { data: { log: compactLog(data?.log, true) } };
    case "search_traces":
      return {
        data: {
          traces: Array.isArray(data?.traces)
            ? data.traces.slice(0, 25).map(compactTraceSummary)
            : [],
          nextCursor: data?.nextCursor ?? null,
        },
      };
    case "get_trace":
      return { data: compactTrace(data) };
    case "get_service_graph":
      return { data: compactServiceGraph(data) };
    case "query_metrics":
      return { data: compactMetrics(data) };
    case "list_incidents":
      return {
        data: {
          incidents: Array.isArray(data?.incidents)
            ? data.incidents.slice(0, 25).map((item) => compactIncident(item))
            : [],
        },
      };
    case "get_incident": {
      const events = Array.isArray(data?.events) ? data.events : [];
      const deliveries = Array.isArray(data?.deliveries) ? data.deliveries : [];
      return {
        data: {
          incident: compactIncident(data?.incident, true),
          events: events.slice(-50).map((item) => {
            const event = asRecord(item);
            return defined({
              type: event?.type ?? event?.eventType,
              at: event?.at ?? event?.occurredAt,
              metadata: compactValue(event?.metadata, {
                maxDepth: 2,
                maxEntries: 10,
              }),
            });
          }),
          deliveries: deliveries.slice(-20).map((item) => {
            const delivery = asRecord(item);
            return defined({
              destination: delivery?.destinationName,
              kind: delivery?.kind ?? delivery?.destinationKind,
              status: delivery?.status,
              attempts: delivery?.attempts ?? delivery?.attemptNumber,
              lastAttemptAt: delivery?.lastAttemptAt,
              deliveredAt: delivery?.deliveredAt,
              httpStatus: delivery?.httpStatus,
              error: truncate(delivery?.errorMessage, 500),
            });
          }),
        },
      };
    }
    case "list_heartbeat_monitors": {
      const monitors = Array.isArray(output.data)
        ? output.data
        : Array.isArray(data?.monitors)
          ? data.monitors
          : [];
      return {
        data: monitors.slice(0, 25).map((item) => compactHeartbeat(item)),
      };
    }
    case "get_heartbeat_monitor":
      return {
        data: compactHeartbeat(data?.monitor ?? output.data, true),
      };
    case "list_alert_rules":
    case "get_alert_rule":
      return compactValue(value, { maxDepth: 6, maxEntries: 25 });
    case "get_app_overview":
      return compactValue(value, { maxDepth: 5, maxEntries: 20 });
    default:
      return compactValue(value, { maxDepth: 3, maxEntries: 20 });
  }
};

const createToolOutputBudget = (limit = 120_000) => {
  let used = 0;
  return (output: unknown) => {
    const size = JSON.stringify(output).length;
    if (used + size > limit) {
      return {
        error:
          "Tool output budget reached. Use narrower filters or answer from the evidence already collected.",
      };
    }
    used += size;
    return output;
  };
};

const compactMessagesForModel = (messages: UIMessage[]) => {
  const compacted = messages
    .filter((message) => message.role !== "system")
    .slice(-40)
    .map((message) => {
      const parts: UIMessage["parts"] = [];
      for (const part of message.parts) {
        if (part.type === "reasoning") continue;
        if (part.type === "text") {
          parts.push({
            ...part,
            text: String(truncate(part.text, 12_000)),
          });
          continue;
        }
        if (!("output" in part)) continue;
        const toolName =
          "toolName" in part && typeof part.toolName === "string"
            ? part.toolName
            : part.type.replace(/^tool-/, "");
        parts.push({
          ...part,
          ...(typeof part.input === "object" && part.input !== null
            ? {
                input: compactValue(part.input, {
                  maxDepth: 3,
                  maxEntries: 20,
                }),
              }
            : {}),
          output: compactToolOutput(toolName, part.output),
        } as UIMessage["parts"][number]);
      }
      return { ...message, metadata: undefined, parts };
    })
    .filter((message) => message.parts.length) as UIMessage[];
  const selected: UIMessage[] = [];
  let contextCharacters = 0;

  for (let index = compacted.length - 1; index >= 0; index -= 1) {
    const message = compacted[index];
    if (!message) continue;
    const messageCharacters = JSON.stringify(message).length;
    if (selected.length && contextCharacters + messageCharacters > 100_000) {
      break;
    }
    selected.unshift(message);
    contextCharacters += messageCharacters;
  }

  return selected;
};

export {
  compactHeartbeat,
  compactIncident,
  compactLog,
  compactMessagesForModel,
  compactMetrics,
  compactServiceGraph,
  compactToolOutput,
  compactTrace,
  compactTraceSummary,
  compactValue,
  createToolOutputBudget,
};
