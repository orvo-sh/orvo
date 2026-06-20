<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { toggleHeartbeatMonitorPausedCommand } from "$lib/api/heartbeats.remote";
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import { toast } from "@repo/components/ui/sonner";
  import type { Snippet } from "svelte";

  let {
    heartbeatMonitor,
    children,
  }: {
    heartbeatMonitor: {
      id: string;
      name: string;
      isPaused: boolean;
    };
    children?: Snippet<[{ openDialog: () => void }]>;
  } = $props();

  let open = $state(false);

  const submit = async () => {
    const result = await toggleHeartbeatMonitorPausedCommand(heartbeatMonitor.id);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    open = false;
    await invalidateAll();
    toast.success(result.data.paused ? "Heartbeat paused." : "Heartbeat resumed.");
  };
</script>

<AlertDialog.Root bind:open>
  {@const openDialog = () => {
    queueMicrotask(() => {
      open = true;
    });
  }}
  {@render children?.({ openDialog })}

  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>
        {heartbeatMonitor.isPaused
          ? "Resume heartbeat monitor?"
          : "Pause heartbeat monitor?"}
      </AlertDialog.Title>
      <AlertDialog.Description>
        {#if heartbeatMonitor.isPaused}
          Resume missed-heartbeat evaluations and notifications for{" "}
          {heartbeatMonitor.name}.
        {:else}
          Pause missed-heartbeat evaluations and notifications for{" "}
          {heartbeatMonitor.name} until you resume it.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={submit}>
        {heartbeatMonitor.isPaused ? "Resume" : "Pause"}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
