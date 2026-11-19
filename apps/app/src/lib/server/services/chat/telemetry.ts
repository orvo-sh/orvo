import { context, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { StepResult, ToolSet } from "ai";

// One usage-bearing span per completed model call; never record aggregate turn
// usage here, because a turn may include several model/tool steps.
const createScoutTelemetry = (
  purpose: "conversation" | "title",
  identity: { userId: string; organizationId: string; appId: string; chatId: string },
) => {
  const parent = context.active();
  const recorded = new Set<string>();
  return (
    step: Pick<
      StepResult<ToolSet>,
      | "callId"
      | "stepNumber"
      | "model"
      | "response"
      | "usage"
      | "performance"
      | "finishReason"
    >,
  ) => {
    const key = `${step.callId}:${step.stepNumber}`;
    if (recorded.has(key)) return;
    recorded.add(key);
    const end = Date.now();
    const duration = step.performance.responseTimeMs;
    const span = trace.getTracer("orvo-scout").startSpan(
      `chat ${step.model.modelId}`,
      {
        kind: SpanKind.CLIENT,
        startTime:
          Number.isFinite(duration) && duration >= 0 ? end - duration : end,
        attributes: {
          "gen_ai.operation.name": "chat",
          "gen_ai.provider.name": step.model.provider.split(".")[0],
          "gen_ai.request.model": step.model.modelId,
          "gen_ai.response.model": step.response.modelId ?? step.model.modelId,
          "gen_ai.response.finish_reasons": [step.finishReason],
          "orvo.scout.purpose": purpose,
          "user.id": identity.userId,
          "orvo.organization.id": identity.organizationId,
          "orvo.app.id": identity.appId,
          "orvo.chat.id": identity.chatId,
        },
      },
      parent,
    );
    const valid = (value: number | undefined) =>
      typeof value === "number" && Number.isFinite(value) && value >= 0;
    const input = step.usage.inputTokens,
      output = step.usage.outputTokens;
    const total =
      step.usage.totalTokens ??
      (valid(input) && valid(output) ? input! + output! : undefined);
    for (const [attribute, value] of Object.entries({
      "gen_ai.usage.input_tokens": input,
      "gen_ai.usage.output_tokens": output,
      "gen_ai.usage.total_tokens": total,
      "gen_ai.usage.cache_read.input_tokens":
        step.usage.inputTokenDetails?.cacheReadTokens,
      "gen_ai.usage.reasoning.output_tokens":
        step.usage.outputTokenDetails?.reasoningTokens,
    }))
      if (valid(value)) span.setAttribute(attribute, value!);
    span.setStatus({ code: SpanStatusCode.OK });
    span.end(end);
  };
};
export { createScoutTelemetry };
