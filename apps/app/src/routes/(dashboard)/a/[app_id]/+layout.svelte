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
    <div class="flex h-dvh max-h-dvh w-full flex-col overflow-hidden">
      {#if data.mode === "cloud"}
        <TrialStatus
          bind:bannerVisible={trialBannerVisible}
          billingStatus={data.billingSummary?.billingStatus ?? null}
          hasPaymentMethod={data.billingSummary?.hasPaymentMethod ?? null}
          trialEnd={data.billingSummary?.trialEnd ?? null}
          billingHref={`/a/${data.currentApp.id}/settings/billing`}
        />
      {/if}
      <Sidebar.Provider class="h-full min-h-0 overflow-hidden">
        <AppSidebar
          activeOrganizationId={data.activeOrganizationId}
          billingSummary={data.billingSummary}
          organizations={data.organizations}
          user={data.user}
          mode={data.mode === "local" ? "local" : "cloud"}
          {trialBannerVisible}
        />
        <Sidebar.Inset class="flex h-full min-h-0 flex-col overflow-hidden">
          <div class="flex h-full min-h-0 min-w-0 flex-1">
            <div class="flex min-h-0 min-w-0 flex-1 flex-col">
              {@render children()}
            </div>
            {#if data.mode === "cloud"}
              <Chat.Rail />
            {/if}
          </div>
        </Sidebar.Inset>
        <RightRail.Host />
      </Sidebar.Provider>
    </div>
  </RightRail.Provider>
</Chat.Provider>
