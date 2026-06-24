<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { deleteHeartbeatMonitorCommand } from "$lib/api/heartbeats.remote";
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import { toast } from "@repo/components/ui/sonner";
  import type { Snippet } from "svelte";

  let {
    heartbeatMonitor,
    children,
    open = $bindable(false),
  }: {
    heartbeatMonitor: {
      id: string;
      name: string;
    };
    children?: Snippet<[{ openDialog: () => void }]>;
    open?: boolean;
  } = $props();

  const submit = async () => {
    const result = await deleteHeartbeatMonitorCommand(heartbeatMonitor.id);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    open = false;
    await invalidateAll();
    toast.success("Heartbeat monitor deleted.");
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
      <AlertDialog.Title>Delete heartbeat monitor?</AlertDialog.Title>
      <AlertDialog.Description>
        This action cannot be undone. {heartbeatMonitor.name} and its configuration
        will be permanently removed.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={submit}>
        Delete
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
