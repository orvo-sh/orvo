<script lang="ts">
  import * as HoverCard from "@repo/components/ui/hover-card";
  import { Badge } from "@repo/components/ui/badge";

  let {
    label,
    value,
    fullValue,
  }: {
    label: string;
    value: string;
    fullValue?: string;
  } = $props();
</script>

{#snippet chip()}
  <Badge
    variant="outline"
    class="h-auto max-w-full gap-0.5 rounded-md px-1.5 py-[1px] text-[11px] font-normal"
  >
    <span class="truncate text-muted-foreground">{label}:</span>
    <span class="max-w-64 truncate text-foreground">{value}</span>
  </Badge>
{/snippet}

{#if fullValue}
  <HoverCard.Root openDelay={50} closeDelay={50}>
    <HoverCard.Trigger
      type="button"
      class="max-w-full text-left"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.stopPropagation()}
    >
      {@render chip()}
    </HoverCard.Trigger>
    <HoverCard.Content class="w-96 max-w-[min(32rem,90vw)] p-0">
      <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <pre
        class="max-h-80 overflow-auto px-3 py-2 font-mono text-xs whitespace-pre-wrap text-foreground"
      >{fullValue}</pre>
    </HoverCard.Content>
  </HoverCard.Root>
{:else}
  {@render chip()}
{/if}
