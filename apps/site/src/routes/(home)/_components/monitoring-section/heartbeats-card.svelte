<script lang="ts">
  import { Badge } from '@repo/components/ui/badge';
  import { Card } from '@repo/components/ui/card';
  import { IconArrowRight, IconClock } from '@tabler/icons-svelte';
</script>

<Card
  class="from-card to-background justify-between gap-0 overflow-hidden bg-linear-to-b p-0 shadow md:col-span-6"
>
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground text-lg font-medium">Heartbeats</h2>
    <p class="text-muted-foreground mt-1.5 max-w-[90%] text-base leading-relaxed">
      Know when scheduled work checks in, drifts, or stops before a missed job becomes a customer
      problem.
      <a
        href="/docs/product/heartbeats"
        class="text-primary bg-primary/5 hover:bg-primary/10 inline-flex rounded-md px-2 text-base underline-offset-4 transition-colors"
      >
        Explore heartbeats <IconArrowRight class="mt-1 ml-1 size-4" aria-hidden="true" />
      </a>
    </p>
  </div>

  <div class="mt-8 shrink-0 px-5">
    <div
      class="bg-background border-foreground/10 overflow-hidden rounded-t-xl border border-b-0 text-sm select-none"
    >
      <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span class="flex items-center gap-2 font-medium">
          <IconClock class="text-muted-foreground size-4" aria-hidden="true" />
          Scheduled jobs
        </span>
        <span class="text-muted-foreground text-xs">3 monitors</span>
      </div>

      <div class="px-4 py-4">
        <div class="flex items-center justify-between gap-3">
          <span class="min-w-0 truncate text-sm font-medium">inventory-sync</span>
          <Badge
            variant="outline"
            class="border-destructive/20 bg-destructive/5 text-destructive gap-1.5"
          >
            <span class="bg-destructive size-1.5 rounded-full" aria-hidden="true"></span>
            Missed
          </Badge>
        </div>
        <p class="text-muted-foreground mt-1 text-xs">Every 5 minutes · 2 minute grace period</p>
        <div class="mt-4 flex items-baseline justify-between gap-3 text-xs">
          <span class="text-muted-foreground">Last check-in</span>
          <span class="tabular-nums">12 minutes ago</span>
        </div>
        <div
          class="mt-3 flex gap-1"
          role="img"
          aria-label="Last hour: ten received check-ins followed by two missed check-ins"
        >
          {#each Array.from({ length: 12 }) as _, index (index)}
            <span
              class={`h-5 min-w-0 flex-1 rounded-xs ${index < 10 ? 'bg-emerald-500/70' : 'bg-destructive/80'}`}
            ></span>
          {/each}
        </div>
        <div class="text-muted-foreground mt-2 flex justify-between text-xs">
          <span>1 hour ago</span><span>Now</span>
        </div>
        <p class="text-destructive mt-3 text-xs">5 minutes overdue</p>
      </div>

      <div class="divide-border/70 divide-y border-t">
        {#each [{ name: 'database-backup', schedule: 'Every 24 hours', lastCheckIn: '2h ago' }, { name: 'stripe-reconciliation', schedule: 'Every hour', lastCheckIn: '18m ago' }] as monitor (monitor.name)}
          <div class="flex items-center gap-2.5 px-4 py-3">
            <span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="Healthy"></span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-medium">{monitor.name}</p>
              <p class="text-muted-foreground mt-1 text-xs">{monitor.schedule}</p>
            </div>
            <span class="text-muted-foreground shrink-0 text-xs tabular-nums"
              >{monitor.lastCheckIn}</span
            >
          </div>
        {/each}
      </div>
    </div>
  </div>
</Card>
