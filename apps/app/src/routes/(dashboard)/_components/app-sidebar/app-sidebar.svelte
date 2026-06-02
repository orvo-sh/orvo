<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { kbdShortcut } from "$lib/utils/kbd-shortcut";
  import { Kbd } from "@repo/components/ui/kbd";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import {
      IconBell as BellIcon,
      IconBook2 as BookOpenTextIcon,
      IconChartBar as ChartBarIcon,
      IconSettings as GearSixIcon,
      IconCaretRightFilled,
      IconGauge,
      IconTerminal2,
      IconSpeakerphone as MegaphoneIcon,
      IconRoute as PathIcon
  } from "@tabler/icons-svelte";

  import { cn } from "@repo/components";
  import AppSidebarOrganizationSwitcher from "./app-sidebar-organization-switcher.svelte";
  import AppSidebarUserNav from "./app-sidebar-user-nav.svelte";

  const navigationGroups = [
    {
      label: "",
      items: [
        {
          href: "/",
          label: "Overview",
          icon: IconGauge,
          shortcut: "o",
        },
      ],
    },
    {
      label: "Telemetry",
      items: [
        { href: "/logs", label: "Logs", icon: IconTerminal2, shortcut: "l" },
        { href: "/metrics", label: "Metrics", icon: ChartBarIcon, shortcut: "m" },
        { href: "/traces", label: "Traces", icon: PathIcon, shortcut: "t" },
      ],
    },
    {
      label: "Monitoring",
      items: [{ href: "/alerts", label: "Alerts", icon: BellIcon, shortcut: "a" }],
    },
  ] as const;

  const settingsShortcut = "s";

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
        navigationGroups.flatMap((group) => group.items).map((item) => [
          item.shortcut,
          () => {
            void goto(item.href);
          },
        ])
      ),
      [settingsShortcut]: () => {
        void goto(resolve("/settings"));
      },
    });
  });
</script>

<Sidebar.Root
  collapsible="offcanvas"
  class="border-sidebar-border/80 border-e bg-sidebar"
>
  <Sidebar.Header
    class="justify-center h-13 gap-0 border-b border-sidebar-border/80 px-1.5 py-3"
  >
    <AppSidebarOrganizationSwitcher {organizations} {activeOrganizationId} />
  </Sidebar.Header>

  <Sidebar.Content class="py-2 gap-1">
    {#each navigationGroups as group (group.label)}
      <Sidebar.Group class="py-0!">
        {#if group.label}
        <Sidebar.GroupLabel>
          {#snippet child({ props })}
            <button
              type="button"
              {...props}
              class={cn(props.class, "w-full justify-between pr-3")}
              aria-expanded={!collapsedGroups[group.label]}
              onclick={() => toggleGroup(group.label)}
            >
              <span>{group.label}</span>
              <IconCaretRightFilled
                class={cn(
                  "size-3.5! opacity-70 transition-transform",
                  collapsedGroups[group.label] ? "" : "rotate-90"
                )}
              />
            </button>
          {/snippet}
        </Sidebar.GroupLabel>
        {/if}
        <Sidebar.GroupContent class={group.label && collapsedGroups[group.label] ? "hidden" : ""}>
          <Sidebar.Menu class="gap-0.5">
            {#each group.items as item (item.href)}
              <Sidebar.MenuItem >
                {@const Icon = item.icon}
                {@const href = item.href}
                {@const isActive =
                  href === "/"
                    ? page.url.pathname === href
                    : page.url.pathname.startsWith(href)}
                <Sidebar.MenuButton class="gap-2.5 group/menu-btn" {isActive} tooltipContent={item.label}>
                  {#snippet child({ props })}
                    <a {href} {...props}>
                      <Icon class="opacity-60" />
                      <span>{item.label}</span>
                      <Kbd class={cn("ml-auto", isActive ? "border-muted-foreground/40" :"opacity-70 group-hover/menu-btn:opacity-100 group-hover/menu-btn:border-muted-foreground/40")}>{item.shortcut}</Kbd>
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    {/each}
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
                  <GearSixIcon class="opacity-75"/>
                  <span>Settings</span>
                  <Kbd class="ml-auto">{settingsShortcut}</Kbd>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton class="gap-2.5" tooltipContent="Documentation">
              {#snippet child({ props })}
                <a href="https://orvo.sh/docs" {...props}>
                  <BookOpenTextIcon class="opacity-75"/>
                  <span>Documentation</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton class="gap-2.5" tooltipContent="Give feedback">
              {#snippet child({ props })}
                <button data-sey-feedback {...props}>
                  <MegaphoneIcon class="opacity-75"/>
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
