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
  import { initializeLocalCommand } from "$lib/api/local.remote";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let name = $state(data.resumeLocalSetup?.name ?? "");
  let email = $state(
    data.resumeLocalSetup?.email ?? data.localSignup?.email ?? "",
  );
  let password = $state("");
  let error = $state((() => data.error)());
  let loading = $state(false);
  let githubLoading = $state(false);

  const finishLocalSetup = async () => {
    if (data.localSignup?.kind !== "setup") return false;

    const result = await initializeLocalCommand({
      setupToken: data.localSignup.setupToken,
    });
    if (!result.success) {
      error = result.error;
      loading = false;
      return true;
    }

    await authClient.organization.setActive({
      organizationId: result.data.organization.id,
    });
    await goto("/");
    return true;
  };

  const handleSubmit = async () => {
    loading = true;
    error = "";

    if (data.resumeLocalSetup) {
      await finishLocalSetup();
      return;
    }

    await authClient.signUp
      .email(
        {
          name,
          email,
          password,
        },
        {
          onSuccess: async () => {
            if (await finishLocalSetup()) return;

            if (data.localSignup?.kind === "invitation") {
              await goto(`/invite/${data.localSignup.invitationId}`);
              return;
            }

            await goto(
              `/verify-email?email=${encodeURIComponent(email)}&callback=${encodeURIComponent(data.callback)}`,
            );
          },
          onError: (ctx) => {
            error =
              getFriendlyErrorMessage(ctx.error.code) ?? ctx.error.message;
            loading = false;
          },
          headers:
            data.localSignup?.kind === "setup"
              ? { "x-orvo-setup-token": data.localSignup.setupToken }
              : data.localSignup?.kind === "invitation"
                ? { "x-orvo-invitation-id": data.localSignup.invitationId }
                : undefined,
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
        callbackURL: data.callback,
        errorCallbackURL: `/sign-up?callback=${encodeURIComponent(data.callback)}`,
      })
      .catch(() => {
        error = "Unable to continue with GitHub right now. Please try again.";
        githubLoading = false;
      });
  };
</script>

<div class="flex flex-col gap-6">
  <form
    id="sign-up-form"
    onsubmit={(event) => {
      event.preventDefault();
      handleSubmit();
    }}
  >
    <FieldGroup>
      <div class="flex flex-col items-center gap-3 text-center">
        <OrvoLogo class="size-14" />
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">
            {data.localSignup?.kind === "setup"
              ? "Set up Orvo Local"
              : data.localSignup?.kind === "invitation"
                ? "Join Orvo Local"
                : "Create your account"}
          </h1>
          <FieldDescription>
            Already have an account? <a
              href={`/sign-in?callback=${encodeURIComponent(data.callback)}`}
              class="text-primary">Sign in</a
            >
          </FieldDescription>
        </div>
      </div>

      {#if data.mode === "cloud"}
        <Field>
          <Button
            id="sign-up-github-button"
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
      {/if}

      {#if data.resumeLocalSetup}
        <FieldDescription class="text-center">
          Signed in as {data.resumeLocalSetup.email}. Finish connecting this
          account to Orvo Local.
        </FieldDescription>
      {:else}
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
              disabled={data.localSignup?.kind === "invitation"}
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
            <Button
              id="sign-up-submit-button"
              type="submit"
              disabled={githubLoading}
              {loading}
              class="w-full"
            >
              Sign up
            </Button>
          </Field>
        </div>
      {/if}

      {#if data.resumeLocalSetup}
        <Field>
          <Button type="submit" {loading} class="w-full">Finish setup</Button>
        </Field>
      {/if}
    </FieldGroup>
  </form>
</div>
