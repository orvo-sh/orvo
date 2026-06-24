<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import {
    dismissIncidentCommand,
    resolveIncidentCommand,
  } from "$lib/api/incidents.remote";
  import { Badge } from "@repo/components/ui/badge";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as Dialog from "@repo/components/ui/dialog";
  import * as Select from "@repo/components/ui/select";
  import * as Tabs from "@repo/components/ui/tabs";
  import { Textarea } from "@repo/components/ui/textarea";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconAlertTriangle,
    IconArrowUpRight,
    IconCircleFilled,
    IconList,
    IconX,
  } from "@tabler/icons-svelte";

  import PageContainer from "../_components/page-container/page-container.svelte";

  let { data } = $props();

  let resolvingId = $state("");
  let dismissingId = $state("");
  let dismissDialogOpen = $state(false);
  let selectedIncident = $state<(typeof data.incidents)[number] | null>(null);
  let dismissReason = $state<
    "expected" | "false_positive" | "not_actionable" | "other"
  >("expected");
  let dismissReasonText = $state("");

  const counts = $derived({
    all: data.incidents.length,
    open: data.incidents.filter((incident) => incident.status === "open").length,
    resolved: data.incidents.filter((incident) => incident.status === "resolved")
      .length,
    dismissed: data.incidents.filter((incident) => incident.status === "dismissed")
      .length,
  });

  const sourceLabels = {
    alert: "Alert",
    heartbeat: "Heartbeat",
    host: "Host",
  } as const;

  const severityClasses = {
    critical: "border-destructive/30 bg-destructive/10 text-destructive",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    info: "border-primary/20 bg-primary/8 text-primary",
  } as const;

  const statusClasses = {
    open: "border-destructive/30 bg-destructive/10 text-destructive",
    resolved:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
    dismissed: "border-muted-foreground/20 bg-muted-foreground/8 text-muted-foreground",
  } as const;

  const formatTimeAgo = (value: string | Date) => {
    const diffSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(value).getTime()) / 1000),
    );

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const formatDateTime = (value: string | Date | null) =>
    value ? new Date(value).toLocaleString() : "—";

  const viewSourceHref = (incident: (typeof data.incidents)[number]) => {
    if (incident.sourceType === "alert") {
      return `/a/${page.params.app_id}/alerts/${incident.sourceId}`;
    }

    if (incident.sourceType === "heartbeat") {
      return `/a/${page.params.app_id}/heartbeats/${incident.sourceId}`;
    }

    return `/a/${page.params.app_id}/hosts/${incident.sourceId}`;
  };

  const sourceLabel = (incident: (typeof data.incidents)[number]) => {
    const snapshot = incident.sourceSnapshot as Record<string, unknown>;
    if (incident.sourceType === "alert") {
      return String(snapshot.ruleName ?? incident.title);
    }

    if (incident.sourceType === "heartbeat") {
      return String(snapshot.heartbeatName ?? incident.title);
    }

    return String(snapshot.hostName ?? incident.entityName ?? incident.sourceId);
  };

  const resolve = async (incidentId: string) => {
    resolvingId = incidentId;
    const result = await resolveIncidentCommand(incidentId);
    resolvingId = "";

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    await invalidateAll();
    toast.success("Incident resolved.");
  };

  const dismiss = async () => {
    if (!selectedIncident) {
      return;
    }

    dismissingId = selectedIncident.id;
    const result = await dismissIncidentCommand({
      id: selectedIncident.id,
      reason: dismissReason,
      reasonText: dismissReason === "other" ? dismissReasonText : undefined,
    });
    dismissingId = "";

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    dismissDialogOpen = false;
    dismissReason = "expected";
    dismissReasonText = "";
    selectedIncident = null;
    await invalidateAll();
    toast.success("Incident dismissed.");
  };
</script>

<PageContainer
  title="Incidents"
  scrollContent={false}
  innerClass="min-h-0 p-0! gap-2 overflow-hidden"
>
  <Tabs.Root value="all" class="flex min-h-0 flex-1 flex-col gap-0">
    <Tabs.List
      variant="line"
      class="flex h-13! w-full justify-start border-b px-3"
    >
      <Tabs.Trigger value="all" class="px-3 not-sm:flex-1">
        <IconList class="size-3.5 not-sm:hidden" />
        All
        <span
          class="items-center justify-center rounded-sm border border-primary/40 bg-primary/10 px-1 font-mono text-xs text-blue-800 tabular-nums not-sm:hidden"
          >{counts.all}</span
        >
      </Tabs.Trigger>
      <Tabs.Trigger value="open" class="px-3 not-sm:flex-1">
        <IconAlertTriangle class="size-3.5 not-sm:hidden" />
        Open
        <span
          class="items-center justify-center rounded-sm border border-destructive/40 bg-destructive/10 px-1 font-mono text-xs text-destructive tabular-nums not-sm:hidden"
          >{counts.open}</span
        >
      </Tabs.Trigger>
      <Tabs.Trigger value="resolved" class="px-3 not-sm:flex-1">
        <IconCircleFilled class="size-3.5 not-sm:hidden" />
        Resolved
        <span
          class="items-center justify-center rounded-sm border border-green-600/40 bg-green-600/10 px-1 font-mono text-xs text-green-700 tabular-nums not-sm:hidden"
          >{counts.resolved}</span
        >
      </Tabs.Trigger>
      <Tabs.Trigger value="dismissed" class="px-3 not-sm:flex-1">
        <IconX class="size-3.5 not-sm:hidden" />
        Dismissed
        <span
          class="items-center justify-center rounded-sm border border-muted-foreground/30 bg-muted-foreground/7 px-1 font-mono text-xs text-muted-foreground tabular-nums not-sm:hidden"
          >{counts.dismissed}</span
        >
      </Tabs.Trigger>
    </Tabs.List>

    {#each ["all", "open", "resolved", "dismissed"] as const as tab}
      <Tabs.Content value={tab} class="min-h-0 flex-1 p-3">
        {@render incidentList({ tab })}
      </Tabs.Content>
    {/each}
  </Tabs.Root>
</PageContainer>

{#snippet incidentList({
  tab,
}: {
  tab: "all" | "open" | "resolved" | "dismissed";
})}
  {@const incidents =
    tab === "all"
      ? data.incidents
      : data.incidents.filter((incident) => incident.status === tab)}
  <Card.Root
    data-empty={incidents.length === 0 ? "true" : undefined}
    class="max-h-full min-h-0 gap-0 divide-y overflow-y-auto rounded-xl p-0 data-empty:ring-0"
  >
    {#each incidents as incident (incident.id)}
      <div
        class="flex items-center gap-2 px-2 py-2 transition-colors hover:bg-muted/50"
      >
        <a
          class="flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-2 py-0.5 pt-0.75"
          href={`/a/${page.params.app_id}/incidents/${incident.id}`}
        >
          <div class="flex flex-wrap items-center gap-2 text-sm font-medium">
            {incident.title}
            <Badge variant="outline" class={severityClasses[incident.severity]}>
              {incident.severity}
            </Badge>
            <Badge variant="outline" class={statusClasses[incident.status]}>
              {incident.status}
            </Badge>
          </div>
          <div class="flex flex-wrap gap-1 text-[0.8rem] text-muted-foreground">
            <span class="font-medium text-secondary-foreground">
              {sourceLabel(incident)}
            </span>
            <span>·</span>
            <span>{sourceLabels[incident.sourceType]}</span>
            {#if incident.entityName}
              <span>·</span>
              <span>{incident.entityName}</span>
            {/if}
            {#if incident.serviceName}
              <span>·</span>
              <span>{incident.serviceName}</span>
            {/if}
            <span>·</span>
            <span>Opened {formatTimeAgo(incident.openedAt)}</span>
            {#if incident.status !== "open"}
              <span>·</span>
              <span>
                {incident.status === "resolved" ? "Closed" : "Dismissed"}
                {formatDateTime(incident.resolvedAt ?? incident.dismissedAt)}
              </span>
            {/if}
          </div>
        </a>

        <div class="flex shrink-0 items-center gap-1">
          {#if incident.status === "open"}
            <Button
              size="sm"
              variant="outline"
              loading={resolvingId === incident.id}
              onclick={() => {
                void resolve(incident.id);
              }}
            >
              Resolve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onclick={() => {
                selectedIncident = incident;
                dismissReason = "expected";
                dismissReasonText = "";
                dismissDialogOpen = true;
              }}
            >
              Dismiss
            </Button>
          {/if}
          <a
            class={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            href={viewSourceHref(incident)}
          >
            <IconArrowUpRight class="size-4" />
          </a>
        </div>
      </div>
    {:else}
      <div
        class="flex flex-col items-center pt-[5%] text-sm text-muted-foreground"
      >
        No incidents found.
      </div>
    {/each}
  </Card.Root>
{/snippet}

<Dialog.Root bind:open={dismissDialogOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Dismiss incident</Dialog.Title>
      <Dialog.Description>
        Choose a reason before dismissing this incident.
      </Dialog.Description>
    </Dialog.Header>

    <div class="grid gap-4 py-2">
      <div class="grid gap-2">
        <label class="text-sm font-medium">Reason</label>
        <Select.Root
          type="single"
          value={dismissReason}
          onValueChange={(value) => {
            if (value) {
              dismissReason = value as typeof dismissReason;
            }
          }}
        >
          <Select.Trigger class="bg-background capitalize">
            {dismissReason.replaceAll("_", " ")}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="expected" label="Expected" />
            <Select.Item value="false_positive" label="False positive" />
            <Select.Item value="not_actionable" label="Not actionable" />
            <Select.Item value="other" label="Other" />
          </Select.Content>
        </Select.Root>
      </div>

      {#if dismissReason === "other"}
        <div class="grid gap-2">
          <label class="text-sm font-medium">Reason details</label>
          <Textarea bind:value={dismissReasonText} rows={4} />
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (dismissDialogOpen = false)}>
        Cancel
      </Button>
      <Button loading={dismissingId === selectedIncident?.id} onclick={dismiss}>
        Dismiss incident
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
