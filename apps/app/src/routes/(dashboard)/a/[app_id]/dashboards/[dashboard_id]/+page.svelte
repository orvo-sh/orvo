<script lang="ts">
  import { resolve } from "$app/paths";
  import { beforeNavigate, goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import * as Chat from "$lib/chat";
  import { createDashboardEditorController } from "$lib/dashboards/editor-controller";
  import { createDashboardPanel } from "$lib/dashboards/panels";
  import { tick, untrack } from "svelte";
  import {
    getDashboardPanelDataQuery,
    createDashboardCommand,
    updateDashboardCommand,
    pinDashboardCommand,
  } from "$lib/api/dashboards.remote";
  import {
    dashboardDefinitionSchema,
    dashboardTimeRanges,
    type DashboardPanel,
  } from "$lib/dashboards/schema";
  import { nextPosition, placePanel } from "$lib/dashboards/grid";
  import { genId } from "@repo/utils";
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { Textarea } from "@repo/components/ui/textarea";
  import * as Dialog from "@repo/components/ui/dialog";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconPlus,
    IconArrowBackUp,
    IconArrowForwardUp,
    IconPencil,
    IconRefresh,
    IconPin,
    IconPinnedFilled,
    IconChartLine,
    IconNumber123,
    IconTable,
    IconChartBar,
    IconTerminal2,
    IconTypography,
  } from "@tabler/icons-svelte";
  import PageContainer from "../../_components/page-container/page-container.svelte";
  import DashboardGrid from "../_components/dashboard-grid.svelte";
  import PanelSettings from "../_components/panel-settings.svelte";
  import SelectField from "../_components/select-field.svelte";
  let { data } = $props();
  const chat = Chat.useChatState();
  let loadedId = $state("");
  let name = $state(untrack(() => data.dashboard.name));
  let description = $state(untrack(() => data.dashboard.description));
  let panels = $state<DashboardPanel[]>(
    untrack(() => structuredClone($state.snapshot(data.dashboard.panels))),
  );
  let timeRange = $state<(typeof dashboardTimeRanges)[number]>("last_hour");
  let editing = $state(
    untrack(() => page.url.searchParams.get("edit") === "1"),
  );
  let saving = $state(false);
  let pinning = $state(false);
  let selectedId = $state<string | null>(null);
  let dock = $state<"add" | "settings" | null>(null);
  let dockOpen = $state(false);
  let metadataOpen = $state(false);
  let refresh = $state(0);
  let history = $state<DashboardPanel[][]>([]);
  let future = $state<DashboardPanel[][]>([]);
  let savedDefinition = $state("");
  let leaveHref = $state<string | null>(null);
  let leaveOpen = $state(false);
  let allowLeave = false;
  let duplicateId = $state("");
  const definition = $derived({ name, description, panels, timeRange });
  const dirty = $derived(JSON.stringify(definition) !== savedDefinition);
  const selected = $derived(panels.find((panel) => panel.id === selectedId));
  const pinned = $derived(
    data.dashboards.some(
      (dashboard) => dashboard.id === data.dashboard.id && dashboard.pinned,
    ),
  );
  const reset = () => {
    name = data.dashboard.name;
    description = data.dashboard.description;
    panels = structuredClone($state.snapshot(data.dashboard.panels));
    timeRange = data.dashboard.timeRange;
    savedDefinition = JSON.stringify({
      name,
      description,
      panels,
      timeRange,
    });
    history = [];
    future = [];
    selectedId = null;
    dock = null;
    dockOpen = false;
  };
  $effect(() => {
    const id = data.dashboard.id;
    if (loadedId !== id)
      untrack(() => {
        reset();
        loadedId = id;
        editing = page.url.searchParams.get("edit") === "1";
        if (editing && !panels.length) {
          dock = "add";
          dockOpen = true;
        }
      });
  });
  $effect(() => {
    if (
      page.url.searchParams.get("duplicate") === "1" &&
      duplicateId !== data.dashboard.id
    ) {
      duplicateId = data.dashboard.id;
      untrack(async () => {
        try {
          const result = await createDashboardCommand({
            name: `${data.dashboard.name.slice(0, 113)} (copy)`,
            description: data.dashboard.description,
            timeRange: data.dashboard.timeRange,
            panels: data.dashboard.panels,
          });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          allowLeave = true;
          await goto(
            resolve(`/a/${data.appId}/dashboards/${result.data.id}?edit=1`),
            {
              replaceState: true,
            },
          );
          await invalidateAll();
          allowLeave = false;
        } catch {
          toast.error("Failed to duplicate dashboard.");
        }
      });
    }
  });
  beforeNavigate((navigation) => {
    if (!editing || !dirty || allowLeave) return;
    if (navigation.willUnload) {
      navigation.cancel();
      return;
    }
    navigation.cancel();
    leaveHref = navigation.to?.url.href ?? null;
    leaveOpen = true;
  });
  const changePanels = (next: DashboardPanel[]) => {
    history = [...history.slice(-49), structuredClone($state.snapshot(panels))];
    future = [];
    panels = next;
  };
  const select = (id: string) => {
    selectedId = id;
    dock = "settings";
    dockOpen = true;
  };
  const addPanel = (visualization: DashboardPanel["visualization"]) => {
    const panel = createDashboardPanel(panels, visualization);
    changePanels([...panels, panel]);
    select(panel.id);
  };
  const updatePanel = (patch: Partial<DashboardPanel>) => {
    if (!selected) return;
    const next = panels.map((panel) =>
      panel.id === selectedId ? { ...panel, ...patch } : panel,
    );
    changePanels(
      patch.w !== undefined || patch.h !== undefined
        ? placePanel(next, selected.id, {
            x: selected.x,
            y: selected.y,
            w: Math.min(24 - selected.x, patch.w ?? selected.w),
            h: patch.h ?? selected.h,
          })
        : next,
    );
  };
  const duplicatePanel = (id: string) => {
    const panel = panels.find((p) => p.id === id)!;
    const copy = {
      ...panel,
      id: genId("panel"),
      title: `${panel.title.slice(0, 113)} (copy)`,
      ...nextPosition(panels, panel.w, panel.h),
    };
    changePanels([...panels, copy]);
    select(copy.id);
  };
  const removePanel = (id: string) => {
    changePanels(panels.filter((panel) => panel.id !== id));
    if (selectedId === id) {
      selectedId = null;
      dockOpen = false;
    }
  };
  const save = async (candidate = $state.snapshot(definition)) => {
    if (saving)
      return {
        success: false,
        error: "A dashboard save is already in progress.",
      };
    const validated = dashboardDefinitionSchema.safeParse(candidate);
    if (!validated.success) {
      toast.error(
        validated.error.issues[0]?.message ?? "Check dashboard settings.",
      );
      return {
        success: false,
        error: validated.error.issues[0]?.message ?? "Invalid dashboard.",
      };
    }
    saving = true;
    try {
      const result = await updateDashboardCommand({
        ...validated.data,
        id: data.dashboard.id,
        revision: data.dashboard.revision,
      });
      if (!result.success) {
        toast.error(result.error);
        return { success: false, error: result.error };
      }
      savedDefinition = JSON.stringify(validated.data);
      editing = JSON.stringify($state.snapshot(definition)) !== savedDefinition;
      dockOpen = false;
      dock = null;
      await invalidateAll();
      if (!editing) await goto(resolve(`/a/${data.appId}/dashboards/${data.dashboard.id}`), {
        replaceState: true,
        noScroll: true,
        keepFocus: true,
      });
      toast.success("Dashboard saved.");
      return { success: true };
    } catch {
      toast.error("Failed to save dashboard.");
      return { success: false, error: "Failed to save dashboard." };
    } finally {
      saving = false;
    }
  };
  const togglePin = async () => {
    pinning = true;
    try {
      const result = await pinDashboardCommand({
        id: data.dashboard.id,
        pinned: !pinned,
      });
      if (!result.success) toast.error(result.error);
      else await invalidateAll();
    } catch {
      toast.error("Failed to update pin.");
    } finally {
      pinning = false;
    }
  };

  const dashboardChatContext = $derived<Chat.ChatContextDescriptor>({
    kind: "dashboard",
    resourceId: data.dashboard.id,
    label: name || "Dashboard",
    metadata: { panelCount: panels.length, timeRange, editing },
  });
  $effect(() => {
    const id = data.dashboard.id;
    let active = true;
    const controller = untrack(() =>
      createDashboardEditorController({
        editorId: genId("editor"),
        dashboardId: id,
        isActive: () => active && data.dashboard.id === id,
        getForm: () => $state.snapshot(definition),
        setForm: (next) => {
          editing = true;
          name = next.name;
          description = next.description;
          timeRange = next.timeRange;
          changePanels(next.panels);
        },
        reveal: async (panelId) => {
          dockOpen = false;
          if (panelId) selectedId = panelId;
          await tick();
        },
        preview: (panel, timeRange) =>
          getDashboardPanelDataQuery({ panel, timeRange }).run(),
        save,
      }),
    );
    chat.dashboardEditor = controller;
    chat.dashboardEditorPrompts = [
      {
        label: "Track Scout token usage",
        prompt:
          "Create and save a dashboard for Scout token usage. Include input tokens, output tokens, token usage over time, and usage by model. Check real panel data and tell me if telemetry is not available yet.",
      },
      {
        label: "Add a latency chart",
        prompt:
          "Add a p95 latency chart grouped by service to this dashboard and save it. Preserve the existing panels.",
      },
      {
        label: "Explain this dashboard",
        prompt:
          "Explain what this dashboard measures and what its current data shows. Do not modify it.",
      },
    ];
    return () => {
      active = false;
      if (chat.dashboardEditor === controller) {
        chat.dashboardEditor = null;
        chat.dashboardEditorPrompts = [];
      }
    };
  });
  $effect(() => {
    const open = chat.railOpen;
    const context = $state.snapshot(dashboardChatContext);
    untrack(() => {
      if (open && chat.context?.kind === "dashboard") chat.context = context;
    });
  });
  let scoutOpenedFor: string | undefined;
  $effect(() => {
    if (
      page.url.searchParams.get("scout") === "1" &&
      scoutOpenedFor !== data.dashboard.id
    ) {
      scoutOpenedFor = data.dashboard.id;
      untrack(() => {
        dockOpen = false;
        void chat.openContext($state.snapshot(dashboardChatContext));
      });
    }
  });

  const timeOptions = [
    { value: "last_30_minutes", label: "Last 30 minutes" },
    { value: "last_hour", label: "Last 1 hour" },
    { value: "last_4_hours", label: "Last 4 hours" },
    { value: "last_24_hours", label: "Last 24 hours" },
    { value: "last_7_days", label: "Last 7 days" },
  ];
</script>

<svelte:head><title>{name} · Dashboards · Orvo</title></svelte:head>

<PageContainer
  class="dashboard-detail"
  title={name || "Dashboard"}
  scout={dashboardChatContext}
  back={{ href: `/a/${data.appId}/dashboards`, title: "Dashboards" }}
  contentClass="overflow-hidden"
  asideTitle={dock === "add" ? "Add panel" : "Panel settings"}
  bind:asideOpen={dockOpen}
  aside={editing && dockOpen ? editorAside : undefined}
>
  {#snippet actions()}
    <div class="hidden sm:block">
      <SelectField
        label=""
        value={timeRange}
        options={timeOptions}
        onchange={(value) => (timeRange = value as typeof timeRange)}
      />
    </div>
    {#if editing}<Button
        variant="outline"
        disabled={saving}
        onclick={() => {
          reset();
          editing = false;
        }}>Cancel</Button
      ><Button
        id="save-dashboard-button"
        loading={saving}
        onclick={() => save()}
        ><span class="hidden sm:inline">Save dashboard</span><span
          class="sm:hidden">Save</span
        ></Button
      >
    {:else}<Button
        variant="ghost"
        size="icon"
        aria-label={pinned ? "Unpin dashboard" : "Pin dashboard"}
        class={pinned
          ? "hidden text-primary sm:inline-flex"
          : "hidden sm:inline-flex"}
        loading={pinning}
        onclick={togglePin}
        >{#if pinned}<IconPinnedFilled data-slot="button-icon" />{:else}<IconPin
            data-slot="button-icon"
          />{/if}</Button
      ><Button
        variant="outline"
        size="icon"
        aria-label="Refresh dashboard"
        class="hidden sm:inline-flex"
        onclick={() => refresh++}><IconRefresh /></Button
      ><Button id="edit-dashboard-button" onclick={() => (editing = true)}
        ><IconPencil data-slot="button-icon" /><span class="hidden sm:inline"
          >Edit dashboard</span
        ><span class="sm:hidden">Edit</span></Button
      >{/if}
  {/snippet}
  <div class="flex shrink-0 flex-wrap items-center gap-3 border-b px-3 py-2">
    {#if editing}<Button
        variant="outline"
        onclick={() => {
          dock = "add";
          dockOpen = true;
        }}><IconPlus data-slot="button-icon" />Add panel</Button
      >
      <div class="flex gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Undo panel change"
          disabled={!history.length}
          onclick={() => {
            future = [structuredClone($state.snapshot(panels)), ...future];
            panels = history.at(-1)!;
            history = history.slice(0, -1);
          }}><IconArrowBackUp /></Button
        ><Button
          variant="ghost"
          size="icon-sm"
          aria-label="Redo panel change"
          disabled={!future.length}
          onclick={() => {
            history = [...history, structuredClone($state.snapshot(panels))];
            panels = future[0];
            future = future.slice(1);
          }}><IconArrowForwardUp /></Button
        >
      </div>
      <Button variant="ghost" size="sm" onclick={() => (metadataOpen = true)}
        >Dashboard settings</Button
      ><span class="ml-auto text-xs text-muted-foreground" role="status"
        >{dirty ? "Unsaved changes" : "Editing dashboard"}</span
      >
    {:else}<p class="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {description ||
          `${panels.length} ${panels.length === 1 ? "panel" : "panels"}`}
      </p>{/if}
    <div class="w-full sm:hidden">
      <SelectField
        label="Time range"
        value={timeRange}
        options={timeOptions}
        onchange={(value) => (timeRange = value as typeof timeRange)}
      />
    </div>
  </div>
  {#if !editing && !panels.length}<div
      class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <IconChartLine class="size-6 text-muted-foreground" />
      <p class="text-sm font-medium">Your dashboard is ready for panels</p>
      <Button
        variant="outline"
        onclick={() => {
          editing = true;
          dock = "add";
          dockOpen = true;
        }}><IconPlus data-slot="button-icon" />Add your first panel</Button
      >
    </div>
  {:else}<DashboardGrid
      {panels}
      {editing}
      {timeRange}
      {refresh}
      {selectedId}
      onselect={select}
      onchange={changePanels}
      onduplicate={duplicatePanel}
      ondelete={removePanel}
      onadd={() => {
        dock = "add";
        dockOpen = true;
      }}
    />{/if}
</PageContainer>
{#snippet editorAside()}
  <div class="min-h-0 flex-1 overflow-y-auto">
    {#if dock === "add"}<div class="grid grid-cols-2 gap-3 p-4">
        {#each [{ value: "time_series", label: "Time series", icon: IconChartLine }, { value: "stat", label: "Stat", icon: IconNumber123 }, { value: "table", label: "Table", icon: IconTable }, { value: "bar", label: "Bar chart", icon: IconChartBar }, { value: "logs", label: "Logs", icon: IconTerminal2 }, { value: "text", label: "Text", icon: IconTypography }] as item (item.value)}<Button
            variant="outline"
            class="h-24 flex-col gap-3"
            onclick={() =>
              addPanel(item.value as DashboardPanel["visualization"])}
            ><item.icon class="size-6 text-primary" />{item.label}</Button
          >{/each}
      </div>
    {:else if selected}<PanelSettings
        panel={selected}
        onchange={updatePanel}
      />{:else}<p class="p-4 text-sm text-muted-foreground">
        Select a panel to edit its settings.
      </p>{/if}
  </div>
{/snippet}
<Dialog.Root bind:open={metadataOpen}
  ><Dialog.Content class="sm:max-w-md"
    ><Dialog.Header
      ><Dialog.Title>Dashboard settings</Dialog.Title></Dialog.Header
    >
    <div class="space-y-4">
      <div class="space-y-2">
        <Label for="edit-dashboard-name">Name</Label>
        <div class="flex items-center gap-2">
          <Input id="edit-dashboard-name" bind:value={name} maxlength={120} />
        </div>
      </div>
      <div class="space-y-2">
        <Label for="edit-dashboard-description">Description</Label><Textarea
          id="edit-dashboard-description"
          bind:value={description}
          maxlength={500}
          rows={3}
        />
      </div>
    </div>
    <Dialog.Footer
      ><Button onclick={() => (metadataOpen = false)}>Done</Button
      ></Dialog.Footer
    ></Dialog.Content
  ></Dialog.Root
>
<Dialog.Root bind:open={leaveOpen}
  ><Dialog.Content class="sm:max-w-sm"
    ><Dialog.Header
      ><Dialog.Title>Discard unsaved changes?</Dialog.Title><Dialog.Description
        >Your saved dashboard will stay as it was.</Dialog.Description
      ></Dialog.Header
    ><Dialog.Footer
      ><Button variant="outline" onclick={() => (leaveOpen = false)}
        >Keep editing</Button
      ><Button
        variant="destructive"
        onclick={async () => {
          allowLeave = true;
          leaveOpen = false;
          // SvelteKit supplied this fully resolved destination URL.
          // eslint-disable-next-line svelte/no-navigation-without-resolve
          if (leaveHref) await goto(leaveHref);
          allowLeave = false;
        }}>Discard changes</Button
      ></Dialog.Footer
    ></Dialog.Content
  ></Dialog.Root
>

<style>
  @media (max-width: 767px) {
    :global(.dashboard-detail > header > div.absolute) {
      left: 3.25rem;
      max-width: calc(100% - 16rem);
      transform: none;
      translate: none;
    }
  }
</style>
