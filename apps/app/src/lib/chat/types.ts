import type { UIMessage } from "ai";

type ChatContextDescriptor = {
  kind: "trace" | "log" | "metric" | "incident" | "heartbeat";
  resourceId: string;
  label: string;
  metadata?: Record<string, unknown>;
};

type ChatThread = {
  id: string;
  title: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  contexts: Array<ChatContextDescriptor & { id: string; chatId: string }>;
};

type ChatSession = {
  thread: ChatThread;
  client: import("@ai-sdk/svelte").Chat<UIMessage>;
};

export type { ChatContextDescriptor, ChatSession, ChatThread };
