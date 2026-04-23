-- 001_create_platform_schema.sql
-- Create platform schema: tables, constraints, indexes, and update trigger.
--
-- Tables (ordered by dependency):
--   1. platform_account — top-level tenant owned by an auth user
--   2. platform_agent   — owned by an account
--   3. platform_deployment — owned by an account, optionally linked to an agent
--
-- Run once against your Supabase project to establish the platform namespace.
-- Idempotent: uses DO blocks so repeated execution is safe.

-- ============================================================
-- Trigger function: keep updated_at fresh on every row update
-- ============================================================

CREATE OR REPLACE FUNCTION platform._set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = platform
AS $$
BEGIN
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. platform_account
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'platform') THEN
    CREATE SCHEMA platform;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'platform_account'
      AND n.nspname = 'platform'
  ) THEN
    CREATE TABLE platform.platform_account (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      auth_user_id    uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
      display_name    text,
      avatar_url      text,
      email           text,
      subscription_status
                      text NOT NULL DEFAULT 'active'
                      CONSTRAINT platform_account_subscription_status_check
                        CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'past_due')),
      subscription_plan
                      text NOT NULL DEFAULT 'default',
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Index: FK + RLS lookup by auth_user_id (single-column, covered by unique constraint
-- on auth_user_id; no separate index needed there, but we add one for any
-- queries that join through the account)
CREATE INDEX IF NOT EXISTS platform_account_auth_user_id_idx
  ON platform.platform_account (auth_user_id);

-- Index: useful for dashboards that filter by subscription status
CREATE INDEX IF NOT EXISTS platform_account_subscription_status_idx
  ON platform.platform_account (subscription_status);

-- Trigger: keep updated_at current
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_platform_account_updated_at'
  ) THEN
    CREATE TRIGGER set_platform_account_updated_at
      BEFORE UPDATE ON platform.platform_account
      FOR EACH ROW
      EXECUTE FUNCTION platform._set_updated_at();
  END IF;
END $$;

-- ============================================================
-- 2. platform_agent
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'platform_agent'
      AND n.nspname = 'platform'
  ) THEN
    CREATE TABLE platform.platform_agent (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id  uuid NOT NULL
                   REFERENCES platform.platform_account(id) ON DELETE CASCADE,
      name        text NOT NULL,
      config      jsonb NOT NULL DEFAULT '{}'::jsonb,
      status      text NOT NULL DEFAULT 'pending'
                   CONSTRAINT platform_agent_status_check
                     CHECK (status IN ('pending', 'ready', 'running', 'error', 'stopped')),
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Index: FK column (required by schema-foreign-key-indexes best practice)
CREATE INDEX IF NOT EXISTS platform_agent_account_id_idx
  ON platform.platform_agent (account_id);

-- Index: status lookup for status-driven queues
CREATE INDEX IF NOT EXISTS platform_agent_status_idx
  ON platform.platform_agent (status);

-- Index: status + created_at for queue ordering
CREATE INDEX IF NOT EXISTS platform_agent_status_created_at_idx
  ON platform.platform_agent (status, created_at DESC);

-- GIN index on config for containment queries (@>, ?, ?&)
-- per advanced-jsonb-indexing best practice
CREATE INDEX IF NOT EXISTS platform_agent_config_gin_idx
  ON platform.platform_agent USING gin (config);

-- Trigger: keep updated_at current
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_platform_agent_updated_at'
  ) THEN
    CREATE TRIGGER set_platform_agent_updated_at
      BEFORE UPDATE ON platform.platform_agent
      FOR EACH ROW
      EXECUTE FUNCTION platform._set_updated_at();
  END IF;
END $$;

-- ============================================================
-- 3. platform_deployment
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'platform_deployment'
      AND n.nspname = 'platform'
  ) THEN
    CREATE TABLE platform.platform_deployment (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id     uuid NOT NULL
                      REFERENCES platform.platform_account(id) ON DELETE CASCADE,
      agent_id       uuid
                      REFERENCES platform.platform_agent(id) ON DELETE SET NULL,
      request_payload jsonb NOT NULL,
      status         text NOT NULL DEFAULT 'queued'
                      CONSTRAINT platform_deployment_status_check
                        CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
      error_message  text,
      result_url     text,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Index: FK column
CREATE INDEX IF NOT EXISTS platform_deployment_account_id_idx
  ON platform.platform_deployment (account_id);

-- Composite index: account + status — the canonical filter for deployment lists
CREATE INDEX IF NOT EXISTS platform_deployment_account_status_idx
  ON platform.platform_deployment (account_id, status);

-- Composite index: account + created_at DESC — chronological feed per account
CREATE INDEX IF NOT EXISTS platform_deployment_account_created_at_idx
  ON platform.platform_deployment (account_id, created_at DESC);

-- GIN index on request_payload for containment queries
CREATE INDEX IF NOT EXISTS platform_deployment_request_payload_gin_idx
  ON platform.platform_deployment USING gin (request_payload);

-- Trigger: keep updated_at current
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_platform_deployment_updated_at'
  ) THEN
    CREATE TRIGGER set_platform_deployment_updated_at
      BEFORE UPDATE ON platform.platform_deployment
      FOR EACH ROW
      EXECUTE FUNCTION platform._set_updated_at();
  END IF;
END $$;
