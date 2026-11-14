<script lang="ts">
  import { cn } from '@repo/components';
  import * as Card from '@repo/components/ui/card';

  const monitors = [
    {
      name: 'daily-billing-sync',
      status: 'healthy',
      statusLabel: 'Healthy',
      checkIns: Array.from({ length: 20 }, (_, index) => (index === 16 ? 'grace' : 'healthy'))
    },
    {
      name: 'webhook-replay',
      status: 'grace',
      statusLabel: 'In grace',
      checkIns: Array.from({ length: 20 }, (_, index) =>
        index === 8 || index === 19 ? 'grace' : 'healthy'
      )
    },
    {
      name: 'nightly-backup',
      status: 'missed',
      statusLabel: 'Missed',
      checkIns: Array.from({ length: 20 }, (_, index) =>
        index === 21 ? 'grace' : index > 15 ? 'missed' : 'healthy'
      )
    }
  ] as const;
</script>

<Card.Root class="justify-between gap-0 overflow-hidden p-0 shadow md:col-span-6">
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground text-lg font-medium">Heartbeats</h2>
    <p class="text-muted-foreground mt-1.5 max-w-[90%] text-base leading-relaxed">
      Know when scheduled work checks in, drifts, or stops before a missed job becomes a customer
      problem.
      <a
        href="/docs/product/heartbeats"
        class="text-primary bg-primary/5 hover:bg-primary/10 inline-flex rounded-md px-2 text-base underline-offset-4 transition-colors"
      >
        Learn more about heartbeats
      </a>
    </p>
  </div>

  <div class="px-5">
    <div
      class="bg-background border-foreground/10 overflow-hidden rounded-xl rounded-b-none border border-b-0 pb-4 text-sm select-none"
    >
      <div class="divide-border/70 divide-y">
        {#each monitors as monitor (monitor.name)}
          <div class="px-2.5 py-2.5">
            <div class="flex items-center justify-between gap-1">
              <p class="text-secondary-foreground min-w-0 truncate font-mono text-xs">
                {monitor.name}
              </p>
              <span
                class={cn(
                  'flex shrink-0 items-center gap-1 text-sm',
                  monitor.status === 'healthy' && 'text-emerald-700',
                  monitor.status === 'grace' && 'text-amber-700',
                  monitor.status === 'missed' && 'text-destructive'
                )}
              >
                <span
                  class={cn(
                    'size-2 rounded-full',
                    monitor.status === 'healthy' && 'bg-emerald-500',
                    monitor.status === 'grace' && 'bg-amber-500',
                    monitor.status === 'missed' && 'bg-destructive'
                  )}
                ></span>
                {monitor.statusLabel}
              </span>
            </div>

            <div
              class="mt-3 flex gap-1 rounded-md bg-gray-200/50 p-1"
              aria-label={`${monitor.name}: heartbeat history for the last 24 runs`}
            >
              {#each monitor.checkIns as status, index (index)}
                <span
                  class={cn(
                    'h-5 min-w-0 flex-1 rounded-[2px]',
                    status === 'healthy' && 'bg-linear-to-t from-emerald-500 to-emerald-500/65',
                    status === 'grace' && 'bg-linear-to-t from-amber-500 to-amber-500/65',
                    status === 'missed' && 'from-destructive to-destructive/65 bg-linear-to-t'
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
