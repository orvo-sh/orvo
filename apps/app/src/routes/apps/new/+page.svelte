<script lang="ts">
  import { replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { createAppCommand } from "$lib/api/apps.remote";
  import { MAX_UPLOAD_FILE_SIZE_BYTES } from "$lib/constants";
  import { uploadFile } from "$lib/upload-file";
  import { OrvoLogo } from "@repo/components/icons/orvo-logo";
  import {
    Avatar,
    AvatarFallback,
    AvatarImage,
  } from "@repo/components/ui/avatar";
  import { Button } from "@repo/components/ui/button";
  import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
  } from "@repo/components/ui/field";
  import { Input } from "@repo/components/ui/input";
  import { toast } from "@repo/components/ui/sonner";
  import { IconBox, IconUpload, IconX } from "@tabler/icons-svelte";
  import { onDestroy, onMount } from "svelte";

  let { data } = $props();

  let name = $state("");
  let logo = $state<string | null>(null);
  let logoPreviewUrl = $state<string | null>(null);
  let logoInput = $state<HTMLInputElement | null>(null);
  let loading = $state(false);
  let uploadingLogo = $state(false);
  let error = $state("");
  let logoError = $state("");

  const revokeLogoPreviewUrl = () => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    logoPreviewUrl = null;
  };

  const clearLogo = () => {
    revokeLogoPreviewUrl();
    logo = null;
    logoError = "";
    if (logoInput) logoInput.value = "";
  };

  const handleLogoInput = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    error = "";
    logoError = "";

    if (!file.type.startsWith("image/")) {
      logoError = "Please upload an image file.";
      input.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      logoError = "Please upload an image smaller than 10 MB.";
      input.value = "";
      return;
    }

    revokeLogoPreviewUrl();
    logoPreviewUrl = URL.createObjectURL(file);
    uploadingLogo = true;

    try {
      logo = await uploadFile(file);
    } catch (uploadError) {
      revokeLogoPreviewUrl();
      logo = null;
      logoError =
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload app logo.";
    } finally {
      uploadingLogo = false;
      input.value = "";
    }
  };

  onMount(() => {
    if (!data.trialStarted) return;

    toast.success("We've started your 14-day Orvo Pro trial.");
    replaceState(resolve("/apps/new"), {});
  });

  onDestroy(revokeLogoPreviewUrl);

  const submit = async () => {
    if (name.trim().length < 2) {
      error = "App name must be at least 2 characters.";
      return;
    }

    if (uploadingLogo) {
      error = "Wait for the logo upload to finish.";
      return;
    }

    loading = true;
    error = "";

    const result = await createAppCommand({
      name: name.trim(),
      logo: logo ?? undefined,
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
              <FieldLabel>App logo</FieldLabel>
              <div class="flex items-center gap-4">
                <Avatar class="size-16 rounded-lg border after:rounded-lg">
                  <AvatarImage
                    src={logoPreviewUrl ?? logo ?? undefined}
                    alt={name.trim() || "App logo"}
                    class="rounded-lg object-cover"
                  />
                  <AvatarFallback class="rounded-lg">
                    <IconBox class="size-5" />
                  </AvatarFallback>
                </Avatar>

                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2">
                    <Button
                      id="upload-app-logo-button"
                      type="button"
                      variant="outline"
                      loading={uploadingLogo}
                      disabled={loading}
                      onclick={() => logoInput?.click()}
                    >
                      <IconUpload data-slot="button-icon" />
                      {logo ? "Change logo" : "Upload logo"}
                    </Button>

                    {#if (logo || logoPreviewUrl) && !uploadingLogo}
                      <Button
                        id="remove-app-logo-button"
                        type="button"
                        variant="ghost"
                        disabled={loading}
                        onclick={clearLogo}
                      >
                        <IconX data-slot="button-icon" />
                        Remove
                      </Button>
                    {/if}
                  </div>
                  <FieldDescription>
                    PNG, JPG, GIF, SVG, or WebP up to 10 MB.
                  </FieldDescription>
                </div>
              </div>

              <input
                bind:this={logoInput}
                type="file"
                accept="image/*"
                class="hidden"
                onchange={(event) => void handleLogoInput(event)}
              />
              <FieldError>{logoError}</FieldError>
            </Field>
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
            disabled={loading || uploadingLogo || name.trim().length < 2}
            class="w-full"
          >
            Create app
          </Button>
        </FieldGroup>
      </form>
    </div>
  </div>
</div>
