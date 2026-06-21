<script lang="ts">
  import { cn } from "@repo/components";
  import * as Card from "@repo/components/ui/card";

  let {
    title,
    value,
    meta = "",
    loading = false,
  }: {
    title: string;
    value: string;
    meta?: string;
    loading?: boolean;
  } = $props();
</script>

<Card.Root class={cn("relative", loading && "pointer-events-none")}>
  <div
    class="absolute top-0 h-full w-full bg-secondary opacity-0 transition-opacity"
    class:opacity-50={loading}
  ></div>

  <Card.Content>
    <div class="flex flex-col gap-px">
      <h3 class="text-sm leading-none text-secondary-foreground">{title}</h3>
      <p class="text-base font-semibold tabular-nums">{value}</p>
      {#if meta}
        <p class="text-xs text-muted-foreground">{meta}</p>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
