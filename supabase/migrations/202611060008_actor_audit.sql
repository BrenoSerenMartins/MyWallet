CREATE TABLE wallet.actor_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),workspace_id uuid NOT NULL REFERENCES wallet.workspaces(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id),entity text NOT NULL,record_id uuid NOT NULL,action text NOT NULL,before_data jsonb,after_data jsonb,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE wallet.actor_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.actor_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON wallet.actor_audit FOR SELECT USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id() AND wallet.workspace_access(workspace_id));
GRANT SELECT ON wallet.actor_audit TO plannedwallet_runtime;
CREATE FUNCTION wallet.audit_actor_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,wallet AS $$
DECLARE before_row jsonb;after_row jsonb;r jsonb;
BEGIN
 IF wallet.actor_id() IS NULL THEN RETURN NULL; END IF;
 IF TG_OP<>'INSERT' THEN before_row=to_jsonb(OLD);END IF;
 IF TG_OP<>'DELETE' THEN after_row=to_jsonb(NEW);END IF;
 r=coalesce(after_row,before_row);
 INSERT INTO wallet.actor_audit(user_id,workspace_id,actor_id,entity,record_id,action,before_data,after_data) VALUES((r->>'user_id')::uuid,(r->>'workspace_id')::uuid,wallet.actor_id(),TG_TABLE_NAME,(r->>'id')::uuid,TG_OP,before_row,after_row);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION wallet.audit_actor_change() FROM PUBLIC;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['financial_accounts','categories','transactions','credit_cards','card_recurring_rules','savings_goals','goal_allocations','monthly_plans'] LOOP
 EXECUTE format('CREATE TRIGGER actor_audit AFTER INSERT OR UPDATE ON wallet.%I FOR EACH ROW EXECUTE FUNCTION wallet.audit_actor_change()',t);
END LOOP;END $$;
CREATE INDEX actor_audit_recent ON wallet.actor_audit(user_id,workspace_id,created_at DESC);
