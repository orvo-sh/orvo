<script lang="ts">
  import ScoutChatScreenshot from '$lib/assets/scout-chat-screenshot.png';
  import ScoutCapabilities from './scout-capabilities.svelte';
  import { IconArrowRight } from '@tabler/icons-svelte';
</script>

<section
  id="scout"
  class="from-muted/100 via-muted/70 to-background border-foreground/15 overflow-hidden border-b bg-linear-to-t"
>
  <div class="pt-16 md:pt-24">
    <div class="mx-auto w-full max-w-6xl px-3 md:px-6">
      <div class="mx-auto max-w-200 text-center">
        <div class="space-y-3">
          <h2 class="text-3xl font-medium tracking-tight text-balance lg:text-4xl">
            Less digging. More understanding.
          </h2>
          <p class="text-secondary-foreground text-lg leading-relaxed">
            Ask a question about your production systems. Scout searches logs, traces, and metrics
            to help you understand what happened and what to do next.
          </p>
        </div>
      </div>

      <div class="relative mx-auto mt-10 md:mt-14">
        <div class="pb-8 md:pb-10">
          <img
            src={ScoutChatScreenshot}
            alt="Scout investigates a checkout error spike, compares latency and database connections, and recommends rolling back the payments deployment"
            width="2812"
            height="1600"
            loading="lazy"
            style="mask-image: linear-gradient(to bottom, black 78%, transparent 100%);"
            class="border-foreground/15 bg-card h-auto w-full rounded-xl border"
          />
        </div>
      </div>
    </div>
  </div>

  <div class="relative">
    <ScoutCapabilities />

    <div class="flex justify-center px-6 pt-8 pb-16 md:pt-10 md:pb-24">
      <a
        href="/docs/product/scout"
        class="text-primary bg-primary/5 hover:bg-primary/10 inline-flex items-center gap-2 rounded-md px-2 text-base underline-offset-4 transition-colors"
      >
        Learn more about Scout
        <IconArrowRight class="size-4" aria-hidden="true" />
      </a>
    </div>
  </div>
</section>
