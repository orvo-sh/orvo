import { expect, test, vi, afterEach } from "vitest";

vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$app/navigation", () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
vi.mock("$app/paths", () => ({ resolve: vi.fn() }));
vi.mock("$app/state", () => ({
  page: { url: new URL("https://example.com/a/app-1/alerts/rule-1") },
}));
vi.mock("$lib/api/chat.remote", () => ({
  createChatCommand: vi.fn(async () => ({
    success: true,
    data: { id: "chat-1" },
  })),
  createChatAttachmentUploadUrlCommand: vi.fn(),
  deleteChatCommand: vi.fn(),
  getChatQuery: vi.fn(),
  listChatsQuery: vi.fn(() => ({
    run: async () => ({ success: true, data: { chats: [] } }),
  })),
}));

import { createEmptyAlertRuleForm } from "$lib/alerts";
import { ChatState } from "$lib/chat/chat-state.svelte";

afterEach(() => vi.unstubAllGlobals());

const reply = (chunks: unknown[]) =>
  new Response(
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
      "data: [DONE]\n\n",
    {
      headers: {
        "Content-Type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
    },
  );

test("only live tool calls edit the page and their results automatically resume Scout", async () => {
  const state = new ChatState("app-1");
  const execute = vi.fn(async () => ({
    data: {
      editorId: "editor-1",
      ruleId: "rule-1",
      revision: 0,
      tab: "condition",
      form: createEmptyAlertRuleForm(),
      destinations: [],
    },
  }));
  state.ruleEditor = { editorId: "editor-1", ruleId: "rule-1", execute };
  const bodies: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      if (bodies.length === 1)
        return reply([
          { type: "start", messageId: "assistant-1" },
          { type: "start-step" },
          {
            type: "tool-input-available",
            toolCallId: "live-call",
            toolName: "get_rule_editor",
            input: { editorId: "editor-1", ruleId: "rule-1" },
          },
          { type: "finish-step" },
          { type: "finish", finishReason: "tool-calls" },
        ]);
      return reply([
        { type: "start", messageId: "assistant-1" },
        { type: "start-step" },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: "Ready to edit." },
        { type: "text-end", id: "text-1" },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]);
    }),
  );
  expect(await state.send("Configure this rule")).toBe(true);
  await vi.waitFor(() => expect(bodies).toHaveLength(2));
  await vi.waitFor(() =>
    expect(state.activeSession?.client.status).toBe("ready"),
  );
  expect(execute).toHaveBeenCalledOnce();
  expect(bodies[0].ruleEditor).toEqual({
    editorId: "editor-1",
    ruleId: "rule-1",
  });
  expect(JSON.stringify(bodies[1].message)).toContain('"revision":0');

  const completed = structuredClone(state.activeSession!.client.messages);
  const reopened = state.createSession(state.activeSession!.thread, completed);
  expect(reopened.client.messages).toHaveLength(completed.length);
  expect(execute).toHaveBeenCalledOnce();
});
