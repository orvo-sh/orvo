<script lang="ts">
  import { cn } from '@repo/components';
  import { GolangIcon } from '@repo/components/icons/golang';
  import { NodejsIcon } from '@repo/components/icons/nodejs';
  import { PostgresqlIcon } from '@repo/components/icons/postgresql';
  import { StripeIcon } from '@repo/components/icons/stripe';
  import * as Card from '@repo/components/ui/card';
  import { Label } from '@repo/components/ui/label';
  import {
    IconChevronDown as ChevronDownIcon,
    IconArrowUpRight,
    IconBinaryTree2,
    IconWorldWww
  } from '@tabler/icons-svelte';

  const ruler = [
    { x: 0, label: '0' },
    { x: 25, label: '210ms' },
    { x: 50, label: '420ms' },
    { x: 75, label: '630ms' },
    { x: 100, label: '842ms' }
  ];

  const spans = [
    {
      id: 'root',
      name: 'POST /api/checkout/confirm',
      depth: 0,
      left: 0,
      width: 100,
      hasChildren: true,
      status: 'error',
      icon: 'http'
    },
    {
      id: 'auth',
      name: 'auth.validateSession',
      depth: 1,
      left: 4,
      width: 16,
      hasChildren: true,
      status: 'ok',
      icon: 'golang'
    },
    {
      id: 'customer-query',
      name: 'postgres.query customer + org entitlements',
      depth: 2,
      left: 8,
      width: 11,
      hasChildren: false,
      status: 'ok',
      icon: 'postgresql'
    },
    {
      id: 'checkout-payload',
      name: 'checkout.buildPaymentPayload',
      depth: 1,
      left: 28,
      width: 21,
      hasChildren: true,
      status: 'ok',
      icon: 'nodejs'
    },
    {
      id: 'stripe-customer',
      name: 'stripe.customers.retrieve',
      depth: 2,
      left: 34,
      width: 10,
      hasChildren: false,
      status: 'ok',
      icon: 'stripe'
    },
    {
      id: 'intent',
      name: 'stripe.payment_intents.create',
      depth: 2,
      left: 52,
      width: 24,
      hasChildren: false,
      status: 'error',
      icon: 'stripe'
    },
    {
      id: 'payment-failure-audit',
      name: 'postgres.insert payment_failure_audit',
      depth: 2,
      left: 78,
      width: 12,
      hasChildren: false,
      status: 'ok',
      icon: 'postgresql'
    },
    {
      id: 'recovery',
      name: 'checkout.publish recovery_email_requested',
      depth: 2,
      left: 87,
      width: 6,
      hasChildren: false,
      status: 'ok',
      icon: 'nodejs'
    }
  ];

  const selectedSpanId = 'intent';
  const LEFT_W = 250;
  const WATERFALL_LANE_INSET = 10;
</script>

<Card.Root
  class="bg-card/90 border-foreground/10 justify-between gap-0 p-0 md:col-span-2 xl:col-span-8"
>
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground flex items-center gap-2 text-lg font-medium">
      <IconBinaryTree2 class="text-primary size-6" />
      Traces
    </h2>
    <p class="text-muted-foreground mt-1.5 max-w-[84%] text-base leading-relaxed">
      Follow checkout across Go auth, Postgres queries, Node.js orchestration, and Stripe in one
      continuous timeline. Open the exact failed span and see where the request crossed service
      boundaries before it broke.
      <a
        href="/docs/signals/traces"
        class="text-primary inline-flex text-base underline-offset-4 hover:underline"
      >
        Learn more about traces
        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
    </p>
  </div>

  <div class="px-5 pt-4 pb-5">
    <div class="bg-background border-foreground/10 overflow-hidden rounded-xl border">
      <div class="h-full min-h-0 w-full overflow-x-auto">
        <div
          class="flex h-full min-h-0 min-w-[34rem] flex-1 flex-col font-mono text-xs select-none"
        >
          <div
            class="text-muted-foreground flex shrink-0 items-center gap-0 border-b px-2 py-2 tracking-wide uppercase"
            role="row"
          >
            <Label class="shrink-0 px-1 text-xs font-normal" style={`width:${LEFT_W}px`}>
              Span
            </Label>
            <div class="min-w-0 flex-1 pr-2">
              <div class="relative h-full min-w-0" style={`margin-left:${WATERFALL_LANE_INSET}px`}>
                {#each ruler as { x, label } (x)}
                  <Label
                    class="absolute top-1/2 text-[11px] font-normal"
                    style="left:{x}%; transform: translateX({x === 0
                      ? '0'
                      : x === 100
                        ? '-100%'
                        : '-50%'}) translateY(-50%)"
                  >
                    {label}
                  </Label>
                {/each}
              </div>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto">
            {#each spans as span (span.id)}
              {@const isError = span.status === 'error'}
              {@const isSelected = selectedSpanId === span.id}
              <div
                data-selected={isSelected}
                class={cn(
                  'group flex w-full items-center gap-0 py-0.5 pr-2 pl-2 text-left transition-colors',
                  isError
                    ? 'bg-destructive/5 text-destructive'
                    : 'text-primary data-[selected=true]:bg-muted'
                )}
              >
                <div
                  class="flex h-8 min-w-0 shrink-0 items-center border-r pr-2"
                  style="width:{LEFT_W}px; padding-left:{8 + span.depth * 12}px"
                >
                  {#if span.hasChildren}
                    <span
                      class="text-muted-foreground mr-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm"
                    >
                      <ChevronDownIcon class="size-3.5" />
                    </span>
                  {:else}
                    <span class="mr-0.5 block size-4 shrink-0"></span>
                  {/if}

                  <span
                    class="text-muted-foreground mr-1.5 flex size-4 shrink-0 items-center justify-center"
                  >
                    {#if span.icon === 'golang'}
                      <GolangIcon class="size-3.5" />
                    {:else if span.icon === 'nodejs'}
                      <NodejsIcon class="size-3.5" />
                    {:else if span.icon === 'postgresql'}
                      <PostgresqlIcon class="size-3.5" />
                    {:else if span.icon === 'stripe'}
                      <StripeIcon class="size-3.5 rounded-[3px]" />
                    {:else}
                      <IconWorldWww class="size-3.5" />
                    {/if}
                  </span>

                  <span
                    class={cn(
                      'text-secondary-foreground block min-w-0 truncate text-xs leading-none',
                      isError && 'text-destructive'
                    )}
                    title={span.name}
                  >
                    {span.name}
                  </span>
                </div>

                <div class="min-w-0 flex-1 pr-2">
                  <div class="relative h-8 min-w-0" style={`margin-left:${WATERFALL_LANE_INSET}px`}>
                    {#each ruler as { x } (x)}
                      {#if x > 0 && x < 100}
                        <div
                          class="bg-border/30 absolute top-0 bottom-0 w-px"
                          style="left:{x}%"
                        ></div>
                      {/if}
                    {/each}

                    <div
                      class={cn(
                        'absolute top-1/2 h-4 -translate-y-1/2 rounded-sm transition-all',
                        isError
                          ? 'from-destructive to-destructive/65 bg-linear-to-t'
                          : 'from-primary to-primary/65 bg-linear-to-t',
                        isSelected ? 'ring-primary/20 opacity-100 ring-2' : 'opacity-90'
                      )}
                      style="left:{span.left}%; width:max({span.width}%, 2px)"
                    ></div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
</Card.Root>
