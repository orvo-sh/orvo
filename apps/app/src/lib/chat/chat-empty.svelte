<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import { IconSparkles } from "@tabler/icons-svelte";

  import type { ChatContextDescriptor } from "./types";

  let {
    context,
    onSuggestion,
  }: {
    context: ChatContextDescriptor | null;
    onSuggestion: (prompt: string) => void;
  } = $props();

  const suggestions = $derived(
    context
      ? [
          `What stands out about this ${context.kind}?`,
          `Help me investigate ${context.label}`,
          "What should I check next?",
        ]
      : [
          "What changed in the last hour?",
          "Show me recent errors",
          "Are any services unhealthy?",
        ],
  );
</script>

<div
  class="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center"
>
  <div
    class="mb-4 flex size-10 items-center justify-center rounded-xl border bg-card shadow-xs"
  >
    <IconSparkles class="size-4.5 text-primary" />
  </div>
  <h2 class="text-sm font-medium text-foreground">
    {context ? `Explore ${context.label}` : "What are you investigating?"}
  </h2>
  <p class="mt-1.5 max-w-sm text-sm leading-5 text-muted-foreground">
    {context
      ? `Scout has this ${context.kind} in context and can connect it to the rest of your telemetry.`
      : "Scout can search your logs, traces, metrics, incidents, and heartbeats."}
  </p>
  <div class="mt-5 flex max-w-md flex-wrap justify-center gap-1.5">
    {#each suggestions as suggestion (suggestion)}
      <Button
        variant="outline"
        size="sm"
        class="h-auto py-1.5 text-sm font-normal whitespace-normal"
        onclick={() => onSuggestion(suggestion)}
      >
        {suggestion}
      </Button>
    {/each}
  </div>
</div>
