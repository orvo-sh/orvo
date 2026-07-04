<script lang="ts">
  import { cn } from '@repo/components';
  import { Badge } from '@repo/components/ui/badge';
  import * as Card from '@repo/components/ui/card';
  import {
    IconActivityHeartbeat,
    IconArrowUpRight,
    IconCircle,
    IconCircleFilled
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

  const monitors: {
    name: string;
    cadence: string;
    lastCheckIn: string;
    status: 'healthy' | 'grace' | 'missed';
    statusLabel: string;
    timeline: ('healthy' | 'grace' | 'missed')[];
  }[] = [
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
      timeline: [
        'healthy',
        'healthy',
        'grace',
        'healthy',
        'healthy',
        'grace',
        'healthy',
        'healthy',
        'healthy',
        'grace',
        'healthy',
        'healthy'
      ]
    },
    {
      name: 'nightly-backup',
      cadence: 'Daily',
      lastCheckIn: 'Missed window',
      status: 'missed',
      statusLabel: 'Missed',
      timeline: [
        'healthy',
        'healthy',
        'healthy',
        'missed',
        'missed',
        'healthy',
        'healthy',
        'healthy',
        'healthy',
        'healthy',
        'grace',
        'missed'
      ]
    },
    {
      name: 's3-inventory-import',
      cadence: 'Every 30 min',
      lastCheckIn: '7 min ago',
      status: 'healthy',
      statusLabel: 'Healthy',
      timeline: [
        'healthy',
        'healthy',
        'healthy',
        'healthy',
        'grace',
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
      name: 'customer-export',
      cadence: 'Every 6 hours',
      lastCheckIn: '9 min into grace',
      status: 'grace',
      statusLabel: 'Grace',
      timeline: [
        'healthy',
        'grace',
        'healthy',
        'healthy',
        'healthy',
        'grace',
        'healthy',
        'healthy',
        'healthy',
        'healthy',
        'grace',
        'healthy'
      ]
    },
    {
      name: 'warehouse-rollup',
      cadence: 'Every 15 min',
      lastCheckIn: '1 min ago',
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
        'healthy',
        'healthy',
        'healthy',
        'healthy',
        'healthy'
      ]
    },
    {
      name: 'partner-feed-poller',
      cadence: 'Every 10 min',
      lastCheckIn: 'Grace expired',
      status: 'missed',
      statusLabel: 'Missed',
      timeline: [
        'healthy',
        'healthy',
        'healthy',
        'grace',
        'missed',
        'healthy',
        'healthy',
        'healthy',
        'grace',
        'healthy',
        'missed',
        'healthy'
      ]
    },
    {
      name: 'invoice-pdf-generator',
      cadence: 'Every 20 min',
      lastCheckIn: '4 min ago',
      status: 'healthy',
      statusLabel: 'Healthy',
      timeline: [
        'healthy',
        'healthy',
        'grace',
        'healthy',
        'healthy',
        'healthy',
        'healthy',
        'healthy',
        'grace',
        'healthy',
        'healthy',
        'healthy'
      ]
    }
  ];

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

<Card.Root class="justify-between gap-0 p-0 aspect-square xl:col-span-4">
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground flex items-center gap-2 text-lg font-medium">
      <IconActivityHeartbeat class="text-primary size-6" />
      Heartbeats
    </h2>
    <p class="text-muted-foreground mt-1.5 max-w-[84%] text-base leading-relaxed">
      Keep recurring jobs, scheduled syncs, and external pings visible. See what checked in on
      time, what is drifting, and what stopped entirely.
      <a
        href="/product/heartbeats"
        class="text-primary inline-flex text-base underline-offset-4 hover:underline"
      >
        Learn more about heartbeats
        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
    </p>
  </div>

  <div class="px-5 pt-4 pb-5">
    <div class="bg-background border-foreground/10 overflow-hidden rounded-xl border">
      <div class="border-border/80 flex items-center gap-2 border-b px-4 py-3">
        {#each summary as item (item.label)}
          <Badge variant="outline" class={cn('gap-1.5 px-2.5 py-1', item.className)}>
            <IconCircleFilled class="size-2.5" />
            {item.value} {item.label.toLowerCase()}
          </Badge>
        {/each}
      </div>

      <div class="divide-border/70 max-h-[27rem] divide-y overflow-hidden">
        {#each monitors as monitor (monitor.name)}
          <div class="space-y-3 px-4 py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-secondary-foreground truncate text-sm font-medium">
                    {monitor.name}
                  </p>
                  <Badge
                    variant="outline"
                    class={cn('gap-1 pr-1.5 pl-0.75', statusClasses[monitor.status])}
                  >
                    {#if monitor.status === 'healthy'}
                      <IconCircleFilled class="size-2.5" />
                    {:else if monitor.status === 'grace'}
                      <IconCircle class="size-2.5" />
                    {:else}
                      <IconCircleFilled class="size-2.5" />
                    {/if}
                    {monitor.statusLabel}
                  </Badge>
                </div>
                <p class="text-muted-foreground mt-1 text-xs">
                  {monitor.cadence}
                  <span class="text-border mx-1.5">/</span>
                  Last check-in {monitor.lastCheckIn}
                </p>
              </div>

              <div class="text-right">
                <p class="text-muted-foreground text-[11px] font-medium tracking-[0.16em] uppercase">
                  Recent
                </p>
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="grid grid-cols-12 gap-1">
                {#each monitor.timeline as state, index (`${monitor.name}-${index}`)}
                  <span
                    class={cn(
                      'block h-7 min-w-0 rounded-sm transition-opacity hover:opacity-85',
                      timelineBucketClasses[state]
                    )}
                    aria-hidden="true"
                  ></span>
                {/each}
              </div>

              <div class="text-muted-foreground flex items-center justify-between text-[11px]">
                <span>Last 12 runs</span>
                <div class="flex items-center gap-3">
                  <span class="inline-flex items-center gap-1">
                    <span class="block size-2 rounded-full bg-green-500"></span>
                    On time
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <span class="block size-2 rounded-full bg-amber-500"></span>
                    Grace
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <span class="block size-2 rounded-full bg-red-500"></span>
                    Missed
                  </span>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</Card.Root>
