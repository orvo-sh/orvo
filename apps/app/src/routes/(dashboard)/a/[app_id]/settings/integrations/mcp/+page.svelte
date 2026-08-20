<script lang="ts">
  import { page } from "$app/state";
  import {
    listMcpConnectionsQuery,
    revokeMcpConnectionCommand,
  } from "$lib/api/mcp.remote";
  import { Button } from "@repo/components/ui/button";
  import * as Dialog from "@repo/components/ui/dialog";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconCopy,
    IconExternalLink,
    IconPlugConnected,
    IconTrash,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  const serverUrl = $derived(`${page.url.origin}/api/mcp`);
  let loading = $state(true);
  let error = $state("");
  let revokeDialogOpen = $state(false);
  let revoking = $state(false);
  let selectedConnection = $state<{
    id: string;
    name: string;
    connectedAt: Date | string;
  } | null>(null);
  let connections = $state<
    Array<{
      id: string;
      name: string;
      connectedAt: Date | string;
    }>
  >([]);

  const loadConnections = async () => {
    loading = true;
    error = "";

    const result = await listMcpConnectionsQuery({});
    if (!result.success) {
      error = result.error;
      loading = false;
      return;
    }

    connections = result.data.connections;
    loading = false;
  };

  const copyServerUrl = async () => {
    await navigator.clipboard.writeText(serverUrl);
    toast.success("MCP server URL copied.");
  };

  const revokeConnection = async () => {
    if (!selectedConnection) return;

    revoking = true;
    const result = await revokeMcpConnectionCommand({
      id: selectedConnection.id,
    });
    revoking = false;

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    connections = connections.filter(
      (connection) => connection.id !== selectedConnection?.id,
    );
    revokeDialogOpen = false;
    selectedConnection = null;
    toast.success("MCP connection revoked.");
  };

  onMount(() => {
    void loadConnections();
  });
</script>

<div class="flex w-full max-w-2xl flex-col gap-10">
  <section class="space-y-1">
    <h2 class="text-base font-medium">Model Context Protocol</h2>
    <p class="max-w-xl text-sm text-muted-foreground">
      Connect compatible AI clients to investigate your Orvo telemetry with
      read-only access.
    </p>
  </section>

  <section class="space-y-3">
    <div class="space-y-1">
      <h3 class="text-sm font-medium">Server URL</h3>
      <p class="text-sm text-muted-foreground">
        Add this URL as a remote MCP server in your client.
      </p>
    </div>

    <div
      class="flex items-center gap-2 rounded-lg border bg-background p-2 pl-4"
    >
      <code class="min-w-0 flex-1 truncate text-sm">{serverUrl}</code>
      <Button type="button" variant="outline" onclick={copyServerUrl}>
        <IconCopy data-slot="button-icon" />
        Copy
      </Button>
    </div>
  </section>

  <section class="space-y-3 border-t pt-8">
    <div class="space-y-1">
      <h3 class="text-sm font-medium">Your connections</h3>
      <p class="text-sm text-muted-foreground">
        MCP clients you have authorized for this organization.
      </p>
    </div>

    {#if loading}
      <p class="text-sm text-muted-foreground">Loading connections...</p>
    {:else if error}
      <p class="text-sm text-destructive">{error}</p>
    {:else if connections.length === 0}
      <div
        class="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground"
      >
        No MCP clients connected yet.
      </div>
    {:else}
      <div class="divide-y rounded-lg border">
        {#each connections as connection (connection.id)}
          <div
            data-testid="mcp-connection"
            class="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div class="flex min-w-0 items-center gap-3">
              <IconPlugConnected
                class="size-4 shrink-0 text-muted-foreground"
              />
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{connection.name}</p>
                <p class="text-xs text-muted-foreground">
                  Connected {new Date(
                    connection.connectedAt,
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onclick={() => {
                selectedConnection = connection;
                revokeDialogOpen = true;
              }}
            >
              Revoke
            </Button>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="space-y-4 border-t pt-8">
    <div class="space-y-1">
      <h3 class="text-sm font-medium">How access works</h3>
      <p class="max-w-xl text-sm text-muted-foreground">
        Your client opens Orvo to authorize the connection. Choose one
        organization, then allow access. The client can read observability data
        across that organization's apps, but cannot make changes.
      </p>
    </div>

    <Button
      href="https://orvo.sh/docs/integrations/mcp"
      target="_blank"
      rel="noreferrer"
      variant="outline"
    >
      Read the MCP guide
      <IconExternalLink data-slot="button-icon" />
    </Button>
  </section>
</div>

<Dialog.Root bind:open={revokeDialogOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title
        >Revoke {selectedConnection?.name ?? "connection"}?</Dialog.Title
      >
      <Dialog.Description>
        This client will immediately lose access to this organization. To
        reconnect, you’ll need to authorize it again.
      </Dialog.Description>
    </Dialog.Header>

    <Dialog.Footer>
      <Button
        type="button"
        variant="outline"
        disabled={revoking}
        onclick={() => (revokeDialogOpen = false)}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="destructive"
        loading={revoking}
        onclick={revokeConnection}
      >
        <IconTrash data-slot="button-icon" />
        Revoke access
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
