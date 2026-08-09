import { z } from "zod";

const createAgentEnrollmentInputSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  environment: z.string().trim().min(1).max(64).default("production"),
});

const getHostInputSchema = z.object({
  id: z.string().trim().min(1),
  time: z.enum(["1h", "4h", "24h", "7d"]).default("1h"),
});

const updateHostInputSchema = z.object({
  id: z.string().trim().min(1),
  displayName: z.string().trim().min(1).max(80),
  environment: z.string().trim().min(1).max(64),
});

const deleteHostInputSchema = z.string().trim().min(1);

const redeemAgentEnrollmentInputSchema = z.object({
  token: z.string().trim().startsWith("enr_").min(20),
  hostId: z.string().trim().min(1).max(255),
  hostName: z.string().trim().min(1).max(255),
  operatingSystem: z.string().trim().min(1).max(64),
  architecture: z.string().trim().min(1).max(64),
  agentVersion: z.string().trim().min(1).max(64),
});

export {
  createAgentEnrollmentInputSchema,
  deleteHostInputSchema,
  getHostInputSchema,
  redeemAgentEnrollmentInputSchema,
  updateHostInputSchema,
};
