import { expect, test, vi } from "vitest";
import { createDashboardEditorController } from "$lib/dashboards/editor-controller";
import { dashboardDefinitionSchema } from "$lib/dashboards/schema";

const harness = () => {
  let form = dashboardDefinitionSchema.parse({
    name: "My dashboard",
    panels: [],
  });
  let active = true;
  const save = vi.fn(async () => ({ success: true }));
  const preview = vi.fn(async () => ({
    success: true,
    data: { series: [{ name: "All", value: 350 }], logs: [], unit: "tokens" },
  }));
  const controller = createDashboardEditorController({
    editorId: "editor-1",
    dashboardId: "dash-1",
    isActive: () => active,
    getForm: () => form,
    setForm: (next) => {
      form = next;
    },
    reveal: async () => {},
    save,
    preview,
  });
  return {
    controller,
    save,
    preview,
    getForm: () => form,
    setName: (name: string) => {
      form.name = name;
    },
    close: () => {
      active = false;
    },
  };
};
const target = { editorId: "editor-1", dashboardId: "dash-1" };

test("Scout composes visible token panels, previews data, preserves other fields, and saves the form", async () => {
  const h = harness();
  expect(
    await h.controller.execute("get_dashboard_editor", target),
  ).toMatchObject({
    data: { revision: 0, form: { name: "My dashboard", panels: [] } },
  });
  const added = await h.controller.execute("upsert_dashboard_panel", {
    ...target,
    revision: 0,
    panel: {
      title: "Input tokens",
      visualization: "stat",
      measure: "input_tokens",
      unit: "tokens",
      service: "orvo-app-server",
    },
  });
  expect(added).toMatchObject({ data: { revision: 1 } });
  const panel = h.getForm().panels[0];
  expect(panel).toMatchObject({
    title: "Input tokens",
    w: 6,
    h: 3,
    source: "traces",
    measure: "input_tokens",
  });
  await h.controller.execute("upsert_dashboard_panel", {
    ...target,
    revision: 1,
    panel: { id: panel.id, title: "Scout input" },
  });
  expect(h.getForm().panels[0]).toMatchObject({
    service: "orvo-app-server",
    title: "Scout input",
    measure: "input_tokens",
  });
  expect(
    await h.controller.execute("preview_dashboard_panel", {
      ...target,
      revision: 2,
      panelId: panel.id,
    }),
  ).toMatchObject({
    data: { preview: { series: [{ name: "All", value: 350 }] } },
  });
  await h.controller.execute("review_dashboard_layout", {
    ...target,
    revision: 2,
  });
  expect(
    await h.controller.execute("save_dashboard", { ...target, revision: 2 }),
  ).toMatchObject({ data: { saved: true, savedRevision: 2 } });
  expect(h.save).toHaveBeenCalledExactlyOnceWith(h.getForm());
});

test("stale, wrong-target and closed editor calls cannot overwrite user changes", async () => {
  const h = harness();
  h.setName("User edit");
  expect(
    await h.controller.execute("edit_dashboard", {
      ...target,
      revision: 0,
      settings: { name: "Stale" },
    }),
  ).toMatchObject({ error: expect.stringContaining("changed") });
  expect(h.getForm().name).toBe("User edit");
  expect(
    await h.controller.execute("get_dashboard_editor", {
      ...target,
      dashboardId: "other",
    }),
  ).toMatchObject({ error: expect.stringContaining("no longer open") });
  h.close();
  expect(
    await h.controller.execute("save_dashboard", { ...target, revision: 1 }),
  ).toMatchObject({ error: expect.any(String) });
  expect(h.save).not.toHaveBeenCalled();
});

test("panel additions snap, push collisions down, and reject invalid changes atomically", async () => {
  const h = harness();
  await h.controller.execute("upsert_dashboard_panel", {
    ...target,
    revision: 0,
    panel: { title: "First", x: 0, y: 0, w: 12, h: 6 },
  });
  await h.controller.execute("upsert_dashboard_panel", {
    ...target,
    revision: 1,
    panel: { title: "Second", x: 0, y: 0, w: 12, h: 6 },
  });
  expect(h.getForm().panels.map((p) => p.y)).toEqual([6, 0]);
  const before = structuredClone(h.getForm());
  expect(
    await h.controller.execute("upsert_dashboard_panel", {
      ...target,
      revision: 2,
      panel: { source: "metrics", metricName: "" },
    }),
  ).toMatchObject({ error: expect.any(String) });
  expect(h.getForm()).toEqual(before);
});

test("Scout can create a panel with a supplied id and patch it without duplicating it", async () => {
  const h = harness();
  const panel = {
    id: "total-tokens",
    title: "Total tokens",
    visualization: "stat",
    source: "traces",
    measure: "total_tokens",
    aggregation: "sum",
    unit: "tokens",
    service: "orvo-app-server",
    x: 0,
    y: 0,
    w: 8,
    h: 4,
    text: "",
    model: "",
    provider: "",
    metricName: "",
    environment: "",
    groupBy: "none",
  };
  expect(
    await h.controller.execute("upsert_dashboard_panel", {
      ...target,
      revision: 0,
      panel,
    }),
  ).toMatchObject({ data: { revision: 1, form: { panels: [panel] } } });
  expect(
    await h.controller.execute("upsert_dashboard_panel", {
      ...target,
      revision: 1,
      panel: { id: "total-tokens", title: "All Scout tokens" },
    }),
  ).toMatchObject({ data: { revision: 2 } });
  expect(h.getForm().panels).toEqual([{ ...panel, title: "All Scout tokens" }]);
  expect(
    await h.controller.execute("preview_dashboard_panel", {
      ...target,
      revision: 2,
      panelId: "total-tokens",
    }),
  ).toMatchObject({ data: { preview: { panelId: "total-tokens" } } });
  await h.controller.execute("review_dashboard_layout", {
    ...target,
    revision: 2,
  });
  expect(
    await h.controller.execute("save_dashboard", {
      ...target,
      revision: 2,
    }),
  ).toMatchObject({ data: { saved: true } });
  expect(h.save).toHaveBeenCalledExactlyOnceWith(h.getForm());
});

test("multi-panel layouts swap positions atomically and must be reviewed before saving", async () => {
  const h = harness();
  await h.controller.execute("upsert_dashboard_panel", {
    ...target,
    revision: 0,
    panel: { id: "left", title: "Left", x: 0, y: 0, w: 12, h: 6 },
  });
  await h.controller.execute("upsert_dashboard_panel", {
    ...target,
    revision: 1,
    panel: { id: "right", title: "Right", x: 12, y: 0, w: 12, h: 6 },
  });
  expect(
    await h.controller.execute("save_dashboard", { ...target, revision: 2 }),
  ).toMatchObject({
    error: expect.stringContaining("review_dashboard_layout"),
  });
  expect(h.save).not.toHaveBeenCalled();
  const before = structuredClone(h.getForm());
  expect(
    await h.controller.execute("layout_dashboard", {
      ...target,
      revision: 2,
      placements: [{ id: "left", x: 12, y: 0, w: 12, h: 6 }],
    }),
  ).toMatchObject({ error: expect.stringContaining("overlap") });
  expect(h.getForm()).toEqual(before);
  expect(
    await h.controller.execute("layout_dashboard", {
      ...target,
      revision: 2,
      placements: [
        { id: "left", x: 12, y: 0, w: 12, h: 6 },
        { id: "right", x: 0, y: 0, w: 12, h: 6 },
      ],
    }),
  ).toMatchObject({ data: { revision: 3, grid: { layoutNeedsReview: true } } });
  expect(
    h.getForm().panels.map((panel) => [panel.id, panel.x, panel.y]),
  ).toEqual([
    ["left", 12, 0],
    ["right", 0, 0],
  ]);
  expect(h.getForm().panels.map((panel) => panel.title)).toEqual([
    "Left",
    "Right",
  ]);
  expect(
    await h.controller.execute("review_dashboard_layout", {
      ...target,
      revision: 3,
    }),
  ).toMatchObject({
    data: {
      grid: { layoutNeedsReview: false },
      layoutReview: { readingOrder: [{ id: "right" }, { id: "left" }] },
    },
  });
  expect(
    await h.controller.execute("save_dashboard", { ...target, revision: 3 }),
  ).toMatchObject({ data: { saved: true } });
  await h.controller.execute("upsert_dashboard_panel", {
    ...target,
    revision: 3,
    panel: { id: "left", h: 8 },
  });
  expect(
    await h.controller.execute("save_dashboard", { ...target, revision: 4 }),
  ).toMatchObject({ error: expect.stringContaining("layout changed") });
  expect(h.save).toHaveBeenCalledTimes(1);
});

test("invalid and stale arrangements leave the entire dashboard unchanged", async () => {
  const h = harness();
  await h.controller.execute("upsert_dashboard_panel", {
    ...target,
    revision: 0,
    panel: { id: "panel", title: "Original" },
  });
  const before = structuredClone(h.getForm());
  for (const placements of [
    [{ id: "missing", x: 0, y: 0, w: 12, h: 6 }],
    [{ id: "panel", x: 20, y: 0, w: 12, h: 6 }],
    [
      { id: "panel", x: 0, y: 0, w: 12, h: 6 },
      { id: "panel", x: 12, y: 0, w: 12, h: 6 },
    ],
  ]) {
    expect(
      await h.controller.execute("layout_dashboard", {
        ...target,
        revision: 1,
        placements,
      }),
    ).toMatchObject({ error: expect.any(String) });
    expect(h.getForm()).toEqual(before);
  }
  h.setName("My changes");
  expect(
    await h.controller.execute("layout_dashboard", {
      ...target,
      revision: 1,
      placements: [{ id: "panel", x: 0, y: 0, w: 12, h: 6 }],
    }),
  ).toMatchObject({ error: expect.stringContaining("changed") });
  expect(h.getForm().name).toBe("My changes");
});

test("custom-sized new panels find space using their final dimensions", async () => {
  const h = harness();
  await h.controller.execute("upsert_dashboard_panel", {
    ...target,
    revision: 0,
    panel: { id: "first", visualization: "stat", w: 8, h: 3 },
  });
  await h.controller.execute("upsert_dashboard_panel", {
    ...target,
    revision: 1,
    panel: { id: "second", visualization: "stat", w: 8, h: 3 },
  });
  await h.controller.execute("upsert_dashboard_panel", {
    ...target,
    revision: 2,
    panel: { id: "third", visualization: "stat", w: 8, h: 3 },
  });
  expect(
    h.getForm().panels.map((panel) => [panel.x, panel.y, panel.w]),
  ).toEqual([
    [0, 0, 8],
    [8, 0, 8],
    [16, 0, 8],
  ]);
});
