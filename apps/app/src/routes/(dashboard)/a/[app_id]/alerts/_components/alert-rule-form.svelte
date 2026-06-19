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
  import { Input } from "@repo/components/ui/input";

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

  const isHostSignal = (signalType: AlertRuleFormValue["signalType"]) =>
    [
      "host_cpu_utilization",
      "host_memory_utilization",
      "host_filesystem_utilization",
      "host_reporting_stale",
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

    if (isHostSignal(form.signalType) || isContainerSignal(form.signalType)) {
      groups.push({
        key: "hostNames",
        label: "Host names",
        description:
          "Match the displayed host name from the collector resource.",
        includePlaceholder: "api-1, worker-2",
        excludePlaceholder: "canary-host",
      });
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

  const submit = async () => {
    await onSubmit();
  };
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
  {#if error}
    <div
      class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {error}
    </div>
  {/if}

  <Card>
    <CardHeader class="gap-1">
      <CardTitle>Basics</CardTitle>
      <CardDescription
        >Name the rule and choose the signal it evaluates.</CardDescription
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
        <span class="text-sm font-medium text-foreground">Signal</span>
        <div class="flex flex-wrap gap-2">
          {#each alertSignalOptions as option}
            <Button
              variant={form.signalType === option.value ? "default" : "outline"}
              type="button"
              onclick={() => {
                form.signalType = option.value;
                if (option.value !== "apdex") {
                  form.apdexTargetMs = null;
                }
              }}
            >
              {option.label}
            </Button>
          {/each}
        </div>
        <p class="text-sm text-muted-foreground">
          {alertSignalDescriptions[form.signalType]}
        </p>
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="gap-1">
      <CardTitle>Threshold</CardTitle>
      <CardDescription
        >Set the condition, rule window, and renotification cadence.</CardDescription
      >
    </CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-2">
      <div class="grid gap-2">
        <span class="text-sm font-medium text-foreground">Comparator</span>
        <div class="flex flex-wrap gap-2">
          {#each alertComparatorOptions as option}
            <Button
              variant={form.comparator === option.value ? "default" : "outline"}
              type="button"
              size="sm"
              onclick={() => {
                form.comparator = option.value;
              }}
            >
              {option.label}
            </Button>
          {/each}
        </div>
      </div>

      <div class="grid gap-2">
        <label class="text-sm font-medium text-foreground" for="alert-threshold"
          >Threshold</label
        >
        <Input id="alert-threshold" type="number" bind:value={form.threshold} />
      </div>

      <div class="grid gap-2">
        <label class="text-sm font-medium text-foreground" for="alert-window"
          >Window in minutes</label
        >
        <Input
          id="alert-window"
          type="number"
          bind:value={form.windowMinutes}
          min={1}
          max={1440}
        />
      </div>

      <div class="grid gap-2">
        <label class="text-sm font-medium text-foreground" for="alert-renotify">
          Renotify every minutes
        </label>
        <Input
          id="alert-renotify"
          type="number"
          value={form.renotifyMinutes ?? ""}
          oninput={(event) => {
            const nextValue = Number(
              (event.currentTarget as HTMLInputElement).value,
            );
            form.renotifyMinutes =
              Number.isFinite(nextValue) && nextValue > 0 ? nextValue : null;
          }}
          min={1}
          placeholder="Leave empty to disable"
        />
      </div>

      {#if form.signalType === "apdex"}
        <div class="grid gap-2 md:col-span-2">
          <label
            class="text-sm font-medium text-foreground"
            for="alert-apdex-target"
          >
            Apdex target in milliseconds
          </label>
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
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="gap-1">
      <CardTitle>Scope</CardTitle>
      <CardDescription
        >Use comma-separated exact matches. Empty include means all values.</CardDescription
      >
    </CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-2">
      {#if scopeGroups.length === 0}
        <div
          class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground md:col-span-2"
        >
          This signal does not have additional scope filters.
        </div>
      {/if}

      {#each scopeGroups as group}
        <div class="grid gap-3 rounded-xl border p-4">
          <div class="space-y-1">
            <h3 class="text-sm font-medium text-foreground">{group.label}</h3>
            <p class="text-sm text-muted-foreground">{group.description}</p>
          </div>
          <div class="grid gap-2">
            <span class="text-sm font-medium text-foreground">Include</span>
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
          </div>
          <div class="grid gap-2">
            <span class="text-sm font-medium text-foreground">Exclude</span>
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
          </div>
        </div>
      {/each}
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="gap-1">
      <CardTitle>Destinations</CardTitle>
      <CardDescription
        >Attach shared webhook or email destinations to notify when the rule fires.</CardDescription
      >
    </CardHeader>
    <CardContent class="grid gap-3">
      {#if destinations.length === 0}
        <div
          class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground"
        >
          No notification destinations yet. Add one in settings before attaching it
          to a rule.
        </div>
      {:else}
        {#each destinations as destination}
          <label
            class="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
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
                  {destination.kind === "webhook" ? "Webhook" : "Email"} · {destination.isEnabled
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
