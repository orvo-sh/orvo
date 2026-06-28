<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import {
    dismissIncidentCommand,
    resolveIncidentCommand,
  } from "$lib/api/incidents.remote";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as Dialog from "@repo/components/ui/dialog";
  import * as Select from "@repo/components/ui/select";
  import * as Table from "@repo/components/ui/table";
  import { Textarea } from "@repo/components/ui/textarea";
  import { toast } from "@repo/components/ui/sonner";
  import { formatDuration } from "@repo/utils";
  import {
    IconArrowLeft,
    IconArrowUpRight,
    IconBell,
    IconClock,
    IconLink,
  } from "@tabler/icons-svelte";

  import PageContainer from "../../_components/page-container/page-container.svelte";

  let { data } = $props();

  let resolving = $state(false);
  let dismissing = $state(false);
  let dismissDialogOpen = $state(false);
  let dismissReason = $state<
    "expected" | "false_positive" | "not_actionable" | "other"
  >("expected");
  let dismissReasonText = $state("");

  const incident = $derived(data.incident);
  const snapshot = $derived(
    (incident.sourceSnapshot ?? {}) as Record<string, unknown>,
  );
  const sourceTypeLabel = {
    alert: "Alert",
    heartbeat: "Heartbeat",
  } as const;
  const severityClasses = {
    critical: "border-destructive/30 bg-destructive/10 text-destructive",
    warning:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    info: "border-primary/20 bg-primary/8 text-primary",
  } as const;
  const statusClasses = {
    open: "border-destructive/30 bg-destructive/10 text-destructive",
    resolved:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
    dismissed:
      "border-muted-foreground/20 bg-muted-foreground/8 text-muted-foreground",
  } as const;

  const incidentWindow = $derived.by(() => {
    const start = new Date(new Date(incident.openedAt).getTime() - 10 * 60_000);
    const terminal = incident.resolvedAt ?? incident.dismissedAt;
    const end = terminal
      ? new Date(new Date(terminal).getTime() + 10 * 60_000)
      : new Date();

    return { start, end };
  });

  const metricsHref = $derived(
    `/a/${page.params.app_id}/metrics?start=${encodeURIComponent(
      incidentWindow.start.toISOString(),
    )}&end=${encodeURIComponent(incidentWindow.end.toISOString())}`,
  );
  const logsHref = $derived(
    `/a/${page.params.app_id}/logs?start=${encodeURIComponent(
      incidentWindow.start.toISOString(),
    )}&end=${encodeURIComponent(incidentWindow.end.toISOString())}`,
  );
  const tracesHref = $derived(
    `/a/${page.params.app_id}/traces?start=${encodeURIComponent(
      incidentWindow.start.toISOString(),
    )}&end=${encodeURIComponent(incidentWindow.end.toISOString())}`,
  );

  const sourceHref = $derived.by(() => {
    if (incident.sourceType === "alert") {
      return `/a/${page.params.app_id}/alerts/${incident.sourceId}`;
    }

    if (incident.sourceType === "heartbeat") {
      return `/a/${page.params.app_id}/heartbeats/${incident.sourceId}`;
    }

    return `/a/${page.params.app_id}/incidents/${incident.id}`;
  });

  const sourceName = $derived.by(() => {
    if (incident.sourceType === "alert") {
      return String(snapshot.ruleName ?? incident.title);
    }

    if (incident.sourceType === "heartbeat") {
      return String(snapshot.heartbeatName ?? incident.title);
    }

    return incident.title;
  });

  const durationSeconds = $derived.by(() => {
    const end = incident.resolvedAt ?? incident.dismissedAt ?? new Date();
    return Math.max(
      0,
      Math.floor(
        (new Date(end).getTime() - new Date(incident.openedAt).getTime()) /
          1000,
      ),
    );
  });

  const explanation = $derived.by(() => {
    if (incident.sourceType === "heartbeat") {
      return `${snapshot.heartbeatName ?? incident.title} missed its expected check-in window. Expected every ${formatDuration(Number(snapshot.expectedEverySeconds ?? 0))} with a ${formatDuration(Number(snapshot.graceSeconds ?? 0))} grace period.`;
    }

    const comparator = String(snapshot.comparator ?? ">");
    const threshold = snapshot.threshold ?? "unknown";
    const observed = incident.lastObservedValue ?? "unknown";
    const windowMinutes = snapshot.windowMinutes ?? "unknown";
    return `${snapshot.ruleName ?? incident.title} crossed its threshold for ${windowMinutes} minutes. Current value is ${observed} and the configured threshold is ${comparator} ${threshold}.`;
  });

  const timelineItems = $derived.by(() => {
    const eventItems = data.events.map((event) => ({
      id: event.id,
      occurredAt: new Date(event.occurredAt),
      label: event.eventType,
      detail:
        typeof event.metadata?.observedValue === "number"
          ? `Value ${event.metadata.observedValue}`
          : null,
    }));
    const deliveryItems = data.deliveries.map((delivery) => ({
      id: delivery.id,
      occurredAt: new Date(delivery.createdAt),
      label:
        delivery.status === "succeeded"
          ? "notification.sent"
          : delivery.status === "failed"
            ? "notification.failed"
            : "notification.queued",
      detail: delivery.destinationName
        ? `${delivery.destinationName} · ${delivery.eventType}`
        : delivery.eventType,
    }));

    return [...eventItems, ...deliveryItems].sort(
      (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
    );
  });

  const resolve = async () => {
    resolving = true;
    const result = await resolveIncidentCommand(incident.id);
    resolving = false;

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    await invalidateAll();
    toast.success("Incident resolved.");
  };

  const dismiss = async () => {
    dismissing = true;
    const result = await dismissIncidentCommand({
      id: incident.id,
      reason: dismissReason,
      reasonText: dismissReason === "other" ? dismissReasonText : undefined,
    });
    dismissing = false;

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    dismissDialogOpen = false;
    await invalidateAll();
    toast.success("Incident dismissed.");
  };
</script>

<PageContainer title="Incident detail">
  {#snippet actions()}
    <Button href={`/a/${page.params.app_id}/incidents`} variant="outline">
      <IconArrowLeft data-slot="button-icon" />
      Back to incidents
    </Button>
  {/snippet}

  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    <section class="rounded-xl border bg-background p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="outline" class={severityClasses[incident.severity]}>
              {incident.severity}
            </Badge>
            <h1 class="text-xl font-semibold">{incident.title}</h1>
            <Badge variant="outline" class={statusClasses[incident.status]}>
              {incident.status}
            </Badge>
          </div>
          <p class="text-sm text-muted-foreground">
            {sourceName} · {sourceTypeLabel[incident.sourceType]} · Started
            {new Date(incident.openedAt).toLocaleString()}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          {#if incident.status === "open"}
            <Button loading={resolving} onclick={resolve}>Resolve</Button>
            <Button
              variant="outline"
              onclick={() => {
                dismissReason = "expected";
                dismissReasonText = "";
                dismissDialogOpen = true;
              }}
            >
              Dismiss
            </Button>
          {/if}
          <Button href={sourceHref} variant="outline">
            <IconArrowUpRight data-slot="button-icon" />
            View source
          </Button>
        </div>
      </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Card.Root class="p-4">
        <p class="text-xs text-muted-foreground">Status</p>
        <p class="mt-1 text-sm font-medium capitalize">{incident.status}</p>
      </Card.Root>
      <Card.Root class="p-4">
        <p class="text-xs text-muted-foreground">Duration</p>
        <p class="mt-1 text-sm font-medium">
          {formatDuration(durationSeconds)}
        </p>
      </Card.Root>
      <Card.Root class="p-4">
        <p class="text-xs text-muted-foreground">Source</p>
        <p class="mt-1 text-sm font-medium">{sourceName}</p>
      </Card.Root>
      <Card.Root class="p-4">
        <p class="text-xs text-muted-foreground">Affected</p>
        <p class="mt-1 text-sm font-medium">
          {incident.entityName ?? incident.entityId}
        </p>
      </Card.Root>
      <Card.Root class="p-4">
        <p class="text-xs text-muted-foreground">Started</p>
        <p class="mt-1 text-sm font-medium">
          {new Date(incident.openedAt).toLocaleString()}
        </p>
      </Card.Root>
    </section>

    {#if incident.sourceType === "heartbeat"}
      <section class="grid gap-3 sm:grid-cols-3">
        <Card.Root class="p-4">
          <p class="text-xs text-muted-foreground">Expected</p>
          <p class="mt-1 text-sm font-medium">
            {formatDuration(Number(snapshot.expectedEverySeconds ?? 0))}
          </p>
        </Card.Root>
        <Card.Root class="p-4">
          <p class="text-xs text-muted-foreground">Grace</p>
          <p class="mt-1 text-sm font-medium">
            {formatDuration(Number(snapshot.graceSeconds ?? 0))}
          </p>
        </Card.Root>
        <Card.Root class="p-4">
          <p class="text-xs text-muted-foreground">Last check-in</p>
          <p class="mt-1 text-sm font-medium">
            {snapshot.lastCheckInAt
              ? new Date(String(snapshot.lastCheckInAt)).toLocaleString()
              : "Never"}
          </p>
        </Card.Root>
      </section>
    {/if}

    <section
      class="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]"
    >
      <div class="grid gap-3">
        <Card.Root class="p-5">
          <div class="flex items-center gap-2">
            <IconClock class="size-4 text-muted-foreground" />
            <h2 class="text-sm font-medium">Explanation</h2>
          </div>
          <p class="mt-3 text-sm text-muted-foreground">{explanation}</p>
        </Card.Root>

        <Card.Root class="p-5">
          <div class="flex items-center gap-2">
            <IconLink class="size-4 text-muted-foreground" />
            <h2 class="text-sm font-medium">Timeline</h2>
          </div>

          <div class="mt-4 space-y-3">
            {#each timelineItems as item (item.id)}
              <div class="flex items-start gap-3">
                <div class="mt-1 size-2 rounded-full bg-primary"></div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-sm font-medium">{item.label}</p>
                    <span class="text-xs text-muted-foreground">
                      {item.occurredAt.toLocaleString()}
                    </span>
                  </div>
                  {#if item.detail}
                    <p class="text-xs text-muted-foreground">{item.detail}</p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </Card.Root>
      </div>

      <div class="grid gap-3">
        <Card.Root class="p-5">
          <div class="flex items-center gap-2">
            <IconArrowUpRight class="size-4 text-muted-foreground" />
            <h2 class="text-sm font-medium">Related signals</h2>
          </div>

          <div class="mt-4 grid gap-2">
            <Button href={sourceHref} variant="outline" class="justify-start">
              View source
            </Button>
            <Button href={logsHref} variant="outline" class="justify-start">
              View logs
            </Button>
            <Button href={tracesHref} variant="outline" class="justify-start">
              View traces
            </Button>
            <Button href={metricsHref} variant="outline" class="justify-start">
              View metrics
            </Button>
          </div>
        </Card.Root>

        <Card.Root class="p-5">
          <div class="flex items-center gap-2">
            <IconBell class="size-4 text-muted-foreground" />
            <h2 class="text-sm font-medium">Notification history</h2>
          </div>

          <Table.Root class="mt-4">
            <Table.Header>
              <Table.Row>
                <Table.Head>Event</Table.Head>
                <Table.Head>Destination</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>At</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each data.deliveries as delivery (delivery.id)}
                <Table.Row>
                  <Table.Cell>{delivery.eventType}</Table.Cell>
                  <Table.Cell
                    >{delivery.destinationName ?? "Unknown"}</Table.Cell
                  >
                  <Table.Cell>{delivery.status}</Table.Cell>
                  <Table.Cell>
                    {new Date(
                      delivery.deliveredAt ??
                        delivery.lastAttemptAt ??
                        delivery.createdAt,
                    ).toLocaleString()}
                  </Table.Cell>
                </Table.Row>
              {:else}
                <Table.Row>
                  <Table.Cell
                    colspan={4}
                    class="py-8 text-center text-sm text-muted-foreground"
                  >
                    No notifications were recorded for this incident.
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </Card.Root>
      </div>
    </section>
  </div>
</PageContainer>

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
      <Button loading={dismissing} onclick={dismiss}>Dismiss incident</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
