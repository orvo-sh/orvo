<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { buttonVariants } from "@repo/components/ui/button";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import { toast } from "@repo/components/ui/sonner";
  import { Spinner } from "@repo/components/ui/spinner";
  import { IconCheck, IconPlus, IconSelector } from "@tabler/icons-svelte";

  let {
    organizations,
    activeOrganizationId,
  }: {
    organizations: {
      id: string;
      name: string;
    }[];
    activeOrganizationId?: string;
  } = $props();

  let open = $state(false);
  let loading = $state(false);
  let selectedOrganizationId = $state("");

  const selectOrganization = async (organizationId: string) => {
    if (organizationId === activeOrganizationId) {
      open = false;
      return;
    }

    selectedOrganizationId = organizationId;
    loading = true;

    await authClient.organization.setActive(
      { organizationId },
      {
        onSuccess: () => {
          open = false;
          window.location.href = "/";
        },
        onError: ({ error }) => {
          toast.error("Failed to switch organizations", {
            description: error.message,
          });
          loading = false;
        },
      },
    );
  };
</script>

<Sidebar.Menu>
  <Sidebar.MenuItem>
    <DropdownMenu.Root bind:open>
      <DropdownMenu.Trigger
        class={buttonVariants({
          variant: "ghost",
          class: "w-full justify-between px-1.5",
        })}
      >
        {@const activeOrganization = organizations.find(
          (organization) => organization.id === activeOrganizationId,
        )!}
        <span class="min-w-0 text-left">
          <span class="block truncate text-sm font-medium">
            {activeOrganization.name}
          </span>
        </span>

        <IconSelector />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        class="flex w-64 flex-col"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        {#each organizations as organization (organization.id)}
          <DropdownMenu.Item
            class="p-2"
            closeOnSelect={false}
            disabled={loading}
            onSelect={() => selectOrganization(organization.id)}
          >
            <span class="flex-1 truncate">{organization.name}</span>
            {#if organization.id == activeOrganizationId}
              <IconCheck />
            {/if}
            {#if loading && organization.id == selectedOrganizationId}
              <Spinner />
            {/if}
          </DropdownMenu.Item>
        {/each}
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          class="p-2"
          disabled={loading}
          onSelect={() => (window.location.href = "/organizations/new")}
        >
          <IconPlus />
          Add organization
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </Sidebar.MenuItem>
</Sidebar.Menu>
