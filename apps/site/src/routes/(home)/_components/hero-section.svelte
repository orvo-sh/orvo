<script>
  import DashboardTraceScreenshot from '$lib/assets/dashboard-trace-screenshot.png';
  import { Button } from '@repo/components/ui/button';
  import { IconChevronRight } from '@tabler/icons-svelte';
</script>

<section
  class="from-muted/100 via-muted/70 border-foreground/15 to-background flex w-full flex-col items-center justify-center overflow-hidden border-b bg-linear-to-t"
>
  <div class="flex w-full max-w-6xl flex-col gap-10 px-3 pt-24 md:gap-16 md:px-6 md:pt-28">
    <div class="relative">
      <h1
        class="mt-5 max-w-3xl font-serif text-4xl font-medium text-balance sm:text-5xl lg:text-6xl"
      >
        Observability for the rest of us.
      </h1>
      <p class="text-secondary-foreground mt-3 mb-7 max-w-4xl text-lg leading-relaxed text-balance">
        Observability got too complicated. Orvo makes it simple again — bringing logs, traces,
        metrics, and more together with AI to make sense of it. Open source by design, and without
        the operational baggage.
      </p>

      <div class="flex flex-col items-center gap-3 *:w-full sm:flex-row sm:*:w-fit">
        <Button variant="default" href="https://app.orvo.sh/sign-up" size="lg"
          >Start free trial
          <IconChevronRight data-slot="button-icon" />
        </Button>
        <Button
          href="https://github.com/orvo-sh/orvo"
          target="_blank"
          rel="noreferrer"
          size="lg"
          variant="outline"
        >
          View on GitHub
        </Button>
      </div>

      <img
        src={DashboardTraceScreenshot}
        class="ring-border border-foreground/20 z-0 mt-16 w-full rounded-xl rounded-b-none border border-b-0 shadow-xl ring-3 md:mt-20"
        alt="Orvo overview showing telemetry volume, latency, error rate, incidents, and services"
        width="2813"
        height="1489"
      />
    </div>
  </div>
</section>
