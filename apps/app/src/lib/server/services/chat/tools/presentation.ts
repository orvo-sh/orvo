import type { UIMessage, UIMessageChunk } from "ai";

const clientToolOutput = (output: unknown) =>
  output &&
  typeof output === "object" &&
  "error" in output &&
  typeof output.error === "string"
    ? { error: output.error.slice(0, 500) }
    : { success: true };

const sanitizeChatMessagesForClient = (messages: UIMessage[]) =>
  messages.map((message) => ({
    ...message,
    metadata: undefined,
    parts: message.parts.map((part) =>
      "output" in part
        ? { ...part, output: clientToolOutput(part.output) }
        : part,
    ),
  }));

const createClientChatStream = (stream: ReadableStream<UIMessageChunk>) =>
  stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform: (chunk, controller) => {
        controller.enqueue(
          chunk.type === "tool-output-available"
            ? { ...chunk, output: clientToolOutput(chunk.output) }
            : chunk,
        );
      },
    }),
  );

export { createClientChatStream, sanitizeChatMessagesForClient };
