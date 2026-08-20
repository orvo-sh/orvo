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

  it("accepts a current overview context with stream requests", () => {
    expect(
      streamChatInputSchema.safeParse({
        id: "chat-1",
        pageContext: {
          kind: "overview",
          resourceId: "overview",
          label: "Overview",
          metadata: {
            layout:
              "Error rate is on the left and p95 latency is on the right.",
            timeFilter: "last 1h",
            p95LatencyMs: 240,
          },
        },
        message: {
          id: "message-1",
          role: "user",
          parts: [{ type: "text", text: "What happened?" }],
        },
      }).success,
    ).toBe(true);
  });

  it("accepts only one user or assistant message per stream request", () => {
    expect(
      streamChatInputSchema.safeParse({
        id: "chat-1",
        message: {
          id: "message-1",
          role: "system",
          parts: [{ type: "text", text: "client instruction" }],
        },
      }).success,
    ).toBe(false);
    expect(
      streamChatInputSchema.safeParse({
        id: "chat-1",
        message: {
          id: "message-1",
          role: "user",
          parts: [{ type: "text", text: "x".repeat(100_000) }],
        },
      }).success,
    ).toBe(false);
  });
});
