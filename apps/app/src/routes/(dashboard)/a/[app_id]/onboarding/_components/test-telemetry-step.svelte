<script lang="ts">
  import { sendTestTelemetryCommand } from "$lib/api/onboarding.remote";
  import { Button } from "@repo/components/ui/button";
  import { toast } from "@repo/components/ui/sonner";
  import { IconCheck, IconLoader2, IconRoute } from "@tabler/icons-svelte";

  const {
    hasReceivedTrace,
    hasReceivedLog,
    hasReceivedMetric,
  }: {
    hasReceivedTrace: boolean;
    hasReceivedLog: boolean;
    hasReceivedMetric: boolean;
  } = $props();

  let sending = $state(false);

  const allReceived = $derived(
    hasReceivedTrace && hasReceivedLog && hasReceivedMetric,
  );

  const sendTestSignals = async () => {
    sending = true;

    const result = await sendTestTelemetryCommand({
      signals: ["traces", "logs", "metrics"],
    });

    if (!result.success) {
      toast.error(result.error);
      sending = false;
      return;
    }

    toast.success("Test signals sent");
    sending = false;
  };

  const signalItems = [
    { key: "traces", label: "Trace", received: hasReceivedTrace },
    { key: "logs", label: "Log", received: hasReceivedLog },
    { key: "metrics", label: "Metric", received: hasReceivedMetric },
  ] as const;
</script>

<div class="space-y-4">
  <div class="space-y-1">
    <h3 class="text-lg font-semibold">Send test telemetry</h3>
    <p class="text-sm text-muted-foreground">
      Fire a synthetic trace, log, and metric so you can see the pipeline work
      immediately.
    </p>
  </div>

  <Button loading={sending} onclick={sendTestSignals} disabled={allReceived}>
    <IconRoute data-slot="button-icon" />
    {#if allReceived}
      All signals received
    {:else}
      Send test signals
    {/if}
  </Button>

  <div class="grid gap-3 sm:grid-cols-3">
    {#each signalItems as item (item.key)}
      <div
        class="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors {item.received
          ? 'border-green-500/20 bg-green-500/5'
          : 'bg-card'}"
      >
        <div
          class="flex size-8 items-center justify-center rounded-full border {item.received
            ? 'border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-300'
            : 'bg-muted text-muted-foreground'}"
        >
          {#if item.received}
            <IconCheck class="size-4" />
          {:else}
            <IconLoader2 class="size-4 animate-spin" />
          {/if}
        </div>
        <div>
          <p class="text-sm font-medium">{item.label}</p>
          <p class="text-xs text-muted-foreground">
            {item.received ? "Received" : "Waiting..."}
          </p>
        </div>
      </div>
    {/each}
  </div>

  <p class="text-xs text-muted-foreground">
    It can take a few seconds for signals to appear. The page checks
    automatically every few seconds.
  </p>
</div>
