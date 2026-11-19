<script lang="ts">
  import { resolve } from "$app/paths";
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { createDashboardCommand } from "$lib/api/dashboards.remote";
  import { Button } from "@repo/components/ui/button";
  import * as Dialog from "@repo/components/ui/dialog";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { Textarea } from "@repo/components/ui/textarea";
  import { toast } from "@repo/components/ui/sonner";
  let { open = $bindable(false) }: { open?: boolean } = $props();
  let name = $state("");
  let description = $state("");
  let saving = $state(false);
  $effect(() => {
    if (open) {
      name = "";
      description = "";
    }
  });
  const create = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    saving = true;
    try {
      const result = await createDashboardCommand({
        name,
        description,
        panels: [],
        timeRange: "last_hour",
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      open = false;
      await invalidateAll();
      await goto(
        resolve(`/a/${page.params.app_id}/dashboards/${result.data.id}?edit=1`),
      );
    } catch {
      toast.error("Failed to create dashboard.");
    } finally {
      saving = false;
    }
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header><Dialog.Title>New dashboard</Dialog.Title></Dialog.Header>
    <form onsubmit={create} class="space-y-4">
      <div class="space-y-2">
        <Label for="dashboard-name">Name</Label>
        <div class="flex items-center gap-2">
          <Input
            id="dashboard-name"
            bind:value={name}
            maxlength={120}
            required
            placeholder="Production health"
          />
        </div>
      </div>
      <div class="space-y-2">
        <Label for="dashboard-description"
          >Description <span class="font-normal text-muted-foreground"
            >(optional)</span
          ></Label
        ><Textarea
          id="dashboard-description"
          bind:value={description}
          maxlength={500}
          rows={2}
        />
      </div>
      <Dialog.Footer
        ><Button
          variant="outline"
          onclick={() => (open = false)}
          disabled={saving}>Cancel</Button
        ><Button
          id="create-dashboard-submit"
          type="submit"
          loading={saving}
          disabled={!name.trim()}>Create dashboard</Button
        ></Dialog.Footer
      >
    </form>
  </Dialog.Content>
</Dialog.Root>
