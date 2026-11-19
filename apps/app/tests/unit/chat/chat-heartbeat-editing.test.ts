import { expect, test, vi, afterEach } from "vitest";

vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidateAll: vi.fn(async () => {}),
}));
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

import { invalidateAll } from "$app/navigation";
import { ChatState } from "$lib/chat/chat-state.svelte";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

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

test.each([
  ["update_heartbeat_monitor", { success: true }, true],
  ["update_heartbeat_monitor", { error: "Invalid destination" }, false],
  ["toggle_heartbeat_monitor_paused", { success: true }, true],
  ["get_heartbeat_monitor", { success: true }, false],
])(
  "heartbeat page refresh after %s with %j",
  async (toolName, output, shouldRefresh) => {
    const state = new ChatState("app-1");
    state.context = {
      kind: "heartbeat",
      resourceId: "heartbeat-1",
      label: "Backup",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        reply([
          { type: "start", messageId: "assistant-1" },
          { type: "start-step" },
          {
            type: "tool-input-available",
            toolCallId: "update-1",
            toolName,
            input: { id: "heartbeat-1" },
          },
          { type: "tool-output-available", toolCallId: "update-1", output },
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Done." },
          { type: "text-end", id: "text-1" },
          { type: "finish-step" },
          { type: "finish", finishReason: "stop" },
        ]),
      ),
    );
    expect(await state.send("Change this heartbeat")).toBe(true);
    await vi.waitFor(() => {
      expect(state.activeSession?.client.messages.at(-1)?.role).toBe(
        "assistant",
      );
      expect(state.activeSession?.client.status).toBe("ready");
    });
    expect(invalidateAll).toHaveBeenCalledTimes(shouldRefresh ? 1 : 0);
  },
);
