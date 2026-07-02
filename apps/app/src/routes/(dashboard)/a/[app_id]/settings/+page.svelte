<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { updateAppCommand } from "$lib/api/apps.remote";
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { toast } from "@repo/components/ui/sonner";
  import { IconDeviceFloppy } from "@tabler/icons-svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let appName = $state(data.currentApp?.name ?? "");
  let saving = $state(false);
  let error = $state("");

  const save = async () => {
    if (!data.currentApp) {
      error = "App not found.";
      return;
    }

    error = "";

    if (appName.trim().length < 2) {
      error = "Project name must be at least 2 characters.";
      return;
    }

    saving = true;

    const result = await updateAppCommand({
      id: data.currentApp.id,
      name: appName.trim(),
    });

    if (!result.success) {
      error = result.error;
      saving = false;
      return;
    }

    await invalidateAll();
    toast.success("Project updated.");
    saving = false;
  };
</script>

<div class="flex w-full max-w-2xl flex-col gap-10">
  <section class="space-y-4">
    <Label for="project-name" class="text-base font-medium">Project name</Label>
    <Input
      id="project-name"
      bind:value={appName}
      minlength={2}
      maxlength={64}
      placeholder="Project name"
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
