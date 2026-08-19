<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { authClient } from "$lib/auth-client";
  import * as Avatar from "@repo/components/ui/avatar";
  import { Button } from "@repo/components/ui/button";
  import * as Dialog from "@repo/components/ui/dialog";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconTrash,
    IconUserPlus,
    IconX,
    IconCopy,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let loading = $state(true);
  let inviteDialogOpen = $state(false);
  let inviting = $state(false);
  let removingMemberId = $state("");
  let cancelingInvitationId = $state("");
  let inviteEmail = $state("");
  let inviteRole = $state<"member" | "admin" | "owner">("member");
  let inviteLink = $state("");
  let error = $state("");
  let members = $state<any[]>([]);
  let invitations = $state<any[]>([]);

  const getInitials = (value: string) =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

  const clearInviteQuery = async () => {
    if (page.url.searchParams.get("invite") === "1") {
      await goto(page.url.pathname, {
        replaceState: true,
        noScroll: true,
      });
    }
  };

  const load = async () => {
    if (!data.currentOrganization) {
      error = "Organization not found.";
      loading = false;
      return;
    }

    loading = true;
    error = "";

    const [membersResult, invitationsResult] = await Promise.all([
      authClient.organization.listMembers({
        query: {
          organizationId: data.currentOrganization.id,
        },
      }),
      authClient.organization.listInvitations({
        query: {
          organizationId: data.currentOrganization.id,
        },
      }),
    ]);

    if (membersResult.error) {
      error = membersResult.error.message || "Failed to load members.";
      loading = false;
      return;
    }

    if (invitationsResult.error) {
      error = invitationsResult.error.message || "Failed to load invitations.";
      loading = false;
      return;
    }

    members = membersResult.data?.members ?? [];
    invitations = invitationsResult.data ?? [];
    loading = false;
  };

  const invite = async () => {
    if (!data.currentOrganization) {
      error = "Organization not found.";
      return;
    }

    error = "";

    if (inviteEmail.trim().length === 0) {
      error = "Email is required.";
      return;
    }

    inviting = true;

    const result = await authClient.organization.inviteMember({
      email: inviteEmail.trim(),
      role: inviteRole,
      organizationId: data.currentOrganization.id,
    });

    if (result.error) {
      error = result.error.message || "Failed to invite member.";
      inviting = false;
      return;
    }

    if (data.mode === "local") {
      inviteLink = `${page.url.origin}/invite/${result.data.id}`;
    } else {
      inviteDialogOpen = false;
    }
    inviteEmail = "";
    inviteRole = "member";
    inviting = false;
    await invalidateAll();
    await load();
    await clearInviteQuery();
    toast.success(
      data.mode === "local" ? "Invitation link created." : "Invitation sent.",
    );
  };

  const copyInvitation = async (invitationId: string) => {
    await navigator.clipboard.writeText(
      `${page.url.origin}/invite/${invitationId}`,
    );
    toast.success("Invitation link copied.");
  };

  const removeMember = async (memberId: string) => {
    if (!data.currentOrganization) {
      return;
    }

    removingMemberId = memberId;

    const result = await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
      organizationId: data.currentOrganization.id,
    });

    removingMemberId = "";

    if (result.error) {
      toast.error(result.error.message || "Failed to remove member.");
      return;
    }

    await invalidateAll();
    await load();
    toast.success("Member removed.");
  };

  const cancelInvitation = async (invitationId: string) => {
    cancelingInvitationId = invitationId;

    const result = await authClient.organization.cancelInvitation({
      invitationId,
    });

    cancelingInvitationId = "";

    if (result.error) {
      toast.error(result.error.message || "Failed to cancel invitation.");
      return;
    }

    await invalidateAll();
    await load();
    toast.success("Invitation canceled.");
  };

  $effect(() => {
    inviteDialogOpen = page.url.searchParams.get("invite") === "1";
  });

  $effect(() => {
    if (!inviteDialogOpen) {
      inviteLink = "";
      void clearInviteQuery();
    }
  });

  onMount(() => {
    void load();
  });
</script>

<div class="flex w-full max-w-4xl flex-col gap-10">
  <section class="space-y-3">
    <div class="space-y-1">
      <h2 class="text-base font-medium">Members</h2>
      <p class="max-w-2xl text-sm text-muted-foreground">
        Manage who has access to this organization and keep track of pending
        invitations.
      </p>
    </div>

    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {/if}
  </section>

  <section class="space-y-3">
    <h3 class="text-sm font-medium text-foreground">Active members</h3>

    {#if loading}
      <p class="text-sm text-muted-foreground">Loading members...</p>
    {:else if members.length === 0}
      <div
        class="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground"
      >
        No members found.
      </div>
    {:else}
      {#each members as member (member.id)}
        <div
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-4"
        >
          <div class="flex items-center gap-3">
            <Avatar.Root class="size-10 border after:hidden">
              <Avatar.Image
                src={member.user?.image ?? undefined}
                alt={member.user?.name ?? ""}
              />
              <Avatar.Fallback id={member.user?.id ?? member.id}>
                {getInitials(member.user?.name ?? member.user?.email ?? "M")}
              </Avatar.Fallback>
            </Avatar.Root>

            <div class="space-y-1">
              <p class="text-sm font-medium">
                {member.user?.name ?? member.user?.email}
              </p>
              <p class="text-xs text-muted-foreground">
                {member.user?.email} · {member.role}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            loading={removingMemberId === member.id}
            disabled={removingMemberId.length > 0}
            onclick={() => removeMember(member.id)}
          >
            <IconTrash data-slot="button-icon" />
            Remove
          </Button>
        </div>
      {/each}
    {/if}
  </section>

  <section class="space-y-3">
    <h3 class="text-sm font-medium text-foreground">Pending invitations</h3>

    {#if loading}
      <p class="text-sm text-muted-foreground">Loading invitations...</p>
    {:else if invitations.length === 0}
      <div
        class="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground"
      >
        No pending invitations.
      </div>
    {:else}
      {#each invitations as invitation (invitation.id)}
        <div
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-4"
        >
          <div class="space-y-1">
            <p class="text-sm font-medium">{invitation.email}</p>
            <p class="text-xs text-muted-foreground">
              {invitation.role} · Sent {new Date(
                invitation.createdAt,
              ).toLocaleString()}
            </p>
          </div>

          <div class="flex items-center gap-2">
            {#if data.mode === "local"}
              <Button
                type="button"
                variant="outline"
                onclick={() => copyInvitation(invitation.id)}
              >
                <IconCopy data-slot="button-icon" />
                Copy link
              </Button>
            {/if}
            <Button
              type="button"
              variant="outline"
              loading={cancelingInvitationId === invitation.id}
              disabled={cancelingInvitationId.length > 0}
              onclick={() => cancelInvitation(invitation.id)}
            >
              <IconX data-slot="button-icon" />
              Cancel
            </Button>
          </div>
        </div>
      {/each}
    {/if}
  </section>
</div>

<Dialog.Root bind:open={inviteDialogOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Invite member</Dialog.Title>
      <Dialog.Description>
        {data.mode === "local"
          ? "Create a private invitation link to share with this person."
          : "Send an organization invitation by email."}
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4">
      <div class="space-y-2">
        <Label for="invite-email">Email</Label>
        <Input
          id="invite-email"
          bind:value={inviteEmail}
          type="email"
          placeholder="name@company.com"
        />
      </div>

      <div class="space-y-2">
        <Label for="invite-role">Role</Label>
        <select
          id="invite-role"
          bind:value={inviteRole}
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="member">member</option>
          <option value="admin">admin</option>
          <option value="owner">owner</option>
        </select>
      </div>

      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}

      {#if inviteLink}
        <div class="space-y-2">
          <Label for="invite-link">Invitation link</Label>
          <div class="flex gap-2">
            <Input id="invite-link" value={inviteLink} readonly />
            <Button
              type="button"
              variant="outline"
              onclick={() =>
                navigator.clipboard
                  .writeText(inviteLink)
                  .then(() => toast.success("Invitation link copied."))}
            >
              <IconCopy data-slot="button-icon" />
              Copy
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            Anyone with this link can create the invited account until it
            expires.
          </p>
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button
        type="button"
        variant="outline"
        onclick={() => (inviteDialogOpen = false)}
      >
        Cancel
      </Button>
      {#if !inviteLink}
        <Button type="button" loading={inviting} onclick={invite}>
          <IconUserPlus data-slot="button-icon" />
          {data.mode === "local" ? "Create invite" : "Send invite"}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
