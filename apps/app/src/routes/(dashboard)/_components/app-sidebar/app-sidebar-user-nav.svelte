<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import {
    IconCreditCard as CreditCardIcon,
    IconLogout2 as SignOutIcon,
    IconSettings as GearIcon
  } from "@tabler/icons-svelte";
  import * as Avatar from "@repo/components/ui/avatar";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import * as Sidebar from "@repo/components/ui/sidebar";

  let {
    user,
  }: {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
    };
  } = $props();

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/sign-in";
  };

  const getInitials = (value: string) =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
</script>



  <Sidebar.MenuItem>
            <Sidebar.MenuButton class="gap-1.5" tooltipContent={"Give feedback"}>
              {#snippet child({ props })}

<DropdownMenu.Root>
  <DropdownMenu.Trigger
    
    {...props}
  >
    
      <Avatar.Root size="xs" class="after:rounded-xs -translate-x-px">
          <Avatar.Image class="rounded-xs!" src={user.image ?? undefined} alt={user.name} />
          <Avatar.Fallback class="text-[0.7rem] rounded-xs!" id={user.id}>{getInitials(user.name)}</Avatar.Fallback>
        </Avatar.Root>
    
  <span>{user.name}</span>
  </DropdownMenu.Trigger>

  <DropdownMenu.Content
    side="top"
    align="end"
    sideOffset={8}
    class="min-w-56 rounded-lg"
  >
    <DropdownMenu.Label class="p-0 font-normal">
      <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
        <Avatar.Root>
          <Avatar.Image src={user.image ?? undefined} alt={user.name} />
          <Avatar.Fallback id={user.id}>{getInitials(user.name)}</Avatar.Fallback>
        </Avatar.Root>

        <div class="grid flex-1 text-left text-sm leading-tight">
          <span class="truncate font-medium">{user.name}</span>
          <span class="text-muted-foreground truncate text-xs">{user.email}</span>
        </div>
      </div>
    </DropdownMenu.Label>

    <DropdownMenu.Separator />

    <DropdownMenu.Group>
      <DropdownMenu.Item>
        <GearIcon />
        Account settings
      </DropdownMenu.Item>

      <DropdownMenu.Item>
        <CreditCardIcon />
        Billing
      </DropdownMenu.Item>
    </DropdownMenu.Group>

    <DropdownMenu.Separator />

    <DropdownMenu.Item variant="destructive" onSelect={handleSignOut}>
      <SignOutIcon />
      Log out
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>

              {/snippet}
                
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
