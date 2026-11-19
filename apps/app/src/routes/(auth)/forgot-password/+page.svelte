<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { authClient, getFriendlyErrorMessage } from "$lib/auth-client";
  import { OrvoLogo } from "@repo/components/icons/orvo-logo";
  import { Button } from "@repo/components/ui/button";
  import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
  } from "@repo/components/ui/field";
  import { Input } from "@repo/components/ui/input";

  let email = $state("");
  let loading = $state(false);
  let sent = $state(false);
  let error = $state("");
  const callback = $derived(page.url.searchParams.get("callback") ?? "/");

  const handleSubmit = async () => {
    if (loading) return;
    loading = true;
    error = "";
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: new URL(
          `/reset-password?callback=${encodeURIComponent(callback)}`,
          page.url.origin,
        ).toString(),
      });
      if (result.error) {
        error =
          getFriendlyErrorMessage(result.error.code ?? "") ??
          "Unable to send a reset link. Please try again.";
        return;
      }
      sent = true;
    } catch {
      error = "Unable to send a reset link. Please try again.";
    } finally {
      loading = false;
    }
  };
</script>

<svelte:head><title>Forgot password · Orvo</title></svelte:head>

<form
  id="forgot-password-form"
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
          {sent ? "Check your email" : "Forgot password?"}
        </h1>
        <FieldDescription>
          {sent
            ? "If an account exists for that email, we’ve sent a password reset link."
            : "Enter your email to receive a password reset link."}
        </FieldDescription>
      </div>
    </div>
    {#if sent}
      <p
        id="forgot-password-success"
        role="status"
        class="text-center text-sm text-muted-foreground"
      >
        Check your spam folder if you don’t see the email.
      </p>
      <Button
        type="button"
        variant="outline"
        onclick={() => {
          sent = false;
        }}>Try another email</Button
      >
    {:else}
      <Field>
        <FieldLabel for="forgot-password-email">Email</FieldLabel>
        <Input
          id="forgot-password-email"
          type="email"
          autocomplete="email"
          bind:value={email}
          placeholder="you@example.com"
          required
        />
      </Field>
      <FieldError>{error}</FieldError>
      <Button
        id="forgot-password-submit-button"
        type="submit"
        {loading}>Send reset link</Button
      >
    {/if}
    <a
      href={resolve(`/sign-in?callback=${encodeURIComponent(callback)}`)}
      class="text-center text-sm text-primary hover:underline"
      >Back to sign in</a
    >
  </FieldGroup>
</form>
