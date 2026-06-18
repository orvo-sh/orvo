<script lang="ts">
  import { Input } from "@repo/components/ui/input";
  import { Kbd } from "@repo/components/ui/kbd";
  import {
    IconCpu as CpuIcon,
    IconSearch as MagnifyingGlassIcon,
    IconStack2 as StackIcon,
  } from "@tabler/icons-svelte";
  import type { LogFilters, LogTimeFilter } from "../types";
  import FilterPill from "./filter-pill.svelte";
  import LevelFilterPill from "./level-filter-pill.svelte";
  import TimeRangePicker from "./time-range-picker.svelte";

  let {
    time = $bindable<LogTimeFilter>(),
    filters = $bindable<LogFilters>({
      search: "",
      levels: [],
      services: [],
      environments: [],
      traceId: "",
    }),
    serviceOptions = [],
    environmentOptions = [],
  }: {
    time?: LogTimeFilter;
    filters?: LogFilters;
    serviceOptions?: { value: string; label: string }[];
    environmentOptions?: { value: string; label: string }[];
  } = $props();

  let searchDraft = $state(filters.search);
  let lastAppliedSearch = $state(filters.search);

  const applySearch = () => {
    const nextSearch = searchDraft.trim();
    filters.search = nextSearch;
    lastAppliedSearch = nextSearch;
  };

  $effect(() => {
    if (filters.search !== lastAppliedSearch) {
      searchDraft = filters.search;
      lastAppliedSearch = filters.search;
    }
  });
</script>

<div class="flex flex-wrap items-center gap-2 bg-secondary p-2 px-3">
  <TimeRangePicker bind:time />
  <div class="relative flex items-center">
    <MagnifyingGlassIcon
      class="pointer-events-none absolute left-3 size-3.5 text-muted-foreground"
    />
    <Input
      placeholder="Search log messages"
      bind:value={searchDraft}
      class="bg-background pr-14 pl-8"
      onkeydown={(event: KeyboardEvent) => {
        if (event.key === "Enter") {
          applySearch();
        }
      }}
    />
    {#if filters.search !== searchDraft.trim() && searchDraft.trim() !== ""}
      <Kbd class="absolute right-2 size-5 cursor-pointer">↵</Kbd>
    {/if}
  </div>
  <span class="mx-1 h-5 w-px bg-border"></span>

  <LevelFilterPill
    label="Level"
    bind:values={filters.levels}
    options={[
      { value: "FATAL", label: "Fatal", colorClass: "bg-destructive" },
      { value: "ERROR", label: "Error", colorClass: "bg-destructive" },
      { value: "WARN", label: "Warn", colorClass: "bg-amber-500" },
      { value: "INFO", label: "Info", colorClass: "bg-primary" },
      { value: "DEBUG", label: "Debug", colorClass: "bg-muted-foreground/70" },
      { value: "TRACE", label: "Trace", colorClass: "bg-muted-foreground/50" },
    ]}
  />

  <FilterPill
    label="Service"
    bind:values={filters.services}
    options={serviceOptions}
    placeholder="Filter by service..."
  >
    {#snippet icon()}
      <CpuIcon class="size-3.5" />
    {/snippet}
  </FilterPill>

  <FilterPill
    label="Environment"
    bind:values={filters.environments}
    options={environmentOptions}
    placeholder="Filter by environment..."
  >
    {#snippet icon()}
      <StackIcon class="size-3.5" />
    {/snippet}
  </FilterPill>
</div>
