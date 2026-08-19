<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { OrvoLogo } from "@repo/components/icons/orvo-logo";
  import { Button } from "@repo/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@repo/components/ui/card";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let loading = $state(false);
  let error = $state("");

  const accept = async () => {
    loading = true;
    error = "";
    const result = await authClient.organization.acceptInvitation({
      invitationId: data.invitation.id,
    });
    if (result.error) {
      error = result.error.message || "Unable to accept this invitation.";
      loading = false;
      return;
    }

    await goto("/");
  };
</script>

<svelte:head><title>Join {data.invitation.organizationName}</title></svelte:head
>

<div class="flex min-h-svh items-center justify-center bg-muted/30 p-6">
  <Card class="w-full max-w-md">
    <CardHeader class="items-center text-center">
      <OrvoLogo class="mb-2 size-12" />
      <CardTitle>Join {data.invitation.organizationName}</CardTitle>
      <CardDescription>
        You were invited as {data.invitation.role ?? "member"}.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if !data.emailMatches}
        <p class="text-sm text-destructive">
          Sign in as {data.invitation.email} to accept this invitation.
        </p>
      {/if}
      {#if error}<p class="text-sm text-destructive">{error}</p>{/if}
      <Button
        class="w-full"
        disabled={!data.emailMatches}
        {loading}
        onclick={accept}
      >
        Accept invitation
      </Button>
    </CardContent>
  </Card>
</div>
