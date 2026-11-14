<script lang="ts">
  import { Card } from '@repo/components/ui/card';
  import { IconArrowRight, IconServer } from '@tabler/icons-svelte';

  const chartId = $props.id();
  const cpuHistory = [
    32, 36, 31, 38, 35, 42, 40, 48, 55, 51, 62, 72, 68, 82, 89, 85, 94, 91, 96, 92, 95, 94
  ];
</script>

<Card
  class="from-card to-background justify-between gap-0 overflow-hidden bg-linear-to-b p-0 shadow md:col-span-6"
>
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground text-lg font-medium">Host monitoring</h2>
    <p class="text-muted-foreground mt-1.5 max-w-[92%] text-base leading-relaxed">
      Keep an eye on CPU, memory, disk, and load without adding another monitoring stack.
      <a
        href="/docs/product/hosts"
        class="text-primary bg-primary/5 hover:bg-primary/10 inline-flex rounded-md px-2 text-base underline-offset-4 transition-colors"
      >
        Explore hosts <IconArrowRight class="mt-1 ml-1 size-4" aria-hidden="true" />
      </a>
    </p>
  </div>

  <div class="mt-8 shrink-0 px-5 pb-5">
    <div class="bg-muted/30 overflow-hidden rounded-xl text-sm select-none">
      <div class="flex items-center gap-3 px-4 pt-4 pb-2">
        <div class="flex min-w-0 items-center gap-2">
          <IconServer class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          <span class="truncate font-medium">prod-worker-02</span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4 px-4 pt-4">
        {#each [{ label: 'CPU', value: '94%' }, { label: 'Memory', value: '68%' }, { label: 'Disk', value: '42%' }] as metric (metric.label)}
          <div>
            <p class="text-muted-foreground text-sm">{metric.label}</p>
            <p class="mt-1 text-2xl font-medium tabular-nums">{metric.value}</p>
          </div>
        {/each}
      </div>

      <div class="px-4 pt-4 pb-3">
        <svg
          viewBox="0 0 420 112"
          class="h-28 w-full overflow-visible"
          preserveAspectRatio="none"
          role="img"
          aria-label="CPU usage rising from 32 percent to 94 percent over the last 30 minutes"
        >
          <defs>
            <linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.18" />
              <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.01" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,112 ${cpuHistory.map((value, index) => `${index * 20},${112 - value}`).join(' ')} 420,112`}
            fill={`url(#${chartId})`}
          />
          <polyline
            points={cpuHistory.map((value, index) => `${index * 20},${112 - value}`).join(' ')}
            fill="none"
            class="stroke-primary"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
          />
          <circle cx="420" cy="18" r="3" class="fill-primary" />
        </svg>
        <div class="text-muted-foreground mt-2 flex justify-between text-xs tabular-nums">
          <span>30 minutes ago</span><span>Now</span>
        </div>
      </div>

      <div class="space-y-3 px-4 pt-3 pb-4">
        {#each [{ name: 'prod-api-01', cpu: '34%' }, { name: 'prod-db-01', cpu: '22%' }] as host (host.name)}
          <div class="flex items-center justify-between gap-3">
            <span class="text-muted-foreground min-w-0 flex-1 truncate text-sm">{host.name}</span>
            <span class="text-sm tabular-nums">{host.cpu}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</Card>
