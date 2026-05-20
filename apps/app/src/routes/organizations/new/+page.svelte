<script lang="ts">
  import * as Button from '@repo/components/ui/button';

  import { authClient } from '$lib/auth-client';
  import { slugify } from '$lib/slugify';

  let { data } = $props();

  let name = $state('');
  let slug = $state('');
  let slugEdited = $state(false);
  let loading = $state(false);
  let error = $state('');

  const getInitials = (value: string) =>
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'O';

  $effect(() => {
    if (slugEdited) return;
    slug = slugify(name);
  });

  const handleCreateOrganization = async () => {
    loading = true;
    error = '';

    await authClient.organization.create(
      {
        name: name.trim(),
        slug: slugify(slug)
      },
      {
        onSuccess: () => {
          location.href = '/';
        },
        onError: (ctx) => {
          error = ctx.error.message;
          loading = false;
        }
      }
    );
  };
</script>

<main class="flex min-h-screen items-center justify-center px-6 py-10">
  <form
    class="w-full max-w-md space-y-6 rounded-3xl border border-border/70 bg-background/95 p-8 shadow-sm"
    onsubmit={(event) => {
      event.preventDefault();
      handleCreateOrganization();
    }}
  >
    <div class="space-y-3 text-center">
      <div class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
        O
      </div>
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">Create your organization</h1>
        <p class="text-sm text-muted-foreground">
          Set up a workspace for {data.user.email}. This follows the same simple flow as
          Sey.
        </p>
      </div>
    </div>

    <div class="flex items-center gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div class="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
        {getInitials(name)}
      </div>
      <div class="min-w-0">
        <p class="truncate font-medium">{name.trim() || 'Workspace preview'}</p>
        <p class="truncate text-sm text-muted-foreground">
          {slugify(slug) || 'workspace-slug'}
        </p>
      </div>
    </div>

    <div class="space-y-4">
      <label class="block space-y-2">
        <span class="text-sm font-medium">Organization name</span>
        <input
          class="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          bind:value={name}
          minlength={2}
          maxlength={64}
          placeholder="Acme"
          required
        />
      </label>

      <label class="block space-y-2">
        <span class="text-sm font-medium">Workspace slug</span>
        <input
          class="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={slug}
          minlength={2}
          maxlength={64}
          placeholder="acme"
          oninput={(event) => {
            slugEdited = true;
            slug = slugify((event.currentTarget as HTMLInputElement).value);
          }}
          required
        />
        <p class="text-sm text-muted-foreground">
          Your workspace URL will use this slug.
        </p>
      </label>

      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}

      <Button.Root type="submit" disabled={loading || name.trim().length < 2 || slug.length < 2}>
        {loading ? 'Creating organization...' : 'Create organization'}
      </Button.Root>
    </div>
  </form>
</main>
