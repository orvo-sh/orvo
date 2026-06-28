import { getDb } from "@repo/db";

import { findVerificationOtp, waitForVerificationOtp } from "./auth-fixtures";

const lazyDb = () => getDb(process.env.POSTGRES_URL!);

const getOtpFromDb = (email: string) => findVerificationOtp(lazyDb(), email);
const waitForOtp = (email: string) => waitForVerificationOtp(lazyDb(), email);

export { createTestLogger } from "./logger";
export {
  applyClickHouseMigrations,
  getClickHouseTestClient,
  startClickHouseContainer,
  stopClickHouseContainer,
  truncateClickHouseTables,
  type StartedClickHouse,
} from "./clickhouse";
export {
  ensureTestBucket,
  startMinioContainer,
  stopMinioContainer,
  TEST_BUCKET,
} from "./minio";
export {
  applyPostgresMigrations,
  startPostgresContainer,
  stopPostgresContainer,
  truncatePostgresTables,
} from "./postgres";
export {
  startAppServer,
  stopAppServer,
  TEST_APP_ORIGIN,
  TEST_APP_PORT,
  waitForServer,
} from "./app-server";
export { buildLog, buildLogs, insertLogs, type LogRow } from "./logs-fixtures";
export { createApp, createOrganization, getTestDb } from "./app-fixtures";
export { findVerificationOtp, waitForVerificationOtp } from "./auth-fixtures";

export { getOtpFromDb, waitForOtp };
