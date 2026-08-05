<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { Button } from "@repo/components/ui/button";
  import * as Popover from "@repo/components/ui/popover";
  import {
    IconArrowUpRight,
    IconHistory,
    IconPlus,
    IconSparkles,
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

  $effect(() => {
    if (chatId && chat.activeChatId !== chatId) void chat.openChat(chatId);
    if (!chatId && mode === "page" && page.url.pathname.endsWith("/chat")) {
      chat.newChat(null);
    }
  });

  const startNew = async () => {
    chat.newChat(mode === "rail" ? chat.context : null);
    historyOpen = false;
    if (mode === "page" && !page.url.pathname.endsWith("/chat")) {
      await goto(
        resolve("/(dashboard)/a/[app_id]/chat", {
          app_id: chat.appId,
        }),
      );
    }
  };
</script>

<div
  data-testid={`chat-shell-${mode}`}
  class="flex h-full min-h-0 min-w-0 flex-1 bg-background"
>
  <section class="flex min-h-0 min-w-0 flex-1 flex-col">
    <div class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        {#if mode === "rail"}
          <span
            class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <IconSparkles class="size-3.5" />
          </span>
          <div class="min-w-0">
            <div class="text-xs font-medium text-foreground">Scout</div>
            <div class="truncate text-[10px] text-muted-foreground">
              {chat.context?.label ?? "App assistant"}
            </div>
          </div>
        {:else}
          <div class="min-w-0">
            <div class="truncate text-xs font-medium text-foreground">
              {session?.thread.title ?? "New chat"}
            </div>
            {#if chat.context}
              <div class="truncate text-[10px] text-muted-foreground">
                Context: {chat.context.label}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      {#if mode === "rail"}
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
          <Popover.Content align="end" class="w-72 gap-0 p-1.5">
            <div class="flex items-center justify-between px-2 py-1.5">
              <span class="text-xs font-medium">Conversations</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="New chat"
                onclick={startNew}
              >
                <IconPlus />
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
      {/if}
    </div>

    {#if chat.loading && !client}
      <div
        class="flex flex-1 items-center justify-center text-xs text-muted-foreground"
      >
        Loading conversation…
      </div>
    {:else}
      <ChatMessageList
        {messages}
        {status}
        chatId={chat.activeChatId}
        context={chat.context}
        target={chat.target}
        compact={mode === "rail"}
        onSuggestion={(prompt) => void chat.send(prompt)}
      />
      {#if chat.error}
        <div class="px-4 pb-1 text-center text-[11px] text-destructive">
          {chat.error}
        </div>
      {/if}
      <ChatComposer
        {status}
        contextLabel={chat.context?.label}
        onSend={chat.send}
        onStop={() => client?.stop()}
      />
    {/if}
  </section>
</div>
