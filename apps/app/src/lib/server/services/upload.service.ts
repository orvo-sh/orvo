import type { Logger } from "@repo/logger";
import { Storage } from "@repo/storage";
import { err, genId, ok } from "@repo/utils";
import { z } from "zod";

class UploadService {
  private logger: Logger;

  constructor(
    logger: Logger,
    private storage: Storage | null,
    private config: {
      cdnBaseUrl?: string;
      maxUploadSizeBytes: number;
      defaultExpiresInSeconds?: number;
    },
  ) {
    this.logger = logger.child("UploadService");
  }

  async createUploadUrl(input: z.infer<typeof createUploadUrlInputSchema>) {
    this.logger.info("createUploadUrl: creating upload url", {
      contentType: input.contentType,
      fileSizeBytes: input.fileSizeBytes,
    });

    const validated = createUploadUrlInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    if (!this.storage || !this.config.cdnBaseUrl) {
      return err("Uploads are not configured.");
    }

    if (validated.data.fileSizeBytes > this.config.maxUploadSizeBytes) {
      return err(
        `File exceeds maximum size of ${this.config.maxUploadSizeBytes / (1024 * 1024)} MB.`,
      );
    }

    if (!validated.data.contentType.startsWith("image/")) {
      return err("Invalid content type. Only images are allowed.");
    }

    const extension =
      validated.data.contentType.split("/")[1]?.replace("svg+xml", "svg") ||
      "bin";
    const key = `uploads/${genId("upl")}.${extension}`;
    const url = new URL(key, this.config.cdnBaseUrl).toString();

    try {
      const presignedUrl = await this.storage.getPresignedUploadUrl(key, {
        contentType: validated.data.contentType,
        expiresIn: this.config.defaultExpiresInSeconds ?? 3600,
      });

      return ok({
        key,
        url,
        presignedUrl,
      });
    } catch (error) {
      this.logger.error(
        "createUploadUrl: failed to create upload url",
        error as Error,
      );
      return err("Failed to create upload URL.");
    }
  }
}

const createUploadUrlInputSchema = z.object({
  contentType: z.string(),
  fileSizeBytes: z.number().nonnegative().default(0),
});

export { UploadService, createUploadUrlInputSchema };
