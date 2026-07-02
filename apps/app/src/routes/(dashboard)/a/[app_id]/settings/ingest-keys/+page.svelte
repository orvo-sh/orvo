<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import {
    createIngestionKeyCommand,
    listIngestionKeysQuery,
    revokeIngestionKeyCommand,
  } from "$lib/api/ingestion-key.remote";
  import { Button } from "@repo/components/ui/button";
  import * as Dialog from "@repo/components/ui/dialog";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconCopy as CopyIcon,
    IconKey as KeyIcon,
    IconPlus,
    IconTrash,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  let loading = $state(true);
  let creating = $state(false);
  let revokingId = $state("");
  let dialogOpen = $state(false);
  let error = $state("");
  let name = $state("");
  let keys = $state<
    Array<{
      id: string;
      name: string;
      key: string;
      createdAt: Date | string;
      lastUsedAt: Date | string | null;
      revokedAt: Date | string | null;
    }>
  >([]);

  const loadKeys = async () => {
    loading = true;
    error = "";

    const result = await listIngestionKeysQuery({ includeRevoked: false });

    if (!result.success) {
      error = result.error;
      loading = false;
      return;
    }

    keys = result.data.keys;
    loading = false;
  };

  const copyKey = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Ingestion key copied.");
  };

  const createKey = async () => {
    error = "";

    if (name.trim().length === 0) {
      error = "Name is required.";
      return;
    }

    creating = true;

    const result = await createIngestionKeyCommand({
      name: name.trim(),
    });

    if (!result.success) {
      error = result.error;
      creating = false;
      return;
    }

    dialogOpen = false;
    name = "";
    creating = false;
    await invalidateAll();
    await loadKeys();
    toast.success("Ingestion key created.");
  };

  const revokeKey = async (id: string) => {
    revokingId = id;

    const result = await revokeIngestionKeyCommand({ id });
    revokingId = "";

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    await invalidateAll();
    await loadKeys();
    toast.success("Ingestion key revoked.");
  };

  onMount(() => {
    void loadKeys();
  });
</script>

<div class="flex w-full max-w-4xl flex-col gap-10">
  <section class="flex flex-wrap items-start justify-between gap-4">
    <div class="space-y-1">
      <h2 class="text-base font-medium">Ingestion keys</h2>
      <p class="max-w-2xl text-sm text-muted-foreground">
        Use these keys with OTLP HTTP exporters and send them as
        `Authorization: Bearer ...`. Create separate keys per environment or
        workload so you can revoke them independently.
      </p>
    </div>

    <Button
      type="button"
      onclick={() => {
        name = "";
        error = "";
        dialogOpen = true;
      }}
    >
      <IconPlus data-slot="button-icon" />
      New ingestion key
    </Button>
  </section>

  {#if error && !dialogOpen}
    <p class="text-sm text-destructive">{error}</p>
  {/if}

  <section class="space-y-3">
    {#if loading}
      <p class="text-sm text-muted-foreground">Loading ingestion keys...</p>
    {:else if keys.length === 0}
      <div class="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
        No ingestion keys yet.
      </div>
    {:else}
      {#each keys as key (key.id)}
        <div class="space-y-3 rounded-lg border px-4 py-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <KeyIcon class="size-4 text-muted-foreground" />
                <p class="text-sm font-medium">{key.name}</p>
              </div>
              <p class="text-xs text-muted-foreground">
                Created {new Date(key.createdAt).toLocaleString()}
                {#if key.lastUsedAt}
                  · Last used {new Date(key.lastUsedAt).toLocaleString()}
                {/if}
              </p>
            </div>

            <div class="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Copy ${key.name} ingestion key`}
                onclick={() => copyKey(key.key)}
              >
                <CopyIcon data-slot="button-icon" />
              </Button>
              <Button
                type="button"
                variant="outline"
                loading={revokingId === key.id}
                disabled={revokingId.length > 0}
                onclick={() => revokeKey(key.id)}
              >
                <IconTrash data-slot="button-icon" />
                Revoke
              </Button>
            </div>
          </div>

          <div class="flex min-h-11 items-center rounded-lg border border-input bg-background px-4">
            <code class="block min-w-0 truncate text-sm text-foreground">
              {key.key}
            </code>
          </div>
        </div>
      {/each}
    {/if}
  </section>
</div>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>New ingestion key</Dialog.Title>
      <Dialog.Description>
        Create a named key for one environment, service, or deploy target.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4">
      <div class="space-y-2">
        <Label for="ingestion-key-name">Name</Label>
        <Input
          id="ingestion-key-name"
          bind:value={name}
          maxlength={64}
          placeholder="Production API"
        />
      </div>

      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}
    </div>

    <Dialog.Footer>
      <Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>
        Cancel
      </Button>
      <Button type="button" loading={creating} onclick={createKey}>
        <IconPlus data-slot="button-icon" />
        Create key
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
