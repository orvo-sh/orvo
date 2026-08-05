<script lang="ts">
  import { page } from "$app/state";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";

  import { setChatState } from "./chat-state.svelte";

  let { appId, children }: { appId: string; children: Snippet } = $props();

  const chat = setChatState(appId);
  let handledLink = "";

  onMount(() => {
    void chat.loadHistory();
  });

  $effect(() => {
    const chatRoot = `/a/${appId}/chat`;
    if (
      chat.railOpen &&
      (page.url.pathname === chatRoot ||
        page.url.pathname.startsWith(`${chatRoot}/`))
    ) {
      chat.closeRail();
    }

    const chatId = page.url.searchParams.get("chat");
    const messageId = page.url.searchParams.get("chat_message");
    const linkKey = `${chatId ?? ""}:${messageId ?? ""}`;
    if (chatId && linkKey !== handledLink) {
      handledLink = linkKey;
      void chat.openChat(chatId, {
        rail: true,
        ...(messageId ? { messageId } : {}),
      });
    }
  });
</script>

{@render children()}
