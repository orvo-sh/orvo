<script lang="ts">
  import { SlackIcon } from '@repo/components/icons/slack';
  import * as Card from '@repo/components/ui/card';
  import { IconArrowUpRight, IconGitMerge } from '@tabler/icons-svelte';

  const signals = [
    { label: 'Checkout error rate', value: '8.2%', detail: 'Threshold 5%' },
    { label: 'p95 latency', value: '842 ms', detail: 'Threshold 500 ms' }
  ];
</script>

<Card.Root class="justify-between gap-0 overflow-hidden p-0 shadow xl:col-span-6">
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground font-sans text-lg font-medium">Alerts &amp; incidents</h2>
    <p class="text-muted-foreground mt-1.5 max-w-[92%] text-base leading-relaxed">
      Know when something needs your attention, without spending your day watching dashboards.
      <a
        href="/docs/product/alerts"
        class="text-primary inline-flex text-base underline-offset-4 hover:underline"
      >
        Learn more
        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
    </p>
  </div>

  <div class="px-5 pt-4 pb-0">
    <div
      class="bg-background border-foreground/10 overflow-hidden rounded-xl rounded-b-none border border-b-0 font-mono text-xs"
    >
      <div class="px-3.5 pt-3.5 pb-3">
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground text-xs">INC-214</span>
          <span class="text-destructive flex items-center gap-1.5 text-xs">
            <span class="bg-destructive size-1.5 rounded-full"></span>
            Open
          </span>
        </div>
        <p class="text-secondary-foreground mt-2 font-sans text-sm font-medium">
          Checkout failures after deployment
        </p>
        <p class="text-muted-foreground mt-1 text-xs">Production · Open for 7 min</p>
      </div>

      <div class="bg-muted/25 border-border/70 border-y px-3.5 py-2">
        <span class="text-muted-foreground flex items-center gap-1.5 text-xs">
          <IconGitMerge class="size-3.5" />
          2 related alerts grouped automatically
        </span>
      </div>

      <div class="divide-border/70 divide-y">
        {#each signals as signal (signal.label)}
          <div class="flex items-center gap-3 px-3.5 py-3">
            <span class="bg-destructive size-1.5 shrink-0 rounded-full"></span>
            <div class="min-w-0 flex-1">
              <p class="text-secondary-foreground truncate font-sans text-xs font-medium">
                {signal.label}
              </p>
              <p class="text-muted-foreground mt-0.5 text-xs">{signal.detail}</p>
            </div>
            <span class="text-destructive shrink-0 font-mono text-xs tabular-nums">
              {signal.value}
            </span>
          </div>
        {/each}
      </div>

      <div class="border-border/70 flex items-center justify-between gap-3 border-t px-3.5 py-2.5">
        <span class="text-muted-foreground text-xs">Team notified 2 min ago</span>
        <span class="text-secondary-foreground flex items-center gap-1.5 text-xs">
          <SlackIcon class="size-3.5" />
          Slack
        </span>
      </div>
    </div>
  </div>
</Card.Root>
