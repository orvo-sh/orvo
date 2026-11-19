import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getDb, getDbClient, type DB } from "@repo/db";
import { user } from "@repo/db/schema";
import { createOrganization, createApp } from "../../helpers/app-fixtures";
import {
  applyPostgresMigrations,
  startPostgresContainer,
  stopPostgresContainer,
} from "../../helpers/postgres";
import { createTestLogger } from "../../helpers/logger";
import { createGetDashboards } from "$lib/server/services/dashboard/methods/get-dashboards";
import { createGetDashboard } from "$lib/server/services/dashboard/methods/get-dashboard";
import { createCreateDashboard } from "$lib/server/services/dashboard/methods/create-dashboard";
import { createUpdateDashboard } from "$lib/server/services/dashboard/methods/update-dashboard";
import { createDeleteDashboard } from "$lib/server/services/dashboard/methods/delete-dashboard";
import { createPinDashboard } from "$lib/server/services/dashboard/methods/pin-dashboard";
import { createDashboardEditorController } from "$lib/dashboards/editor-controller";
import { dashboardDefinitionSchema } from "$lib/dashboards/schema";
import type { DashboardPanel } from "$lib/dashboards/schema";

describe("saved dashboards", () => {
  let container: Awaited<ReturnType<typeof startPostgresContainer>>;
  let db: DB;
  let context: { appId: string; userId: string };
  let otherAppId: string;
  const logger = createTestLogger() as never;
  const sample: DashboardPanel = {
    id: "panel_a",
    title: "Latency",
    visualization: "time_series",
    x: 0,
    y: 3,
    w: 12,
    h: 6,
    source: "traces",
    measure: "duration",
    aggregation: "p95",
    metricName: "",
    service: "api",
    environment: "production",
    groupBy: "service",
    unit: "ms",
    text: "",
  };
  beforeAll(async () => {
    container = await startPostgresContainer();
    db = getDb(container.getConnectionUri());
    await applyPostgresMigrations(db);
    await db.insert(user).values([
      {
        id: "dash_user_a",
        name: "A",
        email: "dash-a@example.com",
        emailVerified: true,
      },
      {
        id: "dash_user_b",
        name: "B",
        email: "dash-b@example.com",
        emailVerified: true,
      },
    ]);
    const organization = await createOrganization(db);
    const app = await createApp(db, { organizationId: organization.id });
    const other = await createApp(db, { organizationId: organization.id });
    context = { appId: app.id, userId: "dash_user_a" };
    otherAppId = other.id;
  });
  afterAll(async () => {
    if (container) {
      await getDbClient(container.getConnectionUri()).end();
      await stopPostgresContainer(container);
    }
  });
  test("creates multiple dashboards, saves layouts, pins per user, protects revisions, and removes from navigation", async () => {
    const deps = { db, logger };
    const create = createCreateDashboard(deps),
      get = createGetDashboard(deps),
      list = createGetDashboards(deps),
      update = createUpdateDashboard(deps),
      pin = createPinDashboard(deps),
      remove = createDeleteDashboard(deps);
    const first = await create(
      { name: "Production health", panels: [] },
      context,
    );
    const second = await create(
      { name: "API performance", panels: [sample] },
      context,
    );
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) throw new Error("Create failed");
    const id = second.data.id;
    expect(await list(context)).toMatchObject({
      success: true,
      data: {
        dashboards: expect.arrayContaining([
          expect.objectContaining({
            id,
            panelCount: 1,
            pinned: false,
          }),
        ]),
      },
    });
    expect(await get({ id }, context)).toMatchObject({
      success: true,
      data: {
        dashboard: {
          name: "API performance",
          panels: [sample],
          revision: 1,
        },
      },
    });
    expect((await get({ id }, { appId: otherAppId })).success).toBe(false);
    expect(
      (
        await update(
          { id, name: "Wrong app", panels: [], revision: 1 },
          { appId: otherAppId },
        )
      ).success,
    ).toBe(false);
    expect(
      (await pin({ id, pinned: true }, { ...context, appId: otherAppId }))
        .success,
    ).toBe(false);
    expect((await remove({ id }, { appId: otherAppId })).success).toBe(false);
    expect((await pin({ id, pinned: true }, context)).success).toBe(true);
    expect(await list(context)).toMatchObject({
      data: {
        dashboards: expect.arrayContaining([
          expect.objectContaining({ id, pinned: true }),
        ]),
      },
    });
    expect(await list({ ...context, userId: "dash_user_b" })).toMatchObject({
      data: {
        dashboards: expect.arrayContaining([
          expect.objectContaining({ id, pinned: false }),
        ]),
      },
    });
    expect(
      (
        await update(
          {
            id,
            name: "API health",
            panels: [{ ...sample, x: 12, y: 0 }],
            revision: 1,
            timeRange: "last_4_hours",
          },
          context,
        )
      ).success,
    ).toBe(true);
    expect(
      (
        await update(
          { id, name: "Stale tab", panels: [], revision: 1 },
          context,
        )
      ).success,
    ).toBe(false);
    expect(await get({ id }, context)).toMatchObject({
      data: {
        dashboard: {
          name: "API health",
          panels: [{ ...sample, x: 12, y: 0 }],
          revision: 2,
          timeRange: "last_4_hours",
        },
      },
    });
    expect((await remove({ id }, context)).success).toBe(true);
    expect((await get({ id }, context)).success).toBe(false);
    const remaining = await list(context);
    expect(
      remaining.success && remaining.data.dashboards.map((d) => d.id),
    ).toEqual([first.data.id]);
  });
  test("Scout's visible form saves through the real dashboard service and reloads intact", async () => {
    const deps = { db, logger };
    const created = await createCreateDashboard(deps)({ name: "Untitled dashboard", panels: [] }, context);
    if (!created.success) throw new Error(created.error);
    let form = dashboardDefinitionSchema.parse({ name: "Untitled dashboard", panels: [] });
    const editor = createDashboardEditorController({
      editorId: "live-editor", dashboardId: created.data.id, isActive: () => true,
      getForm: () => form, setForm: (next) => { form = next; }, reveal: async () => {},
      preview: async () => ({ success: true, data: { series: [], logs: [], unit: "tokens" } }),
      save: (next) => createUpdateDashboard(deps)({ ...next, id: created.data.id, revision: 1 }, context),
    });
    const target = { editorId: "live-editor", dashboardId: created.data.id };
    expect(await editor.execute("edit_dashboard", { ...target, revision: 0, settings: { name: "Scout token usage" } })).toMatchObject({ data: { revision: 1 } });
    expect(await editor.execute("upsert_dashboard_panel", { ...target, revision: 1, panel: { id: "scout-input-tokens", title: "Input tokens", measure: "input_tokens", visualization: "stat", unit: "tokens", service: "orvo-app-server" } })).toMatchObject({ data: { revision: 2 } });
    expect(await editor.execute("save_dashboard", { ...target, revision: 2 })).toMatchObject({ data: { saved: true } });
    expect(await createGetDashboard(deps)({ id: created.data.id }, context)).toMatchObject({ success: true, data: { dashboard: { name: "Scout token usage", revision: 2, panels: [expect.objectContaining({ id: "scout-input-tokens", title: "Input tokens", measure: "input_tokens", x: 0, y: 0, w: 6, h: 3 })] } } });
  });

});
