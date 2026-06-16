<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { alertSignalOptions } from "$lib/alerts";
  import {
    deleteAlertRuleCommand,
    setAlertRuleEnabledCommand,
  } from "$lib/api/alert-rules.remote";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import {
    IconActivity,
    IconAlertTriangle,
    IconBell,
    IconBox,
    IconClock,
    IconGauge,
    IconPencil,
    IconPlus,
    IconSearch,
    IconServer,
    IconTrash,
    IconTrendingUp,
  } from "@tabler/icons-svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";

  let { data } = $props();

  type AlertRule = {
    id: string;
    name: string;
    signalType: string;
    comparator: string;
    threshold: number;
    windowMinutes: number;
    renotifyMinutes: number | null;
    isEnabled: boolean;
    lastTriggeredAt: Date | null;
    openIncident: {
      id: string;
      openedAt: Date;
      lastObservedValue: number | null;
    } | null;
    openIncidentCount: number;
    destinationCount: number;
  };

  let loading = $state(false);
  let error = $state("");
  let togglingRuleId = $state("");
  let deletingRuleId = $state("");
  let rules = $state<AlertRule[]>([]);
  let search = $state("");
  let statusFilter = $state<"all" | "incident" | "healthy" | "disabled">("all");

  $effect(() => {
    error = data.alertRulesResult.success ? "" : data.alertRulesResult.error;
    rules = data.alertRulesResult.success
      ? data.alertRulesResult.data.rules
      : [];
    loading = false;
  });

  const signalLabels = Object.fromEntries(
    alertSignalOptions.map((o) => [o.value, o.label]),
  );

  const signalIcons: Record<string, typeof IconBell> = {
    error_rate: IconAlertTriangle,
    latency_p95_ms: IconClock,
    latency_p99_ms: IconClock,
    apdex: IconGauge,
    throughput_per_min: IconTrendingUp,
    availability_percent: IconActivity,
    host_cpu_utilization: IconServer,
    host_memory_utilization: IconServer,
    host_filesystem_utilization: IconServer,
    host_reporting_stale: IconServer,
    container_cpu_utilization: IconBox,
    container_memory_utilization: IconBox,
    container_reporting_stale: IconBox,
  };

  const comparatorSymbols: Record<string, string> = {
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
  };

  const signalUnits: Record<string, string> = {
    error_rate: "%",
    latency_p95_ms: "ms",
    latency_p99_ms: "ms",
    apdex: "",
    throughput_per_min: "/min",
    availability_percent: "%",
    host_cpu_utilization: "%",
    host_memory_utilization: "%",
    host_filesystem_utilization: "%",
    host_reporting_stale: "m",
    container_cpu_utilization: "%",
    container_memory_utilization: "%",
    container_reporting_stale: "m",
  };

  const formatCondition = (rule: AlertRule) => {
    const signal = signalLabels[rule.signalType] ?? rule.signalType;
    const comparator = comparatorSymbols[rule.comparator] ?? rule.comparator;
    const unit = signalUnits[rule.signalType] ?? "";
    return `${signal} ${comparator} ${rule.threshold}${unit} · ${rule.windowMinutes}m window`;
  };

  const stats = $derived({
    total: rules.length,
    incidents: rules.filter((r) => r.openIncidentCount > 0).length,
    healthy: rules.filter((r) => r.isEnabled && r.openIncidentCount === 0)
      .length,
    disabled: rules.filter((r) => !r.isEnabled).length,
  });

  const filteredRules = $derived.by(() => {
    let result = rules;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }

    if (statusFilter !== "all") {
      result = result.filter((r) => {
        if (statusFilter === "incident") return r.openIncidentCount > 0;
        if (statusFilter === "healthy")
          return r.isEnabled && r.openIncidentCount === 0;
        if (statusFilter === "disabled") return !r.isEnabled;
        return true;
      });
    }

    return [...result].sort((a, b) => {
      const score = (r: AlertRule) =>
        r.openIncidentCount > 0 ? 0 : r.isEnabled ? 1 : 2;
      return score(a) - score(b);
    });
  });

  const toggleRule = async (ruleId: string, isEnabled: boolean) => {
    togglingRuleId = ruleId;
    error = "";
    const result = await setAlertRuleEnabledCommand({ id: ruleId, isEnabled });
    if (result.success === false) {
      error = result.error;
      togglingRuleId = "";
      return;
    }
    await invalidateAll();
    togglingRuleId = "";
  };

  const deleteRule = async (ruleId: string) => {
    if (!window.confirm("Delete this alert rule?")) return;
    deletingRuleId = ruleId;
    error = "";
    const result = await deleteAlertRuleCommand(ruleId);
    if (result.success === false) {
      error = result.error;
      deletingRuleId = "";
      return;
    }
    await invalidateAll();
    deletingRuleId = "";
  };
</script>

<PageContainer title="Alerts">
  {#snippet actions()}
    <Button href={`/a/${page.params.app_id}/alerts/new`}>
      <IconPlus data-slot="button-icon" />
      New rule
    </Button>
  {/snippet}

  <div class="mx-auto flex w-full max-w-5xl flex-col gap-5">
    {#if error}
      <div
        class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {error}
      </div>
    {/if}

    {#if !loading && rules.length > 0}
      <!-- Stats strip -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          class="rounded-xl border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40 {statusFilter ===
          'all'
            ? 'ring-2 ring-primary/20 ring-inset'
            : ''}"
          onclick={() => {
            statusFilter = "all";
          }}
        >
          <p class="text-2xl font-semibold tabular-nums">{stats.total}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">Total rules</p>
        </button>
        <button
          class="rounded-xl border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40 {statusFilter ===
          'incident'
            ? 'ring-2 ring-destructive/30 ring-inset'
            : ''}"
          onclick={() => {
            statusFilter = statusFilter === "incident" ? "all" : "incident";
          }}
        >
          <p class="text-2xl font-semibold text-destructive tabular-nums">
            {stats.incidents}
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">Open incidents</p>
        </button>
        <button
          class="rounded-xl border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40 {statusFilter ===
          'healthy'
            ? 'ring-2 ring-green-500/30 ring-inset'
            : ''}"
          onclick={() => {
            statusFilter = statusFilter === "healthy" ? "all" : "healthy";
          }}
        >
          <p
            class="text-2xl font-semibold text-green-600 tabular-nums dark:text-green-400"
          >
            {stats.healthy}
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">Healthy</p>
        </button>
        <button
          class="rounded-xl border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40 {statusFilter ===
          'disabled'
            ? 'ring-2 ring-primary/20 ring-inset'
            : ''}"
          onclick={() => {
            statusFilter = statusFilter === "disabled" ? "all" : "disabled";
          }}
        >
          <p class="text-2xl font-semibold text-muted-foreground tabular-nums">
            {stats.disabled}
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">Disabled</p>
        </button>
      </div>

      <!-- Search -->
      <div class="relative">
        <IconSearch
          class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input bind:value={search} class="pl-9" placeholder="Search rules..." />
      </div>
    {/if}

    <!-- Rules list -->
    {#if loading}
      {#each { length: 3 } as _, i}
        <div class="animate-pulse rounded-xl border p-5">
          <div class="flex items-start gap-3">
            <div class="mt-0.5 size-8 shrink-0 rounded-lg bg-muted"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-40 rounded bg-muted"></div>
              <div class="h-3 w-60 rounded bg-muted"></div>
            </div>
            <div class="h-5 w-24 rounded-full bg-muted"></div>
          </div>
          <div
            class="mt-4 flex items-center justify-between border-t border-border/50 pt-3"
          >
            <div class="flex gap-4">
              <div class="h-3 w-32 rounded bg-muted"></div>
              <div class="h-3 w-20 rounded bg-muted"></div>
            </div>
            <div class="flex gap-1.5">
              <div class="h-7 w-14 rounded-lg bg-muted"></div>
              <div class="h-7 w-16 rounded-lg bg-muted"></div>
              <div class="h-7 w-8 rounded-lg bg-muted"></div>
            </div>
          </div>
        </div>
      {/each}
    {:else if rules.length === 0}
      <div
        class="flex flex-col items-center gap-4 rounded-xl border border-dashed px-4 py-16 text-center"
      >
        <div class="rounded-xl border bg-muted/40 p-3">
          <IconBell class="size-6 text-muted-foreground" />
        </div>
        <div class="space-y-1">
          <p class="text-sm font-medium">No alert rules yet</p>
          <p class="max-w-xs text-sm text-muted-foreground">
            Create a rule to get notified when a signal crosses a threshold.
          </p>
        </div>
        <Button href={`/a/${page.params.app_id}/alerts/new`} variant="outline">
          <IconPlus data-slot="button-icon" />
          New rule
        </Button>
      </div>
    {:else if filteredRules.length === 0}
      <div
        class="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
      >
        No rules match your search.
      </div>
    {:else}
      {#each filteredRules as rule (rule.id)}
        {@const SignalIcon = signalIcons[rule.signalType] ?? IconBell}
        <div
          class="rounded-xl border bg-background transition-colors {rule.openIncident
            ? 'border-l-2 border-l-destructive'
            : ''}"
        >
          <div class="flex flex-col gap-0 p-5">
            <!-- Header row -->
            <div class="flex items-start justify-between gap-4">
              <div class="flex min-w-0 items-start gap-3">
                <div
                  class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border {rule.openIncident
                    ? 'border-destructive/30 bg-destructive/8 text-destructive'
                    : 'bg-muted/40 text-muted-foreground'}"
                >
                  <SignalIcon class="size-4" />
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm leading-5 font-medium">
                    {rule.name}
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    {formatCondition(rule)}
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                {#if rule.openIncidentCount > 0}
                  <Badge variant="destructive" class="gap-1 text-xs">
                    <span class="size-1.5 animate-pulse rounded-full bg-current"
                    ></span>
                    {rule.openIncidentCount === 1
                      ? "Open incident"
                      : `${rule.openIncidentCount} open incidents`}
                  </Badge>
                {:else if rule.isEnabled}
                  <Badge
                    variant="outline"
                    class="gap-1 border-green-500/30 text-xs text-green-600 dark:text-green-400"
                  >
                    <span class="size-1.5 rounded-full bg-green-500"></span>
                    Healthy
                  </Badge>
                {:else}
                  <Badge variant="outline" class="text-xs text-muted-foreground"
                    >Disabled</Badge
                  >
                {/if}
                {#if rule.destinationCount > 0}
                  <Badge
                    variant="outline"
                    class="text-xs text-muted-foreground"
                  >
                    {rule.destinationCount}
                    {rule.destinationCount === 1
                      ? "destination"
                      : "destinations"}
                  </Badge>
                {/if}
              </div>
            </div>

            <!-- Metadata + actions row -->
            <div
              class="mt-4 flex flex-col gap-3 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div
                class="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"
              >
                <span>
                  Last triggered:
                  {rule.lastTriggeredAt
                    ? new Date(rule.lastTriggeredAt).toLocaleString()
                    : "Never"}
                </span>
                <span
                  >Renotify: {rule.renotifyMinutes
                    ? `${rule.renotifyMinutes}m`
                    : "Off"}</span
                >
                {#if rule.openIncident}
                  <span>
                    Value: {rule.openIncident.lastObservedValue ?? "—"} · Open since
                    {new Date(rule.openIncident.openedAt).toLocaleString()}
                  </span>
                {/if}
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <Button
                  href={`/a/${page.params.app_id}/alerts/${rule.id}`}
                  variant="outline"
                  size="sm"
                >
                  <IconPencil data-slot="button-icon" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  loading={togglingRuleId === rule.id}
                  onclick={() => toggleRule(rule.id, !rule.isEnabled)}
                >
                  {rule.isEnabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  loading={deletingRuleId === rule.id}
                  onclick={() => deleteRule(rule.id)}
                >
                  <IconTrash data-slot="button-icon" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</PageContainer>
