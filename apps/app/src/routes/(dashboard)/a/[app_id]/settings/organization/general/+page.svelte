<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { toast } from "@repo/components/ui/sonner";
  import { IconDeviceFloppy } from "@tabler/icons-svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let name = $state(data.currentOrganization?.name ?? "");
  let saving = $state(false);
  let error = $state("");

  const save = async () => {
    if (!data.currentOrganization) {
      error = "Organization not found.";
      return;
    }

    error = "";

    if (name.trim().length < 2) {
      error = "Organization name must be at least 2 characters.";
      return;
    }

    saving = true;

    const result = await authClient.organization.update({
      organizationId: data.currentOrganization.id,
      data: {
        name: name.trim(),
      },
    });

    if (result.error) {
      error = result.error.message || "Failed to update organization.";
      saving = false;
      return;
    }

    await invalidateAll();
    toast.success("Organization updated.");
    saving = false;
  };
</script>

<div class="flex w-full max-w-2xl flex-col gap-10">
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
