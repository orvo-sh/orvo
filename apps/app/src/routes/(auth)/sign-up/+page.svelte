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
          <h1 class="text-xl font-semibold">Create your account</h1>
          <FieldDescription>
            Already have an account? <a href="/sign-in">Sign in</a>
          </FieldDescription>
        </div>
      </div>

      <div class="grid gap-3">
        <Field>
          <FieldLabel for="sign-up-name">Name</FieldLabel>
          <Input
            id="sign-up-name"
            type="text"
            bind:value={name}
            placeholder="What should we call you?"
            required
          />
        </Field>

        <Field>
          <FieldLabel for="sign-up-email">Email</FieldLabel>
          <Input
            id="sign-up-email"
            type="email"
            bind:value={email}
            placeholder="you@example.com"
            required
          />
        </Field>

        <Field>
          <FieldLabel for="sign-up-password">Password</FieldLabel>
          <Input
            id="sign-up-password"
            type="password"
            bind:value={password}
            placeholder="••••••••"
            required
          />
        </Field>

        <FieldError>{error}</FieldError>

        <Field>
          <Button type="submit" disabled={loading} class="w-full">
            {loading ? 'Creating account...' : 'Sign up'}
          </Button>
        </Field>
      </div>

      <FieldDescription class="text-center">
        Start with a simple workspace account, then create your organization.
      </FieldDescription>
    </FieldGroup>
  </form>
</div>
