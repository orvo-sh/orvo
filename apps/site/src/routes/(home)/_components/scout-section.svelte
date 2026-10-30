<script lang="ts">
  import DashboardTraceScreenshot from '$lib/assets/dashboard-trace-screenshot.png';
  import { ClaudeCodeIcon } from '@repo/components/icons/claude-code';
  import { CodexIcon } from '@repo/components/icons/codex';
  import { OpenCodeIcon } from '@repo/components/icons/opencode';
  import { Button } from '@repo/components/ui/button';

  const mcpClients = [
    { label: 'Codex', icon: CodexIcon },
    { label: 'Claude Code', icon: ClaudeCodeIcon },
    { label: 'OpenCode', icon: OpenCodeIcon }
  ];
</script>

<section
  id="scout"
  class="scout-section bg-background overflow-hidden border-b pt-16 pb-10 md:pt-24 md:pb-16"
>
  <div class="mx-auto w-full max-w-6xl px-3 md:px-6">
    <div class="mx-auto max-w-150 text-center">
      <div class="space-y-3">
        <h2 class="text-3xl font-medium tracking-tight text-balance lg:text-4xl">Meet Scout.</h2>
        <p class="text-secondary-foreground text-lg leading-relaxed">
          Scout investigates your logs, traces, metrics, incidents, alerts, and heartbeats, then
          helps you act with approval. External agents get the same investigation context through
          read-only MCP access.
        </p>
      </div>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button href="/docs/product/scout" variant="outline">How Scout investigates</Button>
        <Button href="/docs/integrations/mcp" variant="link">Connect over MCP</Button>
      </div>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm">
        <span class="text-muted-foreground">MCP works with</span>
        {#each mcpClients as client (client.label)}
          {@const Icon = client.icon}
          <span class="text-secondary-foreground inline-flex items-center gap-2">
            <Icon class="size-4" />
            {client.label}
          </span>
        {/each}
      </div>
    </div>

    <!-- Replace this asset with the final Scout investigation capture when ready. -->
    <div
      class="bg-card border-foreground/15 mt-10 overflow-hidden rounded-xl border shadow-xl md:mt-16"
      style="mask-image: linear-gradient(to bottom, black 65%, transparent 100%);"
    >
      <img
        src={DashboardTraceScreenshot}
        alt="Orvo trace investigation with Scout explaining a failed ClickHouse query alongside its request spans"
        width="2812"
        height="1600"
        loading="lazy"
        class="h-auto w-full"
      />
    </div>
  </div>
</section>

<style>
  .scout-section {
    --scout-sky: oklch(0.65 0.17 250);
    background-image:
      radial-gradient(ellipse 24% 12% at 0% 73%, var(--background) 25%, transparent 75%),
      radial-gradient(ellipse 18% 10% at 13% 79%, var(--background) 20%, transparent 75%),
      radial-gradient(ellipse 28% 14% at 100% 68%, var(--background) 25%, transparent 75%),
      radial-gradient(ellipse 20% 12% at 88% 77%, var(--background) 20%, transparent 75%),
      radial-gradient(ellipse 35% 12% at 45% 94%, var(--background) 15%, transparent 80%),
      linear-gradient(
        to bottom,
        var(--background) 20%,
        color-mix(in srgb, var(--scout-sky) 8%, var(--background)) 45%,
        color-mix(in srgb, var(--scout-sky) 22%, var(--background)) 78%,
        var(--background) 100%
      );
  }
</style>
