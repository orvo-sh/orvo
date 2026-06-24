<script lang="ts">
  import { alertSignalOptions } from "$lib/alerts";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import {
    IconAlertTriangle,
    IconChevronRight,
    IconInfoCircle,
  } from "@tabler/icons-svelte";

  type IncidentItem = {
    id: string;
    status: "open" | "resolved" | "dismissed";
    openedAt: Date;
    lastObservedValue: number | null;
    entityType: "app" | "host" | "container";
    entityName: string | null;
    sourceType: "alert" | "heartbeat" | "host";
    title: string;
    rule?: {
      id: string;
      name: string;
      signalType: string;
    } | null;
  };

  let {
    incidents,
    loading = false,
    onViewAll,
    appId,
  }: {
    incidents: IncidentItem[];
    loading?: boolean;
    onViewAll: () => void;
    appId: string;
  } = $props();

  const limit = 3;
  const visible = $derived(incidents.slice(0, limit));

  const signalLabels = Object.fromEntries(
    alertSignalOptions.map((o) => [o.value, o.label]),
  );

  function formatTimeAgo(value: Date) {
    const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
</script>

<section class="flex flex-col">
  <div
    class="flex translate-y-2 items-center justify-between rounded-t-xl border border-foreground/10 bg-secondary pb-2 inset-shadow-[0px_1px_--theme(--color-white)]"
  >
    <div class="flex flex-1 items-center gap-0 px-3.5 py-0.5">
      <h2 class="text-sm font-normal tracking-tight text-secondary-foreground">
        Open incidents
      </h2>
      <HoverCard.Root openDelay={50} closeDelay={50}>
        <HoverCard.Trigger
          class={buttonVariants({
            variant: "ghost",
            size: "icon-sm",
          })}
        >
          <IconInfoCircle
            class="size-3.5 text-secondary-foreground opacity-75"
          />
        </HoverCard.Trigger>
        <HoverCard.Content
          class="max-w-sm min-w-72 text-sm text-secondary-foreground"
        >
          <p>
            Open incidents track active alert, heartbeat, and host failures.
            They are resolved automatically when the underlying signal recovers.
          </p>
        </HoverCard.Content>
      </HoverCard.Root>
    </div>
    <Button
      variant="ghost"
      class="gap-1 text-secondary-foreground underline"
      disabled={loading}
      onclick={onViewAll}
    >
      View all
      <IconChevronRight />
    </Button>
  </div>

  <Card.Root class="relative p-0">
    {#if loading}
      <div
        class="absolute top-0 z-50 h-full w-full bg-background opacity-60"
      ></div>
    {/if}
    <Card.Content class="p-0">
      {#if visible.length === 0}
        <div
          class="flex items-center justify-center py-8 text-sm text-muted-foreground"
        >
          No open incidents.
        </div>
      {:else}
        <div class="divide-y divide-border">
          {#each visible as incident (incident.id)}
            <a
              href={`/a/${appId}/incidents/${incident.id}`}
              class="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/50"
            >
              <div
                class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
              >
                <IconAlertTriangle class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium">
                    {incident.rule?.name ?? incident.title}
                  </p>
                  <span
                    class="inline-flex items-center rounded-full border border-transparent bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  >
                    Open
                  </span>
                </div>
                <p class="line-clamp-2 text-xs text-muted-foreground">
                  {incident.rule
                    ? (signalLabels[incident.rule.signalType] ??
                        incident.rule.signalType)
                    : incident.sourceType}
                  {#if incident.lastObservedValue !== null}
                    · value {incident.lastObservedValue}
                  {/if}
                  · open for {formatTimeAgo(incident.openedAt)}
                </p>
              </div>
              <IconChevronRight class="size-4 shrink-0 text-muted-foreground" />
            </a>
          {/each}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</section>
