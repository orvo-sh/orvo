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
    x: 0, y: 0, w: 8, h: 4,
    text: "", model: "", provider: "", metricName: "", environment: "",
    groupBy: "none",
  };
  expect(await h.controller.execute("upsert_dashboard_panel", {
    ...target, revision: 0, panel,
  })).toMatchObject({ data: { revision: 1, form: { panels: [panel] } } });
  expect(await h.controller.execute("upsert_dashboard_panel", {
    ...target, revision: 1,
    panel: { id: "total-tokens", title: "All Scout tokens" },
  })).toMatchObject({ data: { revision: 2 } });
  expect(h.getForm().panels).toEqual([{ ...panel, title: "All Scout tokens" }]);
  expect(await h.controller.execute("preview_dashboard_panel", {
    ...target, revision: 2, panelId: "total-tokens",
  })).toMatchObject({ data: { preview: { panelId: "total-tokens" } } });
  expect(await h.controller.execute("save_dashboard", {
    ...target, revision: 2,
  })).toMatchObject({ data: { saved: true } });
  expect(h.save).toHaveBeenCalledExactlyOnceWith(h.getForm());
});
