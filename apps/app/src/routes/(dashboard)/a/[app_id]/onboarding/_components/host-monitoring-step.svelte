<script lang="ts">
  import { createHostInstallSessionCommand } from "$lib/api/host-monitoring.remote";
  import { Button } from "@repo/components/ui/button";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconCheck,
    IconCopy,
    IconLoader2,
    IconServer,
  } from "@tabler/icons-svelte";

  const { hasConnectedHost }: { hasConnectedHost: boolean } = $props();

  let dockerEnabled = $state(false);
  let generating = $state(false);
  let installSession = $state<{
    command: string;
    expiresAt: string;
  } | null>(null);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const generateCommand = async () => {
    generating = true;

    const result = await createHostInstallSessionCommand({ dockerEnabled });

    if (!result.success) {
      toast.error(result.error);
      generating = false;
      return;
    }

    installSession = {
      command: result.data.command,
      expiresAt: result.data.expiresAt,
    };
    generating = false;
  };
</script>

<div class="space-y-4">
  <div class="space-y-1">
    <h3 class="text-lg font-semibold">Host monitoring (optional)</h3>
    <p class="text-sm text-muted-foreground">
      Monitor CPU, memory, disk, and containers by running the Orvo host agent
      on a Linux machine.
    </p>
  </div>

  {#if hasConnectedHost}
    <div class="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
      <div class="flex items-start gap-3">
        <IconCheck class="mt-0.5 size-4 text-green-600 dark:text-green-400" />
        <div>
          <p class="text-sm font-medium">Host connected</p>
          <p class="text-sm text-muted-foreground">
            Orvo is already receiving host metrics from this app.
          </p>
        </div>
      </div>
    </div>
  {:else}
    <div class="flex flex-wrap gap-2">
      <Button
        type="button"
        variant={dockerEnabled ? "outline" : "default"}
        onclick={() => {
          dockerEnabled = false;
        }}
      >
        Linux host
      </Button>
      <Button
        type="button"
        variant={dockerEnabled ? "default" : "outline"}
        onclick={() => {
          dockerEnabled = true;
        }}
      >
        Linux + Docker
      </Button>
      <Button loading={generating} onclick={generateCommand}>
        <IconServer data-slot="button-icon" />
        Generate install command
      </Button>
    </div>

    {#if installSession}
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium">Run this on the host</p>
          <p class="text-xs text-muted-foreground">
            Expires {new Date(installSession.expiresAt).toLocaleString()}
          </p>
        </div>
        <div class="relative">
          <Button
            variant="secondary"
            size="icon-sm"
            class="absolute top-1.5 right-1.5 bg-secondary/60"
            onclick={() => copy(installSession!.command)}
          >
            <IconCopy class="size-3.5" />
          </Button>
          <pre
            class="w-full max-w-full overflow-x-auto rounded-lg bg-zinc-900 px-4 py-4 text-xs whitespace-pre-wrap text-zinc-50"><code
              >{installSession.command}</code
            ></pre>
        </div>
      </div>
    {/if}

    <div class="rounded-lg border px-4 py-3">
      <div class="flex items-start gap-3">
        <IconLoader2 class="mt-0.5 size-4 animate-spin text-muted-foreground" />
        <div>
          <p class="text-sm font-medium">Waiting for host</p>
          <p class="text-sm text-muted-foreground">
            Run the install command on your machine. This page will update when
            the first host metrics arrive.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>
