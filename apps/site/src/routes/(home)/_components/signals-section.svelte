<script lang="ts">
  import { Button } from '@repo/components/ui/button';
</script>

<section class="bg-foreground/7 z-100 flex min-h-96 w-full items-center justify-center py-14">
  <div class="flex w-full max-w-6xl flex-col gap-14 px-6 lg:flex-row lg:items-center lg:gap-16">
    <div class="flex-1">
      <h2 class="text-3xl font-medium">Built around OpenTelemetry.</h2>
      <p class="text-secondary-foreground mt-3 max-w-[58.5rem] leading-relaxed text-balance">
        Logs, traces, metrics, and heartbeats, all in one place. Built on OpenTelemetry and designed
        to help you understand production without stitching together multiple tools.
      </p>
      <div class="mt-6 flex flex-col items-center gap-3 *:w-full sm:flex-row sm:*:w-fit">
        <Button variant="default" href="/">Start free trial</Button>
        <Button href="/docs" variant="outline">Learn more</Button>
      </div>
    </div>

    <div class="flex flex-1 items-center justify-center bg-white">VIDEO GOES HERE</div>
  </div>
</section>
