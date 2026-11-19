<script lang="ts">
  import OrganizationSwitcher from "$lib/components/organization-switcher.svelte";
  import * as Sidebar from "@repo/components/ui/sidebar";

  let {
    organizations,
    activeOrganizationId,
    redirectTo,
  }: {
    organizations: { id: string; name: string }[];
    activeOrganizationId?: string;
    redirectTo?: string;
  } = $props();
</script>

<Sidebar.Menu>
  <Sidebar.MenuItem>
    <OrganizationSwitcher {organizations} {activeOrganizationId} {redirectTo} />
  </Sidebar.MenuItem>
</Sidebar.Menu>
