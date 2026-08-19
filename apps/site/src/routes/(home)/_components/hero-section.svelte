<script>
  import DashboardOverviewScreenshot from '$lib/assets/dashboard-overview-screenshot.png';
  import { Badge } from '@repo/components/ui/badge';
  import { Button } from '@repo/components/ui/button';
  import { IconBrandGithub, IconChevronRight } from '@tabler/icons-svelte';
</script>

<section
  class="from-muted/70 border-foreground/15 to-background flex w-full flex-col items-center justify-center overflow-hidden border-b bg-linear-to-t"
>
  <div class="flex w-full max-w-6xl flex-col gap-10 px-3 pt-16 md:gap-16 md:px-6 md:pt-24">
    <div class="relative">
      <a
        href="https://github.com/orvo-sh/orvo"
        target="_blank"
        rel="noreferrer"
        class="focus-visible:ring-ring mt-10 inline-flex rounded-full outline-none focus-visible:ring-2"
      >
        <Badge
          variant="outline"
          class="bg-background/80 hover:bg-background h-8 gap-2 rounded-full px-3 text-xs font-medium shadow-xs transition-colors"
        >
          <IconBrandGithub class="size-3.5" />
          Open source under AGPL-3.0
          <IconChevronRight class="size-3.5" />
        </Badge>
      </a>

      <h1
        class="mt-5 max-w-3xl font-serif text-4xl font-normal text-balance sm:text-5xl lg:text-6xl"
      >
        Things brea<span class="relative inline-block translate-y-1 rotate-10" aria-hidden="true"
          >k</span
        >. Orvo shows you
        <span
          class="after:bg-primary/10 absolute after:absolute after:bottom-0 after:left-[-3%] after:h-full after:w-[106%] after:rounded-sm"
        >
          why.</span
        >
      </h1>
      <p class="text-secondary-foreground mt-3 mb-7 max-w-3xl text-lg leading-relaxed text-balance">
        Open-source observability for the software you ship. Follow logs, traces, metrics, alerts,
        and recurring jobs in one calm workspace built on OpenTelemetry.
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
          <IconBrandGithub data-slot="button-icon" />
          View on GitHub
        </Button>
      </div>

      <img
        src={DashboardOverviewScreenshot}
        class="ring-border border-foreground/20 z-0 mt-16 rounded-xl rounded-b-none border border-b-0 shadow-xl ring-3 md:mt-20"
        alt="Orvo overview showing telemetry volume, latency, error rate, incidents, and services"
        width="2813"
        height="1489"
      />
    </div>
  </div>
</section>
