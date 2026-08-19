<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { createProfileImageUploadUrlCommand } from "$lib/api/account.remote";
  import { authClient } from "$lib/auth-client";
  import { MAX_UPLOAD_FILE_SIZE_BYTES } from "$lib/constants";
  import { GitHubIcon } from "@repo/components/icons/github";
  import * as Avatar from "@repo/components/ui/avatar";
  import { Button } from "@repo/components/ui/button";
  import * as Dialog from "@repo/components/ui/dialog";
  import { Input } from "@repo/components/ui/input";
  import * as InputGroup from "@repo/components/ui/input-group";
  import { Label } from "@repo/components/ui/label";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconDeviceFloppy,
    IconEye,
    IconEyeOff,
    IconTrash,
    IconUpload,
    IconUser,
    IconX,
  } from "@tabler/icons-svelte";
  import { onDestroy } from "svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let name = $state(data.user.name);
  let profileImage = $state<string | null>(data.user.image ?? null);
  let profileImagePreviewUrl = $state<string | null>(null);
  let profileImageInput = $state<HTMLInputElement | null>(null);
  let uploadingImage = $state(false);
  let savingProfile = $state(false);
  let profileError = $state("");

  let currentPassword = $state("");
  let newPassword = $state("");
  let savingPassword = $state(false);
  let passwordError = $state("");
  let showCurrentPassword = $state(false);
  let showNewPassword = $state(false);

  let deleteDialogOpen = $state(false);
  let deleteConfirmation = $state("");
  let deletingAccount = $state(false);
  let deleteError = $state("");

  const linkedAccounts = $derived(
    data.accounts.filter((account) => account.providerId !== "credential"),
  );

  const revokeProfileImagePreviewUrl = () => {
    if (profileImagePreviewUrl) {
      URL.revokeObjectURL(profileImagePreviewUrl);
      profileImagePreviewUrl = null;
    }
  };

  const getInitials = (value: string) =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

  const resetProfileImageInput = () => {
    if (profileImageInput) {
      profileImageInput.value = "";
    }
  };

  const uploadProfileImage = async (file: File) => {
    const uploadUrlResult = await createProfileImageUploadUrlCommand({
      contentType: file.type,
      fileSizeBytes: file.size,
    });

    if (uploadUrlResult.success === false) {
      profileError = uploadUrlResult.error;
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
      profileError = `Profile image upload failed with status ${uploadResponse.status}.`;
      return false;
    }

    profileImage = uploadUrlResult.data.url;
    return true;
  };

  const handleProfileImageInput = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    profileError = "";

    if (!file.type.startsWith("image/")) {
      profileError = "Please upload an image file.";
      resetProfileImageInput();
      return;
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      profileError = "Please upload an image smaller than 10 MB.";
      resetProfileImageInput();
      return;
    }

    revokeProfileImagePreviewUrl();
    profileImagePreviewUrl = URL.createObjectURL(file);
    uploadingImage = true;

    try {
      const uploaded = await uploadProfileImage(file);
      if (!uploaded) {
        revokeProfileImagePreviewUrl();
      }
    } catch (uploadError) {
      revokeProfileImagePreviewUrl();
      profileError =
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload profile image.";
    } finally {
      uploadingImage = false;
      resetProfileImageInput();
    }
  };

  const clearProfileImage = () => {
    revokeProfileImagePreviewUrl();
    profileImage = null;
    profileError = "";
    resetProfileImageInput();
  };

  const saveProfile = async () => {
    profileError = "";

    if (uploadingImage) {
      profileError = "Wait for the image upload to finish.";
      return;
    }

    if (name.trim().length < 2) {
      profileError = "Your name must be at least 2 characters.";
      return;
    }

    savingProfile = true;

    const result = await authClient.updateUser({
      name: name.trim(),
      image: profileImage,
    });

    if (result.error) {
      profileError = result.error.message || "Failed to update your profile.";
      savingProfile = false;
      return;
    }

    revokeProfileImagePreviewUrl();
    await invalidateAll();
    toast.success("Profile updated.");
    savingProfile = false;
  };

  const savePassword = async () => {
    passwordError = "";

    if (newPassword.length < 8) {
      passwordError = "Your new password must be at least 8 characters.";
      return;
    }

    if (data.hasPassword && currentPassword.length === 0) {
      passwordError = "Enter your current password.";
      return;
    }

    savingPassword = true;

    const result = data.hasPassword
      ? await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        })
      : await authClient.$fetch("/set-password", {
          method: "POST",
          body: {
            newPassword,
          },
        });

    if (result.error) {
      passwordError = result.error.message || "Failed to update your password.";
      savingPassword = false;
      return;
    }

    currentPassword = "";
    newPassword = "";
    toast.success(data.hasPassword ? "Password updated." : "Password created.");
    savingPassword = false;
  };

  const deleteAccount = async () => {
    deleteError = "";

    if (
      deleteConfirmation.trim().toLowerCase() !== data.user.email.toLowerCase()
    ) {
      deleteError = "Type your email exactly to confirm.";
      return;
    }

    deletingAccount = true;

    const result = await authClient.deleteUser({});

    if (result.error) {
      deleteError = result.error.message || "Failed to delete your account.";
      deletingAccount = false;
      return;
    }

    await goto("/sign-in");
  };

  onDestroy(() => {
    revokeProfileImagePreviewUrl();
  });
</script>

<div class="flex w-full max-w-2xl flex-col gap-12">
  {#if data.mode === "cloud"}
    <section class="space-y-4">
      <div class="space-y-1">
        <Label class="text-base font-medium">Profile image</Label>
        <p class="text-sm text-muted-foreground">
          Upload a profile image shown across your account and organization
          memberships.
        </p>
      </div>

      <div class="flex items-center gap-4">
        <Avatar.Root class="size-16 border after:hidden">
          <Avatar.Image
            src={profileImagePreviewUrl ?? profileImage ?? undefined}
            alt={name}
            class="object-cover"
          />
          <Avatar.Fallback id={data.user.id}>
            {#if name.trim()}
              {getInitials(name)}
            {:else}
              <IconUser class="size-5" />
            {/if}
          </Avatar.Fallback>
        </Avatar.Root>

        <div class="space-y-2">
          <div class="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              loading={uploadingImage}
              disabled={savingProfile}
              onclick={() => profileImageInput?.click()}
            >
              <IconUpload data-slot="button-icon" />
              {profileImage ? "Change image" : "Upload image"}
            </Button>

            {#if profileImage || profileImagePreviewUrl}
              <Button
                type="button"
                variant="ghost"
                disabled={uploadingImage || savingProfile}
                onclick={clearProfileImage}
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
        bind:this={profileImageInput}
        type="file"
        accept="image/*"
        class="hidden"
        onchange={(event) => {
          void handleProfileImageInput(event);
        }}
      />
    </section>
  {/if}

  <section class="space-y-4">
    <Label for="profile-name" class="text-base font-medium">Your name</Label>
    <Input
      id="profile-name"
      bind:value={name}
      minlength={2}
      maxlength={64}
      placeholder="Your name"
    />

    <Button
      type="button"
      variant="outline"
      loading={savingProfile}
      onclick={saveProfile}
    >
      <IconDeviceFloppy data-slot="button-icon" />
      Save
    </Button>

    {#if profileError}
      <p class="text-sm text-destructive">{profileError}</p>
    {/if}
  </section>

  <section class="space-y-4">
    <Label for="profile-email" class="text-base font-medium">Your email</Label>
    <Input id="profile-email" value={data.user.email} disabled />

    <p class="text-sm text-muted-foreground">You can't change your email.</p>
  </section>

  <section class="space-y-4">
    <div class="space-y-1">
      <h2 class="text-base font-medium">Password</h2>
      <p class="text-sm text-muted-foreground">
        {data.hasPassword
          ? "Update your password for email and password sign-in."
          : "Set a password so you can sign in without a linked provider."}
      </p>
    </div>

    {#if data.hasPassword}
      <div class="space-y-2">
        <Label for="current-password">Current password</Label>
        <InputGroup.Root>
          <InputGroup.Input
            id="current-password"
            data-slot="input-group-control"
            type={showCurrentPassword ? "text" : "password"}
            bind:value={currentPassword}
            placeholder="Current password"
          />
          <InputGroup.Button
            type="button"
            onclick={() => {
              showCurrentPassword = !showCurrentPassword;
            }}
          >
            {#if showCurrentPassword}
              <IconEyeOff />
            {:else}
              <IconEye />
            {/if}
          </InputGroup.Button>
        </InputGroup.Root>
      </div>
    {/if}

    <div class="space-y-2">
      <Label for="new-password"
        >{data.hasPassword ? "New password" : "Password"}</Label
      >
      <InputGroup.Root>
        <InputGroup.Input
          id="new-password"
          data-slot="input-group-control"
          type={showNewPassword ? "text" : "password"}
          bind:value={newPassword}
          placeholder={data.hasPassword ? "New password" : "Create a password"}
        />
        <InputGroup.Button
          type="button"
          onclick={() => {
            showNewPassword = !showNewPassword;
          }}
        >
          {#if showNewPassword}
            <IconEyeOff />
          {:else}
            <IconEye />
          {/if}
        </InputGroup.Button>
      </InputGroup.Root>
    </div>

    <Button
      type="button"
      variant="outline"
      loading={savingPassword}
      onclick={savePassword}
    >
      <IconDeviceFloppy data-slot="button-icon" />
      Save
    </Button>

    {#if passwordError}
      <p class="text-sm text-destructive">{passwordError}</p>
    {/if}
  </section>

  {#if data.mode === "cloud"}
    <section class="space-y-4">
      <h2 class="text-base font-medium">Linked accounts</h2>

      {#if linkedAccounts.length > 0}
        <div class="space-y-3">
          {#each linkedAccounts as account (account.id)}
            <div
              class="flex items-center gap-3 rounded-lg border border-input bg-background px-4 py-3"
            >
              {#if account.providerId === "github"}
                <GitHubIcon class="size-5" />
                <span class="text-sm font-medium">GitHub account linked</span>
              {:else}
                <span class="text-sm font-medium capitalize">
                  {account.providerId} account linked
                </span>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div
          class="rounded-lg border border-input bg-background px-4 py-3 text-sm text-muted-foreground"
        >
          No linked social accounts.
        </div>
      {/if}
    </section>

    <section class="space-y-4">
      <div class="space-y-1">
        <h2 class="text-base font-medium">Delete account</h2>
        <p class="text-sm text-muted-foreground">
          Permanently remove your user account and any organizations that only
          you belong to.
        </p>
      </div>

      <Button
        type="button"
        variant="destructive"
        onclick={() => (deleteDialogOpen = true)}
      >
        <IconTrash data-slot="button-icon" />
        Delete account
      </Button>
    </section>
  {/if}
</div>

{#if data.mode === "cloud"}
  <Dialog.Root bind:open={deleteDialogOpen}>
    <Dialog.Content class="sm:max-w-lg">
      <Dialog.Header>
        <Dialog.Title>Delete account?</Dialog.Title>
        <Dialog.Description class="space-y-3 text-left leading-6">
          <p>
            This action can't be undone. If you delete your account, any
            organizations that you are the only member of will also be deleted.
            You'll lose your entire billing history, as well as the projects
            within those organizations and all of their associated data. Are you
            sure?
          </p>
          <p>
            If you’d like to delete this account, type {data.user.email} below to
            confirm.
          </p>
        </Dialog.Description>
      </Dialog.Header>

      <div class="space-y-3">
        <Input
          bind:value={deleteConfirmation}
          placeholder={data.user.email}
          aria-label="Confirm account deletion by typing your email"
        />

        {#if deleteError}
          <p class="text-sm text-destructive">{deleteError}</p>
        {/if}
      </div>

      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          onclick={() => (deleteDialogOpen = false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          loading={deletingAccount}
          onclick={deleteAccount}
        >
          <IconTrash data-slot="button-icon" />
          Delete account
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
