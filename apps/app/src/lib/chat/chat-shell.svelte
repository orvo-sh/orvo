<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "@repo/components/ui/button";
  import * as Popover from "@repo/components/ui/popover";
  import {
    IconArrowUpRight,
    IconHistory,
    IconMessagePlus,
    IconX,
  } from "@tabler/icons-svelte";

  import ChatComposer from "./chat-composer.svelte";
  import ChatHistory from "./chat-history.svelte";
  import ChatMessageList from "./chat-message-list.svelte";
  import { useChatState } from "./chat-state.svelte";

  let { mode = "page", chatId }: { mode?: "page" | "rail"; chatId?: string } =
    $props();

  const chat = useChatState();
  let historyOpen = $state(false);
  const session = $derived(chat.activeSession);
  const client = $derived(session?.client ?? null);
  const status = $derived(client?.status ?? "ready");
  const messages = $derived(client?.messages ?? []);
  const title = $derived(
    session?.thread.title && session.thread.title !== "New chat"
      ? session.thread.title
      : "Scout",
  );

  $effect(() => {
    if (chatId && chat.activeChatId !== chatId) void chat.openChat(chatId);
    if (!chatId && mode === "page" && page.url.pathname.endsWith("/chat")) {
      chat.newChat(null);
    }
  });

  const startNew = async () => {
    chat.newChat(mode === "rail" ? chat.context : null);
    historyOpen = false;
  };
</script>

<div
  data-testid={`chat-shell-${mode}`}
  class="flex h-full min-h-0 min-w-0 flex-1 bg-background"
>
  <section class="flex min-h-0 min-w-0 flex-1 flex-col">
    {#if mode === "rail"}
      <div class="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-foreground">
            {title}
          </div>
        </div>

        <Popover.Root bind:open={historyOpen}>
          <Popover.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="ghost"
                size="icon-sm"
                aria-label="Chat history"
              >
                <IconHistory />
              </Button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Content align="end" class="w-80 gap-0 p-1.5">
            <div class="flex items-center justify-between px-2 py-1.5">
              <span class="text-sm font-medium">Conversations</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="New chat"
                onclick={startNew}
              >
                <IconMessagePlus />
              </Button>
            </div>
            <ChatHistory
              mode="popover"
              onSelect={() => (historyOpen = false)}
            />
          </Popover.Content>
        </Popover.Root>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Open Scout page"
          href={`/a/${page.params.app_id}/chat${chat.activeChatId ? `/${chat.activeChatId}` : ""}`}
          onclick={chat.closeRail}
        >
          <IconArrowUpRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close Scout"
          onclick={chat.closeRail}
        >
          <IconX />
        </Button>
      </div>
    {/if}

    {#if chat.loading && !client}
      <div
        class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
      >
        Loading conversation…
      </div>
    {:else}
      {#if messages.length}
        <ChatMessageList
          {messages}
          {status}
          chatId={chat.activeChatId}
          target={chat.target}
          onToolApproval={(id, approved) =>
            void client?.addToolApprovalResponse({ id, approved })}
        />
      {/if}
      {#if chat.error}
        <div class="px-4 pb-1 text-center text-sm text-destructive">
          {chat.error}
        </div>
      {/if}
      <ChatComposer
        {status}
        onSend={chat.send}
        onStop={() => client?.stop()}
        centered={!messages.length}
        compact={mode === "rail"}
      />
    {/if}
  </section>
</div>
