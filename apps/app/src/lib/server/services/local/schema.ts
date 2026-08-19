import { z } from "zod";

const initializeLocalInputSchema = z.object({
  setupToken: z.string().min(1),
});

export { initializeLocalInputSchema };
