import { recordError } from "$lib/instrumentation";
import type { Logger } from "@repo/logger";
import type { Storage } from "@repo/storage";
import { err, genId, ok } from "@repo/utils";
import { z } from "zod";

import { createUploadUrlInputSchema } from "../schema";

const createCreateUploadUrl = ({
  logger,
  storage,
  config,
}: {
  logger: Logger;
  storage: Storage | null;
  config: {
    cdnBaseUrl?: string;
    maxUploadSizeBytes: number;
    defaultExpiresInSeconds?: number;
  };
}) => async (
  input: z.input<typeof createUploadUrlInputSchema>,
) => {
  const validated = createUploadUrlInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  if (!storage || !config.cdnBaseUrl) {
    return err("Uploads are not configured.");
  }

  if (validated.data.fileSizeBytes > config.maxUploadSizeBytes) {
    return err(
      `File exceeds maximum size of ${config.maxUploadSizeBytes / (1024 * 1024)} MB.`,
    );
  }

  if (!validated.data.contentType.startsWith("image/")) {
    return err("Invalid content type. Only images are allowed.");
  }

  const extension =
    validated.data.contentType.split("/")[1]?.replace("svg+xml", "svg") ||
    "bin";
  const key = `uploads/${genId("upl")}.${extension}`;
  const url = new URL(key, config.cdnBaseUrl).toString();

  try {
    const presignedUrl = await storage.getPresignedUploadUrl(key, {
      contentType: validated.data.contentType,
      expiresIn: config.defaultExpiresInSeconds ?? 3600,
    });

    return ok({
      key,
      url,
      presignedUrl,
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to create upload url", error as Error);
    return err("Failed to create upload URL.");
  }
};

export { createCreateUploadUrl };
