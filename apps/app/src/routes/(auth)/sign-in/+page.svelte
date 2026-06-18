<script lang="ts">
  import { goto } from "$app/navigation";
  import { GitHubIcon } from "@repo/components/icons/github";
  import { OrvoLogo } from "@repo/components/icons/orvo-logo";
  import { Button } from "@repo/components/ui/button";
  import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
  } from "@repo/components/ui/field";
  import { Input } from "@repo/components/ui/input";

  import { authClient, getFriendlyErrorMessage } from "$lib/auth-client";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let email = $state("");
  let password = $state("");
  let error = $state((() => data.error)());
  let loading = $state(false);
  let githubLoading = $state(false);

  const handleSubmit = async () => {
    loading = true;
    error = "";

    await authClient.signIn
      .email(
        {
          email,
          password,
        },
        {
          onSuccess: async () => {
            await goto("/");
          },
          onError: async (ctx) => {
            const errorCode = ctx.error.code.toUpperCase();

            if (errorCode === "EMAIL_NOT_VERIFIED") {
              await authClient.emailOtp
                .sendVerificationOtp({
                  email,
                  type: "email-verification",
                })
                .catch(() => undefined);

              await goto(`/verify-email?email=${encodeURIComponent(email)}`);
              return;
            }

            error =
              getFriendlyErrorMessage(ctx.error.code) ?? ctx.error.message;
            loading = false;
          },
        },
      )
      .catch(() => {
        error = "An unexpected error occurred. Please try again.";
        loading = false;
      });
  };
  const handleGithubSignIn = async () => {
    githubLoading = true;
    error = "";

    await authClient.signIn
      .social({
        provider: "github",
        callbackURL: "/",
        errorCallbackURL: "/sign-in",
      })
      .catch(() => {
        error = "Unable to continue with GitHub right now. Please try again.";
        githubLoading = false;
      });
  };
</script>

<div class="flex flex-col gap-6">
  <form
    id="sign-in-form"
    onsubmit={(event) => {
      event.preventDefault();
      handleSubmit();
    }}
  >
    <FieldGroup>
      <div class="flex flex-col items-center gap-3 text-center">
        <OrvoLogo class="size-14" />
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">Welcome back</h1>
          <FieldDescription
            >Don't have an account? <a href="/sign-up" class="text-primary"
              >Get started</a
            ></FieldDescription
          >
        </div>
      </div>

      <Field>
        <Button
          id="sign-in-github-button"
          type="button"
          variant="outline"
          class="w-full"
          loading={githubLoading}
          onclick={handleGithubSignIn}
        >
          <GitHubIcon data-slot="button-icon" class="size-4" />
          Continue with GitHub
        </Button>
      </Field>

      <FieldSeparator>OR</FieldSeparator>

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
          <Button
            id="sign-in-submit-button"
            type="submit"
            disabled={githubLoading}
            {loading}
            class="w-full"
          >
            Sign in
          </Button>
        </Field>
      </div>
    </FieldGroup>
  </form>
</div>
