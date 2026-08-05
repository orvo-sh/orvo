<script lang="ts">
  import { SlackIcon } from '@repo/components/icons/slack';
  import { Badge } from '@repo/components/ui/badge';
  import * as Card from '@repo/components/ui/card';
  import {
    IconAlertTriangle,
    IconArrowUpRight,
    IconBellRinging,
    IconChevronRight,
    IconMail,
    IconWebhook
  } from '@tabler/icons-svelte';

  const alerts = [
    {
      name: 'Checkout error rate',
      detail: 'api-checkout · above 5% for 2 min',
      status: 'Firing',
      time: '2m'
    },
    {
      name: 'Elevated p95 latency',
      detail: 'api · above 500 ms for 7 min',
      status: 'Warning',
      time: '7m'
    }
  ];

  const destinations = [
    { label: 'Slack', icon: SlackIcon },
    { label: 'Email', icon: IconMail },
    { label: 'Webhook', icon: IconWebhook }
  ];
</script>

<Card.Root
  class="bg-card/90 border-foreground/10 justify-between gap-0 p-0 shadow-none md:col-span-2 xl:col-span-4"
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
        href="/docs/product/alerts"
        class="text-primary inline-flex text-base underline-offset-4 hover:underline"
      >
        Learn more about alerts
        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
    </p>
    <div class="mt-3 flex flex-wrap gap-1.5">
      {#each destinations as destination (destination.label)}
        {@const Icon = destination.icon}
        <Badge
          variant="outline"
          class="border-border/70 bg-muted/25 text-secondary-foreground h-6 gap-1.5 rounded-md px-2 text-xs font-normal"
        >
          <Icon class="size-3.5" />
          {destination.label}
        </Badge>
      {/each}
    </div>
  </div>

  <div class="p-5 pt-4">
    <div class="bg-background border-foreground/10 overflow-hidden rounded-lg border">
      <div class="border-border/70 flex items-center justify-between border-b px-3 py-2.5">
        <div class="flex items-center gap-2">
          <span class="relative flex size-2.5">
            <span class="bg-destructive/30 absolute inline-flex size-full animate-ping rounded-full"
            ></span>
            <span class="bg-destructive relative inline-flex size-2.5 rounded-full"></span>
          </span>
          <span class="text-secondary-foreground text-sm font-medium">2 firing alerts</span>
        </div>
        <span class="text-muted-foreground text-xs tabular-nums">1 open incident</span>
      </div>

      <div class="divide-border/70 divide-y">
        {#each alerts as alert (alert.name)}
          <div class="flex items-center gap-3 px-3 py-3">
            <div
              class="bg-destructive/8 text-destructive flex size-8 shrink-0 items-center justify-center rounded-md"
            >
              <IconBellRinging class="size-4" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-secondary-foreground truncate text-sm font-medium">{alert.name}</p>
                <Badge
                  variant="outline"
                  class="border-destructive/20 bg-destructive/6 text-destructive h-5 shrink-0 px-1.5 text-[10px] font-medium"
                >
                  {alert.status}
                </Badge>
              </div>
              <p class="text-muted-foreground mt-0.5 truncate text-xs">{alert.detail}</p>
            </div>
            <span class="text-muted-foreground text-xs tabular-nums">{alert.time}</span>
          </div>
        {/each}
      </div>

      <div class="bg-muted/35 border-border/70 border-t p-2">
        <div class="bg-background flex items-center gap-3 rounded-md border p-2.5">
          <div
            class="bg-destructive/8 text-destructive flex size-8 shrink-0 items-center justify-center rounded-md"
          >
            <IconAlertTriangle class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-secondary-foreground truncate text-sm font-medium">
              api-checkout latency spike
            </p>
            <p class="text-muted-foreground truncate text-xs">Open for 7 min · 2 related alerts</p>
          </div>
          <IconChevronRight class="text-muted-foreground size-4 shrink-0" />
        </div>
      </div>
    </div>
  </div>
</Card.Root>
