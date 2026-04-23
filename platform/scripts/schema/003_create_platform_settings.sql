-- 003_create_platform_settings.sql
-- Create platform_settings: per-account user-editable settings snapshot.
--
-- The platform_settings table stores the current configuration snapshot for
-- each platform_account. It uses upsert-on-account_id so the dashboard
-- always has a single row to read/write.
--
-- Columns:
--   id         — row primary key
--   account_id — FK to platform_account (ownership)
--   values     — JSONB map of setting key → value
--   created_at / updated_at — timestamps, kept current by _set_updated_at()
--
-- Run once against your Supabase project. Idempotent via DO blocks.

-- ============================================================
-- 4. platform_settings
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'platform_settings'
      AND n.nspname = 'platform'
  ) THEN
    CREATE TABLE platform.platform_settings (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id uuid NOT NULL
                   REFERENCES platform.platform_account(id) ON DELETE CASCADE,
      values     jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Index: FK column
CREATE INDEX IF NOT EXISTS platform_settings_account_id_idx
  ON platform.platform_settings (account_id);

-- GIN index on values for containment queries (@>, ?, ?&)
CREATE INDEX IF NOT EXISTS platform_settings_values_gin_idx
  ON platform.platform_settings USING gin (values);

-- Unique constraint: one row per account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_settings_account_id_unique'
  ) THEN
    ALTER TABLE platform.platform_settings
      ADD CONSTRAINT platform_settings_account_id_unique
      UNIQUE (account_id);
  END IF;
END $$;

-- Trigger: keep updated_at current
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_platform_settings_updated_at'
  ) THEN
    CREATE TRIGGER set_platform_settings_updated_at
      BEFORE UPDATE ON platform.platform_settings
      FOR EACH ROW
      EXECUTE FUNCTION platform._set_updated_at();
  END IF;
END $$;
