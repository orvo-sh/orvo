<script lang="ts">
  import { seedOrganizationActivation } from "$lib/stores/organization-activation.svelte";
  import { page } from "$app/state";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import type { LayoutData } from "./$types";
  import AssistantSidebar from "./_components/assistant/assistant-sidebar.svelte";
  import { AppSidebar } from "./_components/app-sidebar";
  import OrganizationActivationPill from "./_components/organization-activation-pill.svelte";

  let {
    children,
    data,
  }: {
    children: import("svelte").Snippet;
    data: LayoutData;
  } = $props();

  $effect(() => {
    seedOrganizationActivation(
      data.activeOrganizationId,
      data.organizationActivation ?? null,
    );
  });
</script>

<Sidebar.Provider class="h-dvh max-h-dvh overflow-hidden">
  <AppSidebar
    level={page.params.app_id ? "app" : "organization"}
    activeOrganizationId={data.activeOrganizationId}
    organizations={data.organizations}
    user={data.user}
  />
  <Sidebar.Inset class="flex h-full min-h-0 flex-row overflow-hidden">
    <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {@render children()}
    </div>
    <AssistantSidebar
      appId={page.params.app_id}
      hidden={page.url.pathname.endsWith("/chat")}
    />
  </Sidebar.Inset>

  {#if data.organizationActivation}
    <OrganizationActivationPill
      organizationId={data.activeOrganizationId}
      initialOpen={data.organizationActivationOpen}
    />
  {/if}
</Sidebar.Provider>
