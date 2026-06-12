import type { DB } from "@repo/db";
import { app } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { AlertRuleService } from "./alert-rule.service";
import { IngestionKeyService } from "./ingestion-key.service";

class AppService {
  private logger: Logger;

  constructor(
    private db: DB,
    logger: Logger,
    private ingestionKeyService: IngestionKeyService,
    private alertRuleService: AlertRuleService,
  ) {
    this.logger = logger.child("AppService");
  }

  async listApps(context: { organizationId: string }) {
    this.logger.info("listApps: listing apps", { context });

    try {
      const apps = await this.db.query.app.findMany({
        where: eq(app.organizationId, context.organizationId),
        orderBy: [asc(app.createdAt), asc(app.name)],
      });

      return ok({ apps });
    } catch (error) {
      this.logger.error("listApps: failed to list apps", error as Error);
      return err("Failed to load apps.");
    }
  }

  async getApp(
    input: z.infer<typeof getAppInputSchema>,
    context: { organizationId: string },
  ) {
    this.logger.info("getApp: getting app", { input, context });

    const validated = getAppInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const currentApp = await this.db.query.app.findFirst({
        where: and(
          eq(app.id, validated.data.id),
          eq(app.organizationId, context.organizationId),
        ),
      });

      if (!currentApp) {
        return err("App not found.");
      }

      return ok({ app: currentApp });
    } catch (error) {
      this.logger.error("getApp: failed to get app", error as Error);
      return err("Failed to load app.");
    }
  }

  async createApp(
    input: z.infer<typeof createAppInputSchema>,
    context: { organizationId: string; userId: string },
  ) {
    this.logger.info("createApp: creating app", { input, context });

    const validated = createAppInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const id = genId("app");

      await this.db.transaction(async (tx) => {
        await tx.insert(app).values({
          id,
          organizationId: context.organizationId,
          name: validated.data.name,
          defaultTimezone: validated.data.defaultTimezone,
          createdBy: context.userId,
          updatedBy: context.userId,
        });

        const results = await Promise.all([
          this.ingestionKeyService.createIngestionKey(
            { kind: "public" },
            { appId: id, userId: context.userId, tx },
          ),
          this.ingestionKeyService.createIngestionKey(
            { kind: "private" },
            { appId: id, userId: context.userId, tx },
          ),
          this.alertRuleService.seedDefaultAlertRules({
            appId: id,
            userId: context.userId,
            tx,
          }),
        ]);

        for (const result of results) {
          if (!result.success) {
            throw new Error(result.error);
          }
        }
      });

      return ok({ id });
    } catch (error) {
      this.logger.error("createApp: failed to create app", error as Error);
      return err("Failed to create app.");
    }
  }

  async updateAppSettings(
    input: z.infer<typeof updateAppSettingsInputSchema>,
    context: { organizationId: string; appId: string; userId: string },
  ) {
    this.logger.info("updateAppSettings: updating app settings", {
      input,
      context,
    });

    const validated = updateAppSettingsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const existing = await this.db.query.app.findFirst({
        where: and(
          eq(app.id, context.appId),
          eq(app.organizationId, context.organizationId),
        ),
      });

      if (!existing) {
        return err("App not found.");
      }

      await this.db
        .update(app)
        .set({
          defaultTimezone: validated.data.defaultTimezone,
          updatedBy: context.userId,
        })
        .where(eq(app.id, existing.id));

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "updateAppSettings: failed to update app settings",
        error as Error,
      );
      return err("Failed to update app settings.");
    }
  }
}

const getAppInputSchema = z.object({
  id: z.string().trim().min(1),
});

const createAppInputSchema = z.object({
  name: z.string().trim().min(2).max(64),
  defaultTimezone: z.string().trim().min(1).max(255),
});

const updateAppSettingsInputSchema = z.object({
  defaultTimezone: z.string().trim().min(1).max(255),
});

export {
  AppService,
  createAppInputSchema,
  getAppInputSchema,
  updateAppSettingsInputSchema,
};
