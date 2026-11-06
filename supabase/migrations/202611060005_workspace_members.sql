-- Financial rows keep the owner's namespace; authenticated actors have explicit capabilities.
CREATE TABLE wallet.workspace_members (
 workspace_id uuid NOT NULL REFERENCES wallet.workspaces(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id), role text NOT NULL CHECK(role IN ('owner','editor','reader')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(workspace_id,actor_id)
);
INSERT INTO wallet.workspace_members(workspace_id,actor_id,role) SELECT id,user_id,'owner' FROM wallet.workspaces;
CREATE FUNCTION wallet.initialize_workspace_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,wallet AS $$
BEGIN INSERT INTO wallet.workspace_members(workspace_id,actor_id,role) VALUES(NEW.id,NEW.user_id,'owner');RETURN NEW;END $$;
CREATE TRIGGER workspace_membership AFTER INSERT ON wallet.workspaces FOR EACH ROW EXECUTE FUNCTION wallet.initialize_workspace_membership();
CREATE FUNCTION wallet.actor_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('wallet.actor_id',true),''),nullif(current_setting('wallet.user_id',true),''))::uuid$$;
CREATE FUNCTION wallet.workspace_access(w uuid,writing boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,wallet AS $$
 SELECT EXISTS(SELECT 1 FROM wallet.workspace_members m JOIN wallet.workspaces s ON s.id=m.workspace_id WHERE s.id=w AND s.user_id=wallet.current_user_id() AND s.deleted_at IS NULL AND m.actor_id=wallet.actor_id() AND (NOT writing OR m.role IN ('owner','editor')))
$$;
CREATE FUNCTION wallet.resolve_workspace(w uuid,writing boolean) RETURNS TABLE(owner_id uuid,member_role text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,wallet AS $$
BEGIN
 IF writing THEN
  RETURN QUERY SELECT s.user_id,m.role FROM wallet.workspaces s JOIN wallet.workspace_members m ON m.workspace_id=s.id WHERE s.id=w AND s.deleted_at IS NULL AND m.actor_id=wallet.actor_id() AND m.role IN ('owner','editor') FOR SHARE OF s,m;
 ELSE
  RETURN QUERY SELECT s.user_id,m.role FROM wallet.workspaces s JOIN wallet.workspace_members m ON m.workspace_id=s.id WHERE s.id=w AND s.deleted_at IS NULL AND m.actor_id=wallet.actor_id();
 END IF;
END $$;
CREATE FUNCTION wallet.shared_workspaces() RETURNS TABLE(id uuid,name text,description text,color text,"isDefault" boolean,role text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,wallet AS $$
 SELECT s.id,s.name,s.description,s.color,false,m.role FROM wallet.workspaces s JOIN wallet.workspace_members m ON m.workspace_id=s.id WHERE m.actor_id=wallet.actor_id() AND s.user_id<>wallet.actor_id() AND s.deleted_at IS NULL
$$;
ALTER TABLE wallet.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_read ON wallet.workspace_members FOR SELECT USING(workspace_id=wallet.current_workspace_id() AND wallet.workspace_access(workspace_id));
CREATE POLICY owner_members ON wallet.workspace_members FOR ALL USING(workspace_id=wallet.current_workspace_id() AND EXISTS(SELECT 1 FROM wallet.workspaces WHERE id=workspace_id AND user_id=wallet.actor_id()) AND role<>'owner') WITH CHECK(workspace_id=wallet.current_workspace_id() AND EXISTS(SELECT 1 FROM wallet.workspaces WHERE id=workspace_id AND user_id=wallet.actor_id()) AND role<>'owner');
GRANT SELECT,INSERT,UPDATE,DELETE ON wallet.workspace_members TO plannedwallet_runtime;
CREATE TABLE wallet.workspace_invites (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES wallet.workspaces(id) ON DELETE CASCADE,
 email text NOT NULL,role text NOT NULL CHECK(role IN ('editor','reader')),token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,revoked_at timestamptz,accepted_at timestamptz,accepted_by uuid REFERENCES auth.users(id),created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE wallet.workspace_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_invites ON wallet.workspace_invites FOR ALL USING(workspace_id=wallet.current_workspace_id() AND EXISTS(SELECT 1 FROM wallet.workspaces WHERE id=workspace_id AND user_id=wallet.actor_id())) WITH CHECK(workspace_id=wallet.current_workspace_id() AND EXISTS(SELECT 1 FROM wallet.workspaces WHERE id=workspace_id AND user_id=wallet.actor_id()));
GRANT SELECT,INSERT,UPDATE ON wallet.workspace_invites TO plannedwallet_runtime;
CREATE FUNCTION wallet.accept_workspace_invite(token text,verified_email text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,wallet AS $$
DECLARE invitation wallet.workspace_invites; own uuid;
BEGIN
 SELECT * INTO invitation FROM wallet.workspace_invites WHERE token_hash=token AND lower(email)=lower(verified_email) AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invitation' USING ERRCODE='22023';END IF;
 SELECT user_id INTO own FROM wallet.workspaces WHERE id=invitation.workspace_id AND deleted_at IS NULL FOR SHARE;
 IF own IS NULL OR own=wallet.actor_id() THEN RAISE EXCEPTION 'Invalid invitation' USING ERRCODE='22023';END IF;
 INSERT INTO wallet.workspace_members(workspace_id,actor_id,role) VALUES(invitation.workspace_id,wallet.actor_id(),invitation.role) ON CONFLICT(workspace_id,actor_id) DO UPDATE SET role=EXCLUDED.role;
 UPDATE wallet.workspace_invites SET accepted_at=clock_timestamp(),accepted_by=wallet.actor_id() WHERE id=invitation.id;
 RETURN invitation.workspace_id;
END $$;
-- Restrictive policies also protect writes if a read endpoint accidentally issues a mutation.
DO $$ DECLARE t record;BEGIN
 FOR t IN SELECT c.table_name FROM information_schema.columns c WHERE c.table_schema='wallet' AND c.column_name='workspace_id' AND c.table_name NOT IN ('workspace_members','workspace_invites') LOOP
  EXECUTE format('CREATE POLICY actor_read ON wallet.%I AS RESTRICTIVE FOR SELECT USING (wallet.workspace_access(workspace_id))',t.table_name);
  EXECUTE format('CREATE POLICY actor_insert ON wallet.%I AS RESTRICTIVE FOR INSERT WITH CHECK (wallet.workspace_access(workspace_id,true))',t.table_name);
  EXECUTE format('CREATE POLICY actor_update ON wallet.%I AS RESTRICTIVE FOR UPDATE USING (wallet.workspace_access(workspace_id,true)) WITH CHECK (wallet.workspace_access(workspace_id,true))',t.table_name);
  EXECUTE format('CREATE POLICY actor_delete ON wallet.%I AS RESTRICTIVE FOR DELETE USING (wallet.workspace_access(workspace_id,true))',t.table_name);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION wallet.initialize_workspace_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION wallet.resolve_workspace(uuid,boolean),wallet.shared_workspaces(),wallet.accept_workspace_invite(text,text),wallet.workspace_access(uuid,boolean),wallet.actor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION wallet.resolve_workspace(uuid,boolean),wallet.shared_workspaces(),wallet.accept_workspace_invite(text,text),wallet.workspace_access(uuid,boolean),wallet.actor_id() TO plannedwallet_runtime;
