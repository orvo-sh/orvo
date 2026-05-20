<script lang="ts">
  import * as Button from '@repo/components/ui/button';

  import { authClient } from '$lib/auth-client';

  let { data } = $props();
  let loading = $state<string | null>(null);
  let error = $state('');

  const getInitials = (value: string) =>
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'O';

  const handleSelectOrganization = async (organizationId: string) => {
    loading = organizationId;
    error = '';

    await authClient.organization.setActive(
      { organizationId },
      {
        onSuccess: () => {
          location.href = '/';
        },
        onError: (ctx) => {
          error = ctx.error.message;
          loading = null;
        }
      }
    );
  };
</script>

<main class="flex min-h-screen items-center justify-center px-6 py-10">
  <div class="w-full max-w-md space-y-6 rounded-3xl border border-border/70 bg-background/95 p-8 shadow-sm">
    <div class="space-y-3 text-center">
      <div class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
        O
      </div>
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">Select an organization</h1>
        <p class="text-sm text-muted-foreground">
          Choose a workspace for {data.user.email}, or create a new one.
        </p>
      </div>
    </div>

    <div class="max-h-80 space-y-3 overflow-auto rounded-2xl border border-border/70 bg-muted/20 p-3">
      {#each data.organizations as organization}
        <button
          class="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background px-4 py-4 text-left transition hover:bg-muted/40 disabled:opacity-60"
          disabled={loading !== null}
          onclick={() => handleSelectOrganization(organization.id)}
          type="button"
        >
          <div class="flex size-11 items-center justify-center rounded-xl bg-primary/10 font-medium text-primary">
            {getInitials(organization.name)}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">{organization.name}</p>
            <p class="truncate text-sm text-muted-foreground">{organization.slug}</p>
          </div>
          {#if loading === organization.id}
            <div class="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          {/if}
        </button>
      {/each}
    </div>

    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {/if}

    <Button.Root href="/organizations/new" variant="outline">New organization</Button.Root>
  </div>
</main>
