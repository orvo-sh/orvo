<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import {
    disconnectSlackIntegrationCommand,
    testSlackIntegrationCommand,
  } from "$lib/api/slack-integrations.remote";
  import { SlackIcon } from "@repo/components/icons/slack";
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import { toast } from "@repo/components/ui/sonner";
  import { IconExternalLink, IconSend, IconTrash } from "@tabler/icons-svelte";

  let { data } = $props();
  let testing = $state(false);
  let disconnecting = $state(false);
  let disconnectOpen = $state(false);

  const testConnection = async () => {
    testing = true;
    const result = await testSlackIntegrationCommand({});
    testing = false;

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Test notification sent to Slack.");
  };

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
    <div class="flex items-center gap-2">
      <SlackIcon class="size-5" />
      <h2 class="text-base font-medium">Scout for Slack</h2>
    </div>
    <p class="max-w-xl text-sm text-muted-foreground">
      Investigate telemetry, continue Scout conversations, approve actions, and
      receive incident notifications in Slack.
    </p>
  </section>

  {#if page.url.searchParams.get("error")}
    <p class="text-sm text-destructive" role="alert">
      {page.url.searchParams.get("error")}
    </p>
  {/if}

  {#if data.integration?.slackBotUserId}
    <Card.Root class="gap-0 overflow-hidden p-0">
      <Card.Header
        class="flex-row items-center justify-between border-b px-5 py-4"
      >
        <div>
          <Card.Title class="text-sm">Scout for Slack</Card.Title>
          <Card.Description
            >Scout and notifications are ready for this app.</Card.Description
          >
        </div>
        <Badge
          variant="outline"
          class="border-green-600/20 bg-green-600/7 text-green-700"
        >
          Connected
        </Badge>
      </Card.Header>
      <Card.Content class="grid gap-5 px-5 py-5 sm:grid-cols-2">
        <div class="space-y-1">
          <p class="text-xs font-medium text-muted-foreground">Workspace</p>
          <p class="text-sm font-medium">{data.integration.slackTeamName}</p>
        </div>
        <div class="space-y-1">
          <p class="text-xs font-medium text-muted-foreground">
            Notification channel
          </p>
          <p class="text-sm font-medium">
            #{data.integration.slackChannelName}
          </p>
        </div>
      </Card.Content>
      <Card.Footer class="justify-between gap-2 border-t px-5 py-4">
        <Button variant="outline" loading={testing} onclick={testConnection}>
          <IconSend data-slot="button-icon" />
          Test notification
        </Button>
        <Button variant="ghost" onclick={() => (disconnectOpen = true)}>
          <IconTrash data-slot="button-icon" />
          Disconnect
        </Button>
      </Card.Footer>
    </Card.Root>

    <p class="text-sm text-muted-foreground">
      Message Orvo directly, or invite it to a channel and mention
      <strong>@Orvo</strong> once to start a Scout conversation. Replies in that
      thread continue the same chat without another mention. Incident
      notifications are sent to #{data.integration.slackChannelName}.
    </p>
    <Card.Root class="gap-2 p-5">
      <Card.Title class="text-sm">Slack Events API request URL</Card.Title>
      <Card.Description>
        Configure this URL under your Slack app's Event Subscriptions and
        subscribe to <code>app_mention</code>, <code>message.channels</code>,
        <code>message.groups</code>, and <code>message.im</code>. Enable the
        Agent experience and Messages tab under App Home for native sessions and
        DMs.
      </Card.Description>
      <code
        class="mt-2 overflow-x-auto rounded-md border bg-muted px-3 py-2 text-xs"
        >{data.requestUrl}</code
      >
    </Card.Root>
  {:else}
    <Card.Root class="items-start gap-5 p-5">
      <div
        class="flex size-10 items-center justify-center rounded-lg border bg-muted"
      >
        <SlackIcon class="size-5" />
      </div>
      <div class="space-y-1">
        <Card.Title class="text-sm">
          {data.integration ? "Reconnect Slack" : "Connect Scout to Slack"}
        </Card.Title>
        <Card.Description>
          {data.integration
            ? "Reconnect to grant the bot permissions Scout needs for DMs, thread replies, streaming responses, and approvals."
            : "Install Scout in your workspace and choose the default channel for incident notifications. You can then message it directly or invite it to other channels."}
        </Card.Description>
      </div>
      <Button
        href={`/api/integrations/slack/connect?app_id=${encodeURIComponent(page.params.app_id!)}`}
      >
        <IconExternalLink data-slot="button-icon" />
        {data.integration ? "Reconnect Slack" : "Connect Slack"}
      </Button>
    </Card.Root>
  {/if}
</div>

<AlertDialog.Root bind:open={disconnectOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Disconnect Slack?</AlertDialog.Title>
      <AlertDialog.Description>
        Orvo will stop sending notifications for this app to
        {data.integration?.slackChannelName
          ? `#${data.integration.slackChannelName}`
          : "Slack"}.
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
