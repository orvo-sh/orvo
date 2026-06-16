<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import {
    IconChevronDown as ChevronDownIcon,
    IconPlus as PlusIcon,
  } from "@tabler/icons-svelte";

  type Organization = {
    id: string;
    name: string;
    logo?: string | null;
  };

  let {
    organizations,
    activeOrganizationId,
  }: {
    organizations: Organization[];
    activeOrganizationId?: string;
  } = $props();

  let open = $state(false);
  let selectedOrganizationId = $state("");
  let loadingOrganizationId = $state<string | null>(null);
  let error = $state("");

  $effect(() => {
    if (
      !selectedOrganizationId ||
      !organizations.some(
        (organization) => organization.id === selectedOrganizationId,
      )
    ) {
      selectedOrganizationId =
        activeOrganizationId ?? organizations[0]?.id ?? "";
    }
  });

  const selectedOrganization = $derived(
    organizations.find(
      (organization) => organization.id === selectedOrganizationId,
    ) ?? organizations[0],
  );

  const getInitials = (value: string) =>
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "O";

  const selectOrganization = async (organizationId: string) => {
    if (organizationId === selectedOrganizationId) {
      open = false;
      return;
    }

    loadingOrganizationId = organizationId;
    error = "";

    await authClient.organization.setActive(
      { organizationId },
      {
        onSuccess: () => {
          selectedOrganizationId = organizationId;
          open = false;
          window.location.href = "/";
        },
        onError: (ctx) => {
          error = ctx.error.message;
          loadingOrganizationId = null;
        },
      },
    );
  };
</script>

{#if selectedOrganization}
  <Sidebar.Menu>
    <Sidebar.MenuItem>
      <DropdownMenu.Root bind:open>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Sidebar.MenuButton {...props} class="w-fit px-1.5">
              <div
                class="flex aspect-square size-5 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"
              >
                {#if selectedOrganization.logo}
                  <img
                    src={selectedOrganization.logo}
                    alt={selectedOrganization.name}
                    class="size-full rounded-md object-cover"
                  />
                {:else}
                  <span class="text-[0.6rem] font-medium">
                    {getInitials(selectedOrganization.name)}
                  </span>
                {/if}
              </div>
              <span class="truncate font-medium">
                {selectedOrganization.name}
              </span>
              <ChevronDownIcon class="opacity-50" />
            </Sidebar.MenuButton>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          class="w-64 rounded-lg"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <DropdownMenu.Label class="text-xs text-muted-foreground">
            Organizations
          </DropdownMenu.Label>
          {#each organizations as organization (organization.id)}
            <DropdownMenu.Item
              closeOnSelect={false}
              disabled={loadingOrganizationId !== null}
              onSelect={() => selectOrganization(organization.id)}
              class="gap-2 p-2"
            >
              <div
                class="flex size-6 items-center justify-center rounded-sm border"
              >
                {#if organization.logo}
                  <img
                    src={organization.logo}
                    alt={organization.name}
                    class="size-4 rounded-sm object-cover"
                  />
                {:else}
                  <span class="text-[0.65rem] font-medium">
                    {getInitials(organization.name)}
                  </span>
                {/if}
              </div>
              {organization.name}
            </DropdownMenu.Item>
          {/each}
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            class="gap-2 p-2"
            onSelect={() => (window.location.href = "/organizations/new")}
          >
            <div
              class="flex size-6 items-center justify-center rounded-md border bg-background"
            >
              <PlusIcon class="size-4" />
            </div>
            <span class="font-medium text-muted-foreground">
              Add organization
            </span>
          </DropdownMenu.Item>
          {#if error}
            <DropdownMenu.Separator />
            <div class="px-2 py-1.5">
              <p class="text-xs text-destructive">{error}</p>
            </div>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Sidebar.MenuItem>
  </Sidebar.Menu>
{/if}
