import type { UIMessage } from "ai";
import { z } from "zod";
import type { ChatContextDescriptor } from "./types";

const nextActionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        prompt: z.string().trim().min(1).max(600),
      }),
    )
    .max(3),
});
const nextActionsOutputSchema = nextActionsSchema.extend({
  context: z.object({ kind: z.string(), resourceId: z.string() }),
});

const getFollowUpSuggestions = (
  messages: UIMessage[],
  context: ChatContextDescriptor | null,
) => {
  const message = messages.at(-1);
  if (!context || message?.role !== "assistant") return [];
  const metadata = message.metadata as { finishReason?: string } | undefined;
  if (metadata?.finishReason !== "stop") return [];
  const tools = message.parts.filter(
    (part) => part.type === "dynamic-tool" || part.type.startsWith("tool-"),
  );
  if (
    tools.some(
      (part) =>
        !("state" in part) ||
        !["output-available", "output-error", "output-denied"].includes(
          String(part.state),
        ),
    )
  )
    return [];
  for (const part of tools.toReversed()) {
    const name =
      part.type === "dynamic-tool"
        ? part.toolName
        : part.type.replace(/^tool-/, "");
    if (name !== "suggest_next_actions" || !("output" in part)) continue;
    const parsed = nextActionsOutputSchema.safeParse(part.output);
    if (
      !parsed.success ||
      parsed.data.context.kind !== context.kind ||
      parsed.data.context.resourceId !== context.resourceId
    )
      return [];
    return parsed.data.suggestions.filter(
      (item, index, all) =>
        all.findIndex((other) => other.prompt === item.prompt) === index,
    );
  }
  return [];
};

export { nextActionsSchema, nextActionsOutputSchema, getFollowUpSuggestions };
