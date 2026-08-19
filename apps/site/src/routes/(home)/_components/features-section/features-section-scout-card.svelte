<script lang="ts">
  import { resolve } from '$app/paths';
  import { Badge } from '@repo/components/ui/badge';
  import * as Card from '@repo/components/ui/card';
  import { IconArrowUpRight, IconSparkles } from '@tabler/icons-svelte';
</script>

<Card.Root class="justify-between gap-0 overflow-hidden p-0 shadow-none xl:col-span-4">
  <div class="p-5 pb-0">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-secondary-foreground flex items-center gap-2 text-lg font-medium">
        <IconSparkles class="text-primary size-6" />
        Scout
      </h2>
      <Badge variant="secondary" class="rounded-full px-2 text-[10px] font-medium">AI</Badge>
    </div>
    <p class="text-muted-foreground mt-1.5 text-base leading-relaxed">
      Ask what changed, investigate an incident, or pull the thread from a single trace across the
      rest of your telemetry.
    </p>
  </div>

  <div class="p-5 pt-4">
    <div class="bg-background border-foreground/10 overflow-hidden rounded-lg border">
      <div class="border-border/70 flex items-center gap-2 border-b px-3 py-2.5">
        <span class="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-md">
          <IconSparkles class="size-3.5" />
        </span>
        <div>
          <p class="text-sm font-medium">What changed in the last hour?</p>
          <p class="text-muted-foreground text-[11px]">Scout is checking your telemetry</p>
        </div>
      </div>
      <div class="space-y-3 p-3 text-xs">
        <div class="bg-muted/55 rounded-md p-2.5 leading-relaxed">
          Checkout errors rose after deployment <span class="font-mono">8f3c7de</span>. The first
          failing trace points to a Stripe timeout in <span class="font-mono">payments</span>.
        </div>
        <div class="grid grid-cols-2 gap-2">
          <a
            href={resolve('/docs/product/traces')}
            class="hover:bg-muted rounded-md border p-2 transition-colors"
          >
            <span class="text-muted-foreground block text-[10px] uppercase">Trace</span>
            <span class="mt-0.5 flex items-center gap-1 font-mono"
              >trace_9r3k2m <IconArrowUpRight class="size-3" /></span
            >
          </a>
          <div class="rounded-md border p-2">
            <span class="text-muted-foreground block text-[10px] uppercase">Confidence</span>
            <span class="mt-0.5 block font-medium">High · 4 signals</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</Card.Root>
