import { nextActionsOutputSchema } from "$lib/chat/suggestions";
import type { UIMessage, UIMessageChunk } from "ai";

const clientToolOutput = (output: unknown, isSuggestion = false) => {
  if (isSuggestion) {
    const parsed = nextActionsOutputSchema.safeParse(output);
    if (parsed.success) return parsed.data;
  }
  return output &&
    typeof output === "object" &&
    "error" in output &&
    typeof output.error === "string"
    ? { error: output.error.slice(0, 500) }
    : { success: true };
};

const sanitizeChatMessagesForClient = (messages: UIMessage[]) =>
  messages.map((message) => ({
    ...message,
    metadata:
      message.metadata &&
      typeof message.metadata === "object" &&
      "finishReason" in message.metadata &&
      typeof message.metadata.finishReason === "string"
        ? { finishReason: message.metadata.finishReason }
        : undefined,
    parts: message.parts.map((part) =>
      "output" in part && "state" in part && part.state === "output-available"
        ? {
            ...part,
            output: clientToolOutput(
              part.output,
              part.type === "tool-suggest_next_actions" ||
                (part.type === "dynamic-tool" &&
                  part.toolName === "suggest_next_actions"),
            ),
          }
        : part,
    ),
  }));

const createClientChatStream = (stream: ReadableStream<UIMessageChunk>) => {
  const suggestionCalls = new Set<string>();
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform: (chunk, controller) => {
        if (
          (chunk.type === "tool-input-start" ||
            chunk.type === "tool-input-available") &&
          chunk.toolName === "suggest_next_actions"
        )
          suggestionCalls.add(chunk.toolCallId);
        controller.enqueue(
          chunk.type === "tool-output-available"
            ? {
                ...chunk,
                output: clientToolOutput(
                  chunk.output,
                  suggestionCalls.has(chunk.toolCallId),
                ),
              }
            : chunk,
        );
      },
    }),
  );
};

export { createClientChatStream, sanitizeChatMessagesForClient };
