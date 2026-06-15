<script lang="ts">
  import { createAppCommand } from "$lib/api/apps.remote";
  import { OrvoLogo } from "@repo/components/icons/orvo-logo";
  import { Button } from "@repo/components/ui/button";
  import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
  } from "@repo/components/ui/field";
  import { Input } from "@repo/components/ui/input";

  let { data }: { data: { hasApps: boolean } } = $props();

  let name = $state("");
  let loading = $state(false);
  let error = $state("");

  const submit = async () => {
    if (name.trim().length < 2) {
      error = "App name must be at least 2 characters.";
      return;
    }

    loading = true;
    error = "";

    const result = await createAppCommand({
      name: name.trim(),
    });

    if (result.success === false) {
      error = result.error;
      loading = false;
      return;
    }

    window.location.href = `/a/${result.data.id}`;
  };
</script>

<div
  class="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10"
>
  <div class="w-full max-w-md">
    <div class="flex flex-col gap-6">
      <form
        id="create-app-form"
        onsubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FieldGroup>
          <div class="flex flex-col items-center gap-2 text-center">
            <OrvoLogo class="size-14" />
            <div class="space-y-1">
              <h1 class="text-xl font-semibold">
                {data.hasApps ? "Create a new app" : "Create your first app"}
              </h1>
              <FieldDescription>
                Apps own telemetry, ingestion keys, alerts, and dashboard views.
              </FieldDescription>
            </div>
          </div>

          <div class="grid gap-3">
            <Field>
              <FieldLabel for="app-name">App name</FieldLabel>
              <Input
                id="app-name"
                bind:value={name}
                minlength={2}
                maxlength={64}
                placeholder="Acme API"
                required
              />
            </Field>
          </div>

          {#if error}
            <p class="text-sm text-destructive">{error}</p>
          {/if}

          <Button
            id="create-app-submit-button"
            type="submit"
            {loading}
            disabled={loading || name.trim().length < 2}
            class="w-full"
          >
            Create app
          </Button>
        </FieldGroup>
      </form>
    </div>
  </div>
</div>
