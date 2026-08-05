<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { cn } from "@repo/components";
  import { formatDurationNs } from "@repo/utils";
  import {
    IconAlertCircle,
    IconArrowUpRight,
    IconRoute,
  } from "@tabler/icons-svelte";

  import { useChatState } from "./chat-state.svelte";

  let {
    output,
    chatId,
    messageId,
  }: { output: unknown; chatId: string; messageId: string } = $props();

  const chat = useChatState();

  const traces = $derived.by(() => {
    if (!output || typeof output !== "object") return [];
    const structuredContent = (output as Record<string, unknown>)
      .structuredContent;
    if (!structuredContent || typeof structuredContent !== "object") return [];
    const items = (structuredContent as Record<string, unknown>).items;
    if (!Array.isArray(items)) return [];

    return items.slice(0, 5).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const trace = item as Record<string, unknown>;
      const id = typeof trace.id === "string" ? trace.id : "";
      if (!id) return [];
      return [
        {
          id,
          name:
            typeof trace.display_name === "string"
              ? trace.display_name
              : typeof trace.name === "string"
                ? trace.name
                : "Unnamed trace",
          serviceName:
            Array.isArray(trace.service_names) &&
            typeof trace.service_names[0] === "string"
              ? trace.service_names[0]
              : "Unknown service",
          durationNs:
            typeof trace.duration_ns === "number" ? trace.duration_ns : 0,
          spanCount:
            typeof trace.span_count === "number" ? trace.span_count : 0,
          errorCount:
            typeof trace.error_count === "number" ? trace.error_count : 0,
        },
      ];
    });
  });

  const openTrace = async (id: string) => {
    await goto(
      resolve(
        `/(dashboard)/a/[app_id]/traces/[trace_id]?chat=${encodeURIComponent(chatId)}&chat_message=${encodeURIComponent(messageId)}`,
        {
          app_id: chat.appId,
          trace_id: id,
        },
      ),
    );
  };
</script>

{#if traces.length}
  <div class="mt-2 overflow-hidden rounded-xl border bg-card" data-scrollable>
    {#each traces as trace, index (trace.id)}
      <button
        type="button"
        class="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/70 {index
          ? 'border-t'
          : ''}"
        onclick={() => openTrace(String(trace.id))}
      >
        <span
          class={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
            trace.errorCount > 0 && "bg-destructive/10 text-destructive",
          )}
        >
          {#if trace.errorCount > 0}
            <IconAlertCircle class="size-4" />
          {:else}
            <IconRoute class="size-4" />
          {/if}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-xs font-medium text-foreground">
            {trace.name}
          </span>
          <span
            class="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground"
          >
            <span class="truncate">{trace.serviceName}</span>
            <span aria-hidden="true">·</span>
            <span class="shrink-0 font-mono tabular-nums">
              {formatDurationNs(trace.durationNs)}
            </span>
            <span aria-hidden="true">·</span>
            <span class="shrink-0">{trace.spanCount} spans</span>
          </span>
        </span>
        <IconArrowUpRight
          class="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
    {/each}
  </div>
{/if}
