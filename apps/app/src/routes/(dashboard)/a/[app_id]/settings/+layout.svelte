<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "@repo/components/ui/button";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import {
    IconCreditCard as CreditCardIcon,
    IconBrandSlack,
    IconSettings as GearSixIcon,
    IconBellPin,
    IconPlugConnected,
    IconUserCircle,
    IconKey as KeyIcon,
    IconPlus as PlusIcon,
    IconUsers as UsersIcon,
  } from "@tabler/icons-svelte";
  import type { Snippet } from "svelte";

  import PageContainer from "../_components/page-container/page-container.svelte";

  let { children }: { children?: Snippet } = $props();

  const settingsBasePath = $derived(`/a/${page.params.app_id}/settings`);

  const sections = $derived([
    {
      label: "App",
      items: [
        {
          href: settingsBasePath,
          label: "General",
          icon: GearSixIcon,
          isActive: (pathname: string) => pathname === settingsBasePath,
        },
        {
          href: `${settingsBasePath}/ingest-keys`,
          label: "Ingestion keys",
          icon: KeyIcon,
          isActive: (pathname: string) =>
            pathname.startsWith(`${settingsBasePath}/ingest-keys`),
        },
        ...(page.data.mode === "cloud"
          ? [
              {
                href: `${settingsBasePath}/notification-destinations`,
                label: "Notification destinations",
                icon: IconBellPin,
                isActive: (pathname: string) =>
                  pathname.startsWith(
                    `${settingsBasePath}/notification-destinations`,
                  ),
              },
            ]
          : []),
      ],
    },
    {
      label: "Organization",
      items: [
        {
          href: `${settingsBasePath}/organization/general`,
          label: "General",
          icon: GearSixIcon,
          isActive: (pathname: string) =>
            pathname.startsWith(`${settingsBasePath}/organization/general`),
        },
        {
          href: `${settingsBasePath}/organization/members`,
          label: "Members",
          icon: UsersIcon,
          isActive: (pathname: string) =>
            pathname.startsWith(`${settingsBasePath}/organization/members`),
        },
        ...(page.data.mode === "cloud"
          ? [
              {
                href: `${settingsBasePath}/billing`,
                label: "Billing & usage",
                icon: CreditCardIcon,
                isActive: (pathname: string) =>
                  pathname.startsWith(`${settingsBasePath}/billing`),
              },
            ]
          : []),
      ],
    },
    ...(page.data.mode === "cloud"
      ? [
          {
            label: "Integrations",
            items: [
              {
                href: `${settingsBasePath}/integrations/mcp`,
                label: "MCP",
                icon: IconPlugConnected,
                isActive: (pathname: string) =>
                  pathname.startsWith(`${settingsBasePath}/integrations/mcp`),
              },
              {
                href: `${settingsBasePath}/integrations/slack`,
                label: "Slack",
                icon: IconBrandSlack,
                isActive: (pathname: string) =>
                  pathname.startsWith(`${settingsBasePath}/integrations/slack`),
              },
            ],
          },
        ]
      : []),
    {
      label: "Account",
      items: [
        {
          href: `${settingsBasePath}/account/profile`,
          label: "Profile",
          icon: IconUserCircle,
          isActive: (pathname: string) =>
            pathname.startsWith(`${settingsBasePath}/account/profile`),
        },
      ],
    },
  ]);

  const activeItem = $derived(
    sections
      .flatMap((section) => section.items)
      .find((item) => item.isActive(page.url.pathname)),
  );
</script>

<PageContainer title={activeItem?.label || "Settings"} contentClass="p-0!">
  {#snippet actions()}
    {#if page.url.pathname.startsWith(`${settingsBasePath}/organization/members`)}
      <Button href={`${page.url.pathname}?invite=1`}>
        <PlusIcon data-slot="button-icon" />
        Invite member
      </Button>
    {:else if page.url.pathname.startsWith(`${settingsBasePath}/notification-destinations`)}
      <Button href={`${page.url.pathname}?create=1`}>
        <PlusIcon data-slot="button-icon" />
        Add destination
      </Button>
    {/if}
  {/snippet}

  <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
    <aside class="w-64 shrink-0 border-r not-lg:hidden">
      {#each sections as section (section.label)}
        <Sidebar.Group>
          <Sidebar.GroupLabel>{section.label}</Sidebar.GroupLabel>
          <Sidebar.GroupContent>
            <Sidebar.Menu>
              {#each section.items as item (item.href)}
                <Sidebar.MenuItem>
                  {@const Icon = item.icon}
                  <Sidebar.MenuButton
                    isActive={item.isActive(page.url.pathname)}
                  >
                    {#snippet child({ props })}
                      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
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
      {/each}
    </aside>

    <div
      class={`min-h-0 min-w-0 flex-1 overflow-y-auto ${page.url.pathname.startsWith(`${settingsBasePath}/notification-destinations`) ? "p-3" : "p-6"}`}
    >
      {@render children?.()}
    </div>
  </div>
</PageContainer>
