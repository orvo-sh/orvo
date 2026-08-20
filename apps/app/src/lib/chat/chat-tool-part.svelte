<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import { Spinner } from "@repo/components/ui/spinner";
  import {
    IconAlertCircle,
    IconAlertTriangle,
    IconChartLine,
    IconFileDescription,
    IconHeartbeat,
    IconNetwork,
    IconPencil,
    IconPlus,
    IconSearch,
    IconSettings,
    IconTerminal2,
    IconTrash,
  } from "@tabler/icons-svelte";
  import type { DynamicToolUIPart } from "ai";

  let {
    part,
    onToolApproval,
  }: {
    part: DynamicToolUIPart;
    onToolApproval: (id: string, approved: boolean) => void;
  } = $props();

  const toolName = $derived(
    part.type === "dynamic-tool"
      ? part.toolName
      : String(part.type).replace(/^tool-/, ""),
  );
  const output = $derived(
    part.state === "output-available" &&
      typeof part.output === "object" &&
      part.output !== null
      ? (part.output as Record<string, unknown>)
      : null,
  );
  const complete = $derived(
    part.state === "output-available" ||
      part.state === "output-error" ||
      part.state === "output-denied",
  );
  const failed = $derived(
    part.state === "output-error" ||
      part.state === "output-denied" ||
      typeof output?.error === "string",
  );
  const intent = $derived(
    part.input &&
      typeof part.input === "object" &&
      "intent" in part.input &&
      typeof part.input.intent === "string"
      ? part.input.intent
      : null,
  );
  const label = $derived(
    intent ??
      (
        {
          search_logs: "Searched logs",
          get_log: "Read log details",
          search_traces: "Searched traces",
          get_trace: "Read trace details",
          get_service_graph: "Mapped services",
          query_metrics: "Queried metrics",
          list_incidents: "Checked incidents",
          get_incident: "Read incident details",
          list_heartbeat_monitors: "Checked heartbeats",
          get_heartbeat_monitor: "Read heartbeat details",
          get_app_overview: "Read app activity",
        } as Record<string, string>
      )[toolName] ??
      `${complete ? "Used" : "Using"} ${String(toolName).replaceAll("_", " ")}`,
  );
  const ToolIcon = $derived(
    (
      {
        search_logs: IconSearch,
        search_traces: IconSearch,
        get_app_overview: IconChartLine,
        get_log: IconFileDescription,
        get_trace: IconFileDescription,
        get_service_graph: IconNetwork,
        query_metrics: IconChartLine,
        list_incidents: IconAlertTriangle,
        get_incident: IconAlertTriangle,
        list_alert_rules: IconAlertTriangle,
        get_alert_rule: IconAlertTriangle,
        list_heartbeat_monitors: IconHeartbeat,
        get_heartbeat_monitor: IconHeartbeat,
        update_app: IconPencil,
        create_alert_rule: IconPlus,
        update_alert_rule: IconPencil,
        set_alert_rule_enabled: IconSettings,
        delete_alert_rule: IconTrash,
        create_heartbeat_monitor: IconPlus,
        update_heartbeat_monitor: IconPencil,
        toggle_heartbeat_monitor_paused: IconSettings,
        regenerate_heartbeat_monitor_secret: IconSettings,
        send_heartbeat_monitor_test_alert: IconHeartbeat,
        delete_heartbeat_monitor: IconTrash,
        resolve_incident: IconAlertTriangle,
        dismiss_incident: IconAlertTriangle,
      } as Record<string, typeof IconTerminal2>
    )[toolName] ?? IconTerminal2,
  );
</script>

<div class="my-2 text-sm text-muted-foreground" data-chat-tool={toolName}>
  {#if part.state === "approval-requested" && !part.approval.isAutomatic}
    <div
      class="rounded-xl border bg-card p-3 text-foreground"
      data-testid="chat-tool-approval"
    >
      <div class="flex items-center gap-2">
        <ToolIcon class="size-4 text-muted-foreground" />
        <p class="font-medium">Approve this action?</p>
      </div>
      {#if intent}<p class="mt-1 text-sm text-muted-foreground">
          {intent}
        </p>{/if}
      <pre
        class="mt-2 max-h-40 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-sm leading-relaxed whitespace-pre-wrap"
        data-scrollable>{JSON.stringify(part.input, null, 2)}</pre>
      <div class="mt-3 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => onToolApproval(part.approval.id, false)}
        >
          Deny
        </Button>
        <Button
          size="sm"
          onclick={() => onToolApproval(part.approval.id, true)}
        >
          Approve
        </Button>
      </div>
    </div>
  {:else}
    <div class="flex items-center gap-2 rounded-lg py-1.5">
      {#if failed}
        <IconAlertCircle class="size-3.5 text-destructive" />
      {:else}
        <ToolIcon class="size-3.5" />
      {/if}
      <span>{label}</span>
      {#if !complete}<Spinner class="ml-auto size-3.5" />{/if}
    </div>
  {/if}
</div>
