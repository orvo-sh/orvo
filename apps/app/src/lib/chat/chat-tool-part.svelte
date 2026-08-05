<script lang="ts">
  import { Spinner } from "@repo/components/ui/spinner";
  import {
    IconAlertCircle,
    IconCheck,
    IconChevronRight,
  } from "@tabler/icons-svelte";
  import type { DynamicToolUIPart } from "ai";

  import ChatTraceResults from "./chat-trace-results.svelte";

  let {
    part,
    chatId,
    messageId,
  }: { part: DynamicToolUIPart; chatId: string; messageId: string } = $props();

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
    part.state === "output-available" || part.state === "output-error",
  );
  const failed = $derived(
    part.state === "output-error" || typeof output?.error === "string",
  );
  const label = $derived(
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
</script>

<div class="my-2 text-xs text-muted-foreground" data-chat-tool={toolName}>
  <details class="group/tool" open={toolName === "search_traces" && complete}>
    <summary
      class="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1.5 select-none hover:text-foreground"
    >
      {#if !complete}
        <Spinner class="size-3.5" />
      {:else if failed}
        <IconAlertCircle class="size-3.5 text-destructive" />
      {:else}
        <IconCheck class="size-3.5 text-emerald-600 dark:text-emerald-400" />
      {/if}
      <span>{label}</span>
      <IconChevronRight
        class="ml-auto size-3.5 transition-transform group-open/tool:rotate-90"
      />
    </summary>
    {#if toolName === "search_traces" && complete && !failed}
      <ChatTraceResults {chatId} {messageId} output={part.output} />
    {:else}
      <div
        class="mt-1 max-h-48 overflow-auto rounded-lg border bg-muted/35 p-2 font-mono text-[10px] leading-relaxed break-words whitespace-pre-wrap"
        data-scrollable
      >
        {JSON.stringify(part.output ?? part.input ?? {}, null, 2)}
      </div>
    {/if}
  </details>
</div>
