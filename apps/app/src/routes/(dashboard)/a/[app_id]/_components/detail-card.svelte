<script context="module" lang="ts">
  type DetailFieldValue =
    | { type: "text"; value: string }
    | { type: "number"; value: number }
    | { type: "object"; value: unknown }
    | { type: "link"; href: string; label: string }
    | { type: "date"; value: Date };

  export type { DetailFieldValue };
</script>

<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconCircleFilled,
    IconCopy,
    IconExternalLink,
  } from "@tabler/icons-svelte";

  let {
    title,
    variant,
    value,
  }: {
    title: string;
  } & (
    | { variant: "single"; value: DetailFieldValue }
    | {
        variant: "multiple";
        value: {
          label: string;
          value: DetailFieldValue;
        }[];
      }
  ) = $props();

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
</script>

<div class="flex min-w-0 flex-col">
  <div
    class="flex min-h-10 flex-1 translate-y-2 items-center justify-between rounded-t-xl border border-foreground/10 bg-secondary pr-2 pb-2 pl-3.5 text-sm text-secondary-foreground inset-shadow-[0px_1px_--theme(--color-white)]"
  >
    {title}
    {#if variant == "single" && !Array.isArray(value)}
      <Button
        size="icon-sm"
        variant="ghost"
        onclick={() => {
          navigator.clipboard
            .writeText(
              (() => {
                if (value.type === "object") {
                  return JSON.stringify(value.value, null, 2);
                } else if (value.type === "link") {
                  return value.href;
                } else if (value.type === "date") {
                  return value.value.toISOString();
                } else {
                  return String(value.value);
                }
              })(),
            )
            .then(() => toast.success("Message copied to clipboard."))
            .catch(() => toast.error("Failed to copy to clipboard."));
        }}
      >
        <IconCopy class="size-3.5" />
      </Button>
    {/if}
  </div>
  <Card.Root class="z-10 w-full min-w-0 p-0">
    <div class="divide-y">
      {#if variant == "single" && !Array.isArray(value)}
        <div class="px-4 py-2.5">
          {@render renderValue(value)}
        </div>
      {:else if variant == "multiple" && Array.isArray(value)}
        {#each value as v}
          <div class="flex min-w-0 items-start gap-3 px-4 py-2.5">
            <span
              title={v.label}
              class="w-24 shrink-0 truncate text-sm text-muted-foreground"
              >{v.label}</span
            >
            {@render renderValue(v.value)}
          </div>
        {/each}
      {/if}
    </div>
  </Card.Root>
</div>

{#snippet renderValue(value: DetailFieldValue)}
  <div class="font-mono tabular-nums">
    {#if value.type === "object"}
      {@const jsonPreview = toJsonPreview(value.value)}
      {@const jsonTokens = formatJsonTokens(value.value)}
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
          <div class="max-h-96 overflow-auto p-3">
            <pre
              class="rounded-md bg-muted/50 p-3 font-mono text-xs leading-5 break-words whitespace-pre-wrap">{#each jsonTokens as token}<span
                  class={token.className}>{token.text}</span
                >{/each}</pre>
          </div>
        </HoverCard.Content>
      </HoverCard.Root>
    {:else if value.type === "link"}
      <div class="min-w-0">
        <a
          href={value.href}
          class="inline-flex min-w-0 items-center gap-1 font-medium text-secondary-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          <span class="truncate">{value.label}</span>
          <IconExternalLink class="size-3.5 shrink-0" />
        </a>
      </div>
    {:else if value.type === "number"}
      <span class="break-all whitespace-pre-wrap">
        {value.value}
      </span>
    {:else if value.type === "date"}
      <span class="break-all whitespace-pre-wrap">
        {new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3,
          hour12: false,
        }).format(value.value)}
      </span>
    {:else}
      <span class="break-all whitespace-pre-wrap">{value.value}</span>
    {/if}
  </div>
{/snippet}
