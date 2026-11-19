<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { createAlertRuleDraftCommand } from "$lib/api/alert-rules.remote";
  import { Button } from "@repo/components/ui/button";
  import { onMount } from "svelte";
  import PageContainer from "../../_components/page-container/page-container.svelte";

  let loading = $state(false);
  let error = $state("");
  const createDraft = async () => {
    if (loading) return;
    loading = true;
    error = "";
    try {
      const result = await createAlertRuleDraftCommand();
      if (!result.success) {
        error = result.error;
        return;
      }
      await goto(
        `/a/${page.params.app_id}/alerts/${result.data.id}${page.url.search}`,
        { replaceState: true, state: { newAlertRule: true } },
      );
    } catch {
      error = "Failed to create alert rule draft.";
    } finally {
      loading = false;
    }
  };
  onMount(() => {
    void createDraft();
  });
</script>

<PageContainer
  title="New alert rule"
  back={{ href: `/a/${page.params.app_id}/alerts`, title: "Alerts" }}
>
  {#if error}
    <div class="p-3">
      <p class="mb-3 text-sm text-destructive" role="alert">{error}</p>
      <Button onclick={createDraft} {loading}>Try again</Button>
    </div>
  {/if}
</PageContainer>
