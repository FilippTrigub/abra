-- 002_create_rls_policies.sql
-- Enable Row-Level Security and create ownership-isolation policies for
-- all platform-owned tables.
--
-- Design:
--   - platform_account policies use auth.uid() against auth_user_id directly.
--   - platform_agent and platform_deployment policies verify ownership by
--     joining through platform_account.auth_user_id = auth.uid().
--   - All tables use FOR ALL (covers SELECT, INSERT, UPDATE, DELETE).
--   - Policies are wrapped in SELECT(auth.uid()) for RLS performance
--     best practice — the function is called once per query, not per row.
--     See security-rls-performance.md from supabase-postgres-best-practices.

-- ============================================================
-- Enable RLS on all platform tables
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'platform_account'
      AND n.nspname = 'platform'
      AND c.relprowsecurity = true
  ) THEN
    ALTER TABLE platform.platform_account ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'platform_agent'
      AND n.nspname = 'platform'
      AND c.relprowsecurity = true
  ) THEN
    ALTER TABLE platform.platform_agent ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'platform_deployment'
      AND n.nspname = 'platform'
      AND c.relprowsecurity = true
  ) THEN
    ALTER TABLE platform.platform_deployment ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'platform_settings'
      AND n.nspname = 'platform'
      AND c.relprowsecurity = true
  ) THEN
    ALTER TABLE platform.platform_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================
-- platform_account policies
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_account_owner_select'
  ) THEN
    CREATE POLICY platform_account_owner_select
      ON platform.platform_account
      FOR SELECT
      TO authenticated
      USING (auth_user_id = (SELECT auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_account_owner_insert'
  ) THEN
    CREATE POLICY platform_account_owner_insert
      ON platform.platform_account
      FOR INSERT
      TO authenticated
      WITH CHECK (auth_user_id = (SELECT auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_account_owner_update'
  ) THEN
    CREATE POLICY platform_account_owner_update
      ON platform.platform_account
      FOR UPDATE
      TO authenticated
      USING (auth_user_id = (SELECT auth.uid()))
      WITH CHECK (auth_user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- ============================================================
-- platform_agent policies
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_agent_owner_select'
  ) THEN
    CREATE POLICY platform_agent_owner_select
      ON platform.platform_agent
      FOR SELECT
      TO authenticated
      USING (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_agent_owner_insert'
  ) THEN
    CREATE POLICY platform_agent_owner_insert
      ON platform.platform_agent
      FOR INSERT
      TO authenticated
      WITH CHECK (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_agent_owner_update'
  ) THEN
    CREATE POLICY platform_agent_owner_update
      ON platform.platform_agent
      FOR UPDATE
      TO authenticated
      USING (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

-- ============================================================
-- platform_deployment policies
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_deployment_owner_select'
  ) THEN
    CREATE POLICY platform_deployment_owner_select
      ON platform.platform_deployment
      FOR SELECT
      TO authenticated
      USING (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_deployment_owner_insert'
  ) THEN
    CREATE POLICY platform_deployment_owner_insert
      ON platform.platform_deployment
      FOR INSERT
      TO authenticated
      WITH CHECK (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_deployment_owner_update'
  ) THEN
    CREATE POLICY platform_deployment_owner_update
      ON platform.platform_deployment
      FOR UPDATE
      TO authenticated
      USING (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

-- ============================================================
-- platform_settings policies
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_settings_owner_select'
  ) THEN
    CREATE POLICY platform_settings_owner_select
      ON platform.platform_settings
      FOR SELECT
      TO authenticated
      USING (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_settings_owner_insert'
  ) THEN
    CREATE POLICY platform_settings_owner_insert
      ON platform.platform_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'platform_settings_owner_update'
  ) THEN
    CREATE POLICY platform_settings_owner_update
      ON platform.platform_settings
      FOR UPDATE
      TO authenticated
      USING (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        account_id IN (
          SELECT id FROM platform.platform_account
          WHERE auth_user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;
