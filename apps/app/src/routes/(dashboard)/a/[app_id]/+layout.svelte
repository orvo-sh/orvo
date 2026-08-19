<script lang="ts">
  import * as Chat from "$lib/chat";
  import * as RightRail from "$lib/right-rail";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import type { LayoutData } from "./$types";
  import { AppSidebar } from "./_components/app-sidebar";
  import TrialStatus from "./_components/trial-status.svelte";

  let {
    children,
    data,
  }: {
    children: import("svelte").Snippet;
    data: LayoutData;
  } = $props();

  let trialBannerVisible = $state(false);
</script>

<Chat.Provider appId={data.currentApp.id}>
  <RightRail.Provider>
    <div class="flex h-dvh w-full max-h-dvh flex-col overflow-hidden">
      <TrialStatus
        bind:bannerVisible={trialBannerVisible}
        billingStatus={data.billingSummary?.billingStatus ?? null}
        trialEnd={data.billingSummary?.trialEnd ?? null}
        billingHref={`/a/${data.currentApp.id}/settings/billing`}
      />
      <Sidebar.Provider class="h-full min-h-0 overflow-hidden">
        <AppSidebar
          activeOrganizationId={data.activeOrganizationId}
          billingSummary={data.billingSummary}
          organizations={data.organizations}
          user={data.user}
          {trialBannerVisible}
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
    </div>
  </RightRail.Provider>
</Chat.Provider>
