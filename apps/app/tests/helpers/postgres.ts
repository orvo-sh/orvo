import { getDb, type DB } from "@repo/db";
import { migrate as postgresMigrator } from "drizzle-orm/postgres-js/migrator";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";

import { postgresMigrationsDir } from "./migrations";

const startPostgresContainer = async (image = "pgvector/pgvector:pg17") =>
  new PostgreSqlContainer(image)
    .withDatabase("orvo")
    .withUsername("postgres")
    .withPassword("password")
    .start();

const applyPostgresMigrations = async (db: DB) => {
  await postgresMigrator(db, { migrationsFolder: postgresMigrationsDir });
};

const hardcodedTruncationTables = [
  "alert_delivery_attempt",
  "alert_event",
  "alert_incident",
  "alert_rule",
  "alert_rule_destination",
  "alert_webhook_destination",
  "app",
  "assistant_chat",
  "assistant_chat_message",
  "heartbeat_monitor",
  "heartbeat_monitor_destination",
  "heartbeat_checkin",
  "incident",
  "incident_event",
  "ingestion_key",
  "invitation",
  "member",
  "notification_delivery",
  "notification_destination",
  "organization_usage",
  "organization",
  "session",
  "subscription",
  "user",
  "verification",
];

const truncatePostgresTables = async (
  db: DB,
  tables: string[] = hardcodedTruncationTables,
) => {
  await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(", ")} CASCADE`));
};

const stopPostgresContainer = async (container: StartedPostgreSqlContainer) => {
  await container.stop();
};

export {
  applyPostgresMigrations,
  startPostgresContainer,
  stopPostgresContainer,
  truncatePostgresTables,
};
