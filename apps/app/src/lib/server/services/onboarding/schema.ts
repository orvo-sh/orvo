import { z } from "zod";

const sendTestTelemetryInputSchema = z.object({
  signals: z.array(z.enum(["traces", "logs", "metrics"])),
});

export { sendTestTelemetryInputSchema };
