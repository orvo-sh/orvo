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
  import { IconChevronLeft, IconSparkle, IconX } from "@tabler/icons-svelte";
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
    scout,
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
    scout?: Chat.ChatContextDescriptor;
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
    if (scout && asideOpen && chatState.railOpen) chatState.closeRail();
  });
</script>

<div
  class={cn(
    `flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background`,
    className,
  )}
>
  <header
    class="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/90 bg-background p-3"
  >
    <div class="flex max-w-[40%] min-w-0 items-center gap-2">
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
        <div class="min-w-0 flex-1">
          <PageContainerAppSwitcher
            apps={page.data.apps}
            currentAppId={page.data.currentApp.id}
          />
        </div>
        <span class="font-meduim text-muted-foreground/20 md:hidden"> / </span>
      </div>
    </div>

    <div
      class="absolute left-1/2 flex max-w-[40%] -translate-x-1/2 items-center gap-2"
    >
      {#if back}
        <a
          href={back.href}
          class="truncate text-sm font-normal tracking-tight text-muted-foreground not-md:hidden hover:text-secondary-foreground hover:underline"
          >{back.title}</a
        >
        <span class="font-normal text-muted-foreground/20 not-md:hidden">
          /
        </span>
      {/if}
      <h1 class="truncate text-sm font-normal tracking-tight text-foreground">
        {title}
      </h1>
    </div>

    <div class="ml-auto min-w-0 shrink-0">
      <div class="flex items-center justify-end gap-2">
        {#if actions}
          {@render actions()}
        {/if}
        {#if scout && page.data.mode === "cloud"}
          <Button
            variant="ghost"
            size="icon"
            class={chatState.railOpen
              ? "border-muted bg-muted text-foreground dark:bg-muted/50"
              : ""}
            aria-label="Open Scout"
            aria-pressed={chatState.railOpen}
            onclick={() => {
              asideOpen = false;
              void chatState.openContext(scout);
            }}
          >
            <IconSparkle data-slot="button-icon" />
          </Button>
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
