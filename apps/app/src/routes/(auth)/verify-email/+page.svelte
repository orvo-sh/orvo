<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { Button } from "@repo/components/ui/button";
  import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
  } from "@repo/components/ui/field";
  import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
  } from "@repo/components/ui/input-otp";
  import { OrvoLogo } from "@repo/components/icons/orvo-logo";

  let { data } = $props();

  let otp = $state("");
  let loading = $state(false);
  let error = $state("");

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split("@");
    return `${localPart.slice(0, 2)}***@${domain}`;
  };

  const handleVerify = async () => {
    loading = true;
    error = "";

    await authClient.emailOtp
      .verifyEmail(
        {
          email: data.email,
          otp,
        },
        {
          onSuccess: async () => {
            await goto("/");
          },
          onError: (ctx) => {
            error = ctx.error.message;
            loading = false;
          },
        },
      )
      .catch(() => {
        error = "An unexpected error occurred. Please try again.";
        loading = false;
      });
  };
</script>

<div class="flex flex-col gap-6">
  <form
    id="verify-email-form"
    onsubmit={(event) => {
      event.preventDefault();
      handleVerify();
    }}
  >
    <FieldGroup>
      <div class="flex flex-col items-center gap-3 text-center">
        <OrvoLogo class="size-12" />
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">Verify your email</h1>
          <FieldDescription>
            We just sent a verification code to <b>{maskEmail(data.email)}</b>.
            Enter it below to confirm your email.
          </FieldDescription>
        </div>
      </div>

      <Field>
        <InputOTP
          maxlength={6}
          id="verify-email-otp"
          bind:value={otp}
          class="items-center justify-center"
        >
          {#snippet children({ cells })}
            <InputOTPGroup>
              {#each cells.slice(0, 3) as cell (cell)}
                <InputOTPSlot {cell} />
              {/each}
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              {#each cells.slice(3, 6) as cell (cell)}
                <InputOTPSlot {cell} />
              {/each}
            </InputOTPGroup>
          {/snippet}
        </InputOTP>
      </Field>

      <div class="grid gap-3">
        <FieldError>{error}</FieldError>

        <Field>
          <Button
            id="verify-email-submit-button"
            type="submit"
            {loading}
            class="w-full"
          >
            Verify email
          </Button>
        </Field>
      </div>
    </FieldGroup>
  </form>
</div>
