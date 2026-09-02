<script lang="ts">
  import { Button } from '@repo/components/ui/button';
  import { IconArrowRight, IconBrandGithub } from '@tabler/icons-svelte';
</script>

<section class="bg-neutral-950 text-white">
  <div
    class="mx-auto flex min-h-[34rem] w-full max-w-6xl flex-col items-center justify-center px-3 py-24 text-center sm:px-6 md:min-h-[42rem] md:py-32 lg:min-h-[46rem]"
  >
    <h2
      class="max-w-5xl text-[clamp(2.75rem,7vw,6.5rem)] leading-[0.95] font-medium tracking-[-0.04em] text-balance"
    >
      Understand production.<br />Fix what matters.
    </h2>
    <p class="mt-7 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
      Bring logs, traces, metrics, and incidents together in one calm, open-source observability
      platform.
    </p>

    <div class="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
      <Button
        href="https://app.orvo.sh/sign-up"
        size="lg"
        class="w-full border-white bg-white text-neutral-950 hover:bg-neutral-200 sm:w-auto"
      >
        Start free trial
        <IconArrowRight data-slot="button-icon" />
      </Button>
      <Button
        href="https://github.com/orvo-sh/orvo"
        target="_blank"
        rel="noreferrer"
        size="lg"
        variant="outline"
        class="w-full border-white/15 bg-white/5 text-white shadow-none hover:bg-white/10 hover:text-white sm:w-auto"
      >
        <IconBrandGithub data-slot="button-icon" />
        View on GitHub
      </Button>
    </div>
  </div>
</section>
