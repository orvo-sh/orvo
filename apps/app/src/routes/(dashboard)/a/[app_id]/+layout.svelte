<script lang="ts">
  import * as Chat from "$lib/chat";
  import * as RightRail from "$lib/right-rail";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import type { LayoutData } from "./$types";
  import { AppSidebar } from "./_components/app-sidebar";

  let {
    children,
    data,
  }: {
    children: import("svelte").Snippet;
    data: LayoutData;
  } = $props();
</script>

<Chat.Provider appId={data.currentApp.id}>
  <RightRail.Provider>
    <Sidebar.Provider class="h-dvh max-h-dvh overflow-hidden">
      <AppSidebar
        activeOrganizationId={data.activeOrganizationId}
        billingSummary={data.billingSummary}
        organizations={data.organizations}
        user={data.user}
      />
      <Sidebar.Inset class="flex h-full min-h-0 flex-col overflow-hidden">
        <div class="flex h-full min-h-0 min-w-0 flex-1">
          <div class="flex min-h-0 min-w-0 flex-1 flex-col">
            {@render children()}
          </div>
          <Chat.Rail />
        </div>
      </Sidebar.Inset>
      <RightRail.Host />
    </Sidebar.Provider>
  </RightRail.Provider>
</Chat.Provider>
