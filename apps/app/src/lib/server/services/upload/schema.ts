import { z } from "zod";

const createUploadUrlInputSchema = z.object({
  contentType: z.string(),
  fileSizeBytes: z.number().nonnegative().default(0),
  purpose: z.enum(["image", "chat_attachment"]).default("image"),
});

const uploadFileInputSchema = createUploadUrlInputSchema.extend({
  data: z.instanceof(Uint8Array),
});

export { createUploadUrlInputSchema, uploadFileInputSchema };
