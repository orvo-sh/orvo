<script lang="ts">
  import type { LogTimeFilter } from "../types";
  import TimeCell from "../../_components/time-cell.svelte";
  import { resolveTimeRange } from "./time-utils";

  let {
    date,
    time,
  }: {
    date: Date;
    time: LogTimeFilter;
  } = $props();

  const range = $derived(resolveTimeRange(time));
  const rangeMs = $derived(
    Math.max(Math.abs(range.end.getTime() - range.start.getTime()), 1),
  );
</script>

<TimeCell {date} {rangeMs} />
