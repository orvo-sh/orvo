<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import * as Avatar from "@repo/components/ui/avatar";
  import { Badge } from "@repo/components/ui/badge";
  import { buttonVariants } from "@repo/components/ui/button";
  import * as Popover from "@repo/components/ui/popover";
  import { CaretUpDownIcon } from "phosphor-svelte";

  type Organization = {
    id: string;
    name: string;
    slug: string;
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
      !organizations.some((organization) => organization.id === selectedOrganizationId)
    ) {
      selectedOrganizationId =
        activeOrganizationId ?? organizations[0]?.id ?? "";
    }
  });

  const selectedOrganization = $derived(
    organizations.find((organization) => organization.id === selectedOrganizationId) ??
      organizations[0],
  );

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


  const organizationButtonClass = (isActive: boolean) =>
    `${buttonVariants({ variant: isActive ? "secondary" : "ghost" })} h-auto w-full justify-start gap-3 px-2 py-2`;
</script>

{#if selectedOrganization}
  <Popover.Root bind:open>
    <Popover.Trigger class={buttonVariants({ variant: "ghost", class:"w-full justify-between px-1.5" })}>
      <span class="flex min-w-0 items-center gap-2">
        <Avatar.Root size="xs" class="after:rounded-xs -translate-x-px">
          <Avatar.Image class="rounded-xs!" 
            src={selectedOrganization.logo ?? undefined}
            alt={selectedOrganization.name}
           />
          <Avatar.Fallback class="text-[0.7rem] rounded-xs!" id={selectedOrganization.id} name={selectedOrganization.name}/>
        </Avatar.Root>
        <span class="min-w-0 text-left">
          <span class="block truncate text-sm font-medium">
            {selectedOrganization.name}
          </span>
        </span>
      </span>

      <CaretUpDownIcon class="text-muted-foreground size-4 shrink-0" />
    </Popover.Trigger>

    <Popover.Content align="start" class="w-80 p-0">
      <Popover.Header class="border-b px-4 py-3">
        <Popover.Title>Switch organization</Popover.Title>
        <Popover.Description>
          Choose the workspace you want to operate in.
        </Popover.Description>
      </Popover.Header>

      <div class="p-2">
        {#each organizations as organization}
          <button
            type="button"
            class={organizationButtonClass(
              organization.id === selectedOrganization.id,
            )}
            onclick={() => selectOrganization(organization.id)}
            disabled={loadingOrganizationId !== null}
          >
            <Avatar.Root size="sm">
              <Avatar.Image
                src={organization.logo ?? undefined}
                alt={organization.name}
              />
              <Avatar.Fallback  id={organization.id} name={organization.name}/>
            </Avatar.Root>

            <span class="min-w-0 flex-1 text-left">
              <span class="flex items-center gap-2">
                <span class="truncate text-sm font-medium">
                  {organization.name}
                </span>

                {#if organization.id === selectedOrganization.id}
                  <Badge variant="secondary">Current</Badge>
                {/if}
              </span>

              <span class="text-muted-foreground block truncate text-xs">
                {organization.slug}
              </span>
            </span>
          </button>
        {/each}
      </div>

      {#if error}
        <div class="border-t px-4 py-3">
          <p class="text-destructive text-xs">{error}</p>
        </div>
      {/if}
    </Popover.Content>
  </Popover.Root>
{/if}
