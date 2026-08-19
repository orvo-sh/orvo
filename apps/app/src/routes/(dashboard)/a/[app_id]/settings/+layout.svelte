<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "@repo/components/ui/button";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import {
    IconBell as BellIcon,
    IconCreditCard as CreditCardIcon,
    IconPlus as PlusIcon,
    IconSettings as GearSixIcon,
    IconUserCircle,
    IconUsers as UsersIcon,
    IconKey as KeyIcon,
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
                href: `${settingsBasePath}/notifications`,
                label: "Notifications",
                icon: BellIcon,
                isActive: (pathname: string) =>
                  pathname.startsWith(`${settingsBasePath}/notifications`),
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

    <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
      {@render children?.()}
    </div>
  </div>
</PageContainer>
