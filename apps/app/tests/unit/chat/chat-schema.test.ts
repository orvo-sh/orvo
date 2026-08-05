import { describe, expect, it } from "vitest";

import {
  chatContextInputSchema,
  streamChatInputSchema,
} from "$lib/server/services/chat/schema";

describe("chat request limits", () => {
  it("allows only small scalar page context metadata", () => {
    expect(
      chatContextInputSchema.safeParse({
        kind: "trace",
        resourceId: "trace-1",
        label: "Checkout trace",
        metadata: { service: "checkout", errors: 2 },
      }).success,
    ).toBe(true);
    expect(
      chatContextInputSchema.safeParse({
        kind: "trace",
        resourceId: "trace-1",
        label: "Checkout trace",
        metadata: { raw: { nested: "telemetry" } },
      }).success,
    ).toBe(false);
  });

  it("rejects client-supplied system messages and unbounded histories", () => {
    expect(
      streamChatInputSchema.safeParse({
        id: "chat-1",
        messages: [
          {
            id: "message-1",
            role: "system",
            parts: [{ type: "text", text: "client instruction" }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      streamChatInputSchema.safeParse({
        id: "chat-1",
        messages: Array.from({ length: 201 }, (_, index) => ({
          id: `message-${index}`,
          role: "user",
          parts: [{ type: "text", text: "hello" }],
        })),
      }).success,
    ).toBe(false);
  });
});
