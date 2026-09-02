<script lang="ts">
  import { GitHubIcon } from '@repo/components/icons/github';
  import { Button } from '@repo/components/ui/button';
  import { IconArrowRight } from '@tabler/icons-svelte';
</script>

<section class="bg-background">
  <div
    class="mx-auto flex w-full max-w-6xl flex-col items-center justify-center px-3 py-20 text-center sm:px-6 md:py-28"
  >
    <h2 class="max-w-3xl text-3xl font-medium tracking-tight text-balance lg:text-5xl">
      Understand production.<br />Fix what matters.
    </h2>
    <p class="text-secondary-foreground mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
      Bring logs, traces, metrics, and incidents together in one calm, open-source observability
      platform.
    </p>

    <div class="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
      <Button href="https://app.orvo.sh/sign-up" size="lg" class="w-full sm:w-auto">
        Start free trial
        <IconArrowRight data-slot="button-icon" />
      </Button>
      <Button
        href="https://github.com/orvo-sh/orvo"
        target="_blank"
        rel="noreferrer"
        size="lg"
        variant="outline"
        class="w-full sm:w-auto"
      >
        <GitHubIcon class="size-4" />
        View on GitHub
      </Button>
    </div>
  </div>
</section>
