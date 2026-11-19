<script lang="ts">
  import { resolve } from "$app/paths";
  import { goto, invalidateAll, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import {
    createDashboardCommand,
    deleteDashboardCommand,
    pinDashboardCommand,
  } from "$lib/api/dashboards.remote";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import * as Select from "@repo/components/ui/select";
  import * as Table from "@repo/components/ui/table";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import * as Dialog from "@repo/components/ui/dialog";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconSparkle,
    IconPlus,
    IconSearch,
    IconLayoutDashboard,
    IconPin,
    IconPinnedFilled,
    IconDots,
    IconCopy,
    IconTrash,
    IconArrowUpRight,
  } from "@tabler/icons-svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";
  import CreateDashboardDialog from "./_components/create-dashboard-dialog.svelte";
  let { data } = $props();
  let search = $state("");
  let filter = $state("all");
  let sort = $state("updated");
  let creatingWithScout = $state(false);
  const createWithScout = async () => {
    if (creatingWithScout) return;
    creatingWithScout = true;
    try {
      const result = await createDashboardCommand({
        name: "Untitled dashboard",
        panels: [],
        timeRange: "last_hour",
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      await goto(
        resolve(`/a/${data.appId}/dashboards/${result.data.id}?edit=1&scout=1`),
      );
      await invalidateAll();
    } catch {
      toast.error("Failed to create dashboard.");
    } finally {
      creatingWithScout = false;
    }
  };
  let creating = $state(false);
  let removing = $state<{ id: string; name: string } | null>(null);
  let busy = $state<string[]>([]);
  const dashboards = $derived(
    data.dashboards
      .filter(
        (dashboard) =>
          (filter !== "pinned" || dashboard.pinned) &&
          `${dashboard.name} ${dashboard.description}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      .toSorted((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
  );
  $effect(() => {
    if (page.url.searchParams.get("new") === "1") {
      creating = true;
      // Preserve SvelteKit's already-resolved URL while consuming the one-shot action.
      const next = new URL(page.url);
      next.searchParams.delete("new");
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      replaceState(next, page.state);
    }
  });
  const action = async (id: string, run: () => Promise<void>) => {
    if (busy.includes(id)) return;
    busy = [...busy, id];
    try {
      await run();
    } catch {
      toast.error("Could not update dashboard.");
    } finally {
      busy = busy.filter((value) => value !== id);
    }
  };
  const pin = (id: string, pinned: boolean) =>
    action(id, async () => {
      const result = await pinDashboardCommand({ id, pinned });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      await invalidateAll();
    });
  const duplicate = (id: string) =>
    action(id, async () => {
      // Get the complete saved definition through the detail load rather than copying list metadata.
      await goto(resolve(`/a/${data.appId}/dashboards/${id}?duplicate=1`));
    });
  const remove = async () => {
    if (!removing) return;
    await action(removing.id, async () => {
      const result = await deleteDashboardCommand({ id: removing!.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      removing = null;
      await invalidateAll();
      toast.success("Dashboard deleted.");
    });
  };
  const formatUpdated = (value: string | Date) =>
    new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
</script>

<svelte:head><title>Dashboards · Orvo</title></svelte:head>

<PageContainer title="Dashboards" contentClass="p-4 md:p-6">
  <div class="mx-auto w-full max-w-7xl space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h2 class="text-xl font-semibold tracking-tight">Dashboards</h2>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          loading={creatingWithScout}
          onclick={createWithScout}
          ><IconSparkle data-slot="button-icon" />Create with Scout</Button
        >
        <Button id="new-dashboard-button" onclick={() => (creating = true)}
          ><IconPlus data-slot="button-icon" />New dashboard</Button
        >
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-48 flex-1 sm:max-w-sm">
        <IconSearch
          class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        /><Input
          aria-label="Search dashboards"
          placeholder="Search dashboards…"
          bind:value={search}
          class="pl-8"
        />
      </div>
      <div class="ml-auto flex gap-2">
        <Select.Root type="single" bind:value={filter}
          ><Select.Trigger class="w-36"
            >{filter === "pinned"
              ? "Pinned dashboards"
              : "All dashboards"}</Select.Trigger
          ><Select.Content
            ><Select.Item value="all">All dashboards</Select.Item><Select.Item
              value="pinned">Pinned dashboards</Select.Item
            ></Select.Content
          ></Select.Root
        >
        <Select.Root type="single" bind:value={sort}
          ><Select.Trigger class="w-32"
            >{sort === "name" ? "Name" : "Last updated"}</Select.Trigger
          ><Select.Content
            ><Select.Item value="updated">Last updated</Select.Item><Select.Item
              value="name">Name</Select.Item
            ></Select.Content
          ></Select.Root
        >
      </div>
    </div>
    {#if data.dashboards.length === 0}
      <div
        class="flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 text-center"
      >
        <IconLayoutDashboard class="size-6 text-muted-foreground" />
        <p class="text-sm font-medium">Create your first dashboard</p>
        <p class="max-w-sm text-sm text-muted-foreground">
          Arrange charts, logs, and metrics in a view of your own.
        </p>
        <Button variant="outline" onclick={() => (creating = true)}
          ><IconPlus data-slot="button-icon" />New dashboard</Button
        >
      </div>
    {:else}
      <div class="overflow-hidden rounded-xl border">
        <Table.Root>
          <Table.Header
            ><Table.Row class="bg-muted/40 hover:bg-muted/40"
              ><Table.Head class="pl-4">Name</Table.Head><Table.Head
                class="w-24">Panels</Table.Head
              ><Table.Head class="hidden w-48 sm:table-cell">Updated</Table.Head
              ><Table.Head class="w-20"
                ><span class="sr-only">Actions</span></Table.Head
              ></Table.Row
            ></Table.Header
          >
          <Table.Body>
            {#each dashboards as dashboard (dashboard.id)}
              <Table.Row data-testid="dashboard-row">
                <Table.Cell class="p-0"
                  ><a
                    class="flex min-w-0 items-center gap-3 px-4 py-4"
                    href={resolve(
                      `/a/${data.appId}/dashboards/${dashboard.id}`,
                    )}
                    ><span
                      class="rounded-lg bg-muted/60 p-2 text-muted-foreground"
                      ><IconLayoutDashboard class="size-4" /></span
                    ><span class="min-w-0"
                      ><span
                        class="block truncate text-sm font-medium hover:underline"
                        >{dashboard.name}</span
                      >{#if dashboard.description}<span
                          class="mt-0.5 block truncate text-sm text-muted-foreground"
                          >{dashboard.description}</span
                        >{/if}</span
                    ></a
                  ></Table.Cell
                >
                <Table.Cell class="text-sm text-muted-foreground tabular-nums"
                  >{dashboard.panelCount}</Table.Cell
                >
                <Table.Cell
                  class="hidden text-sm text-muted-foreground sm:table-cell"
                  >{formatUpdated(dashboard.updatedAt)}</Table.Cell
                >
                <Table.Cell
                  ><div class="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${dashboard.pinned ? "Unpin" : "Pin"} ${dashboard.name}`}
                      aria-pressed={dashboard.pinned}
                      class={dashboard.pinned
                        ? "text-primary"
                        : "text-muted-foreground"}
                      disabled={busy.includes(dashboard.id)}
                      onclick={() => pin(dashboard.id, !dashboard.pinned)}
                      >{#if dashboard.pinned}<IconPinnedFilled />{:else}<IconPin
                        />{/if}</Button
                    >
                    <DropdownMenu.Root
                      ><DropdownMenu.Trigger
                        class={buttonVariants({
                          variant: "ghost",
                          size: "icon-sm",
                        })}
                        aria-label={`Actions for ${dashboard.name}`}
                        ><IconDots /></DropdownMenu.Trigger
                      ><DropdownMenu.Content align="end"
                        ><DropdownMenu.Item
                          onSelect={() =>
                            goto(
                              resolve(
                                `/a/${data.appId}/dashboards/${dashboard.id}`,
                              ),
                            )}
                          ><IconArrowUpRight />Open dashboard</DropdownMenu.Item
                        ><DropdownMenu.Item
                          onSelect={() => duplicate(dashboard.id)}
                          ><IconCopy />Duplicate</DropdownMenu.Item
                        ><DropdownMenu.Separator /><DropdownMenu.Item
                          variant="destructive"
                          onSelect={() => (removing = dashboard)}
                          ><IconTrash />Delete</DropdownMenu.Item
                        ></DropdownMenu.Content
                      ></DropdownMenu.Root
                    >
                  </div></Table.Cell
                >
              </Table.Row>
            {:else}<Table.Row
                ><Table.Cell
                  colspan={4}
                  class="h-32 text-center text-muted-foreground"
                  >No dashboards match your search.</Table.Cell
                ></Table.Row
              >{/each}
          </Table.Body>
        </Table.Root>
      </div>
      <p class="text-sm text-muted-foreground">
        {dashboards.length}
        {dashboards.length === 1 ? "dashboard" : "dashboards"}
      </p>
    {/if}
  </div>
</PageContainer>
<CreateDashboardDialog bind:open={creating} />
<Dialog.Root
  open={removing !== null}
  onOpenChange={(open) => {
    if (!open) removing = null;
  }}
  ><Dialog.Content class="sm:max-w-sm"
    ><Dialog.Header
      ><Dialog.Title>Delete dashboard?</Dialog.Title><Dialog.Description
        >“{removing?.name}” will be removed from dashboards and your sidebar.</Dialog.Description
      ></Dialog.Header
    ><Dialog.Footer
      ><Button variant="outline" onclick={() => (removing = null)}
        >Cancel</Button
      ><Button
        variant="destructive"
        loading={!!removing && busy.includes(removing.id)}
        onclick={remove}>Delete dashboard</Button
      ></Dialog.Footer
    ></Dialog.Content
  ></Dialog.Root
>
