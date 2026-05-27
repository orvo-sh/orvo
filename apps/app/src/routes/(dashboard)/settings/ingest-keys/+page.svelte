<script lang="ts">
  import { onMount } from 'svelte';
  import { createIngestionKeyCommand, getIngestionKeysQuery, revokeIngestionKeyCommand } from '$lib/api/ingestion-key.remote';
  import { Button } from "@repo/components/ui/button";
  import { CopyIcon } from "phosphor-svelte";

  type IngestionKeyRow = {
    id: string;
    kind: 'public' | 'private';
    key: string;
    createdAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
    createdBy: string | null;
  };

  let loading = $state(true);
  let creatingKind = $state<'public' | 'private' | null>(null);
  let revokingId = $state<string | null>(null);
  let error = $state('');
  let ingestionKeys = $state<IngestionKeyRow[]>([]);

  const loadIngestionKeys = async () => {
    loading = true;
    error = '';

    const result = await getIngestionKeysQuery({ includeRevoked: true });
    if (result.success === false) {
      error = result.error;
      loading = false;
      return;
    }

    ingestionKeys = result.data.ingestionKeys;
    loading = false;
  };

  const activePublicKey = $derived(
    ingestionKeys.find((ingestionKey) => ingestionKey.kind === 'public' && !ingestionKey.revokedAt) ?? null
  );

  const activePrivateKey = $derived(
    ingestionKeys.find((ingestionKey) => ingestionKey.kind === 'private' && !ingestionKey.revokedAt) ?? null
  );

  const revokedKeys = $derived(
    ingestionKeys.filter((ingestionKey) => Boolean(ingestionKey.revokedAt))
  );

  const copyKey = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  const createKey = async (kind: 'public' | 'private') => {
    creatingKind = kind;
    error = '';

    const result = await createIngestionKeyCommand({ kind });
    if (result.success === false) {
      error = result.error;
      creatingKind = null;
      return;
    }

    await loadIngestionKeys();
    creatingKind = null;
  };

  const revokeKey = async (ingestionKeyId: string) => {
    revokingId = ingestionKeyId;
    error = '';

    const result = await revokeIngestionKeyCommand({ ingestionKeyId });
    if (result.success === false) {
      error = result.error;
      revokingId = null;
      return;
    }

    await loadIngestionKeys();
    revokingId = null;
  };

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      : 'Never';

  onMount(() => {
    void loadIngestionKeys();
  });
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-12 py-1">
  {#if error}
    <div class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {error}
    </div>
  {/if}

  <section class="space-y-4">
    <div class="space-y-1.5">
      <h2 class="text-2xl font-semibold tracking-tight text-foreground">
        Public
      </h2>
      <p class="text-sm text-muted-foreground">
        For browser and client-side OpenTelemetry SDKs. Send it as `Authorization: Bearer pk_...`.
      </p>
    </div>

    {#if activePublicKey}
      <div class="flex flex-col gap-3 rounded-xl border p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div class="border-input bg-background flex h-12 min-w-0 flex-1 items-center rounded-lg border px-4">
            <code class="block min-w-0 truncate text-sm text-foreground">
              {activePublicKey.key}
            </code>
          </div>

          <Button
            variant="outline"
            size="icon"
            aria-label="Copy public ingestion key"
            onclick={() => copyKey(activePublicKey.key)}
          >
            <CopyIcon />
          </Button>

          <Button
            variant="outline"
            disabled={revokingId === activePublicKey.id}
            loading={revokingId === activePublicKey.id}
            onclick={() => revokeKey(activePublicKey.id)}
          >
            Revoke
          </Button>
        </div>

        <p class="text-xs text-muted-foreground">
          Created {formatDate(activePublicKey.createdAt)}. Last used {formatDate(activePublicKey.lastUsedAt)}.
        </p>
      </div>
    {:else}
      <Button
        class="w-fit"
        disabled={creatingKind === 'private'}
        loading={creatingKind === 'public'}
        onclick={() => createKey('public')}
      >
        Create public key
      </Button>
    {/if}
  </section>

  <section class="space-y-4">
    <div class="space-y-1.5">
      <h2 class="text-2xl font-semibold tracking-tight text-foreground">
        Private
      </h2>
      <p class="text-sm text-muted-foreground">
        For server-side ingestion and backend services. Send it as `Authorization: Bearer sk_...`.
      </p>
    </div>

    {#if activePrivateKey}
      <div class="flex flex-col gap-3 rounded-xl border p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div class="border-input bg-background flex h-12 min-w-0 flex-1 items-center rounded-lg border px-4">
            <code class="block min-w-0 truncate text-sm text-foreground">
              {activePrivateKey.key}
            </code>
          </div>

          <Button
            variant="outline"
            size="icon"
            aria-label="Copy private ingestion key"
            onclick={() => copyKey(activePrivateKey.key)}
          >
            <CopyIcon />
          </Button>

          <Button
            variant="outline"
            disabled={revokingId === activePrivateKey.id}
            loading={revokingId === activePrivateKey.id}
            onclick={() => revokeKey(activePrivateKey.id)}
          >
            Revoke
          </Button>
        </div>

        <p class="text-xs text-muted-foreground">
          Created {formatDate(activePrivateKey.createdAt)}. Last used {formatDate(activePrivateKey.lastUsedAt)}.
        </p>
      </div>
    {:else}
      <Button
        class="w-fit"
        disabled={creatingKind === 'public'}
        loading={creatingKind === 'private'}
        onclick={() => createKey('private')}
      >
        Create private key
      </Button>
    {/if}
  </section>

  <section class="space-y-4">
    <div class="space-y-1.5">
      <h2 class="text-xl font-semibold tracking-tight text-foreground">
        Revoked
      </h2>
      <p class="text-sm text-muted-foreground">
        Append-only history of keys that have been revoked.
      </p>
    </div>

    {#if loading}
      <p class="text-sm text-muted-foreground">Loading ingestion keys...</p>
    {:else if revokedKeys.length === 0}
      <p class="text-sm text-muted-foreground">No revoked ingestion keys yet.</p>
    {:else}
      <div class="flex flex-col gap-3">
        {#each revokedKeys as ingestionKey (ingestionKey.id)}
          <div class="rounded-xl border p-4">
            <div class="flex items-center justify-between gap-4">
              <div class="space-y-1">
                <p class="font-medium capitalize">{ingestionKey.kind}</p>
                <code class="text-sm text-muted-foreground">{ingestionKey.key}</code>
              </div>
              <p class="text-xs text-muted-foreground">Revoked {formatDate(ingestionKey.revokedAt)}</p>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
