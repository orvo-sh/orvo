<script lang="ts">
  import { IconX as XIcon, IconCopy as CopyIcon } from "@tabler/icons-svelte";
  import type { LogRecord } from "../types";

  type SeverityMeta = { label: string; text: string };
  type AttributeSection = {
    label: string;
    entries: Array<[string, string]>;
  };

  function severityMeta(sev: string): SeverityMeta {
    const s = (sev ?? "").toLowerCase();
    if (s === "fatal") return { label: "FATAL", text: "text-destructive" };
    if (s.includes("err") || s === "error")
      return { label: "ERROR", text: "text-destructive" };
    if (s.includes("warn")) return { label: "WARN", text: "text-amber-500" };
    if (s.includes("debug"))
      return { label: "DEBUG", text: "text-muted-foreground" };
    if (s === "trace")
      return { label: "TRACE", text: "text-muted-foreground/60" };
    return { label: "INFO", text: "text-primary" };
  }

  function fmtTimestamp(ts: string, timezone: string): string {
    const d = new Date(ts);
    const parts = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 2,
      hour12: false,
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(d);

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `${get("month").toUpperCase()} ${get("day")} ${get("hour")}:${get("minute")}:${get("second")}.${get("fractionalSecond")} ${get("timeZoneName")}`;
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  function getAttributeEntries(attributes: Record<string, string> | undefined) {
    return Object.entries(attributes ?? {});
  }

  let {
    log,
    timezone,
    onClose,
  }: {
    log: LogRecord;
    timezone: string;
    onClose: () => void;
  } = $props();

  const meta = $derived(severityMeta(log.severity_text));

  const hasAttributes = $derived(
    Object.keys(log.log_attributes ?? {}).length > 0 ||
      Object.keys(log.resource_attributes ?? {}).length > 0 ||
      Object.keys(log.scope_attributes ?? {}).length > 0,
  );

  const attributeSections = $derived<AttributeSection[]>(
    [
      {
        label: "Resource attributes",
        entries: getAttributeEntries(log.resource_attributes),
      },
      {
        label: "Scope attributes",
        entries: getAttributeEntries(log.scope_attributes),
      },
      {
        label: "Log attributes",
        entries: getAttributeEntries(log.log_attributes),
      },
    ].filter((section) => section.entries.length > 0),
  );

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative flex h-full flex-col bg-background">
  <button
    onclick={onClose}
    class="absolute top-3 right-3 z-10 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    aria-label="Close detail panel"
  >
    <XIcon class="size-4" />
  </button>

  <div class="flex-1 space-y-3 overflow-y-auto px-4 py-4">
    <!-- Timeline: Log received -->
    <div class="flex items-center gap-2 pr-8">
      <div
        class="size-2 shrink-0 rounded-full border-2 border-muted-foreground/40"
      ></div>
      <span class="text-sm text-muted-foreground">Log received</span>
      <span class="ml-auto text-sm text-muted-foreground"
        >{fmtTimestamp(log.timestamp, timezone)}</span
      >
    </div>

    <!-- Core info card -->
    <div class="ml-4 overflow-hidden rounded-lg border">
      <div class="divide-y">
        <div class="flex items-start px-4 py-2.5">
          <span class="w-36 shrink-0 text-sm text-muted-foreground"
            >Severity</span
          >
          <span class="text-sm font-medium {meta.text}"
            >{log.severity_text}{log.severity_number
              ? ` (${log.severity_number})`
              : ""}</span
          >
        </div>

        {#if log.service_name}
          <div class="flex items-start px-4 py-2.5">
            <span class="w-36 shrink-0 text-sm text-muted-foreground"
              >Service</span
            >
            <span class="text-sm break-all text-foreground"
              >{log.service_name}</span
            >
          </div>
        {/if}

        {#if log.deployment_environment}
          <div class="flex items-start px-4 py-2.5">
            <span class="w-36 shrink-0 text-sm text-muted-foreground"
              >Environment</span
            >
            <span class="text-sm break-all text-foreground"
              >{log.deployment_environment}</span
            >
          </div>
        {/if}

        {#if log.scope_name}
          <div class="flex items-start px-4 py-2.5">
            <span class="w-36 shrink-0 text-sm text-muted-foreground"
              >Scope</span
            >
            <span class="text-sm break-all text-foreground"
              >{log.scope_name}{log.scope_version
                ? ` @ ${log.scope_version}`
                : ""}</span
            >
          </div>
        {/if}

        {#if log.id}
          <div class="flex items-start px-4 py-2.5">
            <span class="w-36 shrink-0 text-sm text-muted-foreground"
              >Log ID</span
            >
            <span class="font-mono text-sm break-all text-foreground"
              >{log.id}</span
            >
          </div>
        {/if}

        {#if log.trace_id}
          <div class="flex items-start px-4 py-2.5">
            <span class="w-36 shrink-0 text-sm text-muted-foreground"
              >Trace ID</span
            >
            <span class="font-mono text-sm break-all text-foreground"
              >{log.trace_id}</span
            >
          </div>
        {/if}

        {#if log.span_id}
          <div class="flex items-start px-4 py-2.5">
            <span class="w-36 shrink-0 text-sm text-muted-foreground"
              >Span ID</span
            >
            <span class="font-mono text-sm text-foreground">{log.span_id}</span>
          </div>
        {/if}

        {#if log.trace_flags !== undefined}
          <div class="flex items-start px-4 py-2.5">
            <span class="w-36 shrink-0 text-sm text-muted-foreground"
              >Trace Flags</span
            >
            <span class="font-mono text-sm text-foreground"
              >{log.trace_flags}</span
            >
          </div>
        {/if}

        {#if log.ingestion_key_id}
          <div class="flex items-start px-4 py-2.5">
            <span class="w-36 shrink-0 text-sm text-muted-foreground"
              >Ingestion Key</span
            >
            <span class="font-mono text-sm break-all text-foreground"
              >{log.ingestion_key_id}</span
            >
          </div>
        {/if}

        {#if log.observed_timestamp && log.observed_timestamp !== log.timestamp}
          <div class="flex items-start px-4 py-2.5">
            <span class="w-36 shrink-0 text-sm text-muted-foreground"
              >Observed at</span
            >
            <span class="text-sm text-foreground"
              >{fmtTimestamp(log.observed_timestamp, timezone)}</span
            >
          </div>
        {/if}

        {#if log.received_at}
          <div class="flex items-start px-4 py-2.5">
            <span class="w-36 shrink-0 text-sm text-muted-foreground"
              >Received at</span
            >
            <span class="text-sm text-foreground"
              >{fmtTimestamp(log.received_at, timezone)}</span
            >
          </div>
        {/if}

        {#if log.expires_at}
          <div class="flex items-start px-4 py-2.5">
            <span class="w-36 shrink-0 text-sm text-muted-foreground"
              >Expires at</span
            >
            <span class="text-sm text-foreground"
              >{fmtTimestamp(log.expires_at, timezone)}</span
            >
          </div>
        {/if}
      </div>
    </div>

    <!-- Body card -->
    <div class="ml-4 overflow-hidden rounded-lg border">
      <div class="flex items-center justify-between border-b px-4 py-2.5">
        <span class="text-sm text-muted-foreground">Message</span>
        <button
          type="button"
          class="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onclick={() => copyText(log.body)}
        >
          <CopyIcon class="size-3.5" />
          Copy
        </button>
      </div>
      <pre
        class="overflow-x-auto px-4 py-2.5 font-mono text-sm break-all whitespace-pre-wrap text-foreground">{log.body ||
          "(empty body)"}</pre>
    </div>

    <!-- Attribute cards -->
    {#if hasAttributes}
      {#each attributeSections as section}
        <div class="ml-4 overflow-hidden rounded-lg border">
          <div class="border-b px-4 py-2.5">
            <span class="text-sm text-muted-foreground">{section.label}</span>
          </div>
          <div class="divide-y">
            {#each section.entries as [k, v]}
              <div class="flex items-start px-4 py-2.5">
                <span
                  class="w-36 shrink-0 truncate font-mono text-sm text-muted-foreground"
                  >{k}</span
                >
                <span class="font-mono text-sm break-all text-foreground"
                  >{v}</span
                >
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
