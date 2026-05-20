<script lang="ts">
  import { goto } from '$app/navigation';
  import * as Button from '@repo/components/ui/button';

  import { authClient, getFriendlyErrorMessage } from '$lib/auth-client';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  const handleSubmit = async () => {
    loading = true;
    error = '';

    await authClient.signIn.email(
      {
        email,
        password
      },
      {
        onSuccess: async () => {
          await goto('/');
        },
        onError: (ctx) => {
          error = getFriendlyErrorMessage(ctx.error.code) ?? ctx.error.message;
          loading = false;
        }
      }
    ).catch(() => {
      error = 'An unexpected error occurred. Please try again.';
      loading = false;
    });
  };
</script>

<form
  class="space-y-6 rounded-3xl border border-border/70 bg-background/95 p-8 shadow-sm"
  onsubmit={(event) => {
    event.preventDefault();
    handleSubmit();
  }}
>
  <div class="space-y-3 text-center">
    <div class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
      O
    </div>
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p class="text-sm text-muted-foreground">
        Sign in to continue to your Orvo workspace.
      </p>
    </div>
  </div>

  <div class="space-y-4">
    <label class="block space-y-2">
      <span class="text-sm font-medium">Email</span>
      <input
        class="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        type="email"
        bind:value={email}
        placeholder="you@example.com"
        required
      />
    </label>

    <label class="block space-y-2">
      <span class="text-sm font-medium">Password</span>
      <input
        class="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        type="password"
        bind:value={password}
        placeholder="••••••••"
        required
      />
    </label>

    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {/if}

    <Button.Root type="submit" disabled={loading}>
      {loading ? 'Signing in...' : 'Sign in'}
    </Button.Root>
  </div>

  <p class="text-center text-sm text-muted-foreground">
    Don&apos;t have an account?
    <a class="font-medium text-foreground underline underline-offset-4" href="/sign-up">Sign up</a>
  </p>
</form>
