import { recordError } from "$lib/instrumentation";
import { readFile } from "node:fs/promises";

import {
  renderInstallBundle,
  templatePaths,
} from "@repo/host-agent";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { getHostInstallBundleInputSchema } from "../schema";

const createGetInstallBundle = ({
  encryption,
  logger,
  getPrivateIngestionKey,
  config,
}: {
  encryption: Encryption;
  logger: Logger;
  getPrivateIngestionKey: (appId: string) => Promise<string | null>;
  config: { otlpBaseUrl: string };
}) => async (
  input: z.input<typeof getHostInstallBundleInputSchema>,
) => {
  const validated = getHostInstallBundleInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const payload = JSON.parse(encryption.decrypt(validated.data.token)) as {
      appId: string;
      dockerEnabled: boolean;
      expiresAt: string;
    };
    if (
      !payload.appId ||
      typeof payload.dockerEnabled !== "boolean" ||
      !payload.expiresAt
    ) {
      return err("Invalid install token.");
    }

    if (new Date(payload.expiresAt).getTime() < Date.now()) {
      return err("Install token has expired.");
    }

    const privateKey = await getPrivateIngestionKey(payload.appId);
    if (!privateKey) {
      return err("Private ingestion key is missing for this app.");
    }

    const [collectorConfig, systemdUnit, envFile] = await Promise.all([
      readFile(templatePaths.collectorConfig, "utf8"),
      readFile(templatePaths.systemdUnit, "utf8"),
      readFile(templatePaths.envFile, "utf8"),
    ]);

    return ok({
      content: renderInstallBundle(
        {
          collectorConfig,
          systemdUnit,
          envFile,
        },
        {
          appId: payload.appId,
          dockerEnabled: payload.dockerEnabled,
          otlpEndpoint: config.otlpBaseUrl,
          privateIngestionKey: privateKey,
        },
      ),
      contentType: "text/plain; charset=utf-8",
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to render install bundle", error as Error);
    return err("Failed to render install bundle.");
  }
};

export { createGetInstallBundle };
