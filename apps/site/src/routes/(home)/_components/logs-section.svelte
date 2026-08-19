<script lang="ts">
  import DashboardLogsScreenshot from '$lib/assets/dashboard-logs-screenshot.png';
  import { Badge } from '@repo/components/ui/badge';
  import { IconArrowDownRight, IconFileText } from '@tabler/icons-svelte';
</script>

<section class="border-foreground/10 bg-muted/20 border-b py-16 md:py-24">
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-3 md:px-6">
    <div class="grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-end">
      <div class="space-y-4">
        <Badge
          variant="outline"
          class="bg-background w-fit gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
        >
          <IconFileText class="size-3.5" />
          One investigation
        </Badge>
        <h2 class="max-w-2xl text-3xl font-medium tracking-tight text-balance lg:text-5xl">
          Start with the symptom. Keep the context.
        </h2>
      </div>
      <p class="text-secondary-foreground text-base leading-loose text-balance">
        Search a noisy moment, open the related trace, inspect its attributes, and move into the
        incident without rebuilding the story in another tool.
      </p>
    </div>

    <div class="relative">
      <img
        src={DashboardLogsScreenshot}
        class="ring-border border-foreground/20 z-0 rounded-xl border shadow-xl ring-3"
        alt="Orvo log explorer with structured attributes and a selected log detail"
        width="2813"
        height="1489"
        loading="lazy"
      />
      <div
        class="bg-background absolute right-4 bottom-4 hidden max-w-xs rounded-lg border p-4 shadow-lg md:block"
      >
        <IconArrowDownRight class="text-primary size-5" />
        <p class="mt-3 text-sm font-medium">The detail stays attached.</p>
        <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
          Trace and span IDs, service metadata, and every structured attribute remain one click
          away.
        </p>
      </div>
    </div>
  </div>
</section>
