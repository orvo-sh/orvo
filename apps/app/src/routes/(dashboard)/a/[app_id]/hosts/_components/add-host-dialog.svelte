<script lang="ts">
  import { createAgentEnrollmentCommand } from "$lib/api/agents.remote";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import * as Dialog from "@repo/components/ui/dialog";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { toast } from "@repo/components/ui/sonner";
  import { IconCheck, IconCopy, IconPlus } from "@tabler/icons-svelte";

  let open = $state(false);
  let displayName = $state("");
  let environment = $state("production");
  let loading = $state(false);
  let command = $state("");
  let expiresAt = $state("");
  let copied = $state(false);

  const createEnrollment = async () => {
    loading = true;
    try {
      const result = await createAgentEnrollmentCommand({
        displayName,
        environment,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      command = result.data.command;
      expiresAt = result.data.expiresAt;
    } catch {
      toast.error("Failed to create the install command.");
    } finally {
      loading = false;
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      toast.error("Failed to copy the install command.");
    }
  };
</script>

<Dialog.Root
  bind:open
  onOpenChange={(nextOpen) => {
    if (!nextOpen) {
      command = "";
      expiresAt = "";
      displayName = "";
      environment = "production";
    }
  }}
>
  <Dialog.Trigger class={buttonVariants()}>
    <IconPlus data-slot="button-icon" />
    Add host
  </Dialog.Trigger>
  <Dialog.Content class="sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>Add a Linux host</Dialog.Title>
      <Dialog.Description>
        Install the Orvo Agent using a one-time enrollment command.
      </Dialog.Description>
    </Dialog.Header>

    {#if command}
      <div class="grid gap-3">
        <div class="rounded-lg border bg-zinc-950 p-4 text-zinc-50">
          <code class="block overflow-x-auto font-mono text-xs leading-5">
            {command}
          </code>
        </div>
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs text-muted-foreground">
            Expires {new Date(expiresAt).toLocaleTimeString()} and can be used once.
          </p>
          <Button variant="outline" onclick={copy}>
            {#if copied}
              <IconCheck data-slot="button-icon" />
              Copied
            {:else}
              <IconCopy data-slot="button-icon" />
              Copy command
            {/if}
          </Button>
        </div>
        <p class="text-sm text-muted-foreground">
          Run it on the server. This page refreshes automatically when metrics
          arrive.
        </p>
      </div>
    {:else}
      <div class="grid gap-4">
        <div class="grid gap-2">
          <Label for="agent-display-name">Display name</Label>
          <Input
            id="agent-display-name"
            bind:value={displayName}
            placeholder="API production 01"
            autofocus
          />
          <p class="text-xs text-muted-foreground">
            A recognizable name for this host in Orvo.
          </p>
        </div>
        <div class="grid gap-2">
          <Label for="agent-environment">Environment</Label>
          <Input
            id="agent-environment"
            bind:value={environment}
            placeholder="production"
          />
          <p class="text-xs text-muted-foreground">
            Added to every metric reported by this host.
          </p>
        </div>
        <Dialog.Footer>
          <Button variant="outline" onclick={() => (open = false)}
            >Cancel</Button
          >
          <Button
            {loading}
            disabled={!displayName.trim() || !environment.trim()}
            onclick={createEnrollment}>Generate command</Button
          >
        </Dialog.Footer>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
