import { recordError } from "$lib/instrumentation";
import {
  assetPaths,
  installerPublishPath,
} from "@repo/host-agent";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import type { IngestionKeyService } from "../../ingestion-key";
import { createHostInstallSessionInputSchema } from "../schema";
import { shellQuote } from "../shared";

const createCreateInstallSession = ({
  encryption,
  logger,
  ingestionKeyService,
  getPrivateIngestionKey,
  config,
}: {
  encryption: Encryption;
  logger: Logger;
  ingestionKeyService: Pick<IngestionKeyService, "createIngestionKey">;
  getPrivateIngestionKey: (appId: string) => Promise<string | null>;
  config: { appBaseUrl: string; cdnBaseUrl: string };
}) => async (
  input: z.input<typeof createHostInstallSessionInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = createHostInstallSessionInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    let privateKey = await getPrivateIngestionKey(context.appId);
    if (!privateKey) {
      const keyResult = await ingestionKeyService.createIngestionKey(
        { kind: "private" },
        context,
      );
      if (!keyResult.success) {
        return err(keyResult.error);
      }
      privateKey = keyResult.data.key;
    }

    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const token = encryption.encrypt(
      JSON.stringify({
        appId: context.appId,
        dockerEnabled: validated.data.dockerEnabled,
        expiresAt: expiresAt.toISOString(),
      }),
    );
    const bundleUrl = new URL(
      `/api/host-monitoring/install-bundles/${encodeURIComponent(token)}`,
      config.appBaseUrl,
    ).toString();
    const installerUrl = new URL(
      installerPublishPath,
      config.cdnBaseUrl,
    ).toString();

    return ok({
      bundleUrl,
      installerUrl,
      expiresAt: expiresAt.toISOString(),
      command: `curl -fsSL ${shellQuote(installerUrl)} | sudo bash -s -- --bundle-url ${shellQuote(bundleUrl)}`,
      dockerEnabled: validated.data.dockerEnabled,
      installScriptSourcePath: assetPaths.installer,
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to create install session", error as Error);
    return err("Failed to create install session.");
  }
};

export { createCreateInstallSession };
