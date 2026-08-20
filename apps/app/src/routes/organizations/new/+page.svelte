<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { MAX_UPLOAD_FILE_SIZE_BYTES } from "$lib/constants";
  import { uploadFile } from "$lib/upload-file";
  import { OrvoLogo } from "@repo/components/icons/orvo-logo";
  import * as Avatar from "@repo/components/ui/avatar";
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
  import { IconBuildingStore, IconUpload, IconX } from "@tabler/icons-svelte";
  import { onDestroy } from "svelte";

  let name = $state("");
  let logo = $state<string | null>(null);
  let logoPreviewUrl = $state<string | null>(null);
  let logoInput = $state<HTMLInputElement | null>(null);
  let loading = $state(false);
  let uploadingLogo = $state(false);
  let error = $state("");
  let logoError = $state("");

  const revokeLogoPreviewUrl = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    logoPreviewUrl = null;
  };

  const clearLogo = () => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    logoPreviewUrl = null;
    logo = null;
    logoError = "";

    if (logoInput) {
      logoInput.value = "";
    }
  };

  const uploadLogo = async (file: File) => {
    logo = await uploadFile(file);
    return true;
  };

  const handleLogoInput = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

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
      const uploaded = await uploadLogo(file);
      if (!uploaded) {
        revokeLogoPreviewUrl();
        logo = null;
      }
    } catch (uploadError) {
      revokeLogoPreviewUrl();
      logo = null;
      logoError =
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload logo.";
    } finally {
      uploadingLogo = false;
      input.value = "";
    }
  };

  const submit = async () => {
    if (name.trim().length < 2) {
      error = "Organization name must be at least 2 characters.";
      return;
    }

    if (uploadingLogo) {
      error = "Wait for the logo upload to finish.";
      return;
    }

    loading = true;
    error = "";

    const result = await authClient.organization.create({
      name: name.trim(),
      slug: `${slugify(name.trim())}-${generateRandomString(6)}`,
      logo: logo ?? undefined,
    });

    if (result.error) {
      error = result.error.message || "Failed to create organization";
      loading = false;
      return;
    }

    await authClient.organization.setActive(
      { organizationId: result.data.id },
      {
        onSuccess: () => {
          window.location.href = "/organizations/plan";
        },
        onError: (ctx) => {
          error = ctx.error.message;
          loading = false;
        },
      },
    );
  };

  onDestroy(() => {
    revokeLogoPreviewUrl();
  });
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
              <FieldLabel>Organization logo</FieldLabel>
              <div class="flex items-center gap-4">
                <Avatar.Root class="size-16 rounded-sm border after:hidden">
                  <Avatar.Image
                    src={logoPreviewUrl ?? logo ?? undefined}
                    alt={name.trim() || "Organization logo"}
                    class="rounded-sm object-cover"
                  />
                  <Avatar.Fallback class="rounded-sm">
                    <IconBuildingStore />
                  </Avatar.Fallback>
                </Avatar.Root>

                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2">
                    <Button
                      id="upload-organization-logo-button"
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
                        id="remove-organization-logo-button"
                        type="button"
                        variant="ghost"
                        disabled={loading || uploadingLogo}
                        onclick={clearLogo}
                      >
                        <IconX data-slot="button-icon" />
                        Remove
                      </Button>
                    {/if}
                  </div>
                  <FieldDescription class="text-sm">
                    PNG, JPG, GIF, SVG, or WebP up to 10 MB.
                  </FieldDescription>
                </div>
              </div>

              <input
                bind:this={logoInput}
                type="file"
                accept="image/*"
                class="hidden"
                onchange={(event) => {
                  void handleLogoInput(event);
                }}
              />
              <FieldError>{logoError}</FieldError>
            </Field>
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
              disabled={loading || uploadingLogo || name.trim().length < 2}
              class="w-full"
            >
              Create organization
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  </div>
</div>
