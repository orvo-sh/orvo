<script lang="ts">
  import { cn } from '@repo/components';
  import * as Card from '@repo/components/ui/card';
  import { IconArrowUpRight } from '@tabler/icons-svelte';

  const monitors = [
    {
      name: 'daily-billing-sync',
      status: 'healthy',
      statusLabel: 'Healthy',
      checkIns: Array.from({ length: 24 }, (_, index) => (index === 16 ? 'grace' : 'healthy'))
    },
    {
      name: 'webhook-replay',
      status: 'grace',
      statusLabel: 'In grace',
      checkIns: Array.from({ length: 24 }, (_, index) =>
        index === 8 || index === 23 ? 'grace' : 'healthy'
      )
    },
    {
      name: 'nightly-backup',
      status: 'missed',
      statusLabel: 'Missed',
      checkIns: Array.from({ length: 24 }, (_, index) =>
        index === 21 ? 'grace' : index > 21 ? 'missed' : 'healthy'
      )
    }
  ] as const;
</script>

<Card.Root class="justify-between gap-0 overflow-hidden p-0 shadow xl:col-span-4">
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground font-sans text-lg font-medium">Heartbeats</h2>
    <p class="text-muted-foreground mt-1.5 max-w-[90%] text-base leading-relaxed">
      Know when scheduled work checks in, drifts, or stops before a missed job becomes a customer
      problem.
      <a
        href="/docs/product/heartbeats"
        class="text-primary inline-flex text-base underline-offset-4 hover:underline"
      >
        Learn more about heartbeats
        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
    </p>
  </div>

  <div class="px-5 pt-4 pb-0">
    <div
      class="bg-background border-foreground/10 overflow-hidden rounded-xl rounded-b-none border border-b-0 font-mono text-xs select-none"
    >
      <div
        class="text-muted-foreground border-border/70 flex items-center justify-between border-b px-3.5 py-2.5 text-xs font-normal tracking-wide uppercase"
      >
        <span>Monitor</span>
        <span>Last 24 runs</span>
      </div>

      <div class="divide-border/70 divide-y">
        {#each monitors as monitor (monitor.name)}
          <div class="px-3.5 py-3.5">
            <div class="flex items-center justify-between gap-3">
              <p class="text-secondary-foreground min-w-0 truncate text-xs">{monitor.name}</p>
              <span
                class={cn(
                  'flex shrink-0 items-center gap-1.5 text-xs',
                  monitor.status === 'healthy' && 'text-emerald-700',
                  monitor.status === 'grace' && 'text-amber-700',
                  monitor.status === 'missed' && 'text-destructive'
                )}
              >
                <span
                  class={cn(
                    'size-1.5 rounded-full',
                    monitor.status === 'healthy' && 'bg-emerald-500',
                    monitor.status === 'grace' && 'bg-amber-500',
                    monitor.status === 'missed' && 'bg-destructive'
                  )}
                ></span>
                {monitor.statusLabel}
              </span>
            </div>

            <div
              class="mt-3 flex gap-1"
              aria-label={`${monitor.name}: heartbeat history for the last 24 runs`}
            >
              {#each monitor.checkIns as status, index (index)}
                <span
                  class={cn(
                    'h-4 min-w-0 flex-1 rounded-[2px]',
                    status === 'healthy' && 'bg-emerald-500/85',
                    status === 'grace' && 'bg-amber-500/80',
                    status === 'missed' && 'bg-destructive/80'
                  )}
                  title={`Run ${index + 1}: ${status}`}
                ></span>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</Card.Root>
