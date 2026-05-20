<script lang="ts">
  import { goto } from '$app/navigation';
  import { Button } from '@repo/components/ui/button';
  import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel
  } from '@repo/components/ui/field';
  import { Input } from '@repo/components/ui/input';

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

<div class="flex flex-col gap-6">
  <form
    onsubmit={(event) => {
      event.preventDefault();
      handleSubmit();
    }}
  >
    <FieldGroup>
      <div class="flex flex-col items-center gap-3 text-center">
        <div class="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl text-sm font-semibold">
          O
        </div>
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">Welcome back</h1>
          <FieldDescription>Sign in to continue to your Orvo workspace.</FieldDescription>
        </div>
      </div>

      <div class="grid gap-3">
        <Field>
          <FieldLabel for="sign-in-email">Email</FieldLabel>
          <Input
            id="sign-in-email"
            type="email"
            bind:value={email}
            placeholder="you@example.com"
            required
          />
        </Field>

        <Field>
          <FieldLabel for="sign-in-password">Password</FieldLabel>
          <Input
            id="sign-in-password"
            type="password"
            bind:value={password}
            placeholder="••••••••"
            required
          />
        </Field>

        <FieldError>{error}</FieldError>

        <Field>
          <Button type="submit" disabled={loading} class="w-full">
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </Field>
      </div>

      <FieldDescription class="text-center">
        Don&apos;t have an account? <a href="/sign-up">Sign up</a>
      </FieldDescription>
    </FieldGroup>
  </form>
</div>
