const generateHexId = (length: number) => {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const attr = (key: string, value: string) => ({
  key,
  value: { stringValue: value },
});

const buildTestTracePayload = () => {
  const traceId = generateHexId(32);
  const rootSpanId = generateHexId(16);
  const childSpanId = generateHexId(16);
  const nowMs = Date.now();

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [attr("service.name", "orvo-onboarding")],
        },
        scopeSpans: [
          {
            scope: { name: "orvo-onboarding" },
            spans: [
              {
                traceId,
                spanId: rootSpanId,
                name: "GET /health",
                kind: 2,
                startTimeUnixNano: `${nowMs}000000`,
                endTimeUnixNano: `${nowMs + 50}000000`,
                attributes: [],
                status: { code: 1 },
              },
              {
                traceId,
                spanId: childSpanId,
                parentSpanId: rootSpanId,
                name: "postgres.query",
                kind: 2,
                startTimeUnixNano: `${nowMs}000000`,
                endTimeUnixNano: `${nowMs + 20}000000`,
                attributes: [attr("db.system", "postgresql")],
                status: { code: 1 },
              },
            ],
          },
        ],
      },
    ],
  };
};

const buildTestLogPayload = () => {
  const nowMs = Date.now();

  return {
    resourceLogs: [
      {
        resource: {
          attributes: [attr("service.name", "orvo-onboarding")],
        },
        scopeLogs: [
          {
            scope: { name: "orvo-onboarding" },
            logRecords: [
              {
                timeUnixNano: `${nowMs}000000`,
                severityText: "INFO",
                body: { stringValue: "Hello from Orvo" },
                attributes: [],
              },
            ],
          },
        ],
      },
    ],
  };
};

const buildTestMetricPayload = () => {
  const nowMs = Date.now();

  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [attr("service.name", "orvo-onboarding")],
        },
        scopeMetrics: [
          {
            scope: { name: "orvo-onboarding" },
            metrics: [
              {
                name: "cpu.usage",
                description: "Example CPU usage metric from Orvo onboarding.",
                unit: "1",
                gauge: {
                  dataPoints: [
                    {
                      timeUnixNano: `${nowMs}000000`,
                      asDouble: 42,
                      attributes: [],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };
};

export {
  buildTestLogPayload,
  buildTestMetricPayload,
  buildTestTracePayload,
};
