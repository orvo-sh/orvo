<script>
  import { cn } from '@repo/components';
  import { Badge } from '@repo/components/ui/badge';
  import * as Card from '@repo/components/ui/card';
  import { Label } from '@repo/components/ui/label';
  import { IconArrowUpRight, IconCircleFilled, IconFilter2 } from '@tabler/icons-svelte';

  const logs = [
    {
      time: '13:42:18',
      severity: 'info',
      service: 'api-gateway',
      message: 'GET /v1/projects completed in 84ms',
      attributes: ['t_id:t_9r3k2m', 'status:200', 'region:iad1']
    },
    {
      time: '13:42:18',
      severity: 'warn',
      service: 'worker-sync',
      message: 'Retrying failed webhook delivery after upstream timeout',
      attributes: ['job:webhooks', 'attempt:2', 'tenant:acme']
    },
    {
      time: '13:42:19',
      severity: 'error',
      service: 'postgres-primary',
      message: 'statement timeout while loading organization usage summary',
      attributes: ['db:billing', 'span:query_usage', 'timeout:5s']
    },
    {
      time: '13:42:19',
      severity: 'info',
      service: 'otel-collector',
      message: 'Accepted 128 log records from edge-eu-west',
      attributes: ['source:otlp', 'batch:128', 'pipeline:logs']
    },
    {
      time: '13:42:20',
      severity: 'debug',
      service: 'scheduler',
      message: 'Heartbeat check completed for 42 recurring jobs',
      attributes: ['job:heartbeats', 'late:1', 'missed:0']
    },
    {
      time: '13:42:20',
      severity: 'error',
      service: 'payments',
      message: 'Stripe webhook signature verification failed for replayed event',
      attributes: ['provider:stripe', 'event:invoice.paid', 'env:prod']
    },
    {
      time: '13:42:21',
      severity: 'info',
      service: 'frontend',
      message: 'Deployed build 8f3c7de to production',
      attributes: ['release:8f3c7de', 'branch:main', 'actor:ci']
    },
    {
      time: '13:42:21',
      severity: 'trace',
      service: 'queue-consumer',
      message: 'Span exported with parent trace for incident enrichment',
      attributes: ['trace_id:trace_2t1x8q', 'span:enrich_incident', 'sampled:true']
    }
  ];

  const scrollingLogs = [...logs, ...logs];
</script>

<Card.Root class="aspect-square p-0 shadow xl:col-span-6">
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground flex items-center gap-1.5 font-sans text-lg font-medium">
      Logs
    </h2>
    <p class="text-muted-foreground mt-1.5 max-w-[86%] text-base leading-relaxed">
      Search, filter, and explore structured logs with context that stays attached.
      <a
        href="/docs/product/logs"
        class="text-primary inline-flex text-base underline-offset-4 hover:underline"
        >Learn more about logs

        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
    </p>
  </div>
  <div class="logs-surface relative mt-4 overflow-hidden">
    <div class="bg-card px-4">
      <div
        class="filter-bar border-border/80 bg-card relative rounded-md border p-0 transition-colors"
        role="search"
        aria-label="Example log filters"
      >
        <div class="flex h-9 items-center gap-2 px-2">
          <IconFilter2 class="text-muted-foreground size-4 shrink-0" />

          <div
            class="filter-tokens flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto font-mono"
          >
            <span
              class="filter-chip inline-flex h-6 shrink-0 items-center overflow-hidden rounded-md border"
            >
              <span class="text-muted-foreground border-r px-1.5 text-[12px] font-medium"
                >Service</span
              >
              <span
                class="filter-value-primary text-primary flex h-full items-center px-1.5 text-[12px] font-medium"
              >
                CoreService
              </span>
            </span>

            <span
              class="filter-chip inline-flex h-6 shrink-0 items-center overflow-hidden rounded-md border"
            >
              <span class="text-muted-foreground border-r px-1.5 text-[12px] font-medium"
                >Environment</span
              >
              <span
                class="filter-value-good flex h-full items-center px-1.5 text-[12px] font-medium text-green-600"
              >
                Prod
              </span>
            </span>

            <span
              class="border-foreground/20 text-muted-foreground ml-auto inline-flex h-6 shrink-0 items-center rounded-md border border-dashed px-1.5 font-mono text-[12px] font-normal whitespace-nowrap"
            >
              + Add filter
            </span>
          </div>

          <span
            class="filter-scan pointer-events-none absolute right-2.5 bottom-[-1px] left-2.5 h-px overflow-hidden"
          ></span>
        </div>
      </div>
    </div>
    <div class="relative z-20">
      <div
        class="border-foreground/10 bg-card text-secondary-foreground relative flex items-center gap-0 border-b px-3 py-2 text-xs tracking-wide uppercase"
      >
        <Label class="ml-2.5 w-20 shrink-0 text-[0.8rem] font-normal">Time</Label>
        <Label class="w-22 shrink-0 text-[0.8rem] font-normal">Severity</Label>
        <Label class="flex-1 text-[0.8rem] font-normal">Message</Label>
      </div>
    </div>
    <div class="bg-background relative h-[92%] overflow-hidden">
      <div class="logs-stream">
        {#each scrollingLogs as log, index (`${log.time}-${log.service}-${index}`)}
          <div
            class={cn(
              'relative flex items-start gap-0 border-b px-3 py-2 font-mono text-[0.8rem] transition-colors'
            )}
          >
            <div class="text-secondary-foreground ml-2.5 w-20 shrink-0 tabular-nums">
              {#each log.time.split(':') as segment, i}
                <span class={i === 2 ? 'text-muted-foreground/60' : ''}>{segment}</span>{i < 2
                  ? ':'
                  : ''}
              {/each}
            </div>

            <div class="w-22 shrink-0 pr-2">
              <span
                class={`inline-flex items-center gap-1.5 uppercase ${
                  {
                    error: 'text-destructive/80',
                    warn: 'text-amber-600/80',
                    info: 'text-primary/80',
                    debug: 'text-muted-foreground/85',
                    trace: 'text-muted-foreground/65'
                  }[log.severity] ?? 'text-muted-foreground/80'
                }`}
              >
                <span
                  class={cn(
                    'flex items-center gap-0.5 pr-1.5 pl-0.75',
                    {
                      info: 'text-primary/80',
                      warn: 'text-amber-600/80',
                      error: 'text-destructive/80',
                      debug: 'text-muted-foreground',
                      trace: 'text-muted-foreground'
                    }[log.severity]
                  )}
                >
                  <IconCircleFilled class="size-2.5" />
                  {log.severity}
                </span>
              </span>
            </div>

            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <div class={cn('text-secondary-foreground leading-relaxed break-all')}>
                {log.message}
              </div>
              <div class="flex flex-wrap gap-1">
                {#each log.attributes as attribute}
                  <Badge
                    variant="outline"
                    class="border-foreground/10 from-secondary h-6 max-w-full gap-0.5 rounded-md bg-linear-to-t to-transparent px-1.5 py-[1px] text-[11px] font-normal inset-shadow-[0px_1px_--theme(--color-white)]"
                  >
                    <span class="text-muted-foreground truncate">{attribute.split(':')[0]}:</span>
                    <span class="text-foreground max-w-64 truncate">{attribute.split(':')[1]}</span>
                  </Badge>
                {/each}
                {#if log.service === 'payments'}
                  <a
                    href="/docs/product/traces"
                    class="text-destructive ml-0.5 inline-flex h-6 items-center gap-1 text-[11px] font-medium underline-offset-4 hover:underline"
                  >
                    View related trace
                    <IconArrowUpRight class="size-3" />
                  </a>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
      <div
        class="from-card pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-linear-to-t to-transparent"
      ></div>
    </div>
  </div>
</Card.Root>

<style>
  .logs-stream {
    animation: logs-stream 50s linear infinite;
    will-change: transform;
  }

  @keyframes logs-stream {
    from {
      transform: translateY(0);
    }

    to {
      transform: translateY(-50%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .logs-stream {
      animation: none;
    }
  }
</style>
