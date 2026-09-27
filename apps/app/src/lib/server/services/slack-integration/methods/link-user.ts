import { createHash, randomBytes } from "node:crypto";
import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { member, slackLinkState, slackUserLink } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, eq, gt, lt } from "drizzle-orm";

const hashLinkState = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

const createCreateLinkUrl =
  ({ db, logger, origin }: { db: DB; logger: Logger; origin: string }) =>
  async (input: {
    teamId: string;
    slackUserId: string;
    organizationId: string;
    appId: string;
    eventId: string;
  }) => {
    try {
      const token = randomBytes(32).toString("base64url");
      await db.transaction(async (tx) => {
        await tx
          .delete(slackLinkState)
          .where(lt(slackLinkState.expiresAt, new Date()));
        await tx.insert(slackLinkState).values({
          stateHash: hashLinkState(token),
          ...input,
          expiresAt: new Date(Date.now() + 15 * 60_000),
        });
      });
      const url = new URL("/integrations/slack/link", origin);
      url.searchParams.set("token", token);
      return ok({ url: url.toString() });
    } catch (error) {
      recordError(error);
      logger.error(
        "createLinkUrl: failed to create account link",
        error as Error,
      );
      return err("Failed to create an account link.");
    }
  };

const createCompleteLink =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (input: { token: string }, context: { userId: string }) => {
    try {
      const state = await db.query.slackLinkState.findFirst({
        where: and(
          eq(slackLinkState.stateHash, hashLinkState(input.token)),
          gt(slackLinkState.expiresAt, new Date()),
        ),
      });
      if (!state) return err("This Slack account link has expired.");

      const currentMember = await db.query.member.findFirst({
        where: and(
          eq(member.organizationId, state.organizationId),
          eq(member.userId, context.userId),
        ),
      });
      if (!currentMember) {
        return err("Your Orvo account cannot access this Slack integration.");
      }

      await db.transaction(async (tx) => {
        await tx
          .insert(slackUserLink)
          .values({
            id: genId("slul"),
            teamId: state.teamId,
            slackUserId: state.slackUserId,
            userId: context.userId,
          })
          .onConflictDoUpdate({
            target: [slackUserLink.teamId, slackUserLink.slackUserId],
            set: { userId: context.userId, updatedAt: new Date() },
          });
        await tx
          .delete(slackLinkState)
          .where(eq(slackLinkState.stateHash, state.stateHash));
      });

      return ok({ eventId: state.eventId, appId: state.appId });
    } catch (error) {
      recordError(error);
      logger.error("completeLink: failed to link Slack user", error as Error);
      return err("Failed to link your Slack account.");
    }
  };

export { createCompleteLink, createCreateLinkUrl, hashLinkState };
