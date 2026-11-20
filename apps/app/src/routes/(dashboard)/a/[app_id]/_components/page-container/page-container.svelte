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
  import {
    IconChevronLeft,
    IconChevronDown,
    IconChevronUp,
    IconSparkle,
    IconX,
  } from "@tabler/icons-svelte";
  import AppSwitcher from "$lib/components/app-switcher.svelte";

  let {
    title,
    actions,
    children,
    aside,
    asideTitle,
    asideHeader = true,
    asideSide = "right",
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
    asideHeader?: boolean;
    asideSide?: "left" | "right" | "bottom";
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
    if (
      scout &&
      asideOpen &&
      chatState.railOpen &&
      (asideSide === "right" || (isMobile && asideSide !== "bottom"))
    )
      chatState.closeRail();
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
          aria-label={`Back to ${back.title.toLowerCase()}`}
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
          <AppSwitcher
            apps={page.data.apps}
            currentAppId={page.data.currentApp.id}
          />
        </div>
        <span class="font-meduim text-muted-foreground/20 md:hidden"> / </span>
      </div>
    </div>

    <div
      class="flex min-w-0 flex-1 items-center gap-2 md:absolute md:left-1/2 md:max-w-[40%] md:-translate-x-1/2"
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
        {#if scout}
          <Button
            variant="ghost"
            size="icon"
            class={chatState.railOpen
              ? "border-muted bg-muted text-foreground dark:bg-muted/50"
              : ""}
            aria-label="Open Scout"
            aria-pressed={chatState.railOpen}
            onclick={() => {
              if (asideSide === "right" || (isMobile && asideSide !== "bottom"))
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

  <div class={cn("flex min-h-0 flex-1", asideSide === "bottom" && "flex-col")}>
    <div class={cn("flex min-h-0 flex-1 flex-col overflow-auto", contentClass)}>
      {@render children?.()}
    </div>
    {#if aside && (!isMobile || asideSide === "bottom")}
      {#if asideSide === "bottom"}
        <div class="relative z-20 h-0 shrink-0">
          <div
            aria-hidden="true"
            data-testid="bottom-panel-overflow-fade"
            class="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-background to-transparent"
          ></div>
          <Button
            variant="outline"
            size="icon-sm"
            class="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-background shadow-none"
            aria-label={asideOpen
              ? "Collapse editor panel"
              : "Expand editor panel"}
            aria-expanded={asideOpen}
            data-testid="bottom-panel-handle"
            onclick={() => (asideOpen = !asideOpen)}
          >
            {#if asideOpen}<IconChevronDown />{:else}<IconChevronUp />{/if}
          </Button>
        </div>
      {/if}
      <aside
        data-testid="page-editor-sidebar"
        aria-hidden={!asideOpen && asideSide !== "bottom"}
        inert={!asideOpen && asideSide !== "bottom"}
        class={cn(
          "min-h-0 shrink-0 flex-col overflow-hidden bg-background duration-200 ease-out",
          asideSide === "bottom"
            ? "relative z-10 flex w-full border-t border-border transition-[height,border-color]"
            : "hidden h-full transition-[width,border-color] md:flex",
          asideSide === "left" && "order-first",
          asideOpen
            ? asideSide === "bottom"
              ? "h-[min(40dvh,360px)]"
              : asideSide === "left"
                ? "w-88 border-r"
                : "w-88 border-l"
            : asideSide === "bottom"
              ? "h-[41px]"
              : "w-0",
        )}
      >
        {#if asideHeader}
          <div
            class="flex h-14 min-h-14 w-full items-center justify-between border-b px-3"
          >
            <span class="text-sm">
              {asideTitle}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Close ${asideTitle?.toLowerCase() ?? "panel"}`}
              onclick={() => (asideOpen = false)}
            >
              <IconX />
            </Button>
          </div>
        {/if}
        <div
          class={cn(
            "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden transition-all duration-200 ease-out",
            asideOpen || asideSide === "bottom"
              ? "translate-x-0 opacity-100"
              : asideSide === "left"
                ? "pointer-events-none -translate-x-4 opacity-0"
                : "pointer-events-none translate-x-4 opacity-0",
          )}
        >
          {@render aside()}
        </div>
      </aside>
    {/if}
  </div>
</div>

{#if aside && isMobile && asideSide !== "bottom"}
  <Sheet.Root bind:open={asideOpen}>
    <Sheet.Content
      side={asideSide}
      class="w-full gap-0 p-0! sm:max-w-none"
      showCloseButton={false}
    >
      {#if asideHeader}
        <div
          class="flex h-14 min-h-14 w-full items-center justify-between border-b px-3"
        >
          <span class="text-sm">
            {asideTitle}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Close ${asideTitle?.toLowerCase() ?? "panel"}`}
            onclick={() => (asideOpen = false)}
          >
            <IconX />
          </Button>
        </div>
      {/if}
      {@render aside()}
    </Sheet.Content>
  </Sheet.Root>
{/if}
