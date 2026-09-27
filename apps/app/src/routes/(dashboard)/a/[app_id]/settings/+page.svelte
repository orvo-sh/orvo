<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { updateAppCommand } from "$lib/api/apps.remote";
  import { MAX_UPLOAD_FILE_SIZE_BYTES } from "$lib/constants";
  import { uploadFile } from "$lib/upload-file";
  import {
    Avatar,
    AvatarFallback,
    AvatarImage,
  } from "@repo/components/ui/avatar";
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconBox,
    IconDeviceFloppy,
    IconUpload,
    IconX,
  } from "@tabler/icons-svelte";
  import { onDestroy } from "svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let appName = $state(data.currentApp?.name ?? "");
  let logo = $state<string | null>(data.currentApp?.logo ?? null);
  let logoPreviewUrl = $state<string | null>(null);
  let logoInput = $state<HTMLInputElement | null>(null);
  let uploadingLogo = $state(false);
  let saving = $state(false);
  let error = $state("");

  const revokeLogoPreviewUrl = () => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    logoPreviewUrl = null;
  };

  const clearLogo = () => {
    revokeLogoPreviewUrl();
    logo = null;
    error = "";
    if (logoInput) logoInput.value = "";
  };

  const handleLogoInput = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

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
      logo = await uploadFile(file);
    } catch (uploadError) {
      revokeLogoPreviewUrl();
      error =
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload app logo.";
    } finally {
      uploadingLogo = false;
      input.value = "";
    }
  };

  const save = async () => {
    if (!data.currentApp) {
      error = "App not found.";
      return;
    }

    error = "";

    if (uploadingLogo) {
      error = "Wait for the logo upload to finish.";
      return;
    }

    if (appName.trim().length < 2) {
      error = "App name must be at least 2 characters.";
      return;
    }

    saving = true;

    const result = await updateAppCommand({
      id: data.currentApp.id,
      name: appName.trim(),
      logo,
    });

    if (!result.success) {
      error = result.error;
      saving = false;
      return;
    }

    await invalidateAll();
    revokeLogoPreviewUrl();
    toast.success("App updated.");
    saving = false;
  };

  onDestroy(revokeLogoPreviewUrl);
</script>

<div class="flex w-full max-w-2xl flex-col gap-12">
  <section class="space-y-4">
    <div class="space-y-1">
      <Label class="text-base font-medium">App logo</Label>
      <p class="text-sm text-muted-foreground">
        Upload the logo shown in the app switcher.
      </p>
    </div>

    <div class="flex items-center gap-4">
      <Avatar class="size-16 rounded-lg border after:rounded-lg">
        <AvatarImage
          src={logoPreviewUrl ?? logo ?? undefined}
          alt={appName || "App logo"}
          class="rounded-lg object-cover"
        />
        <AvatarFallback class="rounded-lg">
          <IconBox class="size-5" />
        </AvatarFallback>
      </Avatar>

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
            {logo ? "Change logo" : "Upload logo"}
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
      onchange={(event) => void handleLogoInput(event)}
    />
  </section>

  <section class="space-y-4">
    <Label for="app-name" class="text-base font-medium">App name</Label>
    <Input
      id="app-name"
      bind:value={appName}
      minlength={2}
      maxlength={64}
      placeholder="App name"
    />

    <Button
      type="button"
      variant="outline"
      loading={saving}
      disabled={uploadingLogo}
      onclick={save}
    >
      <IconDeviceFloppy data-slot="button-icon" />
      Save
    </Button>

    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {/if}
  </section>
</div>
