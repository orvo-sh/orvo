<script lang="ts">
  import * as Sidebar from "@repo/components/ui/sidebar";
  import { onMount } from "svelte";
  import type { LayoutData } from "./$types";
  import { AppSidebar } from "./_components/app-sidebar";

  let {
    children,
    data,
  }: {
    children: import("svelte").Snippet;
    data: LayoutData;
  } = $props();

  onMount(() => {
    window.sey?.identify({
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      image: data.user.image ?? undefined,
    });
  });
</script>

<Sidebar.Provider class="h-dvh max-h-dvh overflow-hidden">
  <AppSidebar
    activeOrganizationId={data.activeOrganizationId}
    logViews={data.logViews}
    organizations={data.organizations}
    user={data.user}
  />
  <Sidebar.Inset class="h-full min-h-0 overflow-hidden">
    {@render children()}
  </Sidebar.Inset>
</Sidebar.Provider>
