<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { createOrganizationLogoUploadUrlCommand } from "$lib/api/organizations.remote";
  import { authClient } from "$lib/auth-client";
  import { MAX_UPLOAD_FILE_SIZE_BYTES } from "$lib/constants";
  import * as Avatar from "@repo/components/ui/avatar";
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconBuilding,
    IconDeviceFloppy,
    IconUpload,
    IconX,
  } from "@tabler/icons-svelte";
  import { onDestroy } from "svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let name = $state(data.currentOrganization?.name ?? "");
  let logo = $state<string | null>(data.currentOrganization?.logo ?? null);
  let logoPreviewUrl = $state<string | null>(null);
  let logoInput = $state<HTMLInputElement | null>(null);
  let uploadingLogo = $state(false);
  let saving = $state(false);
  let error = $state("");

  const revokeLogoPreviewUrl = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
      logoPreviewUrl = null;
    }
  };

  const getInitials = (value: string) =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

  const uploadLogo = async (file: File) => {
    const uploadUrlResult = await createOrganizationLogoUploadUrlCommand({
      contentType: file.type,
      fileSizeBytes: file.size,
    });

    if (!uploadUrlResult.success) {
      error = uploadUrlResult.error;
      return false;
    }

    const uploadResponse = await fetch(uploadUrlResult.data.presignedUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    if (!uploadResponse.ok) {
      error = `Logo upload failed with status ${uploadResponse.status}.`;
      return false;
    }

    logo = uploadUrlResult.data.url;
    return true;
  };

  const handleLogoInput = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    error = "";

    if (!file.type.startsWith("image/")) {
      error = "Please upload an image file.";
      input.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      error = "Please upload an image smaller than 10 MB.";
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
      }
    } finally {
      uploadingLogo = false;
      input.value = "";
    }
  };

  const clearLogo = () => {
    revokeLogoPreviewUrl();
    logo = null;
    error = "";
    if (logoInput) {
      logoInput.value = "";
    }
  };

  const save = async () => {
    if (!data.currentOrganization) {
      error = "Organization not found.";
      return;
    }

    error = "";

    if (uploadingLogo) {
      error = "Wait for the image upload to finish.";
      return;
    }

    if (name.trim().length < 2) {
      error = "Organization name must be at least 2 characters.";
      return;
    }

    saving = true;

    const result = await authClient.organization.update({
      organizationId: data.currentOrganization.id,
      data: {
        name: name.trim(),
        logo,
      },
    });

    if (result.error) {
      error = result.error.message || "Failed to update organization.";
      saving = false;
      return;
    }

    revokeLogoPreviewUrl();
    await invalidateAll();
    toast.success("Organization updated.");
    saving = false;
  };

  onDestroy(() => {
    revokeLogoPreviewUrl();
  });
</script>

<div class="flex w-full max-w-2xl flex-col gap-12">
  <section class="space-y-4">
    <div class="space-y-1">
      <Label class="text-base font-medium">Organization image</Label>
      <p class="text-sm text-muted-foreground">
        Upload the image shown in the sidebar and organization switcher.
      </p>
    </div>

    <div class="flex items-center gap-4">
      <Avatar.Root class="size-16 border after:hidden">
        <Avatar.Image
          src={logoPreviewUrl ?? logo ?? undefined}
          alt={name}
          class="object-cover"
        />
        <Avatar.Fallback id={data.currentOrganization?.id ?? "organization"}>
          {#if name.trim()}
            {getInitials(name)}
          {:else}
            <IconBuilding class="size-5" />
          {/if}
        </Avatar.Fallback>
      </Avatar.Root>

      <div class="space-y-2">
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            loading={uploadingLogo}
            disabled={saving}
            onclick={() => logoInput?.click()}
          >
            <IconUpload data-slot="button-icon" />
            {logo ? "Change image" : "Upload image"}
          </Button>

          {#if logo || logoPreviewUrl}
            <Button
              type="button"
              variant="ghost"
              disabled={uploadingLogo || saving}
              onclick={clearLogo}
            >
              <IconX data-slot="button-icon" />
              Remove
            </Button>
          {/if}
        </div>

        <p class="text-sm text-muted-foreground">
          PNG, JPG, GIF, SVG, or WebP up to 10 MB.
        </p>
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
  </section>

  <section class="space-y-4">
    <Label for="organization-name" class="text-base font-medium">
      Organization name
    </Label>
    <Input
      id="organization-name"
      bind:value={name}
      minlength={2}
      maxlength={64}
      placeholder="Organization name"
    />

    <Button type="button" variant="outline" loading={saving} onclick={save}>
      <IconDeviceFloppy data-slot="button-icon" />
      Save
    </Button>

    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {/if}
  </section>
</div>
