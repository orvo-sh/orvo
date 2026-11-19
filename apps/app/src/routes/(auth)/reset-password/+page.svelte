<script lang="ts">
  import { page } from "$app/state";
  import { replaceState } from "$app/navigation";
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

  let password = $state("");
  let confirmPassword = $state("");
  let loading = $state(false);
  let complete = $state(false);
  let error = $state("");
  let invalidToken = $state(false);
  const token = $derived(page.url.searchParams.get("token"));
  const callback = $derived(page.url.searchParams.get("callback") ?? "/");

  const handleSubmit = async () => {
    if (loading || !token) return;
    error = "";
    if (password !== confirmPassword) {
      error = "Passwords do not match.";
      return;
    }
    loading = true;
    try {
      const result = await authClient.resetPassword({
        token,
        newPassword: password,
      });
      if (result.error) {
        invalidToken = result.error.code === "INVALID_TOKEN";
        error =
          getFriendlyErrorMessage(result.error.code ?? "") ??
          "Unable to reset your password. Please try again.";
        return;
      }
      password = "";
      confirmPassword = "";
      complete = true;
      // Remove the used reset token from the current browser history entry.
      replaceState(
        resolve(`/reset-password?callback=${encodeURIComponent(callback)}`),
        page.state,
      );
    } catch {
      error = "Unable to reset your password. Please try again.";
    } finally {
      loading = false;
    }
  };
</script>

<svelte:head>
  <title>Reset password · Orvo</title>
  <meta name="referrer" content="no-referrer" />
</svelte:head>

<form
  id="reset-password-form"
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
          {complete ? "Password reset" : "Reset your password"}
        </h1>
        <FieldDescription>
          {complete
            ? "Your password has been updated. Sign in with your new password."
            : "Choose a new password for your account."}
        </FieldDescription>
      </div>
    </div>
    {#if complete}
      <Button
        id="reset-password-sign-in-button"
        href={`/sign-in?callback=${encodeURIComponent(callback)}`}
        >Sign in</Button
      >
    {:else if !token || page.url.searchParams.has("error") || invalidToken}
      <p
        id="reset-password-invalid-token"
        role="alert"
        class="text-center text-sm text-destructive"
      >
        This password reset link is invalid or has expired.
      </p>
      <Button
        href={`/forgot-password?callback=${encodeURIComponent(callback)}`}
        >Request a new link</Button
      >
    {:else}
      <Field>
        <FieldLabel for="reset-password-new">New password</FieldLabel>
        <Input
          id="reset-password-new"
          type="password"
          autocomplete="new-password"
          bind:value={password}
          minlength={8}
          maxlength={128}
          required
        />
      </Field>
      <Field>
        <FieldLabel for="reset-password-confirm">Confirm password</FieldLabel>
        <Input
          id="reset-password-confirm"
          type="password"
          autocomplete="new-password"
          bind:value={confirmPassword}
          minlength={8}
          maxlength={128}
          required
        />
      </Field>
      <FieldError>{error}</FieldError>
      <Button
        id="reset-password-submit-button"
        type="submit"
        {loading}>Reset password</Button
      >
    {/if}
  </FieldGroup>
</form>
