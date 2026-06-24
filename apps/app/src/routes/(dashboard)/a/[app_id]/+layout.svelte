<script lang="ts">
  import * as RightRail from "$lib/right-rail";
  import { seedOrganizationActivation } from "$lib/stores/organization-activation.svelte";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import type { LayoutData } from "./$types";
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
      </div>
    </Sidebar.Inset>
    <RightRail.Host />
    {#if data.organizationActivation}
      <OrganizationActivationPill
        organizationId={data.activeOrganizationId}
        initialOpen={data.organizationActivationOpen}
      />
    {/if}
  </Sidebar.Provider>
</RightRail.Provider>
