import { z } from "zod";

const createAgentEnrollmentInputSchema = z.object({
  environment: z.string().trim().min(1).max(64).default("production"),
});

const redeemAgentEnrollmentInputSchema = z.object({
  token: z.string().trim().startsWith("enr_").min(20),
  hostId: z.string().trim().min(1).max(255),
  hostName: z.string().trim().min(1).max(255),
  operatingSystem: z.string().trim().min(1).max(64),
  architecture: z.string().trim().min(1).max(64),
  agentVersion: z.string().trim().min(1).max(64),
});

export { createAgentEnrollmentInputSchema, redeemAgentEnrollmentInputSchema };
