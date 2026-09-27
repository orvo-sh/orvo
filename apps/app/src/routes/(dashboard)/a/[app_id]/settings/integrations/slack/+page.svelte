<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { disconnectSlackIntegrationCommand } from "$lib/api/slack-integrations.remote";
  import { SlackIcon } from "@repo/components/icons/slack";
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import { toast } from "@repo/components/ui/sonner";
  import { IconExternalLink, IconTrash } from "@tabler/icons-svelte";

  let { data } = $props();
  let disconnecting = $state(false);
  let disconnectOpen = $state(false);

  const disconnect = async () => {
    disconnecting = true;
    const result = await disconnectSlackIntegrationCommand({});
    disconnecting = false;

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    disconnectOpen = false;
    await invalidateAll();
    toast.success("Slack disconnected.");
  };
</script>

<div class="flex w-full max-w-2xl flex-col gap-8">
  <section class="space-y-1">
    <h2 class="text-base font-medium">Scout for Slack</h2>
    <p class="max-w-xl text-sm text-muted-foreground">
      Bring Scout conversations and Orvo notifications into your Slack
      workspace.
    </p>
  </section>

  {#if page.url.searchParams.get("error")}
    <p class="text-sm text-destructive" role="alert">
      {page.url.searchParams.get("error")}
    </p>
  {/if}

  <div class="rounded-lg border">
    <div class="flex items-center gap-3 px-4 py-3">
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted"
      >
        <SlackIcon class="size-4.5" />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <p class="truncate text-sm font-medium">
            {data.integration?.slackBotUserId
              ? data.integration.slackTeamName
              : "Slack"}
          </p>
          {#if data.integration?.slackBotUserId}
            <Badge
              variant="outline"
              class="border-green-600/20 bg-green-600/7 text-green-700"
            >
              Connected
            </Badge>
          {/if}
        </div>
        <p class="text-xs text-muted-foreground">
          {data.integration?.slackBotUserId
            ? "Scout is installed in this workspace."
            : data.integration
              ? "Reconnect Slack to finish setting up Scout."
              : "Install Scout in your workspace to get started."}
        </p>
      </div>

      {#if data.integration?.slackBotUserId}
        <Button variant="outline" onclick={() => (disconnectOpen = true)}>
          Disconnect
        </Button>
      {:else}
        <Button
          href={`/api/integrations/slack/connect?app_id=${encodeURIComponent(page.params.app_id!)}`}
        >
          <IconExternalLink data-slot="button-icon" />
          {data.integration ? "Reconnect" : "Connect Slack"}
        </Button>
      {/if}
    </div>
  </div>
</div>

<AlertDialog.Root bind:open={disconnectOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Disconnect Slack?</AlertDialog.Title>
      <AlertDialog.Description>
        Scout conversations and Slack notifications will stop working for this
        app until you reconnect the workspace.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={disconnecting}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        variant="destructive"
        disabled={disconnecting}
        onclick={disconnect}
      >
        {#if !disconnecting}
          <IconTrash data-slot="button-icon" />
        {/if}
        Disconnect Slack
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
