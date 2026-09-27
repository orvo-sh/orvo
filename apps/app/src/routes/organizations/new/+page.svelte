<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { startFreeTrialCommand } from "$lib/api/billing.remote";
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
  import { generateRandomString, slugify } from "@repo/utils";

  let name = $state("");
  let loading = $state(false);
  let error = $state("");
  let createdOrganizationId = $state<string | null>(null);

  const submit = async () => {
    if (name.trim().length < 2) {
      error = "Organization name must be at least 2 characters.";
      return;
    }

    loading = true;
    error = "";

    try {
      if (!createdOrganizationId) {
        const result = await authClient.organization.create({
          name: name.trim(),
          slug: `${slugify(name.trim())}-${generateRandomString(6)}`,
        });

        if (result.error) {
          error = result.error.message || "Failed to create organization";
          loading = false;
          return;
        }

        createdOrganizationId = result.data.id;
      }

      const activeOrganizationResult = await authClient.organization.setActive({
        organizationId: createdOrganizationId,
      });

      if (activeOrganizationResult.error) {
        error =
          activeOrganizationResult.error.message ||
          "Failed to activate organization.";
        loading = false;
        return;
      }

      const trialResult = await startFreeTrialCommand({ plan: "pro" });
      if (!trialResult.success) {
        error =
          trialResult.error ||
          "Your organization was created, but we couldn't start the trial.";
        loading = false;
        return;
      }

      window.location.href = "/apps/new?trial=started";
    } catch {
      error = createdOrganizationId
        ? "Your organization was created, but we couldn't start the trial."
        : "Failed to create organization";
      loading = false;
    }
  };
</script>

<div
  class="flex min-h-svh flex-col items-center gap-6 p-6 not-sm:pt-20 sm:justify-center md:p-10"
>
  <div class="w-full max-w-md">
    <div class="flex flex-col gap-6">
      <form
        id="create-organization-form"
        onsubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FieldGroup>
          <div class="flex flex-col items-center gap-3 text-center">
            <OrvoLogo class="size-14" />
            <div class="space-y-1">
              <h1 class="text-xl font-semibold">Create your organization</h1>
              <FieldDescription>
                An organization houses your teammates and apps.
              </FieldDescription>
            </div>
          </div>

          <div class="grid gap-3">
            <Field>
              <FieldLabel for="organization-name">Organization name</FieldLabel>
              <Input
                id="organization-name"
                bind:value={name}
                minlength={2}
                maxlength={64}
                placeholder="Acme"
                required
              />
            </Field>
          </div>

          <FieldError>{error}</FieldError>

          <Field>
            <Button
              id="create-organization-submit-button"
              type="submit"
              {loading}
              disabled={loading || name.trim().length < 2}
              class="w-full"
            >
              {createdOrganizationId ? "Retry trial" : "Create organization"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  </div>
</div>
