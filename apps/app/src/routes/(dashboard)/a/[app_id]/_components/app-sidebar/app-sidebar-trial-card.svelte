<script lang="ts">
  import * as Card from "@repo/components/ui/card";

  let {
    href,
    trialStart,
    trialEnd,
  }: {
    href: string;
    trialStart: Date | string | null;
    trialEnd: Date | string | null;
  } = $props();

  const totalTrialDays = $derived.by(() => {
    if (!trialStart || !trialEnd) {
      return 14;
    }

    const startAt = new Date(trialStart).getTime();
    const endAt = new Date(trialEnd).getTime();
    const diffDays = Math.round((endAt - startAt) / 86_400_000);

    return Math.max(diffDays, 1);
  });

  const trialDaysLeft = $derived.by(() => {
    if (!trialEnd) {
      return 0;
    }

    const diffMs = new Date(trialEnd).getTime() - Date.now();
    return Math.max(Math.ceil(diffMs / 86_400_000), 0);
  });

  const progressValue = $derived(
    totalTrialDays > 0 ? (trialDaysLeft / totalTrialDays) * 100 : 0,
  );

  const circleRadius = 14;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const dashOffset = $derived(
    circleCircumference - (progressValue / 100) * circleCircumference,
  );
</script>

<div class="p-2 pb-0">
  <a {href} class="block">
    <Card.Root
      size="sm"
      class="flex flex-row items-center gap-1! rounded-lg  p-1! shadow-xs transition-colors hover:bg-muted/30"
    >
      <div class="relative grid size-8 shrink-0">
        <svg class="size-8 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
          <circle
            cx="22"
            cy="22"
            r={circleRadius}
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            class="text-orange-100"
          />
          <circle
            cx="22"
            cy="22"
            r={circleRadius}
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-dasharray={circleCircumference}
            stroke-dashoffset={dashOffset}
            class="text-orange-500 transition-[stroke-dashoffset]"
          />
        </svg>
      </div>

      <p class="text-sm text-secondary-foreground tabular-nums">
        {trialDaysLeft}/{totalTrialDays} trial days left
      </p>
    </Card.Root>
  </a>
</div>
