<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import {
    getMetricAggregationOptions,
    isUtilizationRatio,
  } from "$lib/metric-definitions";
  import {
    createAlertRuleDraftCommand,
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
    comparator: string;
    threshold: number;
    windowMinutes: number;
    renotifyMinutes: number | null;
    isEnabled: boolean;
    isDraft: boolean;
    lastEvaluationStatus: string | null;
    metricType: string | null;
    metricIsMonotonic: boolean;
    metricName: string | null;
    metricAggregation: string | null;
    metricUnit: string | null;
    lastTriggeredAt: Date | null;
    openIncident: {
      id: string;
      openedAt: Date;
      lastObservedValue: number | null;
    } | null;
    openIncidentCount: number;
    destinationCount: number;
  };

  let creating = $state(false);
  const createRule = async () => {
    if (creating) return;
    creating = true;
    try {
      const result = await createAlertRuleDraftCommand();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      await goto(`/a/${page.params.app_id}/alerts/${result.data.id}`, {
        state: { newAlertRule: true },
      });
    } catch {
      toast.error("Failed to create alert rule draft.");
    } finally {
      creating = false;
    }
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

  const comparatorSymbols: Record<string, string> = {
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
  };
  const stats = $derived({
    total: rules.length,
    incidents: rules.filter((rule) => rule.openIncidentCount > 0).length,
    healthy: rules.filter(
      (rule) =>
        rule.isEnabled &&
        rule.openIncidentCount === 0 &&
        rule.lastEvaluationStatus === "ok",
    ).length,
    disabled: rules.filter((rule) => !rule.isEnabled).length,
  });

  const filteredRules = (tab: "all" | "incident" | "healthy" | "disabled") =>
    rules
      .filter((rule) => {
        if (tab === "incident") return rule.openIncidentCount > 0;
        if (tab === "healthy")
          return (
            rule.isEnabled &&
            rule.openIncidentCount === 0 &&
            rule.lastEvaluationStatus === "ok"
          );
        if (tab === "disabled") return !rule.isEnabled;
        return true;
      })
      .sort((left, right) => {
        const score = (rule: AlertRule) =>
          rule.openIncidentCount > 0 ? 0 : rule.isEnabled ? 1 : 2;
        return score(left) - score(right);
      });

  const visibleRules = $derived.by(() => filteredRules(activeTab));

  const formatCondition = (rule: AlertRule) => {
    if (rule.isDraft) return "Finish configuring this rule";
    const aggregation =
      getMetricAggregationOptions({
        name: rule.metricName ?? "",
        type: rule.metricType ?? "gauge",
        isMonotonic: rule.metricIsMonotonic,
      }).find((option) => option.value === rule.metricAggregation)?.label ??
      "Value";
    const ratio = isUtilizationRatio(rule.metricName, rule.metricUnit);
    const threshold = ratio ? rule.threshold * 100 : rule.threshold;
    const unit = ratio
      ? "%"
      : rule.metricUnit === "1"
        ? ""
        : (rule.metricUnit?.replace(/[{}]/g, "") ?? "");
    return `${rule.metricName ?? "Metric"} · ${aggregation} ${comparatorSymbols[rule.comparator]} ${threshold}${unit} · over ${rule.windowMinutes} minutes`;
  };

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
    <Button loading={creating} onclick={createRule}>
      <IconPlus data-slot="button-icon" />
      Create rule
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
                    {rule.name || "Untitled rule"}
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
                    {:else if rule.isEnabled && rule.lastEvaluationStatus !== "ok"}
                      <Badge variant="outline" class="text-muted-foreground">
                        {rule.lastEvaluationStatus === "no_data"
                          ? "No data"
                          : "Awaiting evaluation"}
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
                        {rule.isDraft ? "Draft" : "Disabled"}
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
                        aria-label={`Actions for ${rule.name || "Untitled rule"}`}
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
                      disabled={togglingRuleId === rule.id || rule.isDraft}
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
