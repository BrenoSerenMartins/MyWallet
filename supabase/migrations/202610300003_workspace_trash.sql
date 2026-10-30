BEGIN;
ALTER TABLE wallet.workspaces ADD COLUMN deleted_at timestamptz;
CREATE INDEX workspace_retention_deadline ON wallet.workspaces(deleted_at) WHERE deleted_at IS NOT NULL;
GRANT UPDATE(deleted_at,is_default) ON wallet.workspaces TO mywallet_runtime;
-- Every existing workspace-scoped table participates in the same atomic cascade.
-- NO ACTION internal references are checked after the cascade statement completes.
DO $$ DECLARE tab record; fk record; BEGIN
 FOR tab IN SELECT table_name FROM information_schema.columns WHERE table_schema='wallet' AND column_name='workspace_id' LOOP
  FOR fk IN SELECT conname FROM pg_constraint WHERE conrelid=format('wallet.%I',tab.table_name)::regclass AND confrelid='wallet.workspaces'::regclass AND contype='f' LOOP
   EXECUTE format('ALTER TABLE wallet.%I DROP CONSTRAINT %I',tab.table_name,fk.conname);
  END LOOP;
  EXECUTE format('ALTER TABLE wallet.%I ADD CONSTRAINT workspace_retention_owner FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE',tab.table_name);
 END LOOP;
END $$;
-- All current scoped policies/defaults now reject workspaces in the trash too.
CREATE OR REPLACE FUNCTION wallet.current_workspace_id() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT w.id FROM wallet.workspaces w WHERE w.id=nullif(current_setting('wallet.workspace_id',true),'')::uuid
 AND w.user_id=wallet.current_user_id() AND w.deleted_at IS NULL $$;

-- The protected Geral groups may disappear only as part of their parent cascade.
CREATE OR REPLACE FUNCTION wallet.protect_default_category_groups() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,wallet AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.is_default AND EXISTS(SELECT 1 FROM wallet.workspaces WHERE id=OLD.workspace_id AND user_id=OLD.user_id) THEN
   RAISE EXCEPTION 'Default category groups are protected' USING ERRCODE='23514';
  END IF;
  RETURN OLD;
 END IF;
 IF OLD.is_default AND (NOT NEW.is_default OR NEW.user_id<>OLD.user_id OR NEW.workspace_id<>OLD.workspace_id OR NEW.type<>OLD.type OR NEW.name<>OLD.name) THEN
  RAISE EXCEPTION 'Default category groups are protected' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION wallet.purge_expired_workspaces(owner_id uuid DEFAULT NULL) RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET row_security=off AS $$
DECLARE removed integer;
BEGIN
 WITH expired AS (
  SELECT id FROM wallet.workspaces
  WHERE deleted_at <= clock_timestamp()-interval '168 hours' AND (owner_id IS NULL OR user_id=owner_id)
  ORDER BY deleted_at,id LIMIT 100 FOR UPDATE SKIP LOCKED
 ), purged AS (
  DELETE FROM wallet.workspaces w USING expired e WHERE w.id=e.id RETURNING w.id
 ) SELECT count(*) INTO removed FROM purged;
 RETURN removed;
END $$;
REVOKE ALL ON FUNCTION wallet.purge_expired_workspaces(uuid) FROM PUBLIC;

CREATE FUNCTION wallet.purge_my_expired_workspaces() RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET row_security=off AS $$
DECLARE owner_id uuid := wallet.current_user_id();
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Verified owner is required'; END IF;
 RETURN wallet.purge_expired_workspaces(owner_id);
END $$;
REVOKE ALL ON FUNCTION wallet.purge_my_expired_workspaces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION wallet.purge_my_expired_workspaces() TO mywallet_runtime;

-- Supabase supports pg_cron: the database runs retention even if the web app sleeps.
-- Portable test/local engines without pg_cron retain the owner-scoped read cleanup.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pg_cron') THEN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
  EXECUTE $job$SELECT cron.schedule('mywallet-workspace-retention','*/10 * * * *','SELECT wallet.purge_expired_workspaces()')$job$;
 END IF;
END $$;
COMMIT;
