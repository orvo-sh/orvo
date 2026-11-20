<script lang="ts">
  import { page } from "$app/state";
  import { cn } from "@repo/components";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import {
    IconBook2 as BookOpenTextIcon,
    IconSettings as GearSixIcon,
    IconCaretRightFilled,
  } from "@tabler/icons-svelte";

  import { generateAppNavigationGroups } from "./app-sidebar-naviagation-groups";
  import AppSidebarOrganizationSwitcher from "./app-sidebar-organization-switcher.svelte";
  import AppSidebarTrialCard from "./app-sidebar-trial-card.svelte";
  import AppSidebarUsageCard from "./app-sidebar-usage-card.svelte";
  import AppSidebarUserNav from "./app-sidebar-user-nav.svelte";

  let {
    organizations,
    activeOrganizationId,
    user,
    billingSummary,
    trialBannerVisible = false,
    footerOnly = false,
    settingsAppId,
  }: {
    organizations: {
      id: string;
      name: string;
    }[];
    activeOrganizationId?: string;
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
    };
    billingSummary: {
      billingPlan: string | null;
      billingStatus: string | null;
      trialStart: Date | string | null;
      trialEnd: Date | string | null;
      includedBytes: number;
      usedBytes: number;
      logsIngestedBytes: number;
      metricsIngestedBytes: number;
      tracesIngestedBytes: number;
      chatUsage: {
        includedCredits: number;
        usedCredits: number;
        remainingCredits: number;
      } | null;
      usagePercent: number;
    } | null;
    trialBannerVisible?: boolean;
    footerOnly?: boolean;
    settingsAppId?: string;
  } = $props();

  type DashboardPageData = {
    currentApp?: {
      id: string;
    };
  };

  const sidebar = Sidebar.useSidebar();

  const currentAppId = $derived(
    (page.data as DashboardPageData | undefined)?.currentApp?.id ?? "",
  );

  const navigationGroups = $derived(
    currentAppId
      ? generateAppNavigationGroups(currentAppId, page.data.dashboards ?? [])
      : [],
  );
  const settingsHref = $derived(
    footerOnly
      ? settingsAppId && `/a/${settingsAppId}/settings`
      : currentAppId
        ? `/a/${currentAppId}/settings`
        : "/settings",
  );

  let collapsedGroups = $state<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    collapsedGroups = {
      ...collapsedGroups,
      [label]: !collapsedGroups[label],
    };
  };
</script>

<Sidebar.Root
  collapsible="offcanvas"
  class={cn(
    "border-e border-sidebar-border/80 bg-sidebar",
    trialBannerVisible && "md:top-10 md:h-[calc(100svh-2.5rem)]",
  )}
>
  <Sidebar.Header
    class="h-14 justify-center gap-0 border-b border-sidebar-border/80 px-1.5 py-3"
  >
    <AppSidebarOrganizationSwitcher
      {organizations}
      {activeOrganizationId}
      redirectTo={footerOnly ? "/apps/new" : undefined}
    />
  </Sidebar.Header>

  <Sidebar.Content class="gap-1 py-2">
    {#each footerOnly ? [] : navigationGroups as group (group.label)}
      <Sidebar.Group class="py-0!">
        {#if group.label}
          <Sidebar.GroupLabel>
            {#snippet child({ props }: any)}
              <button
                type="button"
                {...props}
                class={cn(
                  (props.class as string | undefined) ?? "",
                  "w-full justify-between pr-3",
                )}
                aria-expanded={!collapsedGroups[group.label]}
                onclick={() => toggleGroup(group.label)}
              >
                <span>{group.label}</span>
                <IconCaretRightFilled
                  class={cn(
                    "size-3.5! opacity-70 transition-transform",
                    collapsedGroups[group.label] ? "" : "rotate-90",
                  )}
                />
              </button>
            {/snippet}
          </Sidebar.GroupLabel>
        {/if}
        <Sidebar.GroupContent
          class={group.label && collapsedGroups[group.label] ? "hidden" : ""}
        >
          <Sidebar.Menu class="gap-0.5">
            {#each group.items as item (item.href)}
              <Sidebar.MenuItem>
                {@const Icon = item.icon}
                {@const href = item.href}
                {@const isActive =
                  item.label === "Dashboards"
                    ? page.url.pathname === href
                    : page.url.pathname.includes(href)}
                <Sidebar.MenuButton
                  class="group/menu-btn relative gap-2.5 overflow-visible"
                  {isActive}
                  tooltipContent={item.label}
                >
                  {#snippet child({ props })}
                    <a
                      {href}
                      {...props}
                      onclick={() => {
                        if (sidebar.isMobile) sidebar.setOpenMobile(false);
                      }}
                    >
                      {#if isActive}
                        <span
                          class="absolute -left-2 h-4 w-1 rounded-r-md bg-primary/80"
                        >
                        </span>
                      {/if}
                      <Icon class="opacity-80" />
                      <span>{item.label}</span>
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>

                {#if item.submenu && item.submenu.length > 0}
                  <Sidebar.MenuSub class="mr-0 ml-4 pr-0">
                    {#each item.submenu as subitem (subitem.href)}
                      {@const isSubitemActive =
                        page.url.pathname === subitem.href ||
                        page.url.pathname.startsWith(`${subitem.href}/`)}
                      <Sidebar.MenuSubItem>
                        {#if isSubitemActive}
                          <span
                            aria-hidden="true"
                            class="absolute top-1/2 -left-9 h-4 w-1 -translate-y-1/2 rounded-r-md bg-primary/80"
                          ></span>
                        {/if}
                        <Sidebar.MenuSubButton
                          class="h-8 w-full"
                          isActive={isSubitemActive}
                        >
                          {#snippet child({ props }: any)}
                            <a href={subitem.href} {...props}>
                              <span class="truncate">{subitem.label}</span>
                            </a>
                          {/snippet}
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                    {/each}
                  </Sidebar.MenuSub>
                {/if}
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    {/each}
  </Sidebar.Content>

  <Sidebar.Footer class="gap-0 p-0">
    {#if !footerOnly}
      {#if billingSummary?.billingStatus === "trialing" && billingSummary.trialEnd}
        <AppSidebarTrialCard
          href={`${settingsHref}/billing`}
          trialStart={billingSummary.trialStart}
          trialEnd={billingSummary.trialEnd}
        />
      {/if}
      <AppSidebarUsageCard
        includedBytes={billingSummary?.includedBytes ?? 0}
        logsIngestedBytes={billingSummary?.logsIngestedBytes ?? 0}
        tracesIngestedBytes={billingSummary?.tracesIngestedBytes ?? 0}
        metricsIngestedBytes={billingSummary?.metricsIngestedBytes ?? 0}
        chatCreditsUsed={billingSummary?.chatUsage?.usedCredits ?? 0}
        chatCreditsIncluded={billingSummary?.chatUsage?.includedCredits ?? 0}
      />
    {/if}
    <Sidebar.Group>
      <Sidebar.GroupContent>
        <Sidebar.Menu class="gap-0.5">
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              class="gap-2.5"
              isActive={!!settingsHref &&
                page.url.pathname.startsWith(settingsHref)}
              tooltipContent="Settings"
            >
              disabled={!settingsHref}
              {#snippet child({ props }: any)}
                {#if settingsHref}
                  <a
                    href={settingsHref}
                    {...props}
                    onclick={() => {
                      if (sidebar.isMobile) sidebar.setOpenMobile(false);
                    }}
                  >
                    {#if page.url.pathname.startsWith(settingsHref)}
                      <span
                        class="absolute -left-2 h-4 w-1 rounded-r-md bg-primary/80"
                      >
                      </span>
                    {/if}
                    <GearSixIcon class="opacity-75" />
                    <span>Settings</span>
                  </a>
                {:else}
                  <button type="button" {...props} disabled>
                    <GearSixIcon class="opacity-75" />
                    <span>Settings</span>
                  </button>
                {/if}
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>

          <Sidebar.MenuItem>
            <Sidebar.MenuButton class="gap-2.5" tooltipContent="Documentation">
              {#snippet child({ props }: any)}
                <a href="https://orvo.sh/docs" {...props}>
                  <BookOpenTextIcon class="opacity-75" />
                  <span>Documentation</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
          <AppSidebarUserNav {user} {settingsHref} />
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Footer>
</Sidebar.Root>
