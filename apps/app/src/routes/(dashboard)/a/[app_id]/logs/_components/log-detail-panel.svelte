<script lang="ts">
  import { page } from "$app/state";
  import DetailCard, {
    type DetailFieldValue,
  } from "../../_components/detail-card.svelte";
  import type { LogRecord } from "../types";
  import { formatLogBodyForDisplay } from "./log-attribute-display";

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

  type DetailField = {
    label: string;
    value: DetailFieldValue;
  };

  const toDetailFieldValue = (value: unknown): DetailFieldValue => {
    if (typeof value === "number") {
      return { type: "number", value };
    }

    if (typeof value === "string") {
      const json = parseJsonValue(value);
      return json === null
        ? { type: "text", value }
        : { type: "object", value: json };
    }

    return { type: "object", value };
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

  $effect(() => {
    console.log(log);
  });

  const formattedBody = $derived(formatLogBodyForDisplay(log.body));
  const traceHref = $derived(
    log.trace_id
      ? `/a/${page.params.app_id}/traces/${encodeURIComponent(log.trace_id)}`
      : null,
  );
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  data-testid="log-detail-panel"
  class="relative flex h-full min-h-0 w-full flex-col gap-3 overflow-x-hidden overflow-y-auto bg-background p-3 pt-1"
>
  <DetailCard
    title="Message"
    variant="single"
    value={{
      type: "text",
      value: (() => {
        if (!log.body.trim()) return "(empty body)";
        return log.body;
      })(),
    }}
  />
  <DetailCard
    title="Meta"
    variant="multiple"
    value={(() => {
      let vals: Array<{
        label: string;
        value: DetailFieldValue;
      }> = [
        {
          label: "Severity",
          value: { type: "text", value: log.severity_text },
        },
      ];
      if (log.deployment_environment)
        vals.push({
          label: "Environment",
          value: { type: "text", value: log.deployment_environment },
        });
      if (log.scope_name)
        vals.push({
          label: "Scope",
          value: {
            type: "text",
            value: `${log.scope_name}${
              log.scope_version ? ` @ ${log.scope_version}` : ""
            }`,
          },
        });
      if (log.observed_timestamp && log.observed_timestamp !== log.timestamp)
        vals.push({
          label: "Observed at",
          value: { type: "date", value: new Date(log.observed_timestamp) },
        });
      if (log.received_at)
        vals.push({
          label: "Received at",
          value: { type: "date", value: new Date(log.received_at) },
        });
      if (log.expires_at)
        vals.push({
          label: "Expires at",
          value: { type: "date", value: new Date(log.expires_at) },
        });
      if (log.trace_id && traceHref)
        vals.push({
          label: "Trace",
          value: {
            type: "link",
            href: traceHref,
            label: log.trace_id,
          },
        });
      return vals;
    })()}
  />

  <DetailCard
    title="Log attributes"
    variant="multiple"
    value={Object.entries(log.log_attributes).map(([k, v]) => ({
      label: k,
      value: {
        type: "text",
        value: v,
      },
    }))}
  />

  <DetailCard
    title="Resource attributes"
    variant="multiple"
    value={Object.entries(log.resource_attributes).map(([k, v]) => ({
      label: k,
      value: {
        type: "text",
        value: v,
      },
    }))}
  />

  <DetailCard
    title="Scope attributes"
    variant="multiple"
    value={Object.entries(log.scope_attributes).map(([k, v]) => ({
      label: k,
      value: toDetailFieldValue(v),
    }))}
  />
</div>
