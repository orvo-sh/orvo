<script lang="ts">
  import { page } from "$app/state";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import type { LayoutData } from "./$types";
  import AssistantSidebar from "./_components/assistant/assistant-sidebar.svelte";
  import { AppSidebar } from "./_components/app-sidebar";

  let {
    children,
    data,
  }: {
    children: import("svelte").Snippet;
    data: LayoutData;
  } = $props();
</script>

<Sidebar.Provider class="h-dvh max-h-dvh overflow-hidden">
  <AppSidebar
    level={page.params.app_id ? "app" : "organization"}
    activeOrganizationId={data.activeOrganizationId}
    organizations={data.organizations}
    user={data.user}
  />
  <Sidebar.Inset class="h-full min-h-0 overflow-hidden flex flex-row">
    <div class="flex-1 min-w-0 flex flex-col h-full min-h-0">
      {@render children()}
    </div>
    <AssistantSidebar
      appId={page.params.app_id}
      hidden={page.url.pathname.endsWith("/chat")}
    />
  </Sidebar.Inset>
</Sidebar.Provider>
