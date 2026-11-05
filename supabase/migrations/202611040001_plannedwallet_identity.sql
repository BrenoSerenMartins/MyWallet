BEGIN;
-- This bridge also runs before migration-history lookup, preserving applied versions.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='mywallet_migrations') THEN
    IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='plannedwallet_migrations') THEN
      RAISE EXCEPTION 'Both migration histories exist; resolve their ownership before continuing';
    END IF;
    ALTER SCHEMA mywallet_migrations RENAME TO plannedwallet_migrations;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='mywallet_runtime') THEN
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='plannedwallet_runtime') THEN
      RAISE EXCEPTION 'Both runtime roles exist; resolve their ownership before continuing';
    END IF;
    ALTER ROLE mywallet_runtime RENAME TO plannedwallet_runtime;
  END IF;
END $$;
-- Recreate the owned retention job under the product name, without touching its data.
DO $$ DECLARE old_job record; BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR old_job IN EXECUTE 'SELECT jobid FROM cron.job WHERE jobname=''mywallet-workspace-retention''' LOOP
      EXECUTE 'SELECT cron.unschedule($1)' USING old_job.jobid;
      EXECUTE $job$SELECT cron.schedule('plannedwallet-workspace-retention','*/10 * * * *','SELECT wallet.purge_expired_workspaces()')$job$;
    END LOOP;
  END IF;
END $$;
COMMIT;
