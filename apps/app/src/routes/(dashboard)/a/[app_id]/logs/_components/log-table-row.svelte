<script lang="ts">
  import { normalizeSeverity } from "$lib/utils/normalize-severity";
  import { cn } from "@repo/components";
  import { Badge } from "@repo/components/ui/badge";
  import * as HoverCard from "@repo/components/ui/hover-card";

  import TimeCell from "../../_components/time-cell.svelte";
  import type { LogRecord } from "../types";
  import { buildLogAttributeChips } from "./log-attribute-display";
  import LogAttributeChip from "./log-attribute-chip.svelte";
  import SeverityCell from "./severity-cell.svelte";

  let {
    log,
    rangeMs,
    selected = false,
    onSelectLog,
  }: {
    log: LogRecord;
    rangeMs: number;
    selected?: boolean;
    onSelectLog: (log: LogRecord) => void;
  } = $props();

  const MAX_VISIBLE_ATTRIBUTE_CHIPS = 5;

  let severity = $derived(
    normalizeSeverity(log.severity_number, log.severity_text),
  );
  let attributeChips = $derived(buildLogAttributeChips(log));
  let visibleAttributeChips = $derived(
    attributeChips.slice(0, MAX_VISIBLE_ATTRIBUTE_CHIPS),
  );
  let hiddenAttributeChips = $derived(
    attributeChips.slice(MAX_VISIBLE_ATTRIBUTE_CHIPS),
  );
</script>

<div
  data-log-id={log.id}
  data-testid="logs-table-row"
  data-selected={selected}
  class={cn(
    "group flex cursor-pointer items-start gap-0 py-1 pr-3 pl-3 transition-colors",
    {
      fatal:
        "bg-destructive/10 text-destructive data-[selected=true]:bg-destructive/20",
      error:
        "bg-destructive/8 text-destructive hover:bg-destructive/18 data-[selected=true]:bg-destructive/18",
      warn: "bg-amber-500/8 text-amber-500 hover:bg-amber-500/18 data-[selected=true]:bg-amber-500/18",
      info: cn("text-primary hover:bg-muted data-[selected=true]:bg-muted"),
      debug: cn(
        "text-muted-foreground hover:bg-muted data-[selected=true]:bg-muted",
      ),
      trace: cn(
        "text-muted-foreground/60 hover:bg-muted data-[selected=true]:bg-muted",
      ),
      unknown: cn(
        "text-muted-foreground hover:bg-muted data-[selected=true]:bg-muted",
      ),
    }[severity],
  )}
  onclick={() => onSelectLog(log)}
  onkeydown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectLog(log);
    }
  }}
  role="row"
  tabindex="0"
  aria-selected={selected}
>
  <div
    class="mt-0.5 mr-1.5 flex w-36 shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
  >
    <TimeCell date={new Date(log.timestamp)} {rangeMs} />
  </div>

  <SeverityCell
    severityNumber={log.severity_number}
    severityText={log.severity_text}
  />

  <div class="mt-0.5 mr-3 hidden w-40 shrink-0 lg:block">
    <span
      class="block truncate font-mono text-xs text-secondary-foreground"
      title={log.service_name || "—"}
    >
      {log.service_name || "—"}
    </span>
  </div>

  <div class="mt-0.5 flex min-w-0 flex-1 flex-col items-start gap-1">
    <span
      class="font-mono text-xs leading-relaxed break-all text-secondary-foreground"
    >
      {log.body}
    </span>
    {#if attributeChips.length > 0}
      <div class="flex flex-wrap gap-1">
        {#each visibleAttributeChips as chip (`${chip.key}:${chip.fullValue}`)}
          <LogAttributeChip
            label={chip.key}
            value={chip.value}
            fullValue={chip.fullValue}
          />
        {/each}
        {#if hiddenAttributeChips.length > 0}
          <HoverCard.Root openDelay={50} closeDelay={50}>
            <HoverCard.Trigger
              type="button"
              class="text-left"
              onclick={(event) => event.stopPropagation()}
              onkeydown={(event) => event.stopPropagation()}
            >
              <Badge
                variant="outline"
                class="h-6 h-auto max-w-full gap-0.5 rounded-md border-foreground/10 bg-linear-to-t from-secondary to-transparent px-1.5 py-[1px] text-[11px] font-normal inset-shadow-[0px_1px_--theme(--color-white)]"
              >
                +{hiddenAttributeChips.length}
              </Badge>
            </HoverCard.Trigger>
            <HoverCard.Content class="w-96 max-w-[min(32rem,90vw)] p-2">
              <div class="max-h-80 overflow-auto text-xs">
                <div class="flex flex-wrap items-center gap-1">
                  {#each hiddenAttributeChips as chip, index (`${chip.key}:${chip.fullValue}:${index}`)}
                    <LogAttributeChip
                      label={chip.key}
                      value={chip.value}
                      fullValue={chip.fullValue}
                    />
                    {#if index < hiddenAttributeChips.length - 1}
                      <span class="text-muted-foreground">,</span>
                    {/if}
                  {/each}
                </div>
              </div>
            </HoverCard.Content>
          </HoverCard.Root>
        {/if}
      </div>
    {/if}
  </div>
</div>
