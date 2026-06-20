CREATE SCHEMA IF NOT EXISTS pgboss;

CREATE TYPE pgboss.job_state AS ENUM (
  'created',
  'retry',
  'active',
  'completed',
  'cancelled',
  'failed'
);

CREATE TABLE pgboss.queue (
  name text PRIMARY KEY NOT NULL,
  policy text NOT NULL,
  retry_limit int NOT NULL,
  retry_delay int NOT NULL,
  retry_backoff bool NOT NULL,
  retry_delay_max int,
  expire_seconds int NOT NULL,
  retention_seconds int NOT NULL,
  deletion_seconds int NOT NULL,
  dead_letter text,
  partition bool NOT NULL,
  table_name text NOT NULL
);

CREATE TABLE pgboss.job (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  data jsonb,
  state pgboss.job_state NOT NULL DEFAULT 'created',
  retry_limit integer NOT NULL DEFAULT 2,
  retry_count integer NOT NULL DEFAULT 0,
  retry_delay integer NOT NULL DEFAULT 0,
  retry_backoff boolean NOT NULL DEFAULT false,
  retry_delay_max integer,
  expire_seconds int NOT NULL DEFAULT 900,
  deletion_seconds int NOT NULL DEFAULT 604800,
  singleton_key text,
  singleton_on timestamp without time zone,
  group_id text,
  group_tier text,
  start_after timestamp with time zone NOT NULL DEFAULT now(),
  created_on timestamp with time zone NOT NULL DEFAULT now(),
  started_on timestamp with time zone,
  completed_on timestamp with time zone,
  keep_until timestamp with time zone NOT NULL DEFAULT now() + interval '1209600 seconds',
  output jsonb,
  dead_letter text,
  policy text
);
