<script lang="ts">
  import { page } from "$app/state";
  import { cn } from "@repo/components";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import * as Popover from "@repo/components/ui/popover";
  import {
      IconCheck as CheckIcon,
      IconCircleX,
      IconPlus,
      IconSearch,
      IconSelector
  } from "@tabler/icons-svelte";

  type AppOption = {
    id: string;
    name: string;
  };

  type DashboardPageData = {
    apps?: AppOption[];
    currentApp?: AppOption;
  };

  const getSwitchHref = (
    nextAppId: string,
    currentAppId: string,
    pathname: string,
  ) => {
    const prefix = `/a/${currentAppId}`;
    if (!pathname.startsWith(prefix)) {
      return `/a/${nextAppId}`;
    }

    const suffix = pathname.slice(prefix.length);
    if (!suffix) {
      return `/a/${nextAppId}`;
    }

    if (
      suffix === "/logs" ||
      suffix === "/metrics" ||
      suffix === "/traces" ||
      suffix === "/alerts" ||
      suffix === "/alerts/new" ||
      suffix === "/chat" ||
      suffix === "/settings" ||
      suffix === "/settings/ingest-keys" ||
      /^\/logs\/[^/]+$/.test(suffix)
    ) {
      return `/a/${nextAppId}${suffix}`;
    }

    if (suffix.startsWith("/alerts/")) {
      return `/a/${nextAppId}/alerts`;
    }

    if (suffix.startsWith("/traces/")) {
      return `/a/${nextAppId}/traces`;
    }

    return `/a/${nextAppId}`;
  };

  const dashboardData = $derived(
    (page.data as DashboardPageData | undefined) ?? {},
  );
  const apps = $derived(dashboardData.apps ?? []);
  const currentApp = $derived(dashboardData.currentApp ?? null);
  let search = $state("");

  const filteredApps = $derived(
    apps.filter((app) => app.name.toLowerCase().includes(search.toLowerCase())),
  );
</script>

{#if currentApp && apps.length > 0}
  <Popover.Root>
    <Popover.Trigger
      class={buttonVariants({
        variant: "ghost",
      })}
    >
        {currentApp.name}
	  <IconSelector />
    </Popover.Trigger>

    <Popover.Content
      align="start"
      class="w-72 gap-0 p-0"
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

      <div class="max-h-52 overflow-y-auto p-1 gap-1 flex flex-col">
        {#each filteredApps as app}
          {@const selected = app.id === currentApp.id}
          <a
            href={getSwitchHref(app.id, currentApp.id, page.url.pathname)}
            class={cn(
              "flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted/70",
              selected && "bg-muted/80",
            )}
          >
            <span class="min-w-0 flex-1 truncate text-foreground"
              >{app.name}</span
            >
            {#if selected}
              <CheckIcon class="size-4 shrink-0 text-foreground" />
            {/if}
          </a>
        {/each}
        {#if filteredApps.length === 0}
          <p class="px-2.5 py-1.5 text-sm text-muted-foreground">
            No apps found.
          </p>
        {/if}
      </div>

      <div class="border-t p-1">
        <a
          href="/apps/new"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/70"
        >
          <span
            class="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
          >
            <IconPlus class="size-4"/>
          </span>
          <span class="truncate">Create app</span>
        </a>
      </div>
    </Popover.Content>
  </Popover.Root>
{/if}
