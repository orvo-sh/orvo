import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import { trace, ROOT_CONTEXT, SpanKind } from "@opentelemetry/api";
import { tracing } from "@opentelemetry/sdk-node";
import { createScoutTelemetry } from "$lib/server/services/chat/telemetry";
import { createSelfTelemetrySampler } from "$lib/server/self-telemetry-sampler";

const exporter = new tracing.InMemorySpanExporter();
const provider = new tracing.BasicTracerProvider({
  spanProcessors: [new tracing.SimpleSpanProcessor(exporter)],
});
beforeAll(() => {
  trace.setGlobalTracerProvider(provider);
});
afterEach(() => {
  exporter.reset();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await provider.shutdown();
  trace.disable();
});
const identity = { userId: "user-1", organizationId: "org-1", appId: "app-1", chatId: "chat-1" };
const step = (stepNumber = 0) =>
  ({
    callId: "call-1",
    stepNumber,
    model: { provider: "openai.responses", modelId: "model-a" },
    response: { modelId: "model-a" },
    usage: {
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      inputTokenDetails: { cacheReadTokens: 30 },
      outputTokenDetails: { reasoningTokens: 5 },
    },
    performance: { responseTimeMs: 50 },
    finishReason: "stop",
  }) as Parameters<ReturnType<typeof createScoutTelemetry>>[0];

test("emits one usage span for each model step without prompts or aggregate double-counting", () => {
  const record = createScoutTelemetry("conversation", identity);
  record(step());
  record(step());
  record(step(1));
  const spans = exporter.getFinishedSpans();
  expect(spans).toHaveLength(2);
  for (const span of spans) {
    expect(span.attributes).toMatchObject({
      "user.id": "user-1",
      "orvo.organization.id": "org-1",
      "orvo.app.id": "app-1",
      "orvo.chat.id": "chat-1",
    });
    expect(Object.keys(span.attributes).some((key) => /name$|email/.test(key) && key !== "gen_ai.provider.name" && key !== "gen_ai.operation.name")).toBe(false);
  }
  expect(spans[0].kind).toBe(SpanKind.CLIENT);
  expect(spans[0].attributes).toMatchObject({
    "gen_ai.usage.input_tokens": 100,
    "gen_ai.usage.output_tokens": 20,
    "gen_ai.usage.total_tokens": 120,
    "gen_ai.provider.name": "openai",
    "orvo.scout.purpose": "conversation",
  });
  expect(
    Object.keys(spans[0].attributes).some((key) =>
      /prompt|messages|completion/.test(key),
    ),
  ).toBe(false);
  expect(
    spans.reduce(
      (sum, span) => sum + Number(span.attributes["gen_ai.usage.total_tokens"]),
      0,
    ),
  ).toBe(240);
});

test("does not turn missing or invalid usage into zero and distinguishes title calls", () => {
  const missing = step();
  missing.usage.inputTokens = undefined;
  missing.usage.outputTokens = NaN;
  missing.usage.totalTokens = undefined;
  createScoutTelemetry("title", identity)(missing);
  expect(exporter.getFinishedSpans()[0].attributes).toMatchObject({
    "user.id": "user-1", "orvo.organization.id": "org-1", "orvo.chat.id": "chat-1",
  });
  expect(exporter.getFinishedSpans()[0].attributes).not.toHaveProperty(
    "gen_ai.usage.input_tokens",
  );
  expect(exporter.getFinishedSpans()[0].attributes).not.toHaveProperty(
    "gen_ai.usage.output_tokens",
  );
  expect(exporter.getFinishedSpans()[0].attributes["orvo.scout.purpose"]).toBe(
    "title",
  );
});

test("usage spans are retained when the configured sampler drops ordinary traces", () => {
  vi.stubEnv("OTEL_TRACES_SAMPLER", "always_off");
  const sampler = createSelfTelemetrySampler();
  const args = [
    ROOT_CONTEXT,
    "12345678901234567890123456789012",
    "chat",
    SpanKind.CLIENT,
    {},
    [],
  ] as Parameters<typeof sampler.shouldSample>;
  expect(sampler.shouldSample(...args).decision).toBe(
    tracing.SamplingDecision.NOT_RECORD,
  );
  args[4] = { "orvo.scout.purpose": "conversation" };
  expect(sampler.shouldSample(...args).decision).toBe(
    tracing.SamplingDecision.RECORD_AND_SAMPLED,
  );
});


test("separate chats do not share user attribution", () => {
  const other = { ...identity, userId: "user-2", organizationId: "org-2", chatId: "chat-2" };
  const first = createScoutTelemetry("conversation", identity);
  const second = createScoutTelemetry("conversation", other);
  second(step());
  first(step());
  expect(exporter.getFinishedSpans().map((span) => [span.attributes["user.id"], span.attributes["orvo.organization.id"], span.attributes["orvo.chat.id"]])).toEqual([
    ["user-2", "org-2", "chat-2"], ["user-1", "org-1", "chat-1"],
  ]);
});
