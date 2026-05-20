<script lang="ts">
  import { goto } from '$app/navigation';
  import * as Button from '@repo/components/ui/button';

  import { authClient, getFriendlyErrorMessage } from '$lib/auth-client';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  const handleSubmit = async () => {
    loading = true;
    error = '';

    await authClient.signUp.email(
      {
        name,
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
      <h1 class="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p class="text-sm text-muted-foreground">
        Start with a simple workspace account, then create your organization.
      </p>
    </div>
  </div>

  <div class="space-y-4">
    <label class="block space-y-2">
      <span class="text-sm font-medium">Name</span>
      <input
        class="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        type="text"
        bind:value={name}
        placeholder="What should we call you?"
        required
      />
    </label>

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
      {loading ? 'Creating account...' : 'Sign up'}
    </Button.Root>
  </div>

  <p class="text-center text-sm text-muted-foreground">
    Already have an account?
    <a class="font-medium text-foreground underline underline-offset-4" href="/sign-in">Sign in</a>
  </p>
</form>
