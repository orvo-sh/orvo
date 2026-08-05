import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { page } from "$app/state";
import {
  createChatCommand,
  deleteChatCommand,
  getChatQuery,
  listChatsQuery,
} from "$lib/api/chat.remote";
import { Chat } from "@ai-sdk/svelte";
import { DefaultChatTransport, type UIMessage } from "ai";
import { getContext, setContext } from "svelte";
import { SvelteDate, SvelteMap } from "svelte/reactivity";

import type { ChatContextDescriptor, ChatSession, ChatThread } from "./types";

const contextKey = (context: ChatContextDescriptor) =>
  `${context.kind}:${context.resourceId}`;

class ChatState {
  appId: string;
  activeChatId = $state<string | null>(null);
  context = $state<ChatContextDescriptor | null>(null);
  railOpen = $state(false);
  conversationsOpen = $state(false);
  loading = $state(false);
  historyLoading = $state(false);
  historyError = $state<string | null>(null);
  error = $state<string | null>(null);
  target = $state<{ chatId: string; messageId: string; nonce: number } | null>(
    null,
  );
  threads = $state<ChatThread[]>([]);
  sessions = new SvelteMap<string, ChatSession>();

  constructor(appId: string) {
    this.appId = appId;
  }

  get activeSession() {
    return this.activeChatId
      ? (this.sessions.get(this.activeChatId) ?? null)
      : null;
  }

  loadHistory = async () => {
    this.historyLoading = true;
    this.historyError = null;
    try {
      const result = await listChatsQuery({ limit: 50 }).run();
      if (!result.success) {
        this.historyError = result.error;
        return;
      }
      this.threads = result.data.chats as ChatThread[];
      for (const thread of this.threads) {
        const session = this.sessions.get(thread.id);
        if (session) this.sessions.set(thread.id, { ...session, thread });
      }
    } catch {
      this.historyError = "Failed to load chat history.";
    } finally {
      this.historyLoading = false;
    }
  };

  loadChat = async (id: string) => {
    const existing = this.sessions.get(id);
    if (existing) return existing;

    this.loading = true;
    this.error = null;
    try {
      const result = await getChatQuery({ id }).run();
      if (!result.success) {
        this.error = result.error;
        return null;
      }

      const session = this.createSession(
        result.data.chat as ChatThread,
        result.data.messages as UIMessage[],
      );
      this.sessions.set(id, session);
      return session;
    } catch {
      this.error = "Failed to load this chat.";
      return null;
    } finally {
      this.loading = false;
    }
  };

  openChat = async (
    id: string,
    options: { rail?: boolean; messageId?: string } = {},
  ) => {
    this.activeChatId = id;
    if (options.rail) this.railOpen = true;
    const session = await this.loadChat(id);
    if (!session && this.activeChatId === id) this.activeChatId = null;
    if (session) {
      this.context = session.thread.contexts[0] ?? null;
      if (options.messageId) {
        this.target = {
          chatId: id,
          messageId: options.messageId,
          nonce: Date.now(),
        };
      }
    }
    return session;
  };

  openContext = async (context: ChatContextDescriptor) => {
    this.context = context;
    this.railOpen = true;
    if (!this.threads.length) await this.loadHistory();
    const matching = this.threads.find((thread) =>
      thread.contexts.some((item) => contextKey(item) === contextKey(context)),
    );

    if (matching) {
      await this.openChat(matching.id, { rail: true });
    } else {
      this.activeChatId = null;
    }
  };

  newChat = (context: ChatContextDescriptor | null = null) => {
    this.activeChatId = null;
    this.context = context;
    this.error = null;
  };

  send = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;

    let session = this.activeSession;
    if (!session) {
      const result = await createChatCommand({
        ...(this.context ? { context: this.context } : {}),
      });
      if (!result.success) {
        this.error = result.error;
        return;
      }

      const now = new SvelteDate().toISOString();
      const thread: ChatThread = {
        id: result.data.id,
        title: "New chat",
        createdAt: now,
        updatedAt: now,
        contexts: this.context
          ? [{ ...this.context, id: "pending", chatId: result.data.id }]
          : [],
      };
      session = this.createSession(thread, []);
      this.sessions.set(thread.id, session);
      this.threads = [thread, ...this.threads];
      this.activeChatId = thread.id;

      if (browser && page.url.pathname.endsWith("/chat")) {
        await goto(
          resolve("/(dashboard)/a/[app_id]/chat/[chat_id]", {
            app_id: this.appId,
            chat_id: thread.id,
          }),
          {
            replaceState: true,
            keepFocus: true,
          },
        );
      }
    }

    this.error = null;
    await session.client.sendMessage({ text: cleanText });
  };

  deleteChat = async (id: string) => {
    const session = this.sessions.get(id);
    if (session && ["submitted", "streaming"].includes(session.client.status)) {
      await session.client.stop();
    }
    const result = await deleteChatCommand({ id });
    if (!result.success) {
      this.error = result.error;
      return false;
    }
    this.sessions.delete(id);
    this.threads = this.threads.filter((thread) => thread.id !== id);
    if (this.activeChatId === id) this.newChat(this.context);
    return true;
  };

  closeRail = () => {
    this.railOpen = false;
  };

  createSession = (thread: ChatThread, messages: UIMessage[]) => ({
    thread,
    client: new Chat<UIMessage>({
      id: thread.id,
      messages,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        body: { appId: this.appId },
      }),
      onFinish: () => {
        void this.loadHistory();
      },
      onError: (error) => {
        this.error = error.message || "The response stopped unexpectedly.";
      },
    }),
  });
}

const CHAT_CONTEXT_KEY = Symbol("app-chat");
const setChatState = (appId: string) =>
  setContext(CHAT_CONTEXT_KEY, new ChatState(appId));
const useChatState = () => {
  const state = getContext<ChatState>(CHAT_CONTEXT_KEY);
  if (!state) throw new Error("Chat state is not available.");
  return state;
};

export { ChatState, setChatState, useChatState };
