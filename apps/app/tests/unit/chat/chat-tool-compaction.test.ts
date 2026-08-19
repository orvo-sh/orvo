import { describe, expect, it } from "vitest";

import {
  compactMessagesForModel,
  compactToolOutput,
  compactTrace,
  createToolOutputBudget,
} from "$lib/server/services/chat/tools/compact";

describe("chat tool result compaction", () => {
  it("keeps log searches bounded and removes internal fields", () => {
    const output = compactToolOutput("search_logs", {
      data: {
        logs: Array.from({ length: 40 }, (_, index) => ({
          id: `log-${index}`,
          app_id: "internal-app",
          ingestion_key_id: "secret-key",
          timestamp: "2026-08-05T10:00:00.000Z",
          severity_text: "ERROR",
          service_name: "checkout",
          body: "x".repeat(5_000),
          log_attributes: Object.fromEntries(
            Array.from({ length: 100 }, (__, attributeIndex) => [
              `attribute-${attributeIndex}`,
              "y".repeat(1_000),
            ]),
          ),
        })),
        nextCursor: "next",
      },
    });
    const serialized = JSON.stringify(output);

    expect(serialized).not.toContain("internal-app");
    expect(serialized).not.toContain("secret-key");
    expect(serialized).not.toContain("attribute-0");
    expect(serialized.length).toBeLessThan(25_000);
    expect((output as { data: { logs: unknown[] } }).data.logs).toHaveLength(
      25,
    );
  });

  it("prioritizes useful spans and caps large traces", () => {
    const output = compactTrace({
      spans: Array.from({ length: 200 }, (_, index) => ({
        trace_id: "trace-1",
        span_id: `span-${index}`,
        parent_span_id: index === 0 ? "" : "span-0",
        name: `operation-${index}`,
        duration_ns: index,
        status_code: index === 180 ? 2 : 0,
        resource_attributes: { huge: "x".repeat(10_000) },
        span_attributes: { route: `/checkout/${index}` },
        events_json: "[]",
        links_json: "[]",
      })),
    });

    expect(output.spans).toHaveLength(50);
    expect(output.spans).toContainEqual(
      expect.objectContaining({ id: "span-0" }),
    );
    expect(output.spans).toContainEqual(
      expect.objectContaining({ id: "span-180", status: 2 }),
    );
    expect(output.truncated).toBe(true);
    expect(JSON.stringify(output)).not.toContain("resource_attributes");
  });

  it("collapses metric buckets and remains stable across conversation turns", () => {
    const raw = {
      data: {
        startAtUtc: "2026-08-05T10:00:00.000Z",
        endAtUtc: "2026-08-05T11:00:00.000Z",
        summary: { totalPoints: 10_000, metricCount: 4 },
        facets: { metrics: Array.from({ length: 100 }, (_, index) => index) },
        catalog: [{ name: "http.duration", unit: "ms", lastValue: 42 }],
        series: [
          {
            name: "checkout",
            points: 100,
            buckets: Array.from({ length: 30 }, (_, index) => ({
              startAtUtc: new Date(
                Date.UTC(2026, 7, 5, 10, index * 2),
              ).toISOString(),
              endAtUtc: new Date(
                Date.UTC(2026, 7, 5, 10, index * 2 + 2),
              ).toISOString(),
              value: index,
              points: 3,
            })),
          },
        ],
        samples: Array.from({ length: 100 }, (_, index) => ({ value: index })),
      },
    };
    const compact = compactToolOutput("query_metrics", raw);
    const replayed = compactToolOutput("query_metrics", compact);
    const serialized = JSON.stringify(compact);

    expect(replayed).toEqual(compact);
    expect(serialized).not.toContain("facets");
    expect(serialized).not.toContain("samples");
    expect(
      (
        compact as {
          data: { series: Array<{ values: unknown[] }> };
        }
      ).data.series[0]?.values,
    ).toHaveLength(30);
  });

  it("sanitizes oversized tool results already stored in chat history", () => {
    const messages = compactMessagesForModel([
      {
        id: "message-1",
        role: "assistant",
        metadata: { providerPayload: "x".repeat(20_000) },
        parts: [
          {
            type: "dynamic-tool",
            toolName: "search_logs",
            toolCallId: "call-1",
            state: "output-available",
            input: {},
            output: {
              data: {
                logs: [
                  {
                    id: "log-1",
                    app_id: "internal-app",
                    body: "x".repeat(10_000),
                    resource_attributes: {
                      secret: "y".repeat(10_000),
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ]);
    const serialized = JSON.stringify(messages);

    expect(serialized).not.toContain("providerPayload");
    expect(serialized).not.toContain("internal-app");
    expect(serialized).not.toContain("resource_attributes");
    expect(serialized.length).toBeLessThan(2_000);
  });

  it("bounds conversation history and omits prior reasoning", () => {
    const messages = compactMessagesForModel([
      ...Array.from({ length: 45 }, (_, index) => ({
        id: `message-${index}`,
        role: "user" as const,
        parts: [{ type: "text" as const, text: `question ${index}` }],
      })),
      {
        id: "assistant-message",
        role: "assistant",
        parts: [
          {
            type: "reasoning",
            text: "private reasoning that should not be replayed",
            state: "done",
          },
          { type: "text", text: "x".repeat(20_000), state: "done" },
        ],
      },
    ]);
    const serialized = JSON.stringify(messages);

    expect(messages).toHaveLength(40);
    expect(messages[0]?.id).toBe("message-6");
    expect(serialized).not.toContain("private reasoning");
    expect(serialized).not.toContain("question 5");
    expect(serialized.length).toBeLessThan(16_000);
  });

  it("keeps the replayed model context inside a fixed character budget", () => {
    const messages = compactMessagesForModel(
      Array.from({ length: 40 }, (_, index) => ({
        id: `message-${index}`,
        role: "user" as const,
        parts: [{ type: "text" as const, text: "x".repeat(10_000) }],
      })),
    );

    expect(messages.at(-1)?.id).toBe("message-39");
    expect(messages.length).toBeLessThan(12);
    expect(JSON.stringify(messages).length).toBeLessThanOrEqual(100_000);
  });

  it("caps cumulative output across a multi-tool turn", () => {
    const withinBudget = createToolOutputBudget(100);

    expect(withinBudget({ data: "x".repeat(40) })).toEqual({
      data: "x".repeat(40),
    });
    expect(withinBudget({ data: "y".repeat(60) })).toEqual({
      error:
        "Tool output budget reached. Use narrower filters or answer from the evidence already collected.",
    });
  });

  it("keeps app and alert identifiers usable in nested lists", () => {
    const apps = compactToolOutput("list_apps", {
      data: { apps: [{ id: "app_1", name: "Checkout" }] },
    });
    const alerts = compactToolOutput("list_alert_rules", {
      data: {
        rules: [
          {
            id: "alrt_1",
            name: "Error rate",
            destinations: [{ id: "dst_1", name: "On-call" }],
          },
        ],
      },
    });

    expect(JSON.stringify(apps)).toContain("app_1");
    expect(JSON.stringify(alerts)).toContain("alrt_1");
    expect(JSON.stringify(alerts)).toContain("dst_1");
    expect(JSON.stringify({ apps, alerts })).not.toContain("[omitted]");
  });
});
