<script lang="ts">
  import { page } from "$app/state";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import {
      BookOpenTextIcon,
      ChartBarIcon,
      GearSixIcon,
      GraphIcon,
      ListBulletsIcon,
      MegaphoneIcon,
      SparkleIcon,
  } from "phosphor-svelte";

  import AppSidebarOrganizationSwitcher from "./app-sidebar-organization-switcher.svelte";
  import AppSidebarUserNav from "./app-sidebar-user-nav.svelte";

  const navigation = [
    {
      href: "/",
      label: "Overview",
      icon: SparkleIcon,
    },
    { href: "/logs", label: "Logs", icon: ListBulletsIcon },
    { href: "/metrics", label: "Metrics", icon: ChartBarIcon },
    { href: "/tracers", label: "Tracers", icon: GraphIcon },
  ];

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
    class="justify-center gap-0 border-b border-sidebar-border/80 px-1.5 py-3"
  >
    <AppSidebarOrganizationSwitcher {organizations} {activeOrganizationId} />
  </Sidebar.Header>

  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupContent>
        <Sidebar.Menu class="gap-0.5">
          {#each navigation as item}
            <Sidebar.MenuItem >
              {@const Icon = item.icon}
              {@const isActive =
                item.href === "/"
                  ? page.url.pathname === item.href
                  : page.url.pathname.startsWith(item.href)}
              <Sidebar.MenuButton class="gap-2.5" {isActive} tooltipContent={item.label}>
                {#snippet child({ props })}
                  <a href={item.href} {...props}>
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
              tooltipContent={"Settings"}
            >
              {#snippet child({ props })}
                <a href={"/settings"} {...props}>
                  <GearSixIcon />
                  <span>Settings</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton class="gap-2.5" tooltipContent={"Documentation"}>
              {#snippet child({ props })}
                <a href={"https://orvo.sh/docs"} {...props}>
                  <BookOpenTextIcon />
                  <span>Documentation</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton class="gap-2.5" tooltipContent={"Give feedback"}>
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
