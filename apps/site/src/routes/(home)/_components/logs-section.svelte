<script lang="ts">
  import DashboardLogsScreenshot from '$lib/assets/dashboard-logs-screenshot.png';
  import { Badge } from '@repo/components/ui/badge';
  import { IconFileText } from '@tabler/icons-svelte';
</script>

<section class="border-foreground/15 border-b bg-white py-16 md:py-24">
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-3 md:px-6">
    <div class="flex flex-col gap-4 lg:max-w-2xl">
      <Badge variant="outline" class="w-fit gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
        <IconFileText class="size-3.5" />
        Logs
      </Badge>
      <div class="space-y-3">
        <h2 class="text-3xl font-medium tracking-tight text-balance lg:text-5xl">
          Scroll through production without losing the thread.
        </h2>
        <p class="text-secondary-foreground max-w-2xl text-base leading-loose text-balance">
          Search by service, severity, and trace context, then move through noisy moments with a log
          stream that stays readable under load.
        </p>
      </div>
    </div>

    <img
      src={DashboardLogsScreenshot}
      class="ring-border border-foreground/20 z-0 rounded-xl rounded-b-none border border-b-0 shadow-xl ring-3"
      alt="app screen"
      width="2813"
      height="1489"
    />
  </div>
</section>
