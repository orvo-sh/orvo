<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "@repo/components/ui/button";
  import { IconX, IconMaximize, IconPlus } from "@tabler/icons-svelte";
  import { goto } from "$app/navigation";
  import AssistantConversation from "./assistant-conversation.svelte";
  import { assistantSidebarState } from "$lib/stores/assistant-sidebar.svelte";

  let {
    appId,
    hidden = false,
  }: {
    appId?: string;
    hidden?: boolean;
  } = $props();

  const openFullChat = async () => {
    assistantSidebarState.open = false;
    await goto(`/a/${appId}/chat`);
  };
</script>

{#if appId && !hidden && assistantSidebarState.open}
  <div
    class="flex h-full w-96 min-w-96 flex-col border-l bg-background shadow-xl sm:shadow-none"
  >
    <div class="flex h-13 shrink-0 items-center justify-between border-b px-3">
      <div class="flex min-w-0 items-center gap-2">
        <span
          class="truncate text-sm font-semibold tracking-tight text-foreground"
          >Ask Orvo</span
        >
      </div>
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onclick={openFullChat}
          aria-label="Open full chat"
        >
          <IconMaximize data-slot="button-icon" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onclick={() => (assistantSidebarState.open = false)}
          aria-label="Close Ask Orvo"
        >
          <IconX data-slot="button-icon" />
        </Button>
      </div>
    </div>

    <AssistantConversation
      {appId}
      initialChatId={assistantSidebarState.chatId}
      mode="compact"
      class="min-h-0 flex-1 rounded-none border-none shadow-none"
      onNavigateFull={() => (assistantSidebarState.open = false)}
    />
  </div>
{/if}
