<script lang="ts">
  import { page } from "$app/state";
  import {
    alertComparatorOptions,
    alertSignalDescriptions,
    alertSignalOptions,
    type AlertRuleFormValue,
  } from "$lib/alerts";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@repo/components/ui/card";
  import { Checkbox } from "@repo/components/ui/checkbox";
  import * as Collapsible from "@repo/components/ui/collapsible";
  import { FieldDescription } from "@repo/components/ui/field";
  import { Input } from "@repo/components/ui/input";
  import * as Select from "@repo/components/ui/select";
  import { IconChevronDown, IconInfoCircleFilled } from "@tabler/icons-svelte";

  let {
    form = $bindable(),
    destinations,
    submitting = false,
    error = "",
    submitLabel,
    onSubmit,
  }: {
    form: AlertRuleFormValue;
    destinations: Array<{
      id: string;
      name: string;
      isEnabled: boolean;
      kind: string;
    }>;
    submitting?: boolean;
    error?: string;
    submitLabel: string;
    onSubmit: () => void | Promise<void>;
  } = $props();

  let scopeOpen = $state(false);
  let advancedOpen = $state(false);

  const setScopeValues = (
    group: keyof typeof form.scope,
    mode: "include" | "exclude",
    value: string,
  ) => {
    form.scope[group][mode] = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  };

  const getScopeValue = (
    group: keyof typeof form.scope,
    mode: "include" | "exclude",
  ) => form.scope[group][mode].join(", ");

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

  const isAppSignal = (signalType: AlertRuleFormValue["signalType"]) =>
    [
      "error_rate",
      "latency_p95_ms",
      "latency_p99_ms",
      "apdex",
      "throughput_per_min",
      "availability_percent",
    ].includes(signalType);

  const isContainerSignal = (signalType: AlertRuleFormValue["signalType"]) =>
    [
      "container_cpu_utilization",
      "container_memory_utilization",
      "container_reporting_stale",
    ].includes(signalType);

  const scopeGroups = $derived.by(() => {
    const groups: Array<{
      key: keyof typeof form.scope;
      label: string;
      description: string;
      includePlaceholder: string;
      excludePlaceholder: string;
    }> = [];

    if (isAppSignal(form.signalType)) {
      groups.push(
        {
          key: "services",
          label: "Services",
          description: "Exact service names from traces.",
          includePlaceholder: "api, worker",
          excludePlaceholder: "internal",
        },
        {
          key: "spanNames",
          label: "Span names",
          description: "Entry span names to match.",
          includePlaceholder: "GET /checkout",
          excludePlaceholder: "GET /health",
        },
        {
          key: "environments",
          label: "Environments",
          description: "Deployment environment values.",
          includePlaceholder: "production",
          excludePlaceholder: "staging",
        },
        {
          key: "scopes",
          label: "Instrumentation scopes",
          description: "Instrumentation library or scope names.",
          includePlaceholder: "@opentelemetry/instrumentation-http",
          excludePlaceholder: "custom-test-scope",
        },
      );
    }

    if (isContainerSignal(form.signalType)) {
      groups.push({
        key: "containerNames",
        label: "Container names",
        description: "Match Docker container names without requiring IDs.",
        includePlaceholder: "nginx, queue-worker",
        excludePlaceholder: "one-shot-migration",
      });
    }

    return groups;
  });

  const scopeFilterCount = $derived(
    Object.values(form.scope).reduce(
      (count, values) => count + values.include.length + values.exclude.length,
      0,
    ),
  );

  const signalUnits: Record<AlertRuleFormValue["signalType"], string> = {
    error_rate: "%",
    latency_p95_ms: "ms",
    latency_p99_ms: "ms",
    apdex: "score",
    throughput_per_min: "/min",
    availability_percent: "%",
    container_cpu_utilization: "%",
    container_memory_utilization: "%",
    container_reporting_stale: "min",
  };

  const comparatorPhrases: Record<AlertRuleFormValue["comparator"], string> = {
    gt: "is greater than",
    gte: "is at least",
    lt: "is less than",
    lte: "is at most",
  };

  const submit = async () => {
    await onSubmit();
  };
</script>

<div
  class="mx-auto flex w-full max-w-4xl flex-col gap-3 px-3 py-3 sm:px-5 sm:py-5"
>
  {#if error}
    <div
      class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {error}
    </div>
  {/if}

  <Card>
    <CardHeader class="gap-1 pb-2">
      <CardTitle>Alert condition</CardTitle>
      <CardDescription
        >Choose what to monitor and when it should fire.</CardDescription
      >
    </CardHeader>
    <CardContent class="grid gap-4">
      <div class="grid gap-2">
        <label class="text-sm font-medium text-foreground" for="alert-rule-name"
          >Rule name</label
        >
        <Input
          id="alert-rule-name"
          bind:value={form.name}
          placeholder="High checkout error rate"
        />
      </div>

      <div class="grid gap-2">
        <p class="text-sm font-medium text-foreground">Alert when</p>
        <div
          class="grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(12rem,1fr)_minmax(8rem,0.65fr)]"
        >
          <div class="grid content-start gap-2">
            <label class="text-sm text-muted-foreground" for="alert-signal"
              >Signal</label
            >
            <Select.Root
              type="single"
              value={form.signalType}
              onValueChange={(value) => {
                const option = alertSignalOptions.find(
                  (candidate) => candidate.value === value,
                );
                if (!option) return;
                form.signalType = option.value;
                if (option.value !== "apdex") form.apdexTargetMs = null;
              }}
            >
              <Select.Trigger id="alert-signal" class="w-full bg-background">
                {alertSignalOptions.find(
                  (option) => option.value === form.signalType,
                )?.label ?? "Select a signal"}
              </Select.Trigger>
              <Select.Content>
                {#each alertSignalOptions as option}
                  <Select.Item value={option.value} label={option.label} />
                {/each}
              </Select.Content>
            </Select.Root>
            <FieldDescription class="flex items-start gap-1.5 text-sm">
              <IconInfoCircleFilled class="mt-0.5 size-4 shrink-0" />
              {alertSignalDescriptions[form.signalType]}
            </FieldDescription>
          </div>

          <div class="grid content-start gap-2">
            <label class="text-sm text-muted-foreground" for="alert-comparator"
              >Condition</label
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
            <label class="text-sm text-muted-foreground" for="alert-threshold">
              Threshold ({signalUnits[form.signalType]})
            </label>
            <Input
              id="alert-threshold"
              type="number"
              bind:value={form.threshold}
            />
          </div>
        </div>
      </div>

      <div class="grid gap-2 sm:max-w-xs">
        <label class="text-sm font-medium text-foreground" for="alert-window"
          >Over</label
        >
        <div class="flex items-center gap-2">
          <Input
            id="alert-window"
            type="number"
            bind:value={form.windowMinutes}
            min={1}
            max={1440}
            class="w-24"
          />
          <span class="text-sm text-muted-foreground">minutes</span>
        </div>
      </div>

      <div class="rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
        <span class="font-medium">Rule preview</span>
        <span class="text-muted-foreground">
          Open an incident when {alertSignalOptions
            .find((option) => option.value === form.signalType)
            ?.label.toLowerCase() ?? "signal"}
          {comparatorPhrases[form.comparator]}
          {form.threshold}{signalUnits[form.signalType]}, measured over
          {form.windowMinutes} minutes.
        </span>
      </div>

      {#if form.signalType === "apdex"}
        <div class="grid gap-2 sm:max-w-xs">
          <label
            class="text-sm font-medium text-foreground"
            for="alert-apdex-target">Apdex target (milliseconds)</label
          >
          <Input
            id="alert-apdex-target"
            type="number"
            value={form.apdexTargetMs ?? ""}
            oninput={(event) => {
              const nextValue = Number(
                (event.currentTarget as HTMLInputElement).value,
              );
              form.apdexTargetMs =
                Number.isFinite(nextValue) && nextValue > 0 ? nextValue : null;
            }}
            min={1}
          />
        </div>
      {/if}

      <Collapsible.Root bind:open={advancedOpen}>
        <Collapsible.Trigger
          class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
        >
          Advanced settings
          <IconChevronDown
            class={advancedOpen
              ? "size-4 rotate-180 text-muted-foreground transition-transform"
              : "size-4 text-muted-foreground transition-transform"}
          />
        </Collapsible.Trigger>
        <Collapsible.Content class="pt-3">
          <div class="grid gap-2 sm:max-w-xs">
            <label
              class="text-sm font-medium text-foreground"
              for="alert-renotify">Renotify (minutes)</label
            >
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
              placeholder="Leave empty to disable"
            />
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="gap-1 pb-2">
      <CardTitle>Scope</CardTitle>
      <CardDescription>
        Limit which services, spans, environments, or containers this rule
        applies to.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Collapsible.Root bind:open={scopeOpen}>
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-muted-foreground">
            {scopeFilterCount > 0
              ? `${scopeFilterCount} filters configured.`
              : "No filters applied; this rule covers all matching data."}
          </p>
          {#if scopeGroups.length > 0}
            <Collapsible.Trigger
              class="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              {scopeOpen ? "Hide filters" : "Configure filters"}
              <IconChevronDown
                class={scopeOpen
                  ? "size-4 rotate-180 text-muted-foreground transition-transform"
                  : "size-4 text-muted-foreground transition-transform"}
              />
            </Collapsible.Trigger>
          {/if}
        </div>
        {#if scopeGroups.length > 0}
          <Collapsible.Content class="pt-3">
            <div class="grid gap-3 md:grid-cols-2">
              {#each scopeGroups as group}
                <div class="grid gap-3 rounded-lg border bg-muted/20 p-3">
                  <div class="space-y-1">
                    <h3 class="text-sm font-medium text-foreground">
                      {group.label}
                    </h3>
                    <p class="text-sm text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <label class="grid gap-2">
                      <span class="text-sm font-medium text-foreground"
                        >Include</span
                      >
                      <Input
                        value={getScopeValue(
                          group.key as keyof typeof form.scope,
                          "include",
                        )}
                        oninput={(event) =>
                          setScopeValues(
                            group.key as keyof typeof form.scope,
                            "include",
                            (event.currentTarget as HTMLInputElement).value,
                          )}
                        placeholder={group.includePlaceholder}
                      />
                    </label>
                    <label class="grid gap-2">
                      <span class="text-sm font-medium text-foreground"
                        >Exclude</span
                      >
                      <Input
                        value={getScopeValue(
                          group.key as keyof typeof form.scope,
                          "exclude",
                        )}
                        oninput={(event) =>
                          setScopeValues(
                            group.key as keyof typeof form.scope,
                            "exclude",
                            (event.currentTarget as HTMLInputElement).value,
                          )}
                        placeholder={group.excludePlaceholder}
                      />
                    </label>
                  </div>
                </div>
              {/each}
            </div>
          </Collapsible.Content>
        {/if}
      </Collapsible.Root>
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="gap-1 pb-2">
      <CardTitle>Notifications</CardTitle>
      <CardDescription
        >Choose where to send a notification when this rule fires.</CardDescription
      >
    </CardHeader>
    <CardContent class="grid gap-2">
      {#if destinations.length === 0}
        <div
          class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground"
        >
          No notification destinations yet. Add one in settings before attaching
          it to a rule.
        </div>
      {:else}
        {#each destinations as destination}
          <label
            class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
          >
            <div class="flex items-center gap-3">
              <Checkbox
                checked={form.destinationIds.includes(destination.id)}
                onCheckedChange={(checked) =>
                  toggleDestination(destination.id, Boolean(checked))}
              />
              <div class="space-y-1">
                <p class="text-sm font-medium text-foreground">
                  {destination.name}
                </p>
                <p class="text-xs text-muted-foreground">
                  {destination.kind === "webhook"
                    ? "Webhook"
                    : destination.kind === "slack"
                      ? "Slack"
                      : "Email"} · {destination.isEnabled
                    ? "Enabled"
                    : "Disabled"}
                </p>
              </div>
            </div>
            {#if !destination.isEnabled}
              <Badge variant="outline">Disabled</Badge>
            {/if}
          </label>
        {/each}
      {/if}
    </CardContent>
  </Card>

  <div class="flex items-center justify-end gap-2">
    <Button href={`/a/${page.params.app_id}/alerts`} variant="outline"
      >Cancel</Button
    >
    <Button loading={submitting} onclick={submit}>
      {submitLabel}
    </Button>
  </div>
</div>
