<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import { SlackIcon } from "@repo/components/icons/slack";
  import { IconCheck } from "@tabler/icons-svelte";

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Connect Slack to Scout · Orvo</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-muted/30 p-6">
  <Card.Root class="w-full max-w-md gap-6 p-6">
    <div
      class="flex size-11 items-center justify-center rounded-xl border bg-background"
    >
      {#if form?.linked}
        <IconCheck class="size-5 text-green-600" />
      {:else}
        <SlackIcon class="size-5" />
      {/if}
    </div>

    {#if form?.linked}
      <div class="space-y-2">
        <Card.Title>Slack is connected to Scout</Card.Title>
        <Card.Description>
          Your original question is being continued in Slack. You can close this
          page.
        </Card.Description>
      </div>
    {:else}
      <div class="space-y-2">
        <Card.Title>Connect your account</Card.Title>
        <Card.Description>
          Link your Slack identity to {data.user.email} so Scout can use your Orvo
          access and attribute approved actions to you.
        </Card.Description>
      </div>

      {#if form?.error}
        <p class="text-sm text-destructive" role="alert">{form.error}</p>
      {/if}

      <form method="POST">
        <input type="hidden" name="token" value={data.token} />
        <Button class="w-full" type="submit" disabled={!data.token}>
          <SlackIcon class="size-4" data-slot="button-icon" />
          Connect Slack to Scout
        </Button>
      </form>

      <p class="text-xs leading-relaxed text-muted-foreground">
        Scout checks your current organization membership on every request.
        Linking does not give Slack your Orvo credentials.
      </p>
    {/if}
  </Card.Root>
</main>
