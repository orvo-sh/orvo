import { z } from "zod";

const sendTestTelemetryInputSchema = z.object({
  signals: z.array(z.enum(["traces", "logs", "metrics"])),
});

const completeOnboardingMilestoneInputSchema = z.object({
  milestone: z.enum(["first_alert_rule_created"]),
});

export { sendTestTelemetryInputSchema, completeOnboardingMilestoneInputSchema };
