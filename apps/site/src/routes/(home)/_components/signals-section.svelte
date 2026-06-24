<script>
  import { OrvoLogo } from '@repo/components/icons/orvo-logo';
  import { Button } from '@repo/components/ui/button';

  const nodeBaseClass =
    'absolute z-1 flex items-center justify-center border border-border/90 bg-card/98 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_12px_28px_-20px_rgb(15_23_42/0.18)] transition-transform duration-200 hover:-translate-y-0.5';

  const signals = [
    { label: 'Logs', top: '18.75%' },
    { label: 'Traces', top: '34.375%' },
    { label: 'Metrics', top: '50%' },
    { label: 'Heartbeats', top: '65.625%' },
    { label: 'Hosts', top: '81.25%' }
  ];
</script>

{#snippet sourceNode()}
  <div
    class={`${nodeBaseClass} top-1/2 left-[19%] h-[10%] w-[30%] -translate-x-1/2 -translate-y-1/2 justify-start gap-[0.55rem] rounded-full px-[0.9rem] text-[0.8rem] font-semibold text-slate-700 sm:left-[15.74%] sm:w-[24.08%] sm:gap-3.5 sm:px-6 sm:text-[0.95rem]`}
  >
    <span>Your apps &amp; infrastructure</span>
  </div>
{/snippet}

{#snippet signalNode(signal)}
  <div
    class={`${nodeBaseClass} left-[58%] h-[10%] w-[25%] -translate-x-1/2 -translate-y-1/2 rounded-full text-[0.8rem] font-medium text-slate-500 sm:left-[59.26%] sm:w-[22.22%] sm:text-[0.95rem]`}
    style={`top: ${signal.top};`}
  >
    {signal.label}
  </div>
{/snippet}

{#snippet orvoNode()}
  <div
    class={`${nodeBaseClass} border-primary/20 top-1/2 left-[90%] h-[22%] w-[16%] -translate-x-1/2 -translate-y-1/2 flex-col gap-2.5 rounded-[1.2rem] text-[0.82rem] font-bold text-slate-700 sm:left-[90.74%] sm:h-[25%] sm:w-[14.82%] sm:gap-3.5 sm:rounded-[1.75rem] sm:text-[0.95rem]`}
  >
    <div class="grid size-8 place-items-center rounded-xl bg-blue-50 sm:size-10">
      <OrvoLogo class="size-7 rounded-[10px] sm:size-9" />
    </div>
    <span>Orvo</span>
  </div>
{/snippet}

<section class="bg-foreground/7 z-100 flex min-h-96 w-full items-center justify-center py-14">
  <div class="flex w-full max-w-6xl flex-col gap-14 px-6 lg:flex-row lg:items-center lg:gap-16">
    <div class="flex-1">
      <h2 class="text-3xl font-medium">Built around OpenTelemetry.</h2>
      <p class="text-secondary-foreground mt-3 max-w-[58.5rem] leading-relaxed text-balance">
        Logs, traces, metrics, heartbeats, and hosts, all in one place. Built on OpenTelemetry and
        designed to help you understand production without stitching together multiple tools.
      </p>
      <div class="mt-6 flex flex-col items-center gap-3 *:w-full sm:flex-row sm:*:w-fit">
        <Button variant="default" href="/">Start free trial</Button>
        <Button href="/docs" variant="outline">Learn more</Button>
      </div>
    </div>

    <div class="flex-1">
      <div class="aspect-video rounded-lg bg-white">VIDEO</div>
    </div>
  </div>
</section>
