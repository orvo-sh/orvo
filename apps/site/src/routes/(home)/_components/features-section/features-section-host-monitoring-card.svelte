<script lang="ts">
  import * as Card from '@repo/components/ui/card';
  import { Progress } from '@repo/components/ui/progress';
  import { IconArrowUpRight, IconServer } from '@tabler/icons-svelte';

  const resources = [
    { label: 'CPU', value: 34 },
    { label: 'Memory', value: 61 },
    { label: 'Disk', value: 72 }
  ];
</script>

<Card.Root class="justify-between gap-0 overflow-hidden p-0 shadow xl:col-span-6">
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground font-sans text-lg font-medium">Host monitoring</h2>
    <p class="text-muted-foreground mt-1.5 max-w-[92%] text-base leading-relaxed">
      Keep an eye on CPU, memory, disk, and load without adding another monitoring stack.
      <a
        href="/docs/product/hosts"
        class="text-primary inline-flex text-base underline-offset-4 hover:underline"
      >
        Learn more about hosts
        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
    </p>
  </div>

  <div class="px-5 pt-4 pb-0">
    <div
      class="bg-background border-foreground/10 overflow-hidden rounded-xl rounded-b-none border border-b-0 font-mono text-xs"
    >
      <div class="flex items-start justify-between gap-3 px-3.5 pt-3.5">
        <div class="min-w-0">
          <p class="text-secondary-foreground truncate font-mono text-sm">prod-api-01</p>
          <p class="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
            <IconServer class="size-3" />
            4 vCPU · 16 GB
          </p>
        </div>
        <span class="flex items-center gap-1.5 text-xs text-emerald-700">
          <span class="size-1.5 rounded-full bg-emerald-500"></span>
          Healthy
        </span>
      </div>

      <div class="space-y-3.5 px-3.5 pt-4 pb-4">
        {#each resources as resource (resource.label)}
          <div>
            <div class="flex items-baseline justify-between">
              <span class="text-muted-foreground text-xs">{resource.label}</span>
              <span class="text-secondary-foreground font-mono text-xs tabular-nums"
                >{resource.value}%</span
              >
            </div>
            <Progress value={resource.value} class="mt-1.5 h-1.5" />
          </div>
        {/each}

        <div class="flex items-center justify-between text-xs">
          <span class="text-muted-foreground">Load avg 1.82</span>
          <span class="text-secondary-foreground tabular-nums">Uptime 26 days</span>
        </div>
      </div>

      <div
        class="bg-muted/25 border-border/70 flex items-center justify-between gap-3 border-t px-3.5 py-3"
      >
        <div class="min-w-0">
          <p class="text-secondary-foreground truncate font-mono text-xs">prod-worker-02</p>
          <p class="text-muted-foreground mt-0.5 truncate text-xs">CPU above 90% for 6 min</p>
        </div>
        <span class="flex shrink-0 items-center gap-1.5 text-xs text-amber-700">
          <span class="size-1.5 rounded-full bg-amber-500"></span>
          High CPU
        </span>
      </div>
    </div>
  </div>
</Card.Root>
