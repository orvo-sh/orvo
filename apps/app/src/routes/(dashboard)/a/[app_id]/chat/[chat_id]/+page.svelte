<script lang="ts">
  import { page } from "$app/state";
  import * as Chat from "$lib/chat";
  import { Button } from "@repo/components/ui/button";
  import { IconHourglass, IconPlus } from "@tabler/icons-svelte";
  import PageContainer from "../../_components/page-container/page-container.svelte";

  const chat = Chat.useChatState();
</script>

<PageContainer
  title="Scout"
  contentClass="p-0!"
  asideTitle="Conversations"
  bind:asideOpen={chat.conversationsOpen}
>
  {#snippet actions()}
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="New conversation"
      href={`/a/${page.params.app_id}/chat`}
      onclick={() => chat.newChat(null)}
    >
      <IconPlus />
    </Button>
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="Conversations"
      aria-pressed={chat.conversationsOpen}
      onclick={() => (chat.conversationsOpen = !chat.conversationsOpen)}
    >
      <IconHourglass />
    </Button>
  {/snippet}
  {#snippet aside()}
    <Chat.History mode="page" />
  {/snippet}
  <Chat.Shell mode="page" chatId={page.params.chat_id} />
</PageContainer>
