<script lang="ts">
  import { createAppCommand } from "$lib/api/apps.remote";
  import { getSupportedTimezones, normalizeTimeZone } from "$lib/timezone";
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
  import { onMount } from "svelte";

  let { data }: { data: { hasApps: boolean } } = $props();

  let name = $state("");
  let timezone = $state("UTC");
  let loading = $state(false);
  let error = $state("");

  const timezoneOptions = getSupportedTimezones();

  const submit = async () => {
    const normalizedTimezone = normalizeTimeZone(timezone);
    if (name.trim().length < 2) {
      error = "App name must be at least 2 characters.";
      return;
    }

    if (!normalizedTimezone) {
      error = "Choose a valid IANA timezone.";
      return;
    }

    loading = true;
    error = "";

    const result = await createAppCommand({
      name: name.trim(),
      defaultTimezone: normalizedTimezone,
    });

    if (result.success === false) {
      error = result.error;
      loading = false;
      return;
    }

    window.location.href = `/a/${result.data.id}`;
  };

  onMount(() => {
    const browserTimezone = normalizeTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    if (browserTimezone) {
      timezone = browserTimezone;
    }
  });
</script>

<div
  class="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10"
>
  <div class="w-full max-w-sm">
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
            <OrvoLogo class="size-12" />
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

            <Field>
              <FieldLabel for="app-timezone">Default timezone</FieldLabel>
              <Input
                id="app-timezone"
                bind:value={timezone}
                list="app-timezone-options"
                placeholder="UTC"
                required
              />
              <datalist id="app-timezone-options">
                {#each timezoneOptions as timezoneOption}
                  <option value={timezoneOption}></option>
                {/each}
              </datalist>
              <FieldDescription>
                Used when rendering timestamps for this app.
              </FieldDescription>
              <FieldError>
                {timezone.trim() && !normalizeTimeZone(timezone)
                  ? "Choose a valid IANA timezone."
                  : ""}
              </FieldError>
            </Field>
          </div>

          {#if error}
            <p class="text-sm text-destructive">{error}</p>
          {/if}

          <Button
            id="create-app-submit-button"
            type="submit"
            {loading}
            disabled={loading ||
              name.trim().length < 2 ||
              !normalizeTimeZone(timezone)}
            class="w-full"
          >
            Create app
          </Button>
        </FieldGroup>
      </form>
    </div>
  </div>
</div>
