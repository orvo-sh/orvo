import { Instrument } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { createGetDashboards } from "./methods/get-dashboards";
import { createGetDashboard } from "./methods/get-dashboard";
import { createCreateDashboard } from "./methods/create-dashboard";
import { createUpdateDashboard } from "./methods/update-dashboard";
import { createDeleteDashboard } from "./methods/delete-dashboard";
import { createPinDashboard } from "./methods/pin-dashboard";
import { createGetPanelData } from "./methods/get-panel-data";

@Instrument({ prefix: "dashboard" })
class DashboardService {
  private getDashboardsMethod: ReturnType<typeof createGetDashboards>;
  private getDashboardMethod: ReturnType<typeof createGetDashboard>;
  private createDashboardMethod: ReturnType<typeof createCreateDashboard>;
  private updateDashboardMethod: ReturnType<typeof createUpdateDashboard>;
  private deleteDashboardMethod: ReturnType<typeof createDeleteDashboard>;
  private pinDashboardMethod: ReturnType<typeof createPinDashboard>;
  private getPanelDataMethod: ReturnType<typeof createGetPanelData>;
  constructor(db: DB, clickhouse: ClickHouse, logger: Logger) {
    const childLogger = logger.child("DashboardService");
    this.getDashboardsMethod = createGetDashboards({ db, logger: childLogger });
    this.getDashboardMethod = createGetDashboard({ db, logger: childLogger });
    this.createDashboardMethod = createCreateDashboard({
      db,
      logger: childLogger,
    });
    this.updateDashboardMethod = createUpdateDashboard({
      db,
      logger: childLogger,
    });
    this.deleteDashboardMethod = createDeleteDashboard({
      db,
      logger: childLogger,
    });
    this.pinDashboardMethod = createPinDashboard({ db, logger: childLogger });
    this.getPanelDataMethod = createGetPanelData({
      clickhouse,
      logger: childLogger,
    });
  }
  getDashboards(...args: Parameters<DashboardService["getDashboardsMethod"]>) {
    return this.getDashboardsMethod(...args);
  }
  getDashboard(...args: Parameters<DashboardService["getDashboardMethod"]>) {
    return this.getDashboardMethod(...args);
  }
  createDashboard(
    ...args: Parameters<DashboardService["createDashboardMethod"]>
  ) {
    return this.createDashboardMethod(...args);
  }
  updateDashboard(
    ...args: Parameters<DashboardService["updateDashboardMethod"]>
  ) {
    return this.updateDashboardMethod(...args);
  }
  deleteDashboard(
    ...args: Parameters<DashboardService["deleteDashboardMethod"]>
  ) {
    return this.deleteDashboardMethod(...args);
  }
  pinDashboard(...args: Parameters<DashboardService["pinDashboardMethod"]>) {
    return this.pinDashboardMethod(...args);
  }
  getPanelData(...args: Parameters<DashboardService["getPanelDataMethod"]>) {
    return this.getPanelDataMethod(...args);
  }
}
export * from "./schema";
export { DashboardService };
