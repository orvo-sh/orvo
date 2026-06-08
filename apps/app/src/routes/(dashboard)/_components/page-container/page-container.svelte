<script lang="ts">
    import { cn } from "@repo/components";
    import { Button, buttonVariants } from "@repo/components/ui/button";
    import * as HoverCard from "@repo/components/ui/hover-card";
    import * as Sidebar from "@repo/components/ui/sidebar";
    import { IconInfoCircle, IconSparkles } from "@tabler/icons-svelte";
    import type { Snippet } from "svelte";
    import AppSwitcher from "./page-container-app-switcher.svelte";
    import { page } from "$app/state";
    import { assistantSidebarState } from "$lib/stores/assistant-sidebar.svelte";

  let {
    title,
    helper,
    actions,
    children,
    class: className = "",
    innerClass,
    scrollContent = true
  }: {
    title: string;
    helper?: Snippet;
    actions?: Snippet;
    children?: Snippet;
    class?: string;
    innerClass?: string;
    scrollContent?: boolean;
  } = $props();
</script>

<div
  class={cn(`flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background`,className)}
>
  <header
    class="sticky h-13 bg-secondary top-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/90 p-2 px-3"
  >
        <div class="flex min-w-0 items-center gap-2 flex-1 ">
          <div class="md:hidden">
            <Sidebar.Trigger />
          </div>

          <div class="flex min-w-0 items-center gap-0.5">
            <div class="flex-1">
              <AppSwitcher />
            </div>
          </div>
        </div>

        <div class="flex-1 flex gap-0 items-center justify-center">
          <h1 class="text-sm font-medium tracking-tight text-foreground">
            {title}
          </h1>
          {#if helper}
            <HoverCard.Root openDelay={50} closeDelay={50}>
              <HoverCard.Trigger
                class={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
              >
                <IconInfoCircle class="opacity-75"/>
                <span class="sr-only">Page information</span>
              </HoverCard.Trigger>
              <HoverCard.Content
                class="min-w-72 max-w-sm text-sm text-secondary-foreground"
                >{@render helper()}</HoverCard.Content
              >
            </HoverCard.Root>
          {/if}
        </div>

        <div class="flex-1 ">
            <div
              class="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end"
            >
              {#if actions}
                {@render actions()}
              {/if}
              
              {#if page.params.app_id && !page.url.pathname.endsWith("/chat")}
                <Button
                  variant={assistantSidebarState.open ? "secondary" : "ghost"}
                  size="icon-sm"
                  onclick={() => assistantSidebarState.open = !assistantSidebarState.open}
                  aria-label="Toggle Ask Orvo"
                >
                  <IconSparkles data-slot="button-icon" class="size-4" />
                </Button>
              {/if}
            </div>
        </div>
  </header>

  <div
    class={cn(
      "flex min-h-0 flex-1 flex-col px-4 py-4 md:px-6 md:py-5",
      scrollContent ? "overflow-y-auto" : "overflow-hidden",
      innerClass
    )}
  >
    {@render children?.()}
  </div>
</div>
