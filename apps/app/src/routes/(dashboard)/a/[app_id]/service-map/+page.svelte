<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "@repo/components/ui/button";
  import { IconRefresh } from "@tabler/icons-svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";
  import ServiceGraph from "./_components/service-graph.svelte";

  type PageData = {
    appId: string;
    timePreset: string;
    selectedService: string;
    graph: {
      nodes: Array<{
        name: string;
        total: number;
        errors: number;
        errorRate: number;
        p95LatencyMs: number;
      }>;
      edges: Array<{
        source: string;
        target: string;
        total: number;
        errors: number;
        errorRate: number;
      }>;
      startAtUtc: string;
      endAtUtc: string;
    } | null;
  };

  const timeOptions = [
    { label: "30m", preset: "last_30_minutes" },
    { label: "1h", preset: "last_hour" },
    { label: "4h", preset: "last_4_hours" },
    { label: "24h", preset: "last_24_hours" },
    { label: "7d", preset: "last_7_days" },
  ];

  const data = $derived(page.data as PageData);
  const graph = $derived(data.graph);
  const timePreset = $derived(data.timePreset);
  const selectedService = $derived(data.selectedService);

  function setTimePreset(preset: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("t", preset);
    window.history.pushState({}, "", url.toString());
    window.location.reload();
  }

  function refresh() {
    window.location.reload();
  }
</script>

<PageContainer title="Service map" class="overflow-hidden">
  {#snippet actions()}
    <div class="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-0.5">
      {#each timeOptions as option (option.preset)}
        <button
          class="relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors
            {timePreset === option.preset
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => setTimePreset(option.preset)}
        >
          {option.label}
        </button>
      {/each}
    </div>
    <Button variant="outline" onclick={refresh}>
      <IconRefresh data-slot="button-icon" />
      Refresh
    </Button>
  {/snippet}

  <div class="flex h-full flex-col">
    {#if graph && graph.nodes.length > 0}
      <ServiceGraph {graph} appId={data.appId} {timePreset} {selectedService} />
    {:else}
      <div class="flex flex-1 items-center justify-center">
        <div class="text-center">
          <p class="text-sm font-medium text-muted-foreground">
            No service interactions found
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            Traces with parent-child spans across different services will appear
            here.
          </p>
        </div>
      </div>
    {/if}
  </div>
</PageContainer>
