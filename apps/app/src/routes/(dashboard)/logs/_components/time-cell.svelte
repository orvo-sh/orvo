<script lang="ts">
  import type { LogTimeFilter } from "../types";

  import { resolveTimeRange } from "./time-utils";

  let {
    date,
    time,
  }: {
    date: Date;
    time: LogTimeFilter;
  } = $props();

  const HOUR_MS = 60 * 60 * 1000;
  const TWELVE_HOURS_MS = 12 * HOUR_MS;
  const DAY_MS = 24 * HOUR_MS;
  const TWO_WEEKS_MS = 14 * DAY_MS;

  const timestampFormatter = $derived(
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hour12: false,
    }),
  );
  const timestampParts = $derived(timestampFormatter.formatToParts(date));
  const month = $derived(
    timestampParts.find((part) => part.type === "month")?.value.toUpperCase() ??
      "---",
  );
  const day = $derived(
    timestampParts.find((part) => part.type === "day")?.value ?? "00",
  );
  const hour = $derived(
    timestampParts.find((part) => part.type === "hour")?.value ?? "00",
  );
  const minute = $derived(
    timestampParts.find((part) => part.type === "minute")?.value ?? "00",
  );
  const second = $derived(
    timestampParts.find((part) => part.type === "second")?.value ?? "00",
  );
  const fractionalSecond = $derived(
    (
      timestampParts.find((part) => part.type === "fractionalSecond")?.value ??
      "000"
    ).slice(0, 2),
  );
  const range = $derived(resolveTimeRange(time));
  const rangeMs = $derived(
    Math.max(Math.abs(range.end.getTime() - range.start.getTime()), 1),
  );
</script>

<div class="flex">
{#if rangeMs <= HOUR_MS}
  <span class="mr-1.5 text-muted-foreground">{month} {day}</span>
  <span class="text-secondary-foreground">{hour}:{minute}:{second}</span>
  <span class="text-muted-foreground">.{fractionalSecond}</span>
{:else if rangeMs <= TWELVE_HOURS_MS}
  <span class="mr-1.5 text-muted-foreground">{month} {day}</span>
  <span class="text-secondary-foreground">{hour}:{minute}</span>
  <span class="text-muted-foreground">:{second}.{fractionalSecond}</span>
{:else if rangeMs <= DAY_MS}
  <span class="mr-1.5 text-muted-foreground">{month}</span>
  <span class="text-secondary-foreground">{day} {hour}:{minute}</span>
  <span class="text-muted-foreground">:{second}.{fractionalSecond}</span>
{:else if rangeMs <= TWO_WEEKS_MS}
  <span class="mr-1.5 text-muted-foreground">{month}</span>
  <span class="text-secondary-foreground mr-1.5">{day}</span>
  <span class="text-muted-foreground">
    {" "}{hour}:{minute}:{second}.{fractionalSecond}</span
  >
{:else}
  <span class="mr-1.5 text-secondary-foreground">{month} {day}</span>
  <span class="text-muted-foreground">
    {" "}{hour}:{minute}:{second}.{fractionalSecond}</span
  >
{/if}
</div>