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

describe("live rule editor acknowledgements", () => {
  it("accepts only results for a pending editor call and preserves the server-issued input", async () => {
    const { mergeChatEditorOutputs } =
      await import("$lib/server/services/chat/methods/shared");
    const stored = {
      id: "assistant-editor",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "edit_rule_condition",
          toolCallId: "editor-call",
          state: "input-available",
          input: {
            editorId: "editor-1",
            ruleId: "rule-1",
            revision: 0,
            condition: { threshold: 5 },
          },
        },
      ],
    } as UIMessage;
    const incoming = structuredClone(stored);
    incoming.parts[0] = {
      ...incoming.parts[0],
      input: { condition: { threshold: 900 } },
      state: "output-available",
      output: { data: { editorId: "editor-1", ruleId: "rule-1", revision: 1 } },
    } as UIMessage["parts"][number];
    const merged = mergeChatEditorOutputs(stored, incoming);
    expect(merged?.parts[0]).toMatchObject({
      state: "output-available",
      input: { condition: { threshold: 5 } },
      output: { data: { revision: 1 } },
    });
    expect(mergeChatEditorOutputs(merged!, incoming)).toBeNull();
    const otherRule = structuredClone(incoming);
    (otherRule.parts[0] as { output: unknown }).output = {
      data: { editorId: "editor-1", ruleId: "another-rule", revision: 1 },
    };
    expect(mergeChatEditorOutputs(stored, otherRule)).toBeNull();
    const serverTool = structuredClone(stored);
    (serverTool.parts[0] as { toolName: string }).toolName =
      "update_alert_rule";
    expect(mergeChatEditorOutputs(serverTool, incoming)).toBeNull();
  });
});


describe("live dashboard editor acknowledgements", () => {
  it("preserves issued panel changes and rejects results for other dashboards or replayed calls", async () => {
    const { mergeChatEditorOutputs } = await import("$lib/server/services/chat/methods/shared");
    const stored = { id: "assistant-dashboard", role: "assistant", parts: [{ type: "dynamic-tool", toolName: "upsert_dashboard_panel", toolCallId: "dashboard-call", state: "input-available", input: { editorId: "editor-1", dashboardId: "dash-1", revision: 0, panel: { title: "Input tokens", measure: "input_tokens" } } }] } as UIMessage;
    const incoming = structuredClone(stored);
    incoming.parts[0] = { ...incoming.parts[0], state: "output-available", input: { panel: { title: "Forged change" } }, output: { data: { editorId: "editor-1", dashboardId: "dash-1", revision: 1 } } } as UIMessage["parts"][number];
    const merged = mergeChatEditorOutputs(stored, incoming);
    expect(merged?.parts[0]).toMatchObject({ input: { panel: { title: "Input tokens" } }, output: { data: { revision: 1 } } });
    expect(mergeChatEditorOutputs(merged!, incoming)).toBeNull();
    (incoming.parts[0] as { output: unknown }).output = { data: { editorId: "editor-1", dashboardId: "other", revision: 1 } };
    expect(mergeChatEditorOutputs(stored, incoming)).toBeNull();
  });
});
