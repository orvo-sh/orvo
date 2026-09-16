<script lang="ts">
  import { cn } from '@repo/components';
  import * as Card from '@repo/components/ui/card';
  import { IconArrowUpRight } from '@tabler/icons-svelte';

  const hosts = [
    {
      name: 'prod-api-01',
      detail: 'iad1 · 4 vCPU',
      status: 'healthy',
      statusLabel: 'Healthy',
      memory: 61,
      cpuHistory: [28, 32, 24, 37, 42, 35, 31, 46, 38, 34, 29, 34]
    },
    {
      name: 'prod-worker-02',
      detail: 'iad1 · 8 vCPU',
      status: 'warning',
      statusLabel: 'High CPU',
      memory: 68,
      cpuHistory: [46, 52, 61, 70, 84, 92, 96, 93, 91, 95, 92, 94]
    },
    {
      name: 'prod-db-01',
      detail: 'fra1 · 4 vCPU',
      status: 'healthy',
      statusLabel: 'Healthy',
      memory: 74,
      cpuHistory: [18, 24, 29, 20, 25, 31, 26, 19, 23, 27, 20, 22]
    },
    {
      name: 'prod-cache-01',
      detail: 'iad1 · 2 vCPU',
      status: 'healthy',
      statusLabel: 'Healthy',
      memory: 47,
      cpuHistory: [16, 20, 18, 27, 24, 31, 22, 29, 25, 19, 23, 21]
    }
  ] as const;
</script>

<Card.Root class="justify-between gap-0 overflow-hidden p-0 shadow md:col-span-6">
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground text-lg font-medium">Host monitoring</h2>
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
      class="bg-background border-foreground/10 overflow-hidden rounded-xl rounded-b-none border border-b-0 font-mono text-xs select-none"
    >
      <div
        class="text-muted-foreground border-border/70 grid grid-cols-[minmax(0,1fr)_7rem_4rem] items-center gap-3 border-b px-3.5 py-2.5 font-normal tracking-wide uppercase sm:grid-cols-[minmax(0,1fr)_8rem_4rem_4.5rem]"
      >
        <span class="leading-none">Host</span>
        <span class="justify-self-center leading-none whitespace-nowrap">CPU · 30 min</span>
        <span class="hidden justify-self-center leading-none sm:block">MEM</span>
        <span class="leading-none">Status</span>
      </div>

      <div class="divide-border/70 divide-y">
        {#each hosts as host (host.name)}
          <div
            class={cn(
              'grid min-h-14 grid-cols-[minmax(0,1fr)_7rem_4rem] items-center gap-3 px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_4rem_4.5rem]',
              host.status === 'warning' && 'bg-amber-500/5'
            )}
          >
            <div class="min-w-0">
              <p class="text-secondary-foreground truncate text-xs leading-none">{host.name}</p>
              <p class="text-muted-foreground mt-1.5 truncate text-[11px] leading-none">
                {host.detail}
              </p>
            </div>

            <div
              class="flex h-7 w-full max-w-28 min-w-0 items-end gap-px justify-self-center"
              aria-hidden="true"
            >
              {#each host.cpuHistory as value, index (index)}
                <span
                  class={cn(
                    'min-w-px flex-1 rounded-xs',
                    host.status === 'warning' && index > 4
                      ? 'bg-linear-to-t from-amber-500 to-amber-500/65'
                      : 'from-primary to-primary/65 bg-linear-to-t'
                  )}
                  style={`height: max(${value}%, 3px)`}
                ></span>
              {/each}
            </div>

            <span
              class="text-secondary-foreground hidden justify-self-center leading-none tabular-nums sm:block"
            >
              {host.memory}%
            </span>

            <span
              class={cn(
                'flex items-center gap-1.5 justify-self-center leading-none whitespace-nowrap',
                host.status === 'warning' ? 'text-amber-700' : 'text-emerald-700'
              )}
            >
              <span
                class={cn(
                  'size-1.5 shrink-0 rounded-full',
                  host.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                )}
              ></span>
              {host.statusLabel}
            </span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</Card.Root>
