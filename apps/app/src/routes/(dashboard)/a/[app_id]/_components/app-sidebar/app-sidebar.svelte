<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { kbdShortcut } from "$lib/utils/kbd-shortcut";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import {
    IconBook2 as BookOpenTextIcon,
    IconSettings as GearSixIcon,
    IconCaretRightFilled,
  } from "@tabler/icons-svelte";

  import { cn } from "@repo/components";
  import { generateAppNavigationGroups } from "./app-sidebar-naviagation-groups";
  import AppSidebarOrganizationSwitcher from "./app-sidebar-organization-switcher.svelte";
  import AppSidebarUsageCard from "./app-sidebar-usage-card.svelte";
  import AppSidebarUserNav from "./app-sidebar-user-nav.svelte";

  let {
    organizations,
    activeOrganizationId,
    user,
    billingSummary,
  }: {
    organizations: {
      id: string;
      name: string;
      logo?: string | null;
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
      includedBytes: number;
      usedBytes: number;
      logsIngestedBytes: number;
      metricsIngestedBytes: number;
      tracesIngestedBytes: number;
      usagePercent: number;
    } | null;
  } = $props();

  type DashboardPageData = {
    currentApp?: {
      id: string;
    };
    logViews?: Array<{
      id: string;
      slug: string;
      name: string;
    }>;
  };

  const currentAppId = $derived(
    (page.data as DashboardPageData | undefined)?.currentApp?.id ?? "",
  );
  const logViews = $derived(
    (page.data as DashboardPageData | undefined)?.logViews ?? [],
  );

  const navigationGroups = $derived(
    currentAppId ? generateAppNavigationGroups(currentAppId, logViews) : [],
  );
  const settingsHref = $derived(
    currentAppId ? `/a/${currentAppId}/settings` : "/settings",
  );

  let collapsedGroups = $state<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    collapsedGroups = {
      ...collapsedGroups,
      [label]: !collapsedGroups[label],
    };
  };

  $effect(() => {
    return kbdShortcut({
      ...Object.fromEntries(
        navigationGroups
          .flatMap((group) => group.items)
          .filter((item: any) => item?.shortcut)
          .map((item: any) => [
            item.shortcut,
            () => {
              void goto(item.href);
            },
          ]),
      ),
    });
  });
</script>

<Sidebar.Root
  collapsible="offcanvas"
  class="border-e border-sidebar-border/80 bg-sidebar"
>
  <Sidebar.Header
    class="h-13 justify-center gap-0 border-b border-sidebar-border/80 px-1.5 py-3"
  >
    <AppSidebarOrganizationSwitcher {organizations} {activeOrganizationId} />
  </Sidebar.Header>

  <Sidebar.Content class="gap-1 py-2">
    {#each navigationGroups as group (group.label)}
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
                {@const isActive = page.url.pathname == href}
                <Sidebar.MenuButton
                  class="group/menu-btn relative gap-2.5 overflow-visible"
                  {isActive}
                  tooltipContent={item.label}
                >
                  {#snippet child({ props })}
                    <a {href} {...props}>
                      {#if isActive}
                        <span
                          class="absolute -left-2 h-5.5 w-1 rounded-r-md bg-primary/80"
                        >
                        </span>
                      {/if}
                      <Icon class="opacity-80" />
                      <span>{item.label}</span>
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>

                {#if item.submenu && item.submenu.length > 0}
                  <Sidebar.MenuSub>
                    {#each item.submenu as subitem (subitem.href)}
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton
                          isActive={page.url.pathname === subitem.href}
                        >
                          {#snippet child({ props }: any)}
                            <a href={subitem.href} {...props}>
                              <span>{subitem.label}</span>
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

  <Sidebar.Footer class="gap-0 border-t border-sidebar-border/80 p-0">
    <AppSidebarUsageCard
      includedBytes={billingSummary?.includedBytes ?? 0}
      logsIngestedBytes={billingSummary?.logsIngestedBytes ?? 0}
      tracesIngestedBytes={billingSummary?.tracesIngestedBytes ?? 0}
      metricsIngestedBytes={billingSummary?.metricsIngestedBytes ?? 0}
    />
    <Sidebar.Group>
      <Sidebar.GroupContent>
        <Sidebar.Menu class="gap-0.5">
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              class="gap-2.5"
              isActive={page.url.pathname.startsWith(settingsHref)}
              tooltipContent="Settings"
            >
              {#snippet child({ props }: any)}
                <a href={settingsHref} {...props}>
                  {#if page.url.pathname.startsWith(settingsHref)}
                    <span
                      class="absolute -left-2 h-5.5 w-1 rounded-r-md bg-primary/80"
                    >
                    </span>
                  {/if}
                  <GearSixIcon class="opacity-75" />
                  <span>Settings</span>
                </a>
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
