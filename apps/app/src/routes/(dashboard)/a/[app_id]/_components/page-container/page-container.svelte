<script lang="ts">
  import { page } from "$app/state";
  import { cn } from "@repo/components";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import type { Snippet } from "svelte";

  import { Button } from "@repo/components/ui/button";
  import { IconChevronLeft } from "@tabler/icons-svelte";
  import PageContainerAppSwitcher from "./page-container-app-switcher.svelte";

  let {
    title,
    actions,
    children,
    class: className = "",
    innerClass,
    scrollContent = true,
    back,
  }: {
    title: string;
    actions?: Snippet;
    children?: Snippet;
    class?: string;
    innerClass?: string;
    scrollContent?: boolean;
    back?: { href: string; title: string };
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
