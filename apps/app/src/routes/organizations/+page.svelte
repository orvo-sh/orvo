<script lang="ts">
  import { Avatar, AvatarFallback, AvatarImage } from '@repo/components/ui/avatar';
  import { Button } from '@repo/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from '@repo/components/ui/card';

  import { authClient } from '$lib/auth-client';

  let { data } = $props();
  let loading = $state<string | null>(null);
  let error = $state('');

  const getInitials = (value: string) =>
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'O';

  const handleSelectOrganization = async (organizationId: string) => {
    loading = organizationId;
    error = '';

    await authClient.organization.setActive(
      { organizationId },
      {
        onSuccess: () => {
          location.href = '/';
        },
        onError: (ctx) => {
          error = ctx.error.message;
          loading = null;
        }
      }
    );
  };
</script>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
  <div class="w-full max-w-md">
    <div class="flex flex-col gap-6">
      <div class="flex flex-col items-center gap-3 text-center">
        <div class="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl text-sm font-semibold">
          O
        </div>
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">Select an organization</h1>
          <p class="text-muted-foreground text-sm">
            Choose a workspace for {data.user.email}, or create a new one.
          </p>
        </div>
      </div>

      <Card class="py-0">
        <CardHeader class="border-b">
          <CardTitle>Your workspaces</CardTitle>
          <CardDescription>Pick one to continue into Orvo.</CardDescription>
        </CardHeader>
        <CardContent class="max-h-80 space-y-3 overflow-y-auto p-3">
          {#each data.organizations as organization}
            <Button
              type="button"
              variant="outline"
              class="h-auto w-full justify-start px-3 py-3 text-left"
              disabled={loading !== null}
              onclick={() => handleSelectOrganization(organization.id)}
            >
              <Avatar class="size-10 rounded-lg">
                <AvatarImage
                  src={organization.logo ?? undefined}
                  alt={organization.name}
                  class="rounded-lg"
                />
                <AvatarFallback class="rounded-lg">
                  {getInitials(organization.name)}
                </AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{organization.name}</p>
                <p class="text-muted-foreground truncate text-sm">{organization.slug}</p>
              </div>
              {#if loading === organization.id}
                <span class="text-muted-foreground text-xs">Switching...</span>
              {/if}
            </Button>
          {/each}
        </CardContent>
      </Card>

      {#if error}
        <p class="text-destructive text-sm">{error}</p>
      {/if}

      <Button href="/organizations/new" variant="outline" class="w-full">New organization</Button>
    </div>
  </div>
</div>
