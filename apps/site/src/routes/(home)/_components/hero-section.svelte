<script>
  import DashboardScreenshot from '$lib/assets/dashboard-screenshot.png';
  import { Button } from '@repo/components/ui/button';
  import { IconChevronRight } from '@tabler/icons-svelte';
</script>

<section
  class="from-muted border-foreground/20 flex w-full flex-col items-center justify-center overflow-hidden border-b bg-linear-to-t to-transparent"
>
  <div class="flex w-full max-w-6xl flex-col gap-16 px-6 pt-28">
    <div class="relative">
      <h1 class="mt-8 max-w-3xl text-3xl font-medium text-balance lg:text-6xl">
        Things brea<span class="inline-block translate-y-1 rotate-10">k</span>. Orvo shows you why.
      </h1>
      <p
        class="text-secondary-foreground my-6 max-w-[58.5rem] text-base leading-loose text-balance"
      >
        Monitor apps, infra, and jobs from one place. Built on OpenTelemetry and powered by logs,
        traces, metrics, alerts, and heartbeats.
      </p>

      <div class="flex flex-col items-center gap-3 *:w-full sm:flex-row sm:*:w-fit">
        <Button variant="default" href="/" size="lg"
          >Start free trial
          <div class="bg-primary-foreground/15 rounded-full p-0.5">
            <IconChevronRight />
          </div>
        </Button>
        <Button href="/docs" size="lg" variant="outline">View documentation</Button>
      </div>
    </div>

    <img
      src={DashboardScreenshot}
      class="ring-border border-foreground/20 z-0 rounded-xl rounded-b-none border border-b-0 shadow-xl ring-3"
      alt="app screen"
      width="2814"
      height="1604"
    />
  </div>
</section>
