import { Instrument } from "$lib/instrumentation";
import type { Logger } from "@repo/logger";
import type { Storage } from "@repo/storage";
import { z } from "zod";

import { createCreateUploadUrl } from "./methods/create-upload-url";
import { createUploadFile } from "./methods/upload-file";
import { createUploadUrlInputSchema, uploadFileInputSchema } from "./schema";

@Instrument({ prefix: "upload" })
class UploadService {
  private logger: Logger;
  private createUploadUrlMethod: ReturnType<typeof createCreateUploadUrl>;
  private uploadFileMethod: ReturnType<typeof createUploadFile>;

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
    this.createUploadUrlMethod = createCreateUploadUrl({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
    });
    this.uploadFileMethod = createUploadFile({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
    });
  }

  async createUploadUrl(input: z.input<typeof createUploadUrlInputSchema>) {
    return this.createUploadUrlMethod(input);
  }

  async uploadFile(input: z.input<typeof uploadFileInputSchema>) {
    return this.uploadFileMethod(input);
  }
}

export * from "./schema";
export { UploadService };
