<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { setThemeMode } from "$lib/theme/theme";
  import * as Avatar from "@repo/components/ui/avatar";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import * as Sidebar from "@repo/components/ui/sidebar";
  import {
    IconCreditCard as CreditCardIcon,
    IconMoon as MoonIcon,
    IconSettings as GearIcon,
    IconLogout2 as SignOutIcon,
    IconSunHigh as SunIcon,
  } from "@tabler/icons-svelte";
  import { mode, setMode } from "mode-watcher";

  let {
    user,
    settingsHref,
  }: {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
    };
    settingsHref: string;
  } = $props();

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/sign-in";
  };

  const handleBillingNavigation = () => {
    const billingHref = settingsHref.startsWith("/a/")
      ? `${settingsHref}/billing`
      : "/settings/billing";
    window.location.href = billingHref;
  };

  const handleSettingsNavigation = () => {
    const accountHref = settingsHref.startsWith("/a/")
      ? `${settingsHref}/account/profile`
      : "/settings/account/profile";
    window.location.href = accountHref;
  };

  const handleThemeToggle = () => {
    const nextMode = mode.current === "dark" ? "light" : "dark";
    setMode(nextMode);
    setThemeMode(nextMode);
  };

  const getInitials = (value: string) =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

  const isDarkMode = $derived(mode.current === "dark");
</script>

<Sidebar.MenuItem>
  <Sidebar.MenuButton class="gap-1.5" tooltipContent={"Give feedback"}>
    {#snippet child({ props })}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger {...props}>
          <Avatar.Root size="xs" class="-translate-x-0.5 after:rounded-xs">
            <Avatar.Image
              class="rounded-xs!"
              src={user.image ?? undefined}
              alt={user.name}
            />
            <Avatar.Fallback class="rounded-xs! text-[0.7rem]" id={user.id}
              >{getInitials(user.name)}</Avatar.Fallback
            >
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
                <Avatar.Fallback id={user.id}
                  >{getInitials(user.name)}</Avatar.Fallback
                >
              </Avatar.Root>

              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">{user.name}</span>
                <span class="truncate text-xs text-muted-foreground"
                  >{user.email}</span
                >
              </div>
            </div>
          </DropdownMenu.Label>

          <DropdownMenu.Separator />

          <DropdownMenu.Group>
            <DropdownMenu.CheckboxItem
              checked={isDarkMode}
              onSelect={handleThemeToggle}
            >
              {#if isDarkMode}
                <SunIcon />
              {:else}
                <MoonIcon />
              {/if}
              Dark mode
            </DropdownMenu.CheckboxItem>
          </DropdownMenu.Group>

          <DropdownMenu.Separator />

          <DropdownMenu.Group>
            <DropdownMenu.Item onSelect={handleSettingsNavigation}>
              <GearIcon />
              Account settings
            </DropdownMenu.Item>

            <DropdownMenu.Item onSelect={handleBillingNavigation}>
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
