<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@repo/components/ui/card";
  import { Label } from "@repo/components/ui/label";
  import * as Select from "@repo/components/ui/select";
  import { IconPlugConnected } from "@tabler/icons-svelte";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let organizationId = $state(
    form?.organizationId ?? data.selectedOrganizationId,
  );
  const selectedOrganization = $derived(
    data.organizations.find(
      (organization) => organization.id === organizationId,
    ),
  );
</script>

<svelte:head>
  <title>Authorize MCP access</title>
</svelte:head>

<main
  class="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10"
>
  <Card class="w-full max-w-md shadow-none">
    <CardHeader class="space-y-4">
      <div
        class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
      >
        <IconPlugConnected class="size-5" />
      </div>
      <div class="space-y-1.5">
        <CardTitle>Connect {data.client.name}</CardTitle>
        <CardDescription>
          Choose the organization this client can inspect. It will receive
          read-only access to all apps and observability data in that
          organization.
        </CardDescription>
      </div>
    </CardHeader>

    <CardContent>
      <form method="POST" class="space-y-5">
        <input type="hidden" name="client_id" value={data.clientId} />
        <input type="hidden" name="oauth_query" value={data.oauthQuery} />
        <input type="hidden" name="organization_id" value={organizationId} />

        <div class="space-y-2">
          <Label for="organization">Organization</Label>
          <Select.Root type="single" bind:value={organizationId}>
            <Select.Trigger id="organization" class="w-full">
              {selectedOrganization?.name ?? "Select an organization"}
            </Select.Trigger>
            <Select.Content>
              {#each data.organizations as organization}
                <Select.Item
                  value={organization.id}
                  label={organization.name}
                />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        {#if form?.error}
          <p class="text-sm text-destructive">{form.error}</p>
        {/if}

        <div class="flex justify-end gap-2">
          <Button type="submit" name="decision" value="deny" variant="outline"
            >Deny</Button
          >
          <Button type="submit" name="decision" value="approve"
            >Allow access</Button
          >
        </div>
      </form>
    </CardContent>
  </Card>
</main>
