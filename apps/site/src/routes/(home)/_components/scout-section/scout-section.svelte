<script lang="ts">
  import DashboardTraceScreenshot from '$lib/assets/dashboard-trace-screenshot.png';
  import ScoutCapabilities from './scout-capabilities.svelte';
  import ScoutSlackPreview from './scout-slack-preview.svelte';
</script>

<section id="scout" class="scout-section bg-background overflow-hidden border-b pt-16 md:pt-24">
  <div class="mx-auto w-full max-w-6xl px-3 md:px-6">
    <div class="mx-auto max-w-150 text-center">
      <div class="space-y-3">
        <p class="text-primary text-sm font-medium">Meet Scout</p>
        <h2 class="text-3xl font-medium tracking-tight text-balance lg:text-4xl">
          Less digging. More understanding.
        </h2>
        <p class="text-secondary-foreground text-lg leading-relaxed">
          Ask a question about your production systems. Scout searches logs, traces, and metrics to
          help you understand what happened and what to do next. Talk to Scout in Orvo or
          <a
            href="/docs/integrations/slack"
            class="text-primary focus-visible:outline-ring rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >bring it into Slack</a
          >
          to investigate with your team, right in the thread.
          <a
            href="/docs/product/scout"
            class="text-primary focus-visible:outline-ring rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >Learn more about Scout</a
          >
        </p>
      </div>
    </div>

    <div
      class="relative mt-10 md:mt-16 lg:min-h-[38rem] lg:pt-12"
      style="mask-image: linear-gradient(to bottom, black 65%, transparent 100%);"
    >
      <!-- Replace this asset with the final Scout investigation capture when ready. -->
      <div
        class="bg-card border-foreground/15 overflow-hidden rounded-xl border shadow-xl lg:ml-auto lg:w-4/5"
      >
        <img
          src={DashboardTraceScreenshot}
          alt="Orvo trace investigation with Scout explaining a failed ClickHouse query alongside its request spans"
          width="2812"
          height="1600"
          loading="lazy"
          class="h-auto w-full"
        />
      </div>

      <div
        class="relative z-10 mx-auto -mt-8 w-full max-w-80 lg:absolute lg:top-24 lg:left-0 lg:mt-0 lg:origin-top-left lg:scale-80"
      >
        <ScoutSlackPreview />
      </div>
    </div>
  </div>

  <ScoutCapabilities />
</section>

<style>
  .scout-section {
    --scout-sky: oklch(0.65 0.17 250);
    background-image:
      radial-gradient(ellipse 36% 10% at 0% 43%, var(--background) 20%, transparent 80%),
      radial-gradient(ellipse 28% 12% at 100% 46%, var(--background) 15%, transparent 80%),
      radial-gradient(ellipse 38% 8% at 38% 52%, var(--background) 10%, transparent 85%),
      linear-gradient(
        to bottom,
        var(--background) 8%,
        color-mix(in srgb, var(--scout-sky) 10%, var(--background)) 35%,
        color-mix(in srgb, var(--scout-sky) 18%, var(--background)) 65%,
        color-mix(in srgb, var(--scout-sky) 14%, var(--background)) 100%
      );
  }
</style>
