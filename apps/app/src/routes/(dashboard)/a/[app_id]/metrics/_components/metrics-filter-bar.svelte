<script lang="ts">
  import { Input } from "@repo/components/ui/input";
  import * as Select from "@repo/components/ui/select";
  import {
    IconChartBar,
    IconCpu,
    IconFunction,
    IconSearch,
    IconStack2,
  } from "@tabler/icons-svelte";
  import TimeRangePicker from "../../logs/_components/time-range-picker.svelte";
  import FilterPill from "../../logs/_components/filter-pill.svelte";
  import type {
    LogTimeFilter,
    MetricAggregation,
    MetricFacetOption,
    MetricFilters,
    MetricGroupBy,
  } from "../types";

  const aggregationOptions: { value: MetricAggregation; label: string }[] = [
    { value: "avg", label: "Average" },
    { value: "sum", label: "Sum" },
    { value: "min", label: "Min" },
    { value: "max", label: "Max" },
    { value: "count", label: "Count" },
  ];

  const groupByOptions: { value: MetricGroupBy; label: string }[] = [
    { value: "none", label: "No split" },
    { value: "service", label: "Service" },
    { value: "environment", label: "Environment" },
    { value: "metric", label: "Metric" },
  ];

  let {
    time = $bindable<LogTimeFilter>(),
    filters = $bindable<MetricFilters>({
      search: "",
      metricName: "",
      services: [],
      environments: [],
    }),
    aggregation = $bindable<MetricAggregation>("avg"),
    groupBy = $bindable<MetricGroupBy>("none"),
    metricOptions = [],
    serviceOptions = [],
    environmentOptions = [],
  }: {
    time?: LogTimeFilter;
    filters?: MetricFilters;
    aggregation?: MetricAggregation;
    groupBy?: MetricGroupBy;
    metricOptions?: MetricFacetOption[];
    serviceOptions?: { value: string; label: string }[];
    environmentOptions?: { value: string; label: string }[];
  } = $props();

  let searchDraft = $state(filters.search);
  let lastAppliedSearch = $state(filters.search);

  const selectedMetricLabel = $derived(
    filters.metricName ? filters.metricName : "All metrics",
  );
  const aggregationLabel = $derived(
    aggregationOptions.find((option) => option.value === aggregation)?.label ??
      "Average",
  );
  const groupByLabel = $derived(
    groupByOptions.find((option) => option.value === groupBy)?.label ??
      "No split",
  );

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

<div class="flex flex-wrap items-center gap-2 border-b bg-secondary px-3 py-2">
  <TimeRangePicker bind:time />

  <span class="mx-1 h-5 w-px bg-border"></span>

  <div class="relative flex items-center">
    <IconSearch
      class="pointer-events-none absolute left-3 size-3.5 text-muted-foreground"
    />
    <Input
      placeholder="Search metrics"
      bind:value={searchDraft}
      class="w-56 bg-background pl-8"
      onkeydown={(event: KeyboardEvent) => {
        if (event.key === "Enter") {
          applySearch();
        }
      }}
      onblur={applySearch}
    />
  </div>

  <Select.Root type="single" bind:value={filters.metricName}>
    <Select.Trigger class="max-w-72 border-dashed bg-background">
      <span class="flex min-w-0 items-center gap-1.5">
        <IconChartBar class="size-3.5 text-muted-foreground" />
        <span class="truncate">{selectedMetricLabel}</span>
      </span>
    </Select.Trigger>
    <Select.Content class="max-h-72">
      <Select.Item value="" label="All metrics" />
      {#each metricOptions as option}
        <Select.Item value={option.value}>
          <span class="min-w-0 truncate">{option.value}</span>
          <span class="ml-auto text-xs text-muted-foreground"
            >{option.count}</span
          >
        </Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>

  <span class="mx-1 h-5 w-px bg-border"></span>

  <Select.Root type="single" bind:value={aggregation}>
    <Select.Trigger class="bg-background">
      <span class="flex items-center gap-1.5">
        <IconFunction class="size-3.5 text-muted-foreground" />
        {aggregationLabel}
      </span>
    </Select.Trigger>
    <Select.Content>
      {#each aggregationOptions as option}
        <Select.Item value={option.value} label={option.label} />
      {/each}
    </Select.Content>
  </Select.Root>

  <Select.Root type="single" bind:value={groupBy}>
    <Select.Trigger class="bg-background">
      <span class="flex items-center gap-1.5">
        <IconStack2 class="size-3.5 text-muted-foreground" />
        {groupByLabel}
      </span>
    </Select.Trigger>
    <Select.Content>
      {#each groupByOptions as option}
        <Select.Item value={option.value} label={option.label} />
      {/each}
    </Select.Content>
  </Select.Root>

  <FilterPill
    label="Service"
    bind:values={filters.services}
    options={serviceOptions}
    placeholder="Filter by service..."
  >
    {#snippet icon()}
      <IconCpu class="size-3.5" />
    {/snippet}
  </FilterPill>

  <FilterPill
    label="Environment"
    bind:values={filters.environments}
    options={environmentOptions}
    placeholder="Filter by environment..."
  >
    {#snippet icon()}
      <IconStack2 class="size-3.5" />
    {/snippet}
  </FilterPill>
</div>
