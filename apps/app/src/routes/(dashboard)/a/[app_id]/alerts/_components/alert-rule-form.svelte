<script lang="ts">
  import { alertComparatorOptions, type AlertRuleFormValue } from "$lib/alerts";
  import {
    getMetricAggregationOptions,
    getMetricThresholdBounds,
    getMetricThresholdError,
    isUtilizationRatio,
    getDefaultMetricAggregation,
  } from "$lib/metric-definitions";
  import { tick } from "svelte";
  import MetricPicker from "./metric-picker.svelte";
  import ScopeValuePicker from "./scope-value-picker.svelte";
  import { Checkbox } from "@repo/components/ui/checkbox";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import { Input } from "@repo/components/ui/input";
  import * as Tabs from "@repo/components/ui/tabs";
  import * as Select from "@repo/components/ui/select";
  import {
    IconAdjustments,
    IconFilter,
    IconBell,
    IconX,
    IconInfoCircle,
    IconMail,
    IconWebhook,
    IconBrandSlack,
    IconArrowUpRight,
    IconPlus,
  } from "@tabler/icons-svelte";

  let {
    form = $bindable(),
    activeTab = $bindable("condition"),
    scoutUpdate = null,
    destinations,
    notificationSettingsHref,
    error = "",
  }: {
    form: AlertRuleFormValue;
    activeTab?: "condition" | "scope" | "notifications";
    scoutUpdate?: { tab: string; fields: string[]; sequence: number } | null;
    destinations: Array<{
      id: string;
      name: string;
      isEnabled: boolean;
      kind: string;
      detail?: string;
    }>;
    notificationSettingsHref?: string;
    error?: string;
  } = $props();

  let editorRoot: HTMLDivElement;
  $effect(() => {
    const update = scoutUpdate;
    if (!update) return;
    let cancelled = false;
    void tick().then(() => {
      if (
        cancelled ||
        !editorRoot ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      const ids: Record<string, string> = {
        name: "alert-rule-name",
        metricName: "scout-metric-field",
        metricAggregation: "metric-aggregation",
        comparator: "alert-comparator",
        threshold: "alert-threshold",
        windowMinutes: "alert-window",
        renotifyMinutes: "alert-renotify",
        scope: "scout-scope-fields",
        destinationIds: "scout-destination-fields",
      };
      for (const field of update.fields) {
        const element = editorRoot.querySelector(`#${ids[field]}`);
        element?.animate(
          [
            { outline: "2px solid var(--primary)", outlineOffset: "3px" },
            { outline: "2px solid transparent", outlineOffset: "3px" },
          ],
          { duration: 1400, easing: "ease-out" },
        );
      }
    });
    return () => {
      cancelled = true;
    };
  });

  const toggleDestination = (destinationId: string, checked: boolean) => {
    if (checked) {
      form.destinationIds = [
        ...new Set([...form.destinationIds, destinationId]),
      ];
      return;
    }

    form.destinationIds = form.destinationIds.filter(
      (id) => id !== destinationId,
    );
  };

  const metricAggregations = $derived(
    getMetricAggregationOptions({
      name: form.metricName ?? "",
      type: form.metricType ?? "gauge",
      isMonotonic: form.metricIsMonotonic,
    }),
  );
  const thresholdMetric = $derived({
    name: form.metricName,
    type: form.metricType,
    unit: form.metricUnit,
    isMonotonic: form.metricIsMonotonic,
    aggregation: form.metricAggregation,
  });
  const thresholdBounds = $derived(getMetricThresholdBounds(thresholdMetric));
  const thresholdError = $derived(
    form.metricName
      ? getMetricThresholdError(thresholdMetric, form.threshold)
      : null,
  );

  const scopeAttributes = [
    { key: "service.name", group: "services" },
    { key: "deployment.environment", group: "environments" },
    { key: "scope.name", group: "scopes" },
    { key: "operation.name", group: "spanNames" },
    { key: "container.name", group: "containerNames" },
  ] as const;
  let addedScopeFilters = $state<string[]>([]);
  let choosingFilter = $state(false);
  const filterRows = $derived([
    ...scopeAttributes
      .filter(
        ({ key, group }) =>
          addedScopeFilters.includes(key) ||
          form.scope[group].include.length ||
          form.scope[group].exclude.length,
      )
      .map(({ key, group }) => ({ key, group, values: form.scope[group] })),
    ...Object.entries(form.metricAttributeFilters).map(([key, values]) => ({
      key,
      group: null,
      values,
    })),
  ]);
</script>

{#snippet fieldHelp(label: string, description: string)}
  <HoverCard.Root openDelay={50} closeDelay={50}>
    <HoverCard.Trigger
      aria-label={`About ${label.toLowerCase()}`}
      class={buttonVariants({
        variant: "ghost",
        size: "icon-sm",
        class: "size-5 cursor-help",
      })}
    >
      <IconInfoCircle class="size-3.5 text-secondary-foreground opacity-75" />
    </HoverCard.Trigger>
    <HoverCard.Content
      class="max-w-sm text-sm text-secondary-foreground"
      side="top"
      align="start"
    >
      <p>{description}</p>
    </HoverCard.Content>
  </HoverCard.Root>
{/snippet}

<div bind:this={editorRoot} class="flex w-full flex-col">
  {#if error}
    <div
      class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {error}
    </div>
  {/if}

  <Tabs.Root bind:value={activeTab} class="flex min-h-0 flex-1 flex-col gap-0">
    <Tabs.List
      variant="line"
      class="flex h-13! w-full justify-start border-b px-3"
    >
      <Tabs.Trigger value="condition" class="px-3 not-sm:flex-1">
        <IconAdjustments class="size-3.5 not-sm:hidden" />
        Condition
      </Tabs.Trigger>
      <Tabs.Trigger value="scope" class="px-3 not-sm:flex-1">
        <IconFilter class="size-3.5 not-sm:hidden" />
        Filters
      </Tabs.Trigger>
      <Tabs.Trigger value="notifications" class="px-3 not-sm:flex-1">
        <IconBell class="size-3.5 not-sm:hidden" />
        Notifications
      </Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="condition" class="w-full max-w-4xl px-3 py-6 sm:px-5">
      <section class="space-y-8">
        <div class="grid gap-2">
          <label
            class="text-sm font-medium text-foreground"
            for="alert-rule-name">Rule name</label
          >
          <Input
            id="alert-rule-name"
            bind:value={form.name}
            placeholder="High checkout error rate"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div id="scout-metric-field" class="grid content-start gap-2">
            <div class="flex items-center gap-1">
              <span class="text-sm font-medium">Metric</span>
              {@render fieldHelp(
                "Metric",
                "Search the metrics available for this app.",
              )}
            </div>
            <MetricPicker
              value={form.metricName}
              onSelect={(name, unit, metric) => {
                if (form.metricName !== name) {
                  addedScopeFilters = [];
                  choosingFilter = false;
                  form.scope = {
                    services: { include: [], exclude: [] },
                    spanNames: { include: [], exclude: [] },
                    environments: { include: [], exclude: [] },
                    scopes: { include: [], exclude: [] },
                    containerNames: { include: [], exclude: [] },
                  };
                  form.metricAttributeFilters = {};
                }
                form.metricName = name;
                form.metricUnit = unit;
                form.metricType = metric.type;
                form.metricIsMonotonic = metric.isMonotonic;
                form.metricAggregation = getDefaultMetricAggregation({
                  name,
                  ...metric,
                });
              }}
            />
          </div>
          <div class="grid content-start gap-2">
            <div class="flex items-center gap-1">
              <label class="text-sm font-medium" for="metric-aggregation"
                >Measure</label
              >
              {@render fieldHelp(
                "Measure",
                "Choose which value to compare with the threshold. For request duration, p95 is the time that 95% of requests finish within.",
              )}
            </div>
            <Select.Root
              type="single"
              value={form.metricAggregation ?? "avg"}
              onValueChange={(value) => {
                const option = metricAggregations.find(
                  (option) => option.value === value,
                );
                if (option) form.metricAggregation = option.value;
              }}
            >
              <Select.Trigger id="metric-aggregation" class="w-full"
                >{metricAggregations.find(
                  (option) =>
                    option.value === (form.metricAggregation ?? "avg"),
                )?.label}</Select.Trigger
              >
              <Select.Content>
                {#each metricAggregations as option}<Select.Item
                    value={option.value}
                    label={option.label}
                  />{/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <div class="grid gap-2">
          <p class="text-sm font-medium text-foreground">Alert when</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="grid content-start gap-2">
              <label
                class="text-sm font-medium text-foreground"
                for="alert-comparator">Condition</label
              >
              <Select.Root
                type="single"
                value={form.comparator}
                onValueChange={(value) => {
                  const option = alertComparatorOptions.find(
                    (candidate) => candidate.value === value,
                  );
                  if (option) form.comparator = option.value;
                }}
              >
                <Select.Trigger
                  id="alert-comparator"
                  class="w-full bg-background"
                >
                  {alertComparatorOptions.find(
                    (option) => option.value === form.comparator,
                  )?.label ?? "Choose a condition"}
                </Select.Trigger>
                <Select.Content>
                  {#each alertComparatorOptions as option}
                    <Select.Item value={option.value} label={option.label} />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <div class="grid content-start gap-2">
              <label
                class="text-sm font-medium text-foreground"
                for="alert-threshold"
              >
                Threshold{isUtilizationRatio(
                  form.metricName,
                  form.metricUnit,
                ) || form.metricUnit === "%"
                  ? " (%)"
                  : form.metricUnit && form.metricUnit !== "1"
                    ? ` (${form.metricUnit.replace(/[{}]/g, "")})`
                    : ""}
              </label>
              <Input
                id="alert-threshold"
                type="number"
                step="any"
                min={thresholdBounds.min === undefined
                  ? undefined
                  : thresholdBounds.min *
                    (isUtilizationRatio(form.metricName, form.metricUnit)
                      ? 100
                      : 1)}
                max={thresholdBounds.max === undefined
                  ? undefined
                  : thresholdBounds.max *
                    (isUtilizationRatio(form.metricName, form.metricUnit)
                      ? 100
                      : 1)}
                aria-invalid={!!thresholdError}
                aria-describedby={thresholdError
                  ? "alert-threshold-error"
                  : undefined}
                value={isUtilizationRatio(form.metricName, form.metricUnit)
                  ? form.threshold * 100
                  : form.threshold}
                oninput={(event) => {
                  const value = event.currentTarget.valueAsNumber;
                  form.threshold = isUtilizationRatio(
                    form.metricName,
                    form.metricUnit,
                  )
                    ? value / 100
                    : value;
                }}
              />
              {#if thresholdError}
                <p
                  id="alert-threshold-error"
                  class="text-sm text-destructive"
                  role="alert"
                >
                  {thresholdError}
                </p>
              {/if}
            </div>
          </div>
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          <div class="grid content-start gap-2">
            <div class="flex items-center gap-1">
              <label
                class="text-sm font-medium text-foreground"
                for="alert-window">Over</label
              >
              {@render fieldHelp(
                "Over",
                "Time window used to evaluate the condition.",
              )}
            </div>
            <div class="relative">
              <Input
                id="alert-window"
                type="number"
                bind:value={form.windowMinutes}
                min={1}
                max={1440}
                class="pr-20"
              />
              <span
                class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                >minutes</span
              >
            </div>
          </div>
          <div class="grid content-start gap-2">
            <div class="flex items-center gap-1">
              <label
                class="text-sm font-medium text-foreground"
                for="alert-renotify">Repeat notification every</label
              >
              {@render fieldHelp(
                "Repeat notifications",
                "Repeat notifications while the incident is open. Leave empty to disable.",
              )}
            </div>
            <div class="relative">
              <Input
                id="alert-renotify"
                type="number"
                value={form.renotifyMinutes ?? ""}
                oninput={(event) => {
                  const nextValue = Number(
                    (event.currentTarget as HTMLInputElement).value,
                  );
                  form.renotifyMinutes =
                    Number.isFinite(nextValue) && nextValue > 0
                      ? nextValue
                      : null;
                }}
                min={1}
                max={10080}
                placeholder="Disabled"
                class="pr-20"
              />
              <span
                class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                >minutes</span
              >
            </div>
          </div>
        </div>
      </section>
    </Tabs.Content>
    <Tabs.Content value="scope" class="w-full max-w-4xl px-3 py-6 sm:px-5">
      <section id="scout-scope-fields" class="space-y-5">
        {#if !form.metricName}
          <p class="text-sm text-muted-foreground">
            Choose a metric in Condition to add filters.
          </p>
        {/if}
        {#if filterRows.length}
          <div class="space-y-6">
            {#each filterRows as filter (`${filter.group ?? "attribute"}:${filter.key}`)}
              <div
                class="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4"
              >
                <div class="flex min-w-0 items-start gap-1 sm:pt-1">
                  <span
                    class="min-w-0 flex-1 py-1 text-sm font-medium break-all"
                    >{filter.key}</span
                  >
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${filter.key} filter`}
                    onclick={() => {
                      if (filter.group) {
                        form.scope[filter.group] = { include: [], exclude: [] };
                        addedScopeFilters = addedScopeFilters.filter(
                          (key) => key !== filter.key,
                        );
                      } else delete form.metricAttributeFilters[filter.key];
                    }}><IconX /></Button
                  >
                </div>
                <div class="min-w-0 space-y-3">
                  {#each ["include", "exclude"] as const as mode}
                    <div
                      class="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-2"
                    >
                      <span class="pt-2 text-sm text-secondary-foreground"
                        >{mode === "include" ? "Only include" : "Exclude"}</span
                      >
                      <ScopeValuePicker
                        metricName={form.metricName ?? undefined}
                        group="attributeValues"
                        attributeKey={filter.key}
                        label={`${mode === "include" ? "Include" : "Exclude"} ${filter.key}`}
                        placeholder={filter.values[mode].length
                          ? "Add values..."
                          : mode === "include"
                            ? "All values"
                            : "None excluded"}
                        bind:values={filter.values[mode]}
                      />
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
        {#if choosingFilter && form.metricName}
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <MetricPicker
                kind="attributeKeys"
                metricName={form.metricName}
                label="Choose a filter attribute"
                focusOnMount
                excludeValues={filterRows.map((filter) => filter.key)}
                onSelect={(key) => {
                  const scope = scopeAttributes.find(
                    (attribute) => attribute.key === key,
                  );
                  if (scope)
                    addedScopeFilters = [
                      ...new Set([...addedScopeFilters, key]),
                    ];
                  else if (!Object.hasOwn(form.metricAttributeFilters, key))
                    form.metricAttributeFilters = {
                      ...form.metricAttributeFilters,
                      [key]: { include: [], exclude: [] },
                    };
                  choosingFilter = false;
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cancel adding filter"
              onclick={() => {
                choosingFilter = false;
              }}><IconX /></Button
            >
          </div>
        {:else}
          <Button
            variant="outline"
            class="h-14 w-full border-dashed bg-transparent text-secondary-foreground shadow-none not-disabled:inset-shadow-none"
            disabled={!form.metricName ||
              Object.keys(form.metricAttributeFilters).length >= 20}
            onclick={() => {
              choosingFilter = true;
            }}
          >
            <IconPlus data-slot="button-icon" /> Add filter
          </Button>
        {/if}
      </section>
    </Tabs.Content>
    <Tabs.Content
      value="notifications"
      class="w-full max-w-4xl px-3 py-6 sm:px-5"
    >
      <section id="scout-destination-fields" class="max-w-2xl space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-medium">Send notifications to</h3>
          {#if notificationSettingsHref}
            <Button variant="ghost" size="sm" href={notificationSettingsHref}>
              Manage destinations <IconArrowUpRight data-slot="button-icon" />
            </Button>
          {/if}
        </div>
        {#if destinations.length === 0}
          <div class="space-y-3 py-4">
            <p class="text-sm text-muted-foreground">
              No notification destinations yet.
            </p>
            {#if notificationSettingsHref}
              <Button
                variant="outline"
                size="sm"
                href={`${notificationSettingsHref}?create=1`}
                >Add a destination</Button
              >
            {/if}
          </div>
        {:else}
          <div>
            {#each destinations as destination}
              <label
                class="flex cursor-pointer items-center gap-3 border-b py-3 last:border-b-0"
                class:opacity-50={!destination.isEnabled}
              >
                <Checkbox
                  aria-label={`Notify ${destination.name}`}
                  checked={form.destinationIds.includes(destination.id)}
                  disabled={!destination.isEnabled &&
                    !form.destinationIds.includes(destination.id)}
                  onCheckedChange={(checked) =>
                    toggleDestination(destination.id, Boolean(checked))}
                />
                {#if destination.kind === "webhook"}<IconWebhook
                    class="size-4 shrink-0 text-muted-foreground"
                  />
                {:else if destination.kind === "slack"}<IconBrandSlack
                    class="size-4 shrink-0 text-muted-foreground"
                  />
                {:else}<IconMail
                    class="size-4 shrink-0 text-muted-foreground"
                  />{/if}
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{destination.name}</p>
                  {#if destination.detail}<p
                      class="truncate text-sm text-muted-foreground"
                    >
                      {destination.detail}
                    </p>{/if}
                </div>
                <span class="shrink-0 text-sm text-muted-foreground"
                  >{!destination.isEnabled
                    ? "Disabled"
                    : destination.kind === "webhook"
                      ? "Webhook"
                      : destination.kind === "slack"
                        ? "Slack"
                        : "Email"}</span
                >
              </label>
            {/each}
          </div>
        {/if}
      </section>
    </Tabs.Content>
  </Tabs.Root>
</div>
