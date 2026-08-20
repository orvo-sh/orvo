import { describe, expect, it } from "vitest";
import type { UIMessage, UIMessageChunk } from "ai";

import { mergeChatToolApproval } from "$lib/server/services/chat/methods/shared";
import {
  createClientChatStream,
  sanitizeChatMessagesForClient,
} from "$lib/server/services/chat/tools/presentation";

describe("server-authoritative chat messages", () => {
  it("keeps stored tool evidence out of loaded browser messages", () => {
    const messages = sanitizeChatMessagesForClient([
      {
        id: "assistant-1",
        role: "assistant",
        metadata: { internal: "provider metadata" },
        parts: [
          {
            type: "dynamic-tool",
            toolName: "search_logs",
            toolCallId: "call-1",
            state: "output-available",
            input: { intent: "Find checkout errors" },
            output: { data: { logs: [{ body: "secret evidence" }] } },
          },
        ],
      },
    ] as UIMessage[]);

    expect(messages[0]?.metadata).toBeUndefined();
    expect(JSON.stringify(messages)).not.toContain("secret evidence");
    expect(messages[0]?.parts[0]).toEqual(
      expect.objectContaining({
        input: { intent: "Find checkout errors" },
        output: { success: true },
      }),
    );
  });

  it("redacts tool evidence from live UI chunks", async () => {
    const stream = createClientChatStream(
      new ReadableStream<UIMessageChunk>({
        start: (controller) => {
          controller.enqueue({
            type: "tool-output-available",
            toolCallId: "call-1",
            output: { data: { traces: ["private trace"] } },
          });
          controller.close();
        },
      }),
    );

    const chunks: UIMessageChunk[] = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks).toEqual([
      {
        type: "tool-output-available",
        toolCallId: "call-1",
        output: { success: true },
      },
    ]);
  });

  it("merges only a matching signed approval into stored tool state", () => {
    const stored = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "update_app",
          toolCallId: "call-1",
          state: "approval-requested",
          input: { intent: "Rename the app", name: "Checkout" },
          approval: {
            id: "approval-1",
            signature: "signed-on-server",
          },
        },
      ],
    } as UIMessage;
    const incoming = structuredClone(stored);
    incoming.parts[0] = {
      ...incoming.parts[0],
      state: "approval-responded",
      approval: {
        id: "approval-1",
        signature: "signed-on-server",
        approved: true,
      },
      input: { intent: "Tampered", name: "Something else" },
    } as UIMessage["parts"][number];

    const merged = mergeChatToolApproval(stored, incoming);

    expect(merged?.parts[0]).toEqual(
      expect.objectContaining({
        state: "approval-responded",
        input: { intent: "Rename the app", name: "Checkout" },
        approval: expect.objectContaining({ approved: true }),
      }),
    );
    const wrongSignature = structuredClone(incoming);
    const part = wrongSignature.parts[0];
    if ("approval" in part && part.approval) {
      part.approval.signature = "tampered";
    }
    expect(mergeChatToolApproval(stored, wrongSignature)).toBeNull();
  });
});
