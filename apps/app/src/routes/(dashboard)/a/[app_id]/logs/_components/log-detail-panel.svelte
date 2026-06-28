<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import { toast } from "@repo/components/ui/sonner";
  import { IconCopy as CopyIcon, IconCircleFilled } from "@tabler/icons-svelte";
  import type { LogRecord } from "../types";
  import { formatLogBodyForDisplay } from "./log-attribute-display";

  const fmtTimestamp = (ts: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).format(new Date(ts));
  };

  const parseJsonValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
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
    log,
    timezone,
    onClose,
  }: {
    log: LogRecord;
    timezone: string;
    onClose: () => void;
  } = $props();

  const formattedBody = $derived(formatLogBodyForDisplay(log.body));
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  data-testid="log-detail-panel"
  class="relative flex h-full min-h-0 w-full flex-col gap-3 overflow-x-hidden overflow-y-auto bg-background p-3 pt-1"
>
  <div class="flex min-w-0 flex-col">
    <div
      class="flex min-h-10 flex-1 translate-y-2 items-center justify-between rounded-t-xl border border-foreground/10 bg-secondary pr-2 pb-2 pl-3.5 text-sm text-secondary-foreground inset-shadow-[0px_1px_--theme(--color-white)]"
    >
      Message
      <Button
        size="icon-sm"
        variant="ghost"
        onclick={() => {
          navigator.clipboard
            .writeText(formattedBody)
            .then(() => toast.success("Message copied to clipboard."))
            .catch(() => toast.error("Failed to copy to clipboard."));
        }}
      >
        <CopyIcon class="size-3.5" />
      </Button>
    </div>
    <Card.Root class="z-10 w-full min-w-0 p-0">
      <pre
        class="overflow-x-auto px-4 py-2.5 font-mono text-sm leading-5 break-words whitespace-pre-wrap text-foreground">{formattedBody}</pre>
    </Card.Root>
  </div>

  {@render cantFigureAName_Card(
    "Meta",
    (() => {
      let vals = [{ label: "Severity", value: log.severity_text }];
      if (log.deployment_environment)
        vals.push({ label: "Environment", value: log.deployment_environment });
      if (log.scope_name)
        vals.push({
          label: "Scope",
          value: `${log.scope_name}${
            log.scope_version ? ` @ ${log.scope_version}` : ""
          }`,
        });
      if (log.observed_timestamp && log.observed_timestamp !== log.timestamp)
        vals.push({
          label: "Observed at",
          value: fmtTimestamp(log.observed_timestamp),
        });
      if (log.received_at)
        vals.push({
          label: "Received at",
          value: fmtTimestamp(log.received_at),
        });
      if (log.expires_at)
        vals.push({
          label: "Expires at",
          value: fmtTimestamp(log.expires_at),
        });
      return vals;
    })(),
  )}

  {@render cantFigureAName_Card(
    "Log attributes",
    Object.entries(log.log_attributes).map(([k, v]) => ({
      label: k,
      value: v,
    })),
  )}
  {@render cantFigureAName_Card(
    "Resource attributes",
    Object.entries(log.resource_attributes).map(([k, v]) => ({
      label: k,
      value: v,
    })),
  )}
  {@render cantFigureAName_Card(
    "Scope attributes",
    Object.entries(log.scope_attributes).map(([k, v]) => ({
      label: k,
      value: v,
    })),
  )}
</div>

{#snippet cantFigureAName_Card(
  title: string,
  fields: { label: string; value: string }[],
)}
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
            {@const json = parseJsonValue(field.value)}
            <div class="flex min-w-0 items-start gap-3 px-4 py-2.5">
              <span
                title={field.label}
                class="w-24 shrink-0 truncate text-sm text-muted-foreground"
                >{field.label}</span
              >
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
