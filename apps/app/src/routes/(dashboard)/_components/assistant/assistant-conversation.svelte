<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    createAssistantChatCommand,
    deleteAssistantChatCommand,
    getAssistantChatQuery,
    listAssistantChatsQuery,
  } from "$lib/api/chat.remote";
  import { cn } from "@repo/components";
  import { Button } from "@repo/components/ui/button";
  import { ScrollArea } from "@repo/components/ui/scroll-area";
  import { Separator } from "@repo/components/ui/separator";
  import { Chat } from "@ai-sdk/svelte";
  import { DefaultChatTransport, type UIMessage } from "ai";
  import {
    IconBell,
    IconChartBar,
    IconExternalLink,
    IconGauge,
    IconMessageCircle,
    IconPlus,
    IconRefresh,
    IconSearch,
    IconSparkles,
    IconTrash,
    IconLayoutSidebarRightExpand,
  } from "@tabler/icons-svelte";
  import { pushChatToSidebar } from "$lib/stores/assistant-sidebar.svelte";
  import AssistantInput from "./assistant-input.svelte";
  import AssistantMessage from "./assistant-message.svelte";

  type ChatHistoryEntry = {
    id: string;
    title: string;
    createdAt: string | Date;
    updatedAt: string | Date;
  };

  let {
    appId,
    mode = "full",
    class: className = "",
    initialChatId = "",
    onNavigateFull,
  }: {
    appId: string;
    mode?: "full" | "compact";
    class?: string;
    initialChatId?: string;
    onNavigateFull?: () => void;
  } = $props();

  let activeAppId = $state("");
  let activeChatId = $state(initialChatId);
  let input = $state("");
  let history = $state<ChatHistoryEntry[]>([]);
  let historyLoading = $state(false);
  let chatLoading = $state(false);
  let errorMessage = $state("");
  let viewportRef = $state<HTMLElement | null>(null);

  const suggestions = [
    {
      label: "Summarize recent errors",
      prompt: "Summarize recent errors",
      icon: IconSearch,
    },
    {
      label: "Find the slowest traces",
      prompt: "Find the slowest traces",
      icon: IconGauge,
    },
    {
      label: "Review alert coverage",
      prompt: "Review alert coverage",
      icon: IconBell,
    },
    {
      label: "Show log volume for the last 24 hours",
      prompt: "Show log volume for the last 24 hours",
      icon: IconChartBar,
    },
  ];

  const createChatClient = (messages: UIMessage[] = []) =>
    new Chat<UIMessage>({
      messages,
      transport: new DefaultChatTransport<UIMessage>({
        api: "/api/chat",
        body: () => ({
          chatId: activeChatId,
          appId,
        }),
      }),
      onError: (error) => {
        errorMessage = error.message;
      },
      onFinish: () => {
        void loadHistory();
      },
    });

  let chat = $state(createChatClient());
  const busy = $derived(
    chat.status === "submitted" || chat.status === "streaming",
  );
  const hasMessages = $derived(chat.messages.length > 0);

  const partSignature = (part: UIMessage["parts"][number]) => {
    if (part.type === "text") {
      return `${part.type}:${part.text.length}`;
    }

    if ("state" in part && typeof part.state === "string") {
      return `${part.type}:${part.state}`;
    }

    return part.type;
  };

  const scrollSignature = $derived(
    `${chat.status}:${chat.messages
      .map(
        (message) =>
          `${message.id}:${message.parts.map(partSignature).join(",")}`,
      )
      .join("|")}`,
  );

  const loadHistory = async () => {
    historyLoading = true;

    const result = await listAssistantChatsQuery({ limit: 30 }).run();
    if (!result.success) {
      errorMessage = result.error;
      historyLoading = false;
      return;
    }

    history = result.data.chats as ChatHistoryEntry[];
    historyLoading = false;
  };

  const ensureActiveChat = async () => {
    if (activeChatId) {
      return true;
    }

    const result = await createAssistantChatCommand({ title: "New chat" });
    if (!result.success) {
      errorMessage = result.error;
      return false;
    }

    activeChatId = result.data.id;
    chat = createChatClient([]);
    return true;
  };

  const sendMessage = async (message = input) => {
    const text = message.trim();
    if (!text || busy) {
      return;
    }

    errorMessage = "";
    chat.clearError();

    const ready = await ensureActiveChat();
    if (!ready) {
      return;
    }

    input = "";

    try {
      await chat.sendMessage({ text });
      await loadHistory();
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Ask Orvo failed to respond.";
    }
  };

  const loadChat = async (id: string) => {
    if (id === activeChatId || busy) {
      return;
    }

    chatLoading = true;
    errorMessage = "";

    const result = await getAssistantChatQuery({ id }).run();
    if (!result.success) {
      errorMessage = result.error;
      chatLoading = false;
      return;
    }

    activeChatId = id;
    chat = createChatClient(result.data.messages as UIMessage[]);
    chatLoading = false;
  };

  const startNewChat = async () => {
    if (busy) {
      await chat.stop();
    }

    activeChatId = "";
    input = "";
    errorMessage = "";
    chat = createChatClient([]);
  };

  const deleteChat = async (event: MouseEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();

    const result = await deleteAssistantChatCommand({ id });
    if (!result.success) {
      errorMessage = result.error;
      return;
    }

    if (id === activeChatId) {
      activeChatId = "";
      chat = createChatClient([]);
    }

    await loadHistory();
  };

  const stopResponse = async () => {
    await chat.stop();
  };

  const openFullChat = async () => {
    onNavigateFull?.();
    await goto(`/a/${appId}/chat`);
  };

  const handlePushToSidebar = () => {
    if (!activeChatId) return;
    pushChatToSidebar(appId, activeChatId);
  };

  const formatHistoryDate = (value: string | Date) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  $effect(() => {
    scrollSignature;

    if (!viewportRef) {
      return;
    }

    requestAnimationFrame(() => {
      viewportRef?.scrollTo({
        top: viewportRef.scrollHeight,
        behavior: "smooth",
      });
    });
  });

  $effect(() => {
    if (appId === activeAppId) {
      return;
    }

    activeAppId = appId;
    activeChatId = initialChatId || "";
    input = "";
    errorMessage = "";
    history = [];
    chat = createChatClient([]);
    void loadHistory();

    if (activeChatId) {
      void loadChat(activeChatId);
    }
  });
</script>

<div
  class={cn(
    "flex min-h-0 flex-1 overflow-hidden bg-background",
    mode === "full" ? "h-full flex-col lg:flex-row" : "h-full flex-col",
    className,
  )}
>
  <section class="flex min-h-0 min-w-0 flex-1 flex-col">
    {#if errorMessage}
      <div
        class="border-b border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        {errorMessage}
      </div>
    {/if}

    <ScrollArea class="min-h-0 flex-1" bind:viewportRef>
      <div
        class={cn(
          "mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 px-4 py-5",
          mode === "compact" && "gap-3 px-3 py-4",
        )}
      >
        {#if !hasMessages}
          <div class="flex min-h-72 flex-1 items-center justify-center">
            <div class="w-full max-w-xl space-y-5 text-center">
              <div
                class="mx-auto flex size-12 items-center justify-center rounded-2xl border bg-muted/30 shadow-sm"
              >
                <IconSparkles class="size-5 text-muted-foreground" />
              </div>
              <div>
                <p class="text-lg font-semibold tracking-tight">Ask Orvo</p>
                <p class="mt-1.5 text-sm text-muted-foreground">
                  Talk to this app's logs, traces, and alerts.
                </p>
              </div>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {#each suggestions as suggestion}
                  <button
                    type="button"
                    class="group flex cursor-pointer items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left shadow-xs transition-all hover:bg-muted/60"
                    onclick={() => void sendMessage(suggestion.prompt)}
                  >
                    <div
                      class="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted transition-colors"
                    >
                      <suggestion.icon class="size-3.5 text-muted-foreground" />
                    </div>
                    <span
                      class="text-sm leading-snug text-foreground/80 transition-colors group-hover:text-foreground"
                    >
                      {suggestion.label}
                    </span>
                  </button>
                {/each}
              </div>
            </div>
          </div>
        {:else}
          {#each chat.messages as message, index (message.id)}
            <AssistantMessage
              {message}
              compact={mode === "compact"}
              streaming={busy && index === chat.messages.length - 1}
            />
          {/each}
          {#if chatLoading}
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <IconRefresh class="size-4 animate-spin" />
              Loading chat
            </div>
          {/if}
        {/if}
      </div>
    </ScrollArea>

    {#if mode === "compact" && history.length > 0}
      <div class="border-t px-3 py-2">
        <div class="flex items-center gap-2 overflow-x-auto">
          {#each history.slice(0, 4) as item}
            <button
              type="button"
              class={cn(
                "max-w-44 shrink-0 truncate rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted",
                item.id === activeChatId && "bg-muted text-foreground",
              )}
              onclick={() => void loadChat(item.id)}
            >
              {item.title}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="flex items-center justify-between border-t px-3 py-1.5">
      <div class="flex items-center gap-1">
        {#if mode === "compact"}
          <Button
            variant="ghost"
            size="icon-sm"
            onclick={openFullChat}
            aria-label="Open full chat"
          >
            <IconExternalLink data-slot="button-icon" />
          </Button>
        {:else}
          <Button
            variant="ghost"
            size="icon-sm"
            onclick={handlePushToSidebar}
            disabled={!activeChatId}
            aria-label="Push to sidebar"
          >
            <IconLayoutSidebarRightExpand data-slot="button-icon" />
          </Button>
        {/if}
        <Button
          variant="ghost"
          size="icon-sm"
          onclick={startNewChat}
          aria-label="New chat"
        >
          <IconPlus data-slot="button-icon" />
        </Button>
      </div>
      <div class="text-xs text-muted-foreground">
        {#if busy}
          Working...
        {:else}
          Ready
        {/if}
      </div>
    </div>

    <AssistantInput
      bind:value={input}
      {busy}
      disabled={chatLoading}
      compact={mode === "compact"}
      onSubmit={() => sendMessage()}
      onStop={stopResponse}
    />
  </section>

  {#if mode === "full"}
    <aside class="hidden w-72 shrink-0 flex-col border-l bg-muted/15 lg:flex">
      <div class="flex h-12 items-center justify-between border-b px-3">
        <div class="flex min-w-0 items-center gap-2">
          <IconMessageCircle class="size-4 text-muted-foreground" />
          <span class="truncate text-sm font-medium">Chats</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="gap-1.5 text-foreground hover:text-foreground"
          onclick={startNewChat}
        >
          <IconPlus class="size-4" />
          <span>New</span>
        </Button>
      </div>

      <ScrollArea class="min-h-0 flex-1">
        <div class="flex flex-col gap-0.5 p-2">
          {#if historyLoading && history.length === 0}
            <div class="px-3 py-2 text-xs text-muted-foreground">
              Loading chats
            </div>
          {:else if history.length === 0}
            <div class="px-3 py-2 text-xs text-muted-foreground">
              No chats yet.
            </div>
          {:else}
            {#each history as item}
              <div class="group relative flex items-center">
                <Button
                  variant="ghost"
                  class={cn(
                    "h-auto w-full justify-start rounded-lg px-3 py-2.5 pr-9 text-left transition-colors",
                    item.id === activeChatId
                      ? "bg-background text-foreground shadow-sm hover:bg-background"
                      : "hover:bg-muted/60",
                  )}
                  onclick={() => void loadChat(item.id)}
                >
                  <div class="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                    <span
                      class={cn(
                        "block w-full min-w-0 truncate text-sm leading-snug",
                        item.id === activeChatId
                          ? "font-medium"
                          : "font-normal",
                      )}
                    >
                      {item.title}
                    </span>
                    <span class="block text-xs text-muted-foreground">
                      {formatHistoryDate(item.updatedAt)}
                    </span>
                  </div>
                </Button>
                <div
                  class="absolute right-1 z-10 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                  role="button"
                  tabindex="-1"
                  onclick={(event) => event.stopPropagation()}
                  onkeydown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.stopPropagation();
                    }
                  }}
                >
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-foreground"
                    onclick={(event) => void deleteChat(event, item.id)}
                    aria-label="Delete chat"
                  >
                    <IconTrash data-slot="button-icon" />
                  </Button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </ScrollArea>
    </aside>
  {/if}
</div>
