<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { alertSignalOptions } from "$lib/alerts";
  import {
    deleteAlertRuleCommand,
    setAlertRuleEnabledCommand,
  } from "$lib/api/alert-rules.remote";
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import { Input } from "@repo/components/ui/input";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconActivity,
    IconAlertTriangle,
    IconBell,
    IconBox,
    IconCheck,
    IconChevronRight,
    IconClock,
    IconDots,
    IconGauge,
    IconPencil,
    IconPlus,
    IconSearch,
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

  let error = $state("");
  let togglingRuleId = $state("");
  let deletingRuleId = $state("");
  let deleteRuleId = $state<string | null>(null);
  let rules = $state<AlertRule[]>([]);
  let search = $state("");
  let statusFilter = $state<"all" | "incident" | "healthy" | "disabled">("all");

  $effect(() => {
    error = data.alertRulesResult.success ? "" : data.alertRulesResult.error;
    rules = data.alertRulesResult.success
      ? data.alertRulesResult.data.rules
      : [];
  });

  const signalLabels = Object.fromEntries(
    alertSignalOptions.map((option) => [option.value, option.label]),
  );
  const signalIcons: Record<string, typeof IconBell> = {
    error_rate: IconAlertTriangle,
    latency_p95_ms: IconClock,
    latency_p99_ms: IconClock,
    apdex: IconGauge,
    throughput_per_min: IconTrendingUp,
    availability_percent: IconActivity,
    container_cpu_utilization: IconBox,
    container_memory_utilization: IconBox,
    container_reporting_stale: IconBox,
    host_cpu_utilization: IconBox,
    host_memory_utilization: IconBox,
    host_filesystem_utilization: IconBox,
    host_reporting_stale: IconBox,
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
    container_cpu_utilization: "%",
    container_memory_utilization: "%",
    container_reporting_stale: "m",
    host_cpu_utilization: "%",
    host_memory_utilization: "%",
    host_filesystem_utilization: "%",
    host_reporting_stale: "m",
  };

  const stats = $derived({
    total: rules.length,
    incidents: rules.filter((rule) => rule.openIncidentCount > 0).length,
    healthy: rules.filter(
      (rule) => rule.isEnabled && rule.openIncidentCount === 0,
    ).length,
    disabled: rules.filter((rule) => !rule.isEnabled).length,
  });

  const filteredRules = $derived.by(() =>
    rules
      .filter(
        (rule) =>
          !search.trim() ||
          rule.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
      .filter((rule) => {
        if (statusFilter === "incident") return rule.openIncidentCount > 0;
        if (statusFilter === "healthy")
          return rule.isEnabled && rule.openIncidentCount === 0;
        if (statusFilter === "disabled") return !rule.isEnabled;
        return true;
      })
      .sort((left, right) => {
        const score = (rule: AlertRule) =>
          rule.openIncidentCount > 0 ? 0 : rule.isEnabled ? 1 : 2;
        return score(left) - score(right);
      }),
  );

  const formatCondition = (rule: AlertRule) =>
    `${signalLabels[rule.signalType] ?? rule.signalType} ${comparatorSymbols[rule.comparator] ?? rule.comparator} ${rule.threshold}${signalUnits[rule.signalType] ?? ""} · ${rule.windowMinutes}m window`;

  const toggleRule = async (rule: AlertRule) => {
    togglingRuleId = rule.id;
    try {
      const result = await setAlertRuleEnabledCommand({
        id: rule.id,
        isEnabled: !rule.isEnabled,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      await invalidateAll();
      toast.success(
        rule.isEnabled ? "Alert rule disabled." : "Alert rule enabled.",
      );
    } catch {
      toast.error("Failed to update alert rule.");
    } finally {
      togglingRuleId = "";
    }
  };

  const removeRule = async () => {
    if (!deleteRuleId) return;
    deletingRuleId = deleteRuleId;
    try {
      const result = await deleteAlertRuleCommand(deleteRuleId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      deleteRuleId = null;
      await invalidateAll();
      toast.success("Alert rule deleted.");
    } catch {
      toast.error("Failed to delete alert rule.");
    } finally {
      deletingRuleId = "";
    }
  };
</script>

<PageContainer title="Alerts" contentClass="overflow-y-auto p-3">
  {#snippet actions()}
    <Button href={`/a/${page.params.app_id}/alerts/new`}>
      <IconPlus data-slot="button-icon" />
      New rule
    </Button>
  {/snippet}

  <div class="flex flex-col gap-4">
    {#if error}
      <div
        class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {error}
      </div>
    {/if}

    {#if rules.length > 0}
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {#each [{ key: "all", label: "Alert rules", value: stats.total, icon: IconBell }, { key: "incident", label: "Open incidents", value: stats.incidents, icon: IconAlertTriangle }, { key: "healthy", label: "Healthy", value: stats.healthy, icon: IconCheck }, { key: "disabled", label: "Disabled", value: stats.disabled, icon: IconActivity }] as summary (summary.key)}
          <Button
            variant="outline"
            class={`h-auto justify-between rounded-xl p-4 text-left ${statusFilter === summary.key ? "ring-2 ring-primary/15 ring-inset" : ""}`}
            onclick={() =>
              (statusFilter =
                statusFilter === summary.key && summary.key !== "all"
                  ? "all"
                  : (summary.key as typeof statusFilter))}
          >
            <span>
              <span class="block text-sm font-normal text-muted-foreground"
                >{summary.label}</span
              >
              <span class="mt-1 block text-xl font-semibold tabular-nums"
                >{summary.value}</span
              >
            </span>
            <span
              class={`flex size-10 items-center justify-center rounded-md ${summary.key === "incident" && summary.value > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-secondary-foreground"}`}
            >
              <summary.icon class="size-4" />
            </span>
          </Button>
        {/each}
      </section>

      <div class="relative max-w-sm">
        <IconSearch
          class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          bind:value={search}
          class="pl-9"
          placeholder="Search alert rules"
        />
      </div>
    {/if}

    {#if rules.length === 0}
      <div class="flex min-h-80 flex-1 items-center justify-center">
        <div class="flex max-w-sm flex-col items-center gap-4 text-center">
          <div class="rounded-xl border bg-muted/40 p-3">
            <IconBell class="size-5 text-muted-foreground" />
          </div>
          <div>
            <p class="text-sm font-medium">Create your first alert rule</p>
            <p class="mt-1 text-sm text-muted-foreground">
              Get notified when an application or infrastructure signal crosses
              a threshold.
            </p>
          </div>
          <Button
            href={`/a/${page.params.app_id}/alerts/new`}
            variant="outline"
          >
            <IconPlus data-slot="button-icon" />
            New rule
          </Button>
        </div>
      </div>
    {:else}
      <section class="flex flex-col">
        <div
          class="flex translate-y-2 items-center justify-between rounded-t-xl border border-foreground/10 bg-secondary px-3.5 pt-1 pb-3 inset-shadow-[0px_1px_--theme(--color-white)]"
        >
          <div>
            <h2 class="text-sm text-secondary-foreground">
              {statusFilter === "all"
                ? "All rules"
                : statusFilter === "incident"
                  ? "Rules with incidents"
                  : statusFilter === "healthy"
                    ? "Healthy rules"
                    : "Disabled rules"}
            </h2>
          </div>
          <span class="text-xs text-muted-foreground tabular-nums"
            >{filteredRules.length} shown</span
          >
        </div>
        <Card.Root class="z-1 gap-0 overflow-hidden p-0">
          {#if filteredRules.length === 0}
            <div
              class="flex min-h-40 items-center justify-center px-4 text-center text-sm text-muted-foreground"
            >
              No alert rules match this view.
            </div>
          {:else}
            <div class="divide-y">
              {#each filteredRules as rule (rule.id)}
                {@const SignalIcon = signalIcons[rule.signalType] ?? IconBell}
                <div
                  class="group flex items-center gap-3 p-3 transition-colors hover:bg-muted/40"
                >
                  <div
                    class={`flex size-10 shrink-0 items-center justify-center rounded-lg ${rule.openIncidentCount > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-secondary-foreground"}`}
                  >
                    <SignalIcon class="size-4" />
                  </div>
                  <a
                    href={resolve(`/a/${page.params.app_id}/alerts/${rule.id}`)}
                    class="min-w-0 flex-1"
                  >
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="truncate text-sm font-medium">{rule.name}</p>
                      {#if rule.openIncidentCount > 0}
                        <Badge variant="destructive">
                          {rule.openIncidentCount === 1
                            ? "Open incident"
                            : `${rule.openIncidentCount} open incidents`}
                        </Badge>
                      {:else if rule.isEnabled}
                        <Badge
                          variant="outline"
                          class="border-green-600/20 bg-green-600/7 text-green-700 dark:text-green-400"
                        >
                          Healthy
                        </Badge>
                      {:else}
                        <Badge variant="outline" class="text-muted-foreground"
                          >Disabled</Badge
                        >
                      {/if}
                    </div>
                    <p class="mt-1 truncate text-xs text-muted-foreground">
                      {formatCondition(rule)}
                    </p>
                  </a>
                  <div class="hidden shrink-0 text-right md:block">
                    <p class="text-xs text-muted-foreground">Last triggered</p>
                    <p class="mt-0.5 text-xs tabular-nums">
                      {rule.lastTriggeredAt
                        ? new Date(rule.lastTriggeredAt).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                  <a
                    href={resolve(`/a/${page.params.app_id}/alerts/${rule.id}`)}
                    class="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:text-foreground"
                    aria-label={`Open ${rule.name}`}
                  >
                    <IconChevronRight class="size-4" />
                  </a>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      {#snippet child({ props })}
                        <Button
                          {...props}
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${rule.name}`}
                        >
                          <IconDots />
                        </Button>
                      {/snippet}
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end" class="w-40">
                      <DropdownMenu.Item
                        onSelect={() =>
                          void goto(
                            resolve(
                              `/a/${page.params.app_id}/alerts/${rule.id}`,
                            ),
                          )}
                      >
                        <IconPencil />
                        Edit rule
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        disabled={togglingRuleId === rule.id}
                        onSelect={() => void toggleRule(rule)}
                      >
                        <IconActivity />
                        {rule.isEnabled ? "Disable rule" : "Enable rule"}
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        variant="destructive"
                        onSelect={() => (deleteRuleId = rule.id)}
                      >
                        <IconTrash />
                        Delete rule
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </div>
              {/each}
            </div>
          {/if}
        </Card.Root>
      </section>
    {/if}
  </div>
</PageContainer>

<AlertDialog.Root
  open={deleteRuleId !== null}
  onOpenChange={(open) => {
    if (!open) deleteRuleId = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete alert rule?</AlertDialog.Title>
      <AlertDialog.Description>
        This action cannot be undone. Any open incident created by this rule
        will be resolved.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        variant="destructive"
        disabled={deletingRuleId !== ""}
        onclick={removeRule}
      >
        Delete rule
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
