const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_CHAT_ATTACHMENTS = 5;
const CHAT_ATTACHMENT_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/json",
  "text/plain",
  "text/markdown",
  "text/csv",
] as const;

const PLANS = {
  starter: {
    priceUsd: 19,
    retentionDays: {
      logs: 14,
      metrics: 14,
      traces: 14,
    },
    ingestLimitBytes: 50 * Math.pow(1024, 3),
    scoutCreditsPerPeriod: 150_000,
    overagePricePerGb: null,
  },
  pro: {
    priceUsd: 49,
    retentionDays: {
      logs: 30,
      metrics: 30,
      traces: 30,
    },
    ingestLimitBytes: 150 * Math.pow(1024, 3),
    scoutCreditsPerPeriod: 1_200_000,
    overagePricePerGb: 0.32,
  },
};

export {
  CHAT_ATTACHMENT_MEDIA_TYPES,
  MAX_CHAT_ATTACHMENTS,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  PLANS,
};
