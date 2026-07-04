<script lang="ts">
  import { SlackIcon } from '@repo/components/icons/slack';
  import { Badge } from '@repo/components/ui/badge';
  import * as Card from '@repo/components/ui/card';
  import { cn } from '@repo/components';
  import {
    IconAlertTriangle,
    IconArrowUpRight,
    IconMail,
    IconWebhook
  } from '@tabler/icons-svelte';

  const summary = [
    { label: 'Active', value: '3', tone: 'text-destructive' },
    { label: 'Firing', value: '2', tone: 'text-orange-500' },
    { label: 'Muted', value: '1', tone: 'text-muted-foreground' }
  ];

  const rows = [
    {
      alert: 'High error rate on /api/checkout',
      severity: 'Critical',
      severityTone: 'text-destructive',
      state: 'Firing',
      stateTone: 'text-destructive',
      triggered: '2m ago',
      points: [14, 14, 15, 16, 22, 20, 18, 19, 18, 18],
      stroke: '#ef4444'
    },
    {
      alert: 'p95 latency > 500ms (api)',
      severity: 'Warning',
      severityTone: 'text-orange-500',
      state: 'Firing',
      stateTone: 'text-destructive',
      triggered: '7m ago',
      points: [10, 11, 11, 12, 15, 14, 13, 13, 12, 12],
      stroke: '#f59e0b'
    },
    {
      alert: 'Disk usage > 85% (app-server-01)',
      severity: 'Warning',
      severityTone: 'text-orange-500',
      state: 'Firing',
      stateTone: 'text-destructive',
      triggered: '18m ago',
      points: [8, 8, 9, 9, 10, 10, 11, 12, 12, 12],
      stroke: '#f59e0b'
    },
    {
      alert: 'CPU usage > 90% (worker-02)',
      severity: 'Info',
      severityTone: 'text-slate-500',
      state: 'Resolved',
      stateTone: 'text-muted-foreground',
      triggered: '1h ago',
      points: [7, 7, 7, 8, 9, 10, 11, 10, 9, 9],
      stroke: '#94a3b8'
    }
  ];

  const createSparklinePath = (points: number[]) =>
    points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * 100;
        const y = 30 - point;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

  const destinations = [
    { label: 'Slack', icon: SlackIcon },
    { label: 'Email', icon: IconMail },
    { label: 'Webhook', icon: IconWebhook }
  ];
</script>

<Card.Root
  class="bg-card/90 border-foreground/10 justify-between gap-0 p-0 md:col-span-2 xl:col-span-8"
>
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground flex items-center gap-2 text-lg font-medium">
      <IconAlertTriangle class="text-primary size-6" />
      Alerts &amp; incidents
    </h2>
    <p class="text-muted-foreground mt-1.5 max-w-[88%] text-base leading-relaxed">
      Get notified when something crosses your threshold, route the right signal to the right
      people, and keep the incident queue focused on what actually needs action.
      <a
        href="/product/alerts"
        class="text-primary inline-flex text-base underline-offset-4 hover:underline"
      >
        Learn more about alerts
        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      {#each destinations as destination (destination.label)}
        {@const Icon = destination.icon}
        <Badge
          variant="outline"
          class="gap-1.5 rounded-md border-border/70 bg-muted/25 px-2.5 py-1 text-xs font-medium text-secondary-foreground"
        >
          <Icon class="size-3.5" />
          {destination.label}
        </Badge>
      {/each}
    </div>
  </div>

  <div class="p-5 pt-4">
    <div class="bg-background border-foreground/10 overflow-hidden rounded-xl border">
      <div class="grid md:grid-cols-[120px_minmax(0,1fr)]">
        <div class="border-border/70 flex flex-col justify-end gap-5 border-b p-4 md:border-r md:border-b-0">
          {#each summary as item}
            <div class="space-y-0.5">
              <p class="text-muted-foreground text-sm">{item.label}</p>
              <p class={cn('text-4xl leading-none font-medium', item.tone)}>{item.value}</p>
            </div>
          {/each}
        </div>

        <div class="min-w-0">
          <div
            class="text-muted-foreground grid grid-cols-[minmax(0,1.9fr)_0.8fr_0.8fr_0.8fr_88px] gap-4 border-b px-4 py-3 text-[11px] font-medium tracking-[0.14em] uppercase"
          >
            <span>Alert</span>
            <span>Severity</span>
            <span>State</span>
            <span>Triggered</span>
            <span class="sr-only">Trend</span>
          </div>

          <div>
            {#each rows as row, index (row.alert)}
              <div
                class={cn(
                  'grid grid-cols-[minmax(0,1.9fr)_0.8fr_0.8fr_0.8fr_88px] items-center gap-4 px-4 py-3',
                  index < rows.length - 1 && 'border-b border-border/60'
                )}
              >
                <p class="text-secondary-foreground truncate text-sm font-medium">{row.alert}</p>
                <p class={cn('text-sm font-medium', row.severityTone)}>{row.severity}</p>
                <p class={cn('text-sm font-medium', row.stateTone)}>{row.state}</p>
                <p class="text-secondary-foreground text-sm">{row.triggered}</p>

                <div class="flex justify-end">
                  <svg viewBox="0 0 100 20" class="h-6 w-[72px]" aria-hidden="true">
                    <path
                      d={createSparklinePath(row.points)}
                      fill="none"
                      stroke={row.stroke}
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
</Card.Root>
