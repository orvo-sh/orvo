<script lang="ts">
  import { cn } from "@repo/components";
  import { buttonVariants } from "@repo/components/ui/button";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import { IconArrowLeft, IconInfoCircle } from "@tabler/icons-svelte";
  import type { Snippet } from "svelte";

  import PageContainerAppSwitcher from "./page-container-app-switcher.svelte";

  let {
    title,
    back,
    helper,
    actions,
    children,
    class: className = "",
    innerClass,
    scrollContent = true,
  }: {
    title: string;
    back?: string;
    helper?: Snippet;
    actions?: Snippet;
    children?: Snippet;
    class?: string;
    innerClass?: string;
    scrollContent?: boolean;
  } = $props();
</script>

<div
  class={cn(
    `flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background`,
    className,
  )}
>
  <header
    class="sticky top-0 z-10 flex h-13 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/90 bg-background p-2 px-3"
  >
    <div class="flex min-w-0 items-center gap-2 md:flex-1">
      <div class="md:hidden">
        <Sidebar.Trigger />
      </div>

      <div class="flex min-w-0 items-center gap-0.5">
        <div class="flex-1">
          <PageContainerAppSwitcher />
        </div>
        <span class="font-meduim text-muted-foreground/20 md:hidden"> / </span>
      </div>
    </div>

    <div class="flex flex-1 items-center gap-2 md:justify-center">
      {#if back}
        <a
          href={back}
          class="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft class="size-4" />
          <span class="sr-only">Back</span>
        </a>
      {/if}
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
            <IconInfoCircle class="opacity-75" />
            <span class="sr-only">Page information</span>
          </HoverCard.Trigger>
          <HoverCard.Content
            class="max-w-sm min-w-72 text-sm text-secondary-foreground"
            >{@render helper()}</HoverCard.Content
          >
        </HoverCard.Root>
      {/if}
    </div>

    <div class="flex-1">
      <div class="flex w-auto flex-wrap items-center justify-end gap-2">
        {#if actions}
          {@render actions()}
        {/if}
      </div>
    </div>
  </header>

  <div
    class={cn(
      "flex min-h-0 flex-1 flex-col px-3 py-3",
      scrollContent ? "overflow-y-auto" : "overflow-hidden",
      innerClass,
    )}
  >
    {@render children?.()}
  </div>
</div>
