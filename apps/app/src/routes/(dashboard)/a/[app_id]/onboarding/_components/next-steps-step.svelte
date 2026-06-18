<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "@repo/components/ui/button";
  import { IconCheck, IconCircle } from "@tabler/icons-svelte";

  const {
    activation,
  }: {
    activation: {
      hasSentFirstSignals: boolean;
      hasCreatedFirstAlert: boolean;
      hasInvitedTeammate: boolean;
    };
  } = $props();

  const appId = page.params.app_id;

  const items = [
    {
      label: "Telemetry connected",
      done: activation.hasSentFirstSignals,
      href: null,
    },
    {
      label: "Create your first alert",
      done: activation.hasCreatedFirstAlert,
      href: `/a/${appId}/alerts`,
    },
    {
      label: "Invite a teammate",
      done: activation.hasInvitedTeammate,
      href: `/a/${appId}/settings/members`,
    },
    {
      label: "Track a deployment",
      done: false,
      href: `/a/${appId}/deployments`,
    },
    {
      label: "Install host monitoring",
      done: false,
      href: `/a/${appId}/hosts`,
    },
  ] as const;
</script>

<div class="space-y-4">
  <div class="space-y-1">
    <h3 class="text-lg font-semibold">Next steps</h3>
    <p class="text-sm text-muted-foreground">
      You are ready to use Orvo. Complete these actions to get the most out of
      your setup.
    </p>
  </div>

  <div class="divide-y rounded-lg border">
    {#each items as item (item.label)}
      <div class="flex items-center justify-between gap-4 px-4 py-3">
        <div class="flex items-center gap-3">
          <div
            class="flex size-6 shrink-0 items-center justify-center rounded-full border {item.done
              ? 'border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-300'
              : 'border-muted-foreground/30 text-muted-foreground'}"
          >
            {#if item.done}
              <IconCheck class="size-3.5" />
            {:else}
              <IconCircle class="size-3.5" />
            {/if}
          </div>
          <span class="text-sm font-medium">{item.label}</span>
        </div>
        {#if item.href}
          <Button variant="outline" size="sm" href={item.href}>Go</Button>
        {/if}
      </div>
    {/each}
  </div>
</div>
