<script>
  import { cn } from '@repo/components';
  import { Badge } from '@repo/components/ui/badge';
  import * as Card from '@repo/components/ui/card';
  import { Label } from '@repo/components/ui/label';
  import { IconArrowUpRight, IconCircleFilled, IconFileText } from '@tabler/icons-svelte';

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

<Card.Root class="aspect-square p-0 xl:col-span-6">
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground flex items-center gap-2 text-lg font-medium">
      <IconFileText class="text-primary size-6" />Logs
    </h2>
    <p class="text-muted-foreground mt-1.5 max-w-[82%] text-base leading-relaxed">
      Search messages, attributes, services, trace IDs, and more from a single view. Filter out the
      noise, investigate faster, and find the exact events that explain what happened.
      <a
        href="/docs/product/logs"
        class="text-primary inline-flex text-base underline-offset-4 hover:underline"
        >Learn more about logs

        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
    </p>
  </div>
  <div class="relative overflow-hidden">
    <div class="relative z-20">
      <div
        class="border-foreground/20 bg-card text-muted-foreground relative flex items-center gap-0 border-b px-3 py-2 text-xs tracking-wide uppercase"
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
              'flex items-start gap-0 border-b px-3 py-2 font-mono text-[0.8rem]',
              {
                error: 'bg-destructive/4',
                warn: 'bg-amber-500/4'
              }[log.severity]
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
                      info: 'text-blue-700 ',
                      warn: 'text-amber-800',
                      error: 'text-red-800',
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

            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <div class="text-secondary-foreground leading-relaxed break-all">
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
