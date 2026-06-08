<script lang="ts">
  import { page } from "$app/state";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import {
      IconSettings as GearSixIcon,
      IconKey as KeyIcon,
      IconWebhook as WebhookIcon
  } from "@tabler/icons-svelte";
  import type { Snippet } from "svelte";

  import PageContainer from "../../../_components/page-container/page-container.svelte";

  let { children }: { children?: Snippet } = $props();

  const settingsBasePath = $derived(`/a/${page.params.app_id}/settings`);

  const sections = $derived([
    {
      label: "Data",
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
      ],
    },
    {
      label: "Alerts",
      items: [
        {
          href: `${settingsBasePath}/alerts/webhooks`,
          label: "Webhooks",
          icon: WebhookIcon,
          isActive: (pathname: string) =>
            pathname.startsWith(`${settingsBasePath}/alerts/webhooks`),
        },
      ],
    },
  ]);

  const activeItem = $derived(
    sections
      .flatMap((section) => section.items)
      .find((item) => item.isActive(page.url.pathname))
  );
</script>

<PageContainer title={activeItem?.label || "Settings"} innerClass="p-0!">
  <div class="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-8">
    <aside
      class="shrink-0 w-64 not-lg:hidden border-r"
    >
      {#each sections as section}
        <Sidebar.Group>
          <Sidebar.GroupLabel>{section.label}</Sidebar.GroupLabel>
          <Sidebar.GroupContent>
            <Sidebar.Menu>
              {#each section.items as item}
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

    <div class="min-h-0 min-w-0 flex-1">
      {@render children?.()}
    </div>
  </div>
</PageContainer>
