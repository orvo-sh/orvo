<script lang="ts">
  import { IconCheck, IconScan } from '@tabler/icons-svelte';
</script>

<div class="mx-auto w-full max-w-6xl px-3 pt-8 pb-16 md:px-6 md:pt-12 md:pb-24">
  <div class="grid gap-8 md:grid-cols-2 md:gap-16">
    <div class="flex items-start gap-4">
      <IconScan class="text-primary mt-1 size-5 shrink-0" aria-hidden="true" />
      <div>
        <h3 class="text-lg font-medium">Start with the context you already have</h3>
        <p class="text-secondary-foreground mt-2 text-base leading-relaxed">
          Open Scout from a log, trace, or supported product page. Your filters, time range, and
          selected record give the investigation a starting point.
        </p>
      </div>
    </div>
    <div class="flex items-start gap-4">
      <IconCheck class="text-primary mt-1 size-5 shrink-0" aria-hidden="true" />
      <div>
        <h3 class="text-lg font-medium">Go from a finding to an action</h3>
        <p class="text-secondary-foreground mt-2 text-base leading-relaxed">
          Create an alert, update a heartbeat, or resolve an incident together. Scout asks you to
          approve consequential changes, in Orvo and in Slack.
        </p>
      </div>
    </div>
  </div>
</div>
