import { z } from "zod";

const heartbeatIdSchema = z.string().trim().min(1);
const getHeartbeatMonitorInputSchema = heartbeatIdSchema;

const createHeartbeatMonitorInputSchema = z.object({
  name: z.string().trim().min(2).max(64),
  expectedEverySeconds: z.number().int().min(1).max(2_592_000),
  graceSeconds: z.number().int().min(0).max(2_592_000),
  destinationIds: z.array(heartbeatIdSchema).max(20).default([]),
});

const updateHeartbeatMonitorInputSchema =
  createHeartbeatMonitorInputSchema.extend({
    id: heartbeatIdSchema,
  });

const deleteHeartbeatMonitorInputSchema = heartbeatIdSchema;
const regenerateHeartbeatMonitorSecretInputSchema = heartbeatIdSchema;
const toggleHeartbeatMonitorPausedInputSchema = heartbeatIdSchema;
const sendHeartbeatMonitorTestAlertInputSchema = heartbeatIdSchema;

const recordHeartbeatCheckInBySecretInputSchema = z.object({
  secretToken: z.string().trim().min(1),
});

export {
  createHeartbeatMonitorInputSchema,
  deleteHeartbeatMonitorInputSchema,
  getHeartbeatMonitorInputSchema,
  heartbeatIdSchema,
  recordHeartbeatCheckInBySecretInputSchema,
  regenerateHeartbeatMonitorSecretInputSchema,
  sendHeartbeatMonitorTestAlertInputSchema,
  toggleHeartbeatMonitorPausedInputSchema,
  updateHeartbeatMonitorInputSchema,
};
