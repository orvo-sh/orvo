<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import * as Chat from "$lib/chat";
  import { cn } from "@repo/components";
  import * as Sheet from "@repo/components/ui/sheet";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";

  import { Button } from "@repo/components/ui/button";
  import { IconChevronLeft, IconX } from "@tabler/icons-svelte";
  import PageContainerAppSwitcher from "./page-container-app-switcher.svelte";

  let {
    title,
    actions,
    children,
    aside,
    asideTitle,
    asideOpen = $bindable(false),
    class: className = "",
    contentClass,
    back,
    chat,
  }: {
    title: string;
    actions?: Snippet;
    children?: Snippet;
    aside?: Snippet;
    asideTitle?: string;
    asideOpen?: boolean;
    class?: string;
    contentClass?: string;
    back?: { href: string; title: string };
    chat?: Chat.ChatContextDescriptor;
  } = $props();

  let isMobile = $state(false);

  onMount(() => {
    if (!browser) {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncIsMobile = () => {
      isMobile = mediaQuery.matches;
    };

    syncIsMobile();
    mediaQuery.addEventListener("change", syncIsMobile);

    return () => {
      mediaQuery.removeEventListener("change", syncIsMobile);
    };
  });

  const chatState = Chat.useChatState();

  $effect(() => {
    if (chat && asideOpen && chatState.railOpen) chatState.closeRail();
  });
</script>

<div
  class={cn(
    `flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background`,
    className,
  )}
>
  <header
    class="sticky top-0 z-10 flex h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/90 bg-background p-3"
  >
    <div class="flex min-w-0 items-center gap-2 md:flex-1">
      {#if back}
        <Button
          variant="ghost"
          size="icon-sm"
          class="md:hidden"
          href={back.href}
        >
          <IconChevronLeft />
        </Button>
      {/if}

      <div class={cn("md:hidden", back && "hidden")}>
        <Sidebar.Trigger />
      </div>

      <div
        class={cn("flex min-w-0 items-center gap-0.5", back && "not-md:hidden")}
      >
        <div class="flex-1">
          <PageContainerAppSwitcher
            apps={page.data.apps}
            currentAppId={page.data.currentApp.id}
          />
        </div>
        <span class="font-meduim text-muted-foreground/20 md:hidden"> / </span>
      </div>
    </div>

    <div class="flex flex-1 items-center gap-2 md:justify-center">
      {#if back}
        <a
          href={back.href}
          class="text-sm font-normal tracking-tight text-muted-foreground not-md:hidden hover:text-secondary-foreground hover:underline"
          >{back.title}</a
        >
        <span class="font-normal text-muted-foreground/20 not-md:hidden">
          /
        </span>
      {/if}
      <h1 class="text-sm font-normal tracking-tight text-foreground">
        {title}
      </h1>
    </div>

    <div class="flex-1">
      <div class="flex w-auto flex-wrap items-center justify-end gap-2">
        {#if actions}
          {@render actions()}
        {/if}
        {#if chat}
          <Chat.Trigger context={chat} onOpen={() => (asideOpen = false)} />
        {/if}
      </div>
    </div>
  </header>

  <div class="flex min-h-0 flex-1">
    <div class={cn("flex min-h-0 flex-1 flex-col overflow-auto", contentClass)}>
      {@render children?.()}
    </div>
    {#if aside && !isMobile}
      <aside
        class={cn(
          "hidden h-full min-h-0 shrink-0 flex-col bg-background transition-[width,border-color] duration-200 ease-out md:flex",
          asideOpen ? "w-88 border-l" : "w-0",
        )}
      >
        <div
          class="flex h-14 min-h-14 w-full items-center justify-between border-b px-3"
        >
          <span class="text-sm">
            {asideTitle}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onclick={() => (asideOpen = false)}
          >
            <IconX />
          </Button>
        </div>
        <div
          class={cn(
            "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden transition-all duration-200 ease-out",
            asideOpen
              ? "translate-x-0 opacity-100"
              : "pointer-events-none translate-x-4 opacity-0",
          )}
        >
          {@render aside()}
        </div>
      </aside>
    {/if}
  </div>
</div>

{#if aside && isMobile}
  <Sheet.Root bind:open={asideOpen}>
    <Sheet.Content
      side="right"
      class="w-full gap-0 p-0! sm:max-w-none"
      showCloseButton={false}
    >
      <div
        class="flex h-14 min-h-14 w-full items-center justify-between border-b px-3"
      >
        <span class="text-sm">
          {asideTitle}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onclick={() => (asideOpen = false)}
        >
          <IconX />
        </Button>
      </div>
      {@render aside()}
    </Sheet.Content>
  </Sheet.Root>
{/if}
