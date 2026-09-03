<script lang="ts">
  import { SlackIcon } from '@repo/components/icons/slack';
  import { Button } from '@repo/components/ui/button';
  import * as Card from '@repo/components/ui/card';
  import { IconArrowUpRight } from '@tabler/icons-svelte';
</script>

<Card.Root class="justify-between gap-0 overflow-hidden p-0 shadow xl:col-span-6">
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground text-lg font-medium">Alerts &amp; incidents</h2>
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
      class="bg-background border-foreground/10 overflow-hidden rounded-xl rounded-b-none border border-b-0"
    >
      <div class="flex items-start gap-2.5 p-3.5">
        <div class="flex size-8 shrink-0 items-center justify-center rounded-lg border shadow-xs">
          <SlackIcon class="size-4" />
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 text-xs">
            <span class="text-secondary-foreground font-medium">Orvo</span>
            <span class="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-medium">
              APP
            </span>
            <span class="text-muted-foreground">12:08</span>
          </div>

          <p class="text-secondary-foreground mt-1.5 text-sm font-medium">
            Checkout error rate is high
          </p>
          <p class="text-muted-foreground mt-1 text-sm leading-5">
            <span class="text-secondary-foreground">checkout-api</span> in production crossed its alert
            threshold.
          </p>

          <div class="bg-muted/30 mt-2.5 rounded-lg border p-2.5">
            <div class="flex items-baseline justify-between gap-3 text-xs">
              <span class="text-muted-foreground">Error rate · last 5 min</span>
              <span class="text-destructive font-mono text-sm font-medium tabular-nums">8.2%</span>
            </div>
            <svg
              class="mt-1.5 h-10 w-full overflow-visible"
              viewBox="0 0 320 48"
              preserveAspectRatio="none"
              role="img"
              aria-label="Error rate rising above the five percent threshold"
            >
              <line
                x1="0"
                y1="25"
                x2="320"
                y2="25"
                class="stroke-border"
                stroke-width="1"
                stroke-dasharray="4 4"
              />
              <path
                d="M0 42 C28 42 39 40 61 39 S100 37 122 38 S159 34 180 35 S215 31 232 29 S266 17 280 18 S304 8 320 5"
                fill="none"
                class="stroke-destructive"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <div class="text-muted-foreground mt-1 flex justify-between text-xs">
              <span>Threshold 5%</span>
              <span>Incident opened</span>
            </div>
          </div>

          <div class="mt-2.5 flex items-center gap-2">
            <Button type="button" size="sm"
              >View incident <IconArrowUpRight data-slot="button-icon" /></Button
            >
            <Button href="/docs/product/incidents" variant="outline" size="sm">Acknowledge</Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</Card.Root>
