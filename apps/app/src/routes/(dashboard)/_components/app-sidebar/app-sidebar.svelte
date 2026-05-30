<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import {
      IconBook2 as BookOpenTextIcon,
      IconChartBar as ChartBarIcon,
      IconHome as HouseIcon,
      IconRoute as PathIcon,
      IconSettings as GearSixIcon,
      IconSpeakerphone as MegaphoneIcon,
      IconTerminal2 as TerminalWindowIcon
  } from "@tabler/icons-svelte";
  import * as Sidebar from "@repo/components/ui/sidebar";

  import AppSidebarOrganizationSwitcher from "./app-sidebar-organization-switcher.svelte";
  import AppSidebarUserNav from "./app-sidebar-user-nav.svelte";

  const navigation = [
    {
      href: "/",
      label: "Home",
      icon: HouseIcon,
    },
    { href: "/logs", label: "Logs", icon: TerminalWindowIcon },
    { href: "/metrics", label: "Metrics", icon: ChartBarIcon },
    { href: "/traces", label: "Traces", icon: PathIcon },
  ] as const;

  let {
    organizations,
    activeOrganizationId,
    user,
  }: {
    organizations: {
      id: string;
      name: string;
      slug: string;
      logo?: string | null;
    }[];
    activeOrganizationId?: string;
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
    };
  } = $props();
</script>

<Sidebar.Root
  collapsible="offcanvas"
  class="border-sidebar-border/80 border-e bg-sidebar"
>
  <Sidebar.Header
    class="justify-center h-14 gap-0 border-b border-sidebar-border/80 px-1.5 py-3"
  >
    <AppSidebarOrganizationSwitcher {organizations} {activeOrganizationId} />
  </Sidebar.Header>

  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupContent>
        <Sidebar.Menu class="gap-0.5">
          {#each navigation as item (item.href)}
            <Sidebar.MenuItem >
              {@const Icon = item.icon}
              {@const href = item.href}
              {@const isActive =
                href === "/"
                  ? page.url.pathname === href
                  : page.url.pathname.startsWith(href)}
              <Sidebar.MenuButton class="gap-2.5" {isActive} tooltipContent={item.label}>
                {#snippet child({ props })}
                  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
                  <a {href} {...props}>
                    <Icon />
                    <span>{item.label}</span>
                  </a>
                {/snippet}
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {/each}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>

  <Sidebar.Footer class="border-t border-sidebar-border/80 p-0">
    <Sidebar.Group>
      <Sidebar.GroupContent>
        <Sidebar.Menu class="gap-0.5">
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              class="gap-2.5"
              isActive={page.url.pathname.startsWith("/settings")}
              tooltipContent="Settings"
            >
              {#snippet child({ props })}
                <a href={resolve("/settings")} {...props}>
                  <GearSixIcon />
                  <span>Settings</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton class="gap-2.5" tooltipContent="Documentation">
              {#snippet child({ props })}
                <a href="https://orvo.sh/docs" {...props}>
                  <BookOpenTextIcon />
                  <span>Documentation</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton class="gap-2.5" tooltipContent="Give feedback">
              {#snippet child({ props })}
                <button data-sey-feedback {...props}>
                  <MegaphoneIcon />
                  <span>Got feedback?</span>
                </button>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
          <AppSidebarUserNav {user} />
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>

  </Sidebar.Footer>
</Sidebar.Root>
