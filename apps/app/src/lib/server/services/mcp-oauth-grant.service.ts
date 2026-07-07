import { Instrument, recordError } from "$lib/instrumentation";
import { and, count, eq, inArray, type DB } from "@repo/db";
import { app, mcpOauthGrant, member, oauthClient } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { z } from "zod";

const oauthIdentityScopes = ["openid", "profile", "email", "offline_access"];

const upsertMcpOauthGrantInputSchema = z.object({
  clientId: z.string().trim().min(1),
  organizationId: z.string().trim().min(1),
  allowedAppIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(100)
    .refine((value) => new Set(value).size === value.length, {
      message: "Allowed apps must be unique.",
    }),
});

const getMcpOauthConsentPageDataInputSchema = z.object({
  clientId: z.string().trim().min(1),
});

const resolveMcpOauthGrantInputSchema = z.object({
  clientId: z.string().trim().min(1),
});

@Instrument({ prefix: "mcpOauthGrant" })
class McpOauthGrantService {
  private db: DB;
  private logger: Logger;

  constructor(db: DB, logger: Logger) {
    this.db = db;
    this.logger = logger.child("McpOauthGrantService");
  }

  async getConsentPageData(
    input: z.input<typeof getMcpOauthConsentPageDataInputSchema>,
    context: { userId: string },
  ) {
    const validated = getMcpOauthConsentPageDataInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const client = await this.db.query.oauthClient.findFirst({
        where: eq(oauthClient.clientId, validated.data.clientId),
      });

      if (!client) {
        return err("OAuth client not found.");
      }

      const grant = await this.db.query.mcpOauthGrant.findFirst({
        where: and(
          eq(mcpOauthGrant.clientId, validated.data.clientId),
          eq(mcpOauthGrant.userId, context.userId),
        ),
      });

      return ok({
        client: {
          clientId: client.clientId,
          name: client.name || "OAuth client",
          icon: client.icon || null,
          metadata: client.metadata,
          redirectUrls: client.redirectUris ?? [],
        },
        grant: grant
          ? {
              organizationId: grant.organizationId,
              allowedAppIds: grant.allowedAppIds,
            }
          : null,
      });
    } catch (error) {
      recordError(error);
      this.logger.error(
        "getConsentPageData: failed to load MCP OAuth consent page data",
        error as Error,
      );
      return err("Failed to load the OAuth consent page.");
    }
  }

  async upsertGrant(
    input: z.input<typeof upsertMcpOauthGrantInputSchema>,
    context: { userId: string },
  ) {
    const validated = upsertMcpOauthGrantInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const currentMember = await this.db.query.member.findFirst({
        where: and(
          eq(member.organizationId, validated.data.organizationId),
          eq(member.userId, context.userId),
        ),
      });

      if (!currentMember) {
        return err("You no longer have access to that organization.");
      }

      const allowedApps = await this.db
        .select({ total: count() })
        .from(app)
        .where(
          and(
            eq(app.organizationId, validated.data.organizationId),
            inArray(app.id, validated.data.allowedAppIds),
          ),
        );

      if (
        Number(allowedApps[0]?.total ?? 0) !==
        validated.data.allowedAppIds.length
      ) {
        return err("Choose valid apps from this organization.");
      }

      const existingGrant = await this.db.query.mcpOauthGrant.findFirst({
        where: and(
          eq(mcpOauthGrant.clientId, validated.data.clientId),
          eq(mcpOauthGrant.userId, context.userId),
        ),
      });

      if (existingGrant) {
        await this.db
          .update(mcpOauthGrant)
          .set({
            organizationId: validated.data.organizationId,
            allowedAppIds: validated.data.allowedAppIds,
            updatedAt: new Date(),
          })
          .where(eq(mcpOauthGrant.id, existingGrant.id));

        return ok({ id: existingGrant.id });
      }

      const id = genId("mcpg");

      await this.db.insert(mcpOauthGrant).values({
        id,
        clientId: validated.data.clientId,
        userId: context.userId,
        organizationId: validated.data.organizationId,
        allowedAppIds: validated.data.allowedAppIds,
      });

      return ok({ id });
    } catch (error) {
      recordError(error);
      this.logger.error(
        "upsertGrant: failed to save MCP OAuth grant",
        error as Error,
      );
      return err("Failed to save the OAuth grant.");
    }
  }

  async resolveGrant(
    input: z.input<typeof resolveMcpOauthGrantInputSchema>,
    context: { userId: string },
  ) {
    const validated = resolveMcpOauthGrantInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const grant = await this.db.query.mcpOauthGrant.findFirst({
        where: and(
          eq(mcpOauthGrant.clientId, validated.data.clientId),
          eq(mcpOauthGrant.userId, context.userId),
        ),
      });

      if (!grant) {
        return err(
          "This OAuth client has not been granted access to any apps.",
        );
      }

      const currentMember = await this.db.query.member.findFirst({
        where: and(
          eq(member.organizationId, grant.organizationId),
          eq(member.userId, context.userId),
        ),
      });

      if (!currentMember) {
        return err("This OAuth grant is no longer valid.");
      }

      return ok({
        organizationId: grant.organizationId,
        allowedAppIds: grant.allowedAppIds,
      });
    } catch (error) {
      recordError(error);
      this.logger.error(
        "resolveGrant: failed to resolve MCP OAuth grant",
        error as Error,
      );
      return err("Failed to resolve the OAuth grant.");
    }
  }
}

export {
  McpOauthGrantService,
  getMcpOauthConsentPageDataInputSchema,
  oauthIdentityScopes,
  resolveMcpOauthGrantInputSchema,
  upsertMcpOauthGrantInputSchema,
};
