<script lang="ts">
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import type { Snippet } from "svelte";

  import CreateEditHeartbeatMonitor from "./create-edit-heartbeat-monitor.svelte";

  let {
    heartbeatMonitor,
    destinations,
    children,
  }: {
    heartbeatMonitor: {
      id: string;
      name: string;
      expectedEverySeconds: number;
      graceSeconds: number;
      destinationIds: string[];
    };
    destinations: {
      id: string;
      name: string;
      kind: "webhook" | "email";
    }[];
    children?: Snippet<[{ openDialog: () => void }]>;
  } = $props();

  let confirmOpen = $state(false);
  let editOpen = $state(false);

  const handleContinue = () => {
    confirmOpen = false;
    editOpen = true;
  };
</script>

<CreateEditHeartbeatMonitor
  bind:open={editOpen}
  {heartbeatMonitor}
  {destinations}
/>

<AlertDialog.Root bind:open={confirmOpen}>
  {@const openDialog = () => {
    queueMicrotask(() => {
      confirmOpen = true;
    });
  }}
  {@render children?.({ openDialog })}

  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Edit heartbeat monitor?</AlertDialog.Title>
      <AlertDialog.Description>
        Review and update the schedule, grace period, or destinations for{" "}
        {heartbeatMonitor.name}.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={handleContinue}>Continue</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
