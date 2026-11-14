<script lang="ts">
  import { IconChevronRight, IconPlus } from "@tabler/icons-svelte";
  import { OrvoLogo } from "@repo/components/icons/orvo-logo";
  import { Avatar, AvatarFallback } from "@repo/components/ui/avatar";
  import { Button } from "@repo/components/ui/button";

  import { authClient } from "$lib/auth-client";

  let { data } = $props();
  let loading = $state<string | null>(null);
  let error = $state("");

  const getInitials = (value: string) =>
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "O";

  const handleSelectOrganization = async (organizationId: string) => {
    loading = organizationId;
    error = "";

    await authClient.organization
      .setActive(
        { organizationId },
        {
          onSuccess: () => {
            location.href = "/";
          },
          onError: (ctx) => {
            error = ctx.error.message;
            loading = null;
          },
        },
      )
      .catch(() => {
        error = "Unable to select organization. Please try again.";
        loading = null;
      });
  };
</script>

<svelte:head>
  <title>Select an organization · Orvo</title>
</svelte:head>

<main
  class="flex min-h-svh flex-col items-center p-6 not-sm:pt-20 sm:justify-center md:p-10"
>
  <div class="flex w-full max-w-md flex-col gap-6">
    <div class="flex flex-col items-center gap-3 text-center">
      <OrvoLogo class="size-14" />
      <div class="space-y-1">
        <h1 class="text-xl font-semibold">Select an organization</h1>
        <p class="text-sm break-all text-muted-foreground">{data.user.email}</p>
      </div>
    </div>

    <div class="overflow-hidden rounded-xl border bg-card">
      <ul
        aria-label="Organizations"
        class="max-h-80 space-y-1 overflow-y-auto p-1"
      >
        {#each data.organizations as organization (organization.id)}
          <li>
            <Button
              id={`organization-option-${organization.id}`}
              type="button"
              variant="ghost"
              class="h-14 w-full justify-start gap-3 px-3 text-left"
              disabled={loading !== null}
              loading={loading === organization.id}
              loaderPosition="right"
              onclick={() => handleSelectOrganization(organization.id)}
            >
              <Avatar class="rounded-lg after:rounded-lg" aria-hidden="true">
                <AvatarFallback class="rounded-lg">
                  {getInitials(organization.name)}
                </AvatarFallback>
              </Avatar>
              <span class="min-w-0 flex-1 truncate">{organization.name}</span>
              <IconChevronRight
                data-slot="button-icon"
                class="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </Button>
          </li>
        {/each}
      </ul>
      <div class="border-t p-1">
        <Button
          id="new-organization-button"
          href="/organizations/new"
          variant="ghost"
          class="h-11 w-full justify-start gap-3 px-3"
          disabled={loading !== null}
        >
          <span
            class="flex size-8 items-center justify-center"
            aria-hidden="true"
          >
            <IconPlus
              data-slot="button-icon"
              class="size-4 text-muted-foreground"
            />
          </span>
          Create organization
        </Button>
      </div>
    </div>

    {#if error}
      <p role="alert" class="text-sm text-destructive">{error}</p>
    {/if}
  </div>
</main>
