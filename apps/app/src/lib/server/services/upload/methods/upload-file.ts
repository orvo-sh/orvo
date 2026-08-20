import { recordError } from "$lib/instrumentation";
import { CHAT_ATTACHMENT_MEDIA_TYPES } from "$lib/constants";
import type { Logger } from "@repo/logger";
import type { Storage } from "@repo/storage";
import { err, genId, ok } from "@repo/utils";
import { z } from "zod";

import { uploadFileInputSchema } from "../schema";

const createUploadFile =
  ({
    logger,
    storage,
    config,
  }: {
    logger: Logger;
    storage: Storage | null;
    config: {
      cdnBaseUrl?: string;
      maxUploadSizeBytes: number;
    };
  }) =>
  async (input: z.input<typeof uploadFileInputSchema>) => {
    const validated = uploadFileInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    if (!storage || !config.cdnBaseUrl) {
      return err("Uploads are not configured.");
    }

    if (
      validated.data.fileSizeBytes > config.maxUploadSizeBytes ||
      validated.data.data.byteLength > config.maxUploadSizeBytes
    ) {
      return err(
        `File exceeds maximum size of ${config.maxUploadSizeBytes / (1024 * 1024)} MB.`,
      );
    }

    if (
      validated.data.purpose === "image"
        ? !validated.data.contentType.startsWith("image/")
        : !CHAT_ATTACHMENT_MEDIA_TYPES.includes(
            validated.data
              .contentType as (typeof CHAT_ATTACHMENT_MEDIA_TYPES)[number],
          )
    ) {
      return err("This file type is not supported.");
    }

    const extension =
      validated.data.contentType.split("/")[1]?.replace("svg+xml", "svg") ||
      "bin";
    const key = `${validated.data.purpose === "chat_attachment" ? "chat-attachments" : "uploads"}/${genId("upl")}.${extension}`;

    try {
      await storage.upload(
        key,
        validated.data.data,
        validated.data.contentType,
      );
      return ok({ url: new URL(key, config.cdnBaseUrl).toString() });
    } catch (error) {
      recordError(error);
      logger.error("uploadFile: failed to upload file", error as Error);
      return err("Failed to upload file.");
    }
  };

export { createUploadFile };
