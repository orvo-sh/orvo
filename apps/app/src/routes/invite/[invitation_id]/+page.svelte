<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { Button } from "@repo/components/ui/button";
  import { OrvoLogo } from "@repo/components/icons/orvo-logo";
  import { toast } from "@repo/components/ui/sonner";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let accepting = $state(false);

  const accept = async () => {
    accepting = true;
    const result = await authClient.organization.acceptInvitation({
      invitationId: data.invitation.id,
    });
    accepting = false;
    if (result.error) {
      toast.error(result.error.message || "Failed to accept invitation.");
      return;
    }
    await goto("/");
  };
</script>

<main class="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
  <section class="w-full space-y-6 rounded-xl border bg-card p-6">
    <div class="space-y-3">
      <OrvoLogo class="size-10" />
      <div class="space-y-1">
        <h1 class="text-xl font-semibold">
          Join {data.invitation.organizationName}
        </h1>
        <p class="text-sm text-muted-foreground">
          Invitation sent to {data.invitation.email}.
        </p>
      </div>
    </div>

    {#if !data.emailMatches}
      <p class="text-sm text-destructive">
        You are signed in as {data.signedInEmail}. Sign in with {data.invitation
          .email} to accept this invitation.
      </p>
    {:else}
      <Button class="w-full" loading={accepting} onclick={accept}>
        Accept invitation
      </Button>
    {/if}
  </section>
</main>
