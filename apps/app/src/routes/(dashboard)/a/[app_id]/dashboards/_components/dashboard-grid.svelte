<script lang="ts">
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import {
    IconGripVertical,
    IconDots,
    IconPencil,
    IconCopy,
    IconTrash,
    IconArrowDownRight,
    IconPlus,
  } from "@tabler/icons-svelte";
  import {
    GRID_COLUMNS,
    GRID_ROW_HEIGHT,
    GRID_GAP,
    placePanel,
  } from "$lib/dashboards/grid";
  import type { DashboardPanel } from "$lib/dashboards/schema";
  import { dashboardTimeRanges } from "$lib/dashboards/schema";
  import PanelContent from "./panel-content.svelte";
  let {
    panels,
    editing,
    selectedId,
    timeRange,
    refresh,
    onselect,
    onchange,
    onduplicate,
    ondelete,
    onadd,
  }: {
    panels: DashboardPanel[];
    editing: boolean;
    selectedId: string | null;
    timeRange: (typeof dashboardTimeRanges)[number];
    refresh: number;
    onselect: (id: string) => void;
    onchange: (panels: DashboardPanel[]) => void;
    onduplicate: (id: string) => void;
    ondelete: (id: string) => void;
    onadd: () => void;
  } = $props();
  let width = $state(0);
  let interaction = $state<{
    id: string;
    mode: "move" | "resize";
    pointerId: number;
    startX: number;
    startY: number;
    columnPitch: number;
    original: DashboardPanel[];
  } | null>(null);
  let preview = $state<DashboardPanel[] | null>(null);
  const displayed = $derived(preview ?? panels);
  const bottom = $derived(
    Math.max(0, ...displayed.map((panel) => panel.y + panel.h)),
  );
  const start = (event: PointerEvent, id: string, mode: "move" | "resize") => {
    if (!editing || width < 640 || event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    interaction = {
      id,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      columnPitch: (width + GRID_GAP) / GRID_COLUMNS,
      original: structuredClone($state.snapshot(panels)),
    };
  };
  const move = (event: PointerEvent) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    const panel = interaction.original.find((p) => p.id === interaction!.id)!;
    const dx = Math.round(
      (event.clientX - interaction.startX) / interaction.columnPitch,
    );
    const dy = Math.round(
      (event.clientY - interaction.startY) / (GRID_ROW_HEIGHT + GRID_GAP),
    );
    preview = placePanel(
      interaction.original,
      panel.id,
      interaction.mode === "move"
        ? { ...panel, x: panel.x + dx, y: panel.y + dy }
        : {
            ...panel,
            w: Math.min(24 - panel.x, panel.w + dx),
            h: panel.h + dy,
          },
    );
  };
  const finish = (event: PointerEvent) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    if (preview) onchange(preview);
    interaction = null;
    preview = null;
  };
  const cancel = () => {
    interaction = null;
    preview = null;
  };
  const keyboard = (
    event: KeyboardEvent,
    panel: DashboardPanel,
    resize = false,
  ) => {
    if (event.key === "Escape") {
      cancel();
      return;
    }
    if (
      !editing ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const dx =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    onchange(
      placePanel(
        panels,
        panel.id,
        event.shiftKey || resize
          ? {
              ...panel,
              w: Math.min(24 - panel.x, panel.w + dx),
              h: panel.h + dy,
            }
          : { ...panel, x: panel.x + dx, y: panel.y + dy },
      ),
    );
  };
</script>

<svelte:window
  onpointermove={move}
  onpointerup={finish}
  onpointercancel={cancel}
  onkeydown={(event) => {
    if (event.key === "Escape") cancel();
  }}
/>
<div class="min-w-0 flex-1 overflow-auto p-3">
  <div
    bind:clientWidth={width}
    class="dashboard-grid relative grid gap-3"
    class:editing
    style:grid-template-columns={width >= 640
      ? "repeat(24, minmax(0, 1fr))"
      : "minmax(0, 1fr)"}
    style:grid-auto-rows={width >= 640 ? `${GRID_ROW_HEIGHT}px` : "auto"}
    style:background-size={`${(width + GRID_GAP) / GRID_COLUMNS}px ${GRID_ROW_HEIGHT + GRID_GAP}px`}
    style:min-height={editing ? "480px" : undefined}
  >
    {#each displayed as panel (panel.id)}
      <section
        data-testid="dashboard-panel"
        data-panel-id={panel.id}
        data-grid-x={panel.x}
        data-grid-y={panel.y}
        data-grid-w={panel.w}
        data-grid-h={panel.h}
        aria-label={panel.title}
        class="relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
        class:ring-2={editing &&
          (selectedId === panel.id || interaction?.id === panel.id)}
        class:ring-primary={editing &&
          (selectedId === panel.id || interaction?.id === panel.id)}
        style:grid-column={width >= 640
          ? `${panel.x + 1} / span ${panel.w}`
          : undefined}
        style:grid-row={width >= 640
          ? `${panel.y + 1} / span ${panel.h}`
          : undefined}
        style:height={width < 640
          ? `${Math.max(132, panel.h * (GRID_ROW_HEIGHT + GRID_GAP) - GRID_GAP)}px`
          : undefined}
      >
        <header class="flex h-11 shrink-0 items-center gap-1 px-3">
          {#if editing}<Button
              variant="ghost"
              size="icon-xs"
              class="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
              aria-label={`Move ${panel.title}. Use arrow keys to move, Shift and arrow keys to resize.`}
              onpointerdown={(event) => start(event, panel.id, "move")}
              onkeydown={(event) => keyboard(event, panel)}
              ><IconGripVertical /></Button
            >{/if}
          {#if editing}<Button
              variant="ghost"
              class="min-w-0 flex-1 justify-start truncate px-1 text-left"
              onclick={() => onselect(panel.id)}>{panel.title}</Button
            >{:else}<h3 class="min-w-0 flex-1 truncate text-sm font-medium">
              {panel.title}
            </h3>{/if}
          {#if editing}<DropdownMenu.Root
              ><DropdownMenu.Trigger
                class={buttonVariants({ variant: "ghost", size: "icon-xs" })}
                aria-label={`Actions for panel ${panel.title}`}
                ><IconDots /></DropdownMenu.Trigger
              ><DropdownMenu.Content align="end"
                ><DropdownMenu.Item onSelect={() => onselect(panel.id)}
                  ><IconPencil />Edit panel</DropdownMenu.Item
                ><DropdownMenu.Item onSelect={() => onduplicate(panel.id)}
                  ><IconCopy />Duplicate</DropdownMenu.Item
                ><DropdownMenu.Separator /><DropdownMenu.Item
                  variant="destructive"
                  onSelect={() => ondelete(panel.id)}
                  ><IconTrash />Remove panel</DropdownMenu.Item
                ></DropdownMenu.Content
              ></DropdownMenu.Root
            >{/if}
        </header>
        <div class="min-h-0 flex-1">
          <PanelContent {panel} {timeRange} {refresh} />
        </div>
        {#if editing && width >= 640}<Button
            variant="ghost"
            size="icon-xs"
            class="absolute right-0 bottom-0 cursor-se-resize touch-none rounded-none text-muted-foreground"
            aria-label={`Resize ${panel.title}`}
            onpointerdown={(event) => start(event, panel.id, "resize")}
            onkeydown={(event) => keyboard(event, panel, true)}
            ><IconArrowDownRight class="size-3" /></Button
          >{/if}
      </section>
    {/each}
    {#if editing}<div
        class="flex min-h-28 items-center justify-center rounded-xl border border-dashed bg-background/70"
        style:grid-column={width >= 640 ? "1 / -1" : undefined}
        style:grid-row={width >= 640 ? `${bottom + 1} / span 3` : undefined}
      >
        <Button variant="ghost" onclick={onadd}
          ><IconPlus data-slot="button-icon" />Add panel</Button
        >
      </div>{/if}
    {#if interaction && preview}{@const active = preview.find(
        (p) => p.id === interaction!.id,
      )!}
      <div
        class="pointer-events-none absolute right-3 bottom-3 rounded-md bg-foreground px-2 py-1 text-xs text-background"
        role="status"
      >
        {active.w} columns × {active.h} rows
      </div>{/if}
  </div>
</div>

<style>
  .dashboard-grid.editing {
    background-image:
      linear-gradient(
        to right,
        color-mix(in oklab, var(--primary) 12%, transparent) 1px,
        transparent 1px
      ),
      linear-gradient(
        to bottom,
        color-mix(in oklab, var(--primary) 8%, transparent) 1px,
        transparent 1px
      );
    background-position: 0 0;
  }
</style>
