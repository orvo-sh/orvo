<script lang="ts">
  import { cn } from '@repo/components';
  import { Badge } from '@repo/components/ui/badge';
  import * as Card from '@repo/components/ui/card';
  import {
    IconActivityHeartbeat,
    IconArrowUpRight,
    IconCircleFilled,
    IconClock
  } from '@tabler/icons-svelte';

  const summary = [
    {
      label: 'Healthy',
      value: 24,
      className: 'border-green-600/20 bg-green-600/7 text-green-700'
    },
    {
      label: 'Grace',
      value: 4,
      className: 'border-amber-600/20 bg-amber-600/7 text-amber-800'
    },
    {
      label: 'Missed',
      value: 2,
      className: 'border-red-600/20 bg-red-600/7 text-red-800'
    }
  ];

  const monitors = [
    {
      name: 'daily-billing-sync',
      cadence: 'Every 1 hour',
      lastCheckIn: '2 min ago',
      status: 'healthy',
      statusLabel: 'Healthy',
      timeline: [
        'healthy',
        'healthy',
        'healthy',
        'healthy',
        'healthy',
        'healthy',
        'healthy',
        'healthy'
      ]
    },
    {
      name: 'webhook-replay',
      cadence: 'Every 5 min',
      lastCheckIn: 'Within grace period',
      status: 'grace',
      statusLabel: 'Grace',
      timeline: ['healthy', 'healthy', 'grace', 'healthy', 'healthy', 'grace', 'healthy', 'healthy']
    }
  ] as const;

  const statusClasses: Record<'healthy' | 'grace' | 'missed', string> = {
    healthy: 'border-green-600/20 bg-green-600/7 text-green-700',
    grace: 'border-amber-600/20 bg-amber-600/7 text-amber-800',
    missed: 'border-red-600/20 bg-red-600/7 text-red-800'
  };

  const timelineBucketClasses: Record<'healthy' | 'grace' | 'missed', string> = {
    healthy: 'bg-emerald-500/85',
    grace: 'bg-amber-500/75',
    missed: 'bg-destructive/80'
  };
</script>

<Card.Root class="justify-between gap-0 p-0 shadow-none xl:col-span-4">
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground flex items-center gap-2 text-lg font-medium">
      <IconActivityHeartbeat class="text-primary size-6" />
      Heartbeats
    </h2>
    <p class="text-muted-foreground mt-1.5 max-w-[84%] text-base leading-relaxed">
      Keep recurring jobs, scheduled syncs, and external pings visible. See what checked in on time,
      what is drifting, and what stopped entirely.
      <a
        href="/docs/product/heartbeats"
        class="text-primary inline-flex text-base underline-offset-4 hover:underline"
      >
        Learn more about heartbeats
        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
    </p>
  </div>

  <div class="px-5 pt-4 pb-5">
    <div class="bg-background border-foreground/10 overflow-hidden rounded-lg border">
      <div class="border-border/80 flex items-center gap-1.5 border-b px-3 py-2.5">
        {#each summary as item (item.label)}
          <Badge variant="outline" class={cn('h-6 gap-1.5 px-2 font-normal', item.className)}>
            <span class="font-medium tabular-nums">{item.value}</span>
            {item.label}
          </Badge>
        {/each}
      </div>

      <div class="divide-border/70 divide-y">
        {#each monitors as monitor (monitor.name)}
          <div class="space-y-3 px-3 py-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-secondary-foreground truncate text-sm font-medium">
                    {monitor.name}
                  </p>
                  <Badge
                    variant="outline"
                    class={cn(
                      'h-5 gap-1 pr-1.5 pl-0.75 text-[10px]',
                      statusClasses[monitor.status]
                    )}
                  >
                    <IconCircleFilled class="size-2.5" />
                    {monitor.statusLabel}
                  </Badge>
                </div>
                <p class="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                  <IconClock class="size-3" />
                  {monitor.cadence}
                  <span class="text-border mx-1">·</span>
                  {monitor.lastCheckIn}
                </p>
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="grid grid-cols-8 gap-1">
                {#each monitor.timeline as state, index (`${monitor.name}-${index}`)}
                  <span
                    class={cn('block h-2 min-w-0 rounded-full', timelineBucketClasses[state])}
                    aria-hidden="true"
                  ></span>
                {/each}
              </div>

              <div class="text-muted-foreground flex items-center justify-between text-[11px]">
                <span>Last 8 runs</span>
                <span>{monitor.status === 'healthy' ? 'All on time' : '2 in grace'}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</Card.Root>
