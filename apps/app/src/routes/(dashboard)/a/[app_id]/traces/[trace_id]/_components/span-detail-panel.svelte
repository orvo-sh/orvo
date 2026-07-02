<script lang="ts">
  import * as Card from "@repo/components/ui/card";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import { formatDurationNs } from "@repo/utils";
  import { IconCircleFilled } from "@tabler/icons-svelte";
  import type { SpanRow } from "../../types";

  const KIND_LABELS: Record<number, string> = {
    0: "Unspecified",
    1: "Internal",
    2: "Server",
    3: "Client",
    4: "Producer",
    5: "Consumer",
  };

  const STATUS_META: Record<number, { label: string }> = {
    0: { label: "Unset" },
    1: { label: "OK" },
    2: { label: "Error" },
  };

  const fmtTime = (iso: string): string => {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hour12: false,
    });
  };

  const parseJson = (raw: string): unknown => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const toJsonPreview = (value: unknown) => {
    const preview = JSON.stringify(value).replace(/\s+/g, " ");
    return preview.length <= 96 ? preview : `${preview.slice(0, 95)}…`;
  };

  const formatJsonTokens = (value: unknown) => {
    const formatted = JSON.stringify(value, null, 2);
    const tokens: Array<{ text: string; className: string }> = [];
    const pattern =
      /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    let lastIndex = 0;

    for (const match of formatted.matchAll(pattern)) {
      const token = match[0];
      const index = match.index ?? 0;

      if (index > lastIndex) {
        tokens.push({
          text: formatted.slice(lastIndex, index),
          className: "text-foreground",
        });
      }

      tokens.push({
        text: token,
        className: match[1]
          ? "text-sky-600"
          : match[2]
            ? "text-emerald-600"
            : token === "null"
              ? "text-rose-600"
              : token === "true" || token === "false"
                ? "text-violet-600"
                : "text-amber-600",
      });

      lastIndex = index + token.length;
    }

    if (lastIndex < formatted.length) {
      tokens.push({
        text: formatted.slice(lastIndex),
        className: "text-foreground",
      });
    }

    return tokens;
  };

  let {
    span,
    onClose,
  }: {
    span: SpanRow;
    onClose: () => void;
  } = $props();

  const status = $derived(STATUS_META[span.status_code] ?? STATUS_META[0]);
  const events = $derived(parseJson(span.events_json) as unknown[] | null);
  const links = $derived(parseJson(span.links_json) as unknown[] | null);

  const overviewFields = $derived.by(() => {
    const fields = [
      {
        label: "Status",
        value: `${status.label}${span.status_message ? ` - ${span.status_message}` : ""}`,
      },
      {
        label: "Kind",
        value: String(KIND_LABELS[span.kind] ?? span.kind),
      },
      {
        label: "Duration",
        value: formatDurationNs(span.duration_ns),
      },
      {
        label: "Start",
        value: fmtTime(span.start_time),
      },
      {
        label: "End",
        value: fmtTime(span.end_time),
      },
      {
        label: "Trace ID",
        value: span.trace_id,
      },
    ];

    if (span.parent_span_id) {
      fields.push({
        label: "Parent",
        value: span.parent_span_id,
      });
    }

    if (span.service_name) {
      fields.push({
        label: "Service",
        value: span.service_name,
      });
    }

    if (span.deployment_environment) {
      fields.push({
        label: "Environment",
        value: span.deployment_environment,
      });
    }

    if (span.scope_name) {
      fields.push({
        label: "Scope",
        value: `${span.scope_name}${span.scope_version ? ` @ ${span.scope_version}` : ""}`,
      });
    }

    return fields;
  });
</script>

<div
  data-testid="span-detail-panel"
  class="relative flex h-full min-h-0 w-full flex-col gap-3 overflow-x-hidden overflow-y-auto bg-background p-3 pt-1"
>
  {@render detailCard("Overview", overviewFields)}

  {@render detailCard(
    "Span attributes",
    Object.entries(span.span_attributes).map(([label, value]) => ({
      label,
      value,
    })),
  )}

  {@render detailCard(
    "Resource attributes",
    Object.entries(span.resource_attributes).map(([label, value]) => ({
      label,
      value,
    })),
  )}

  {@render detailCard(
    "Scope attributes",
    Object.entries(span.scope_attributes).map(([label, value]) => ({
      label,
      value,
    })),
  )}

  {#if events && events.length > 0}
    {@render jsonCard("Events", events)}
  {/if}

  {#if links && links.length > 0}
    {@render jsonCard("Links", links)}
  {/if}
</div>

{#snippet detailCard(title: string, fields: { label: string; value: string }[])}
  {#if fields.length > 0}
    <div class="flex min-w-0 flex-col">
      <div
        class="flex min-h-10 flex-1 translate-y-2 items-center justify-between rounded-t-xl border border-foreground/10 bg-secondary px-3.5 pb-2 text-sm text-secondary-foreground inset-shadow-[0px_1px_--theme(--color-white)]"
      >
        {title}
      </div>
      <Card.Root class="z-10 w-full min-w-0 p-0">
        <div class="divide-y">
          {#each fields as field}
            {@const json = parseJson(field.value)}
            <div class="flex min-w-0 items-start gap-3 px-4 py-2.5">
              <span
                title={field.label}
                class="w-24 shrink-0 truncate text-sm text-muted-foreground"
              >
                {field.label}
              </span>
              <div
                class="min-w-0 flex-1 text-sm font-medium text-secondary-foreground"
              >
                {#if json}
                  {@const jsonPreview = toJsonPreview(json)}
                  {@const jsonTokens = formatJsonTokens(json)}
                  <HoverCard.Root openDelay={50} closeDelay={50}>
                    <HoverCard.Trigger
                      type="button"
                      class="max-w-full min-w-0 rounded-md text-left"
                    >
                      <span
                        class="flex min-w-0 items-start gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60"
                      >
                        <span
                          class="mt-0.5 flex h-fit w-fit shrink-0 gap-0.5 rounded-sm border border-foreground/10 bg-muted px-1 py-1 text-muted-foreground"
                        >
                          <IconCircleFilled class="size-1.5" />
                          <IconCircleFilled class="size-1.5" />
                          <IconCircleFilled class="size-1.5" />
                        </span>
                        <span
                          class="min-w-0 truncate font-mono text-xs text-muted-foreground"
                        >
                          {jsonPreview}
                        </span>
                      </span>
                    </HoverCard.Trigger>
                    <HoverCard.Content
                      side="left"
                      align="start"
                      class="w-[28rem] max-w-[min(42rem,calc(100vw-2rem))] p-0"
                    >
                      <div
                        class="border-b px-3 py-2 text-xs font-medium text-muted-foreground"
                      >
                        {field.label}
                      </div>
                      <div class="max-h-96 overflow-auto p-3">
                        <pre
                          class="rounded-md bg-muted/50 p-3 font-mono text-xs leading-5 break-words whitespace-pre-wrap">{#each jsonTokens as token}<span
                              class={token.className}>{token.text}</span
                            >{/each}</pre>
                      </div>
                    </HoverCard.Content>
                  </HoverCard.Root>
                {:else}
                  <span class="break-all whitespace-pre-wrap"
                    >{field.value}</span
                  >
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </Card.Root>
    </div>
  {/if}
{/snippet}

{#snippet jsonCard(title: string, value: unknown)}
  <div class="flex min-w-0 flex-col">
    <div
      class="flex min-h-10 flex-1 translate-y-2 items-center rounded-t-xl border border-foreground/10 bg-secondary px-3.5 pb-2 text-sm text-secondary-foreground inset-shadow-[0px_1px_--theme(--color-white)]"
    >
      {title}
    </div>
    <Card.Root class="z-10 w-full min-w-0 p-0">
      <div class="max-h-96 overflow-auto p-3">
        <pre
          class="rounded-md bg-muted/50 p-3 font-mono text-xs leading-5 break-words whitespace-pre-wrap text-foreground">{JSON.stringify(
            value,
            null,
            2,
          )}</pre>
      </div>
    </Card.Root>
  </div>
{/snippet}
