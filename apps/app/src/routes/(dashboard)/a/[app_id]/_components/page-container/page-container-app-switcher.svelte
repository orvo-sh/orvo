<script lang="ts">
  import { page } from "$app/state";
  import { cn } from "@repo/components";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import * as Popover from "@repo/components/ui/popover";
  import {
    IconCheck,
    IconCircleX,
    IconPlus,
    IconSearch,
    IconSelector,
  } from "@tabler/icons-svelte";

  let {
    apps,
    currentAppId,
  }: {
    apps: {
      id: string;
      name: string;
    }[];
    currentAppId: string;
  } = $props();

  let search = $state("");
</script>

<Popover.Root>
  <Popover.Trigger
    class={buttonVariants({
      variant: "ghost",
    })}
  >
    {@const activeApp = apps.find((app) => app.id === currentAppId)!}
    {activeApp.name}
    <IconSelector />
  </Popover.Trigger>

  <Popover.Content
    class="flex w-64 flex-col gap-0 p-0"
    align="start"
    side="bottom"
  >
    <div class="relative flex items-center gap-1 border-b px-2 py-1">
      <IconSearch
        class="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground"
      />
      <Input
        bind:value={search}
        placeholder="Find app..."
        class="h-8 w-auto flex-1 border-0 bg-transparent pl-6 text-sm shadow-none focus-visible:ring-0"
      />
      {#if search}
        <Button
          class="size-6 opacity-80"
          size="icon-sm"
          variant="ghost"
          onclick={() => (search = "")}
        >
          <IconCircleX data-slot="button-icon" />
        </Button>
      {/if}
    </div>

    <div class="flex max-h-52 flex-col gap-1 overflow-y-auto p-1">
      {#each apps.filter((app) => app.name
          .toLowerCase()
          .includes(search.toLowerCase())) as app}
        {@const selected = app.id === currentAppId}
        <a
          href={`/a/${app.id}/${page.url.pathname.split("/")[3] ?? ""}`}
          data-sveltekit-reload
          class={cn(
            "flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted/70",
            selected && "bg-muted/80",
          )}
        >
          <span class="min-w-0 flex-1 truncate text-foreground">{app.name}</span
          >
          {#if selected}
            <IconCheck class="size-4 shrink-0 text-foreground" />
          {/if}
        </a>
      {:else}
        <p class="px-2.5 py-1.5 text-sm text-muted-foreground">
          No apps found.
        </p>
      {/each}
    </div>

    <div class="border-t p-1">
      <a
        href="/apps/new"
        class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/70"
      >
        <span
          class="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
        >
          <IconPlus class="size-4" />
        </span>
        <span class="truncate">Create app</span>
      </a>
    </div>
  </Popover.Content>
</Popover.Root>
