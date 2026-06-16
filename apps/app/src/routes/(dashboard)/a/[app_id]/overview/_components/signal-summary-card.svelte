<script lang="ts">
  import { cn } from "@repo/components";
  import * as Card from "@repo/components/ui/card";
  import {
    type Icon as TablerIcon,
    IconChevronRight,
    IconTrendingDown,
    IconTrendingUp,
  } from "@tabler/icons-svelte";

  let {
    icon: Icon,
    title,
    value,
    trend,
    href,
    loading,
  }: {
    icon: TablerIcon;
    title: string;
    value: string;
    trend: number;
    href: string;
    loading: boolean;
  } = $props();
</script>

<a {href}>
  <Card.Root
    class={cn(
      "relative hover:ring-foreground/20",
      loading && "pointer-events-none",
    )}
  >
    <div
      class="absolute top-0 h-full w-full bg-secondary opacity-0 transition-opacity"
      class:opacity-50={loading}
    ></div>

    <Card.Content>
      <div class="flex items-center justify-between gap-3">
        <div class="flex gap-3">
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-secondary-foreground"
          >
            <Icon class="size-4" />
          </div>
          <div class="flex flex-col justify-center gap-px">
            <h3 class="text-sm leading-none text-secondary-foreground">
              {title}
            </h3>
            <div class="flex gap-1.5">
              <p class="text-base font-semibold tabular-nums">{value}</p>
              <span
                class={cn(
                  "mb-2 flex items-center gap-px text-xs",
                  trend === 0
                    ? "text-muted-foreground"
                    : trend > 0
                      ? "text-green-600"
                      : "text-red-600",
                )}
              >
                {#if trend > 0}
                  <IconTrendingUp class="size-3 " />
                {:else if trend < 0}
                  <IconTrendingDown class="size-3 " />
                {/if}
                {trend >= 0 ? "" : "-"}{Math.abs(trend).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        <div class="flex flex-col items-end gap-px">
          <div
            class="flex size-5 items-center justify-center rounded-full border bg-muted"
          >
            <IconChevronRight class="size-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
</a>
