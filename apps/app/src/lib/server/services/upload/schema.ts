import { z } from "zod";

const createUploadUrlInputSchema = z.object({
  contentType: z.string(),
  fileSizeBytes: z.number().nonnegative().default(0),
});

export { createUploadUrlInputSchema };
