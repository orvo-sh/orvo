<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import { cn } from "@repo/components";
  import { IconArrowRight, IconCheck } from "@tabler/icons-svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";
  import ExplainerCard from "./_components/explainer-card.svelte";
  import HostMonitoringStep from "./_components/host-monitoring-step.svelte";
  import NextStepsStep from "./_components/next-steps-step.svelte";
  import SdkInstallStep from "./_components/sdk-install-step.svelte";
  import TestTelemetryStep from "./_components/test-telemetry-step.svelte";

  let { data } = $props();

  const steps = [
    {
      id: "connect",
      label: "Connect application",
      complete: data.hasReceivedFirstSignal,
    },
    {
      id: "test",
      label: "Test telemetry",
      complete:
        data.hasReceivedTrace && data.hasReceivedLog && data.hasReceivedMetric,
    },
    {
      id: "host",
      label: "Host monitoring (optional)",
      complete: data.hasConnectedHost,
    },
    {
      id: "next",
      label: "Next steps",
      complete: false,
    },
  ] as const;

  const initialStep = (() => {
    const index = steps.findIndex((step) => !step.complete);
    return index === -1 ? 0 : index;
  })();

  let activeStep = $state(initialStep);

  $effect(() => {
    const nextIncomplete = steps.findIndex((step) => !step.complete);
    if (nextIncomplete !== -1 && activeStep < nextIncomplete) {
      activeStep = nextIncomplete;
    }
  });

  $effect(() => {
    if (
      data.hasReceivedTrace &&
      data.hasReceivedLog &&
      data.hasReceivedMetric &&
      data.hasConnectedHost
    ) {
      return;
    }

    const interval = setInterval(() => {
      void invalidateAll();
    }, 3000);

    return () => clearInterval(interval);
  });

  const fallbackActivation = {
    hasCreatedFirstApp: true,
    hasSentFirstSignals: data.hasReceivedFirstSignal,
    hasViewedTelemetry: false,
    hasCreatedFirstAlert: false,
    hasInvitedTeammate: false,
  };
</script>

<PageContainer title="Getting started">
  {#snippet actions()}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <Button variant="ghost" size="sm" href="/a/{page.params.app_id}/overview">
      Skip to dashboard
      <IconArrowRight class="ml-1 size-4" />
    </Button>
  {/snippet}

  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <div class="space-y-1">
      <h2 class="text-2xl font-semibold tracking-tight">
        Set up your application
      </h2>
      <p class="text-muted-foreground">
        Get your first trace, log, and metric into Orvo in minutes.
      </p>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {#each steps as step, index (step.id)}
        <button
          type="button"
          class={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors",
            activeStep === index
              ? "border-primary/50 bg-primary/5"
              : "bg-card hover:bg-muted/40",
            step.complete && "border-green-500/30 bg-green-500/5",
          )}
          onclick={() => {
            activeStep = index;
          }}
        >
          <div
            class={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
              step.complete
                ? "border-green-500/50 bg-green-500/20 text-green-700 dark:text-green-300"
                : activeStep === index
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-muted-foreground/30 text-muted-foreground",
            )}
          >
            {#if step.complete}
              <IconCheck class="size-3.5" />
            {:else}
              {index + 1}
            {/if}
          </div>
          <span class="text-sm font-medium">{step.label}</span>
        </button>
      {/each}
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
      <Card.Root class="min-w-0">
        <Card.Content class="p-5">
          {#if activeStep === 0}
            <SdkInstallStep ingestionKey={data.ingestionKey ?? ""} />
          {:else if activeStep === 1}
            <TestTelemetryStep
              hasReceivedTrace={data.hasReceivedTrace}
              hasReceivedLog={data.hasReceivedLog}
              hasReceivedMetric={data.hasReceivedMetric}
            />
          {:else if activeStep === 2}
            <HostMonitoringStep hasConnectedHost={data.hasConnectedHost} />
          {:else}
            <NextStepsStep activation={data.activation ?? fallbackActivation} />
          {/if}
        </Card.Content>
      </Card.Root>

      <div class="space-y-4">
        {#if activeStep === 0}
          <ExplainerCard title="How it works">
            <pre
              class="text-xs leading-relaxed text-muted-foreground">Your application
        │
        ▼
      Orvo</pre>
            <p class="text-sm text-muted-foreground">
              Your app sends telemetry via the OpenTelemetry SDK. Orvo receives
              it at the ingest endpoint and routes it to your app.
            </p>
          </ExplainerCard>
        {:else if activeStep === 1}
          <ExplainerCard title="What you will see">
            <pre
              class="text-xs leading-relaxed text-muted-foreground">Test signal
     │
     ▼
  Ingest
     │
     ▼
   Orvo</pre>
            <p class="text-sm text-muted-foreground">
              Sending a test trace, log, and metric proves the pipeline works
              before you instrument your real code.
            </p>
          </ExplainerCard>
        {:else if activeStep === 2}
          <ExplainerCard title="Host monitoring">
            <pre class="text-xs leading-relaxed text-muted-foreground">Host
 ├─ CPU
 ├─ Memory
 ├─ Disk
 └─ Containers
        │
        ▼
      Orvo</pre>
            <p class="text-sm text-muted-foreground">
              Install the Orvo host agent on a Linux machine to collect system
              and container metrics. This step is optional.
            </p>
          </ExplainerCard>
        {:else}
          <ExplainerCard title="Keep going">
            <pre
              class="text-xs leading-relaxed text-muted-foreground">Application
      │
 Error rate > 5%
      │
      ▼
     Alert</pre>
            <p class="text-sm text-muted-foreground">
              Alerts turn telemetry into action. Create your first alert, invite
              a teammate, or track a deployment.
            </p>
          </ExplainerCard>
        {/if}
      </div>
    </div>
  </div>
</PageContainer>
