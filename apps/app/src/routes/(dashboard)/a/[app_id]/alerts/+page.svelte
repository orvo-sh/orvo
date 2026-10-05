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
  import { toast } from "@repo/components/ui/sonner";
  import * as Tabs from "@repo/components/ui/tabs";
  import {
    IconActivity,
    IconAlertTriangle,
    IconCheck,
    IconCircle,
    IconCircleFilled,
    IconDots,
    IconList,
    IconPencil,
    IconPlus,
    IconTrash,
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
  let activeTab = $state<"all" | "incident" | "healthy" | "disabled">("all");

  $effect(() => {
    error = data.alertRulesResult.success ? "" : data.alertRulesResult.error;
    rules = data.alertRulesResult.success
      ? data.alertRulesResult.data.rules
      : [];
  });

  const signalLabels = Object.fromEntries(
    alertSignalOptions.map((option) => [option.value, option.label]),
  );
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

  const filteredRules = (tab: "all" | "incident" | "healthy" | "disabled") =>
    rules
      .filter((rule) => {
        if (tab === "incident") return rule.openIncidentCount > 0;
        if (tab === "healthy")
          return rule.isEnabled && rule.openIncidentCount === 0;
        if (tab === "disabled") return !rule.isEnabled;
        return true;
      })
      .sort((left, right) => {
        const score = (rule: AlertRule) =>
          rule.openIncidentCount > 0 ? 0 : rule.isEnabled ? 1 : 2;
        return score(left) - score(right);
      });

  const visibleRules = $derived.by(() => filteredRules(activeTab));

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

<PageContainer title="Alerts" contentClass="min-h-0 gap-2 overflow-hidden p-0!">
  {#snippet actions()}
    <Button href={`/a/${page.params.app_id}/alerts/new`}>
      <IconPlus data-slot="button-icon" />
      New rule
    </Button>
  {/snippet}

  <div class="flex min-h-0 flex-1 flex-col">
    {#if error}
      <div
        class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {error}
      </div>
    {/if}

    <Tabs.Root
      bind:value={activeTab}
      class="flex min-h-0 flex-1 flex-col gap-0"
    >
      <Tabs.List
        variant="line"
        class="flex h-13! w-full justify-start border-b px-3"
      >
        <Tabs.Trigger value="all" class="px-3 not-sm:flex-1">
          <IconList class="size-3.5 not-sm:hidden" />
          All
          <span
            class="items-center justify-center rounded-sm border border-primary/40 bg-primary/10 px-1 font-mono text-xs text-blue-800 tabular-nums not-sm:hidden"
            >{stats.total}</span
          >
        </Tabs.Trigger>
        <Tabs.Trigger value="incident" class="px-3 not-sm:flex-1">
          <IconAlertTriangle class="size-3.5 not-sm:hidden" />
          Open incidents
          <span
            class="items-center justify-center rounded-sm border border-destructive/40 bg-destructive/10 px-1 font-mono text-xs text-destructive tabular-nums not-sm:hidden"
            >{stats.incidents}</span
          >
        </Tabs.Trigger>
        <Tabs.Trigger value="healthy" class="px-3 not-sm:flex-1">
          <IconCheck class="size-3.5 not-sm:hidden" />
          Healthy
          <span
            class="items-center justify-center rounded-sm border border-green-600/40 bg-green-600/10 px-1 font-mono text-xs text-green-800 tabular-nums not-sm:hidden"
            >{stats.healthy}</span
          >
        </Tabs.Trigger>
        <Tabs.Trigger value="disabled" class="px-3 not-sm:flex-1">
          <IconActivity class="size-3.5 not-sm:hidden" />
          Disabled
          <span
            class="items-center justify-center rounded-sm border border-muted-foreground/30 bg-muted-foreground/7 px-1 font-mono text-xs text-muted-foreground tabular-nums not-sm:hidden"
            >{stats.disabled}</span
          >
        </Tabs.Trigger>
      </Tabs.List>

      {#each ["all", "incident", "healthy", "disabled"] as const as tab}
        <Tabs.Content value={tab} class="min-h-0 flex-1 p-3">
          <Card.Root
            data-empty={visibleRules.length === 0 ? "true" : undefined}
            class="mb-3 max-h-full min-h-0 gap-0 divide-y overflow-y-auto rounded-xl p-0 data-empty:bg-transparent data-empty:shadow-none data-empty:ring-0"
          >
            {#each visibleRules as rule (rule.id)}
              <div
                class="flex items-center gap-2 px-2 py-2 transition-colors hover:bg-muted/50"
              >
                <a
                  href={resolve(`/a/${page.params.app_id}/alerts/${rule.id}`)}
                  class="flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-2 py-0.5 pt-0.75"
                >
                  <div
                    class="flex flex-wrap items-center gap-2 text-sm font-medium"
                  >
                    {rule.name}
                    {#if rule.openIncidentCount > 0}
                      <Badge
                        variant="outline"
                        class="gap-0.5 border-red-600/20 bg-red-600/7 pr-1.5 pl-0.75 text-red-800"
                      >
                        <IconCircleFilled class="size-2.5" />
                        {rule.openIncidentCount === 1
                          ? "Open incident"
                          : `${rule.openIncidentCount} open incidents`}
                      </Badge>
                    {:else if rule.isEnabled}
                      <Badge
                        variant="outline"
                        class="gap-0.5 border-green-600/20 bg-green-600/7 pr-1.5 pl-0.75 text-green-700"
                      >
                        <IconCircleFilled class="size-2.5" />
                        Healthy
                      </Badge>
                    {:else}
                      <Badge
                        variant="outline"
                        class="gap-0.5 border-muted-foreground/20 bg-muted-foreground/7 pr-1.5 pl-0.75 text-muted-foreground"
                      >
                        <IconCircle class="size-2.5" />
                        Disabled
                      </Badge>
                    {/if}
                  </div>
                  <div
                    class="flex flex-wrap gap-0.75 gap-y-1 text-[0.8rem] text-muted-foreground"
                  >
                    {formatCondition(rule)}
                    <span>·</span>
                    <span>
                      Last triggered
                      <span class="font-medium text-secondary-foreground">
                        {rule.lastTriggeredAt
                          ? new Date(rule.lastTriggeredAt).toLocaleString()
                          : "Never"}
                      </span>
                    </span>
                  </div>
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
                          resolve(`/a/${page.params.app_id}/alerts/${rule.id}`),
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
            {:else}
              <div
                class="flex flex-col items-center pt-[5%] text-muted-foreground"
              >
                No alert rules found.
              </div>
            {/each}
          </Card.Root>
        </Tabs.Content>
      {/each}
    </Tabs.Root>
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
