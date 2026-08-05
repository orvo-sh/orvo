<script lang="ts">
  import { browser } from "$app/environment";
  import * as Sheet from "@repo/components/ui/sheet";
  import { onMount } from "svelte";

  import ChatShell from "./chat-shell.svelte";
  import { useChatState } from "./chat-state.svelte";

  const chat = useChatState();
  let isMobile = $state(false);

  onMount(() => {
    if (!browser) return;
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => (isMobile = query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  });
</script>

<aside
  data-testid="chat-rail"
  class="hidden h-full min-h-0 shrink-0 overflow-hidden bg-background transition-[width,border-color] duration-250 ease-[cubic-bezier(.2,.8,.2,1)] md:block"
  class:w-[420px]={chat.railOpen}
  class:w-0={!chat.railOpen}
  class:border-l={chat.railOpen}
  aria-hidden={!chat.railOpen}
>
  <div
    class="h-full w-[420px] transition-[opacity,transform] duration-200 ease-out"
    class:translate-x-0={chat.railOpen}
    class:opacity-100={chat.railOpen}
    class:pointer-events-none={!chat.railOpen}
    class:translate-x-3={!chat.railOpen}
    class:opacity-0={!chat.railOpen}
  >
    {#if !isMobile && chat.railOpen}
      <ChatShell mode="rail" />
    {/if}
  </div>
</aside>

{#if isMobile}
  <Sheet.Root
    bind:open={() => chat.railOpen, (open) => !open && chat.closeRail()}
  >
    <Sheet.Content
      side="right"
      class="w-full gap-0 p-0! sm:max-w-none"
      showCloseButton={false}
    >
      {#if chat.railOpen}
        <ChatShell mode="rail" />
      {/if}
    </Sheet.Content>
  </Sheet.Root>
{/if}
