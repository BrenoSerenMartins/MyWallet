CREATE TABLE wallet.recognition_decisions (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id() REFERENCES wallet.workspaces(id) ON DELETE CASCADE,
 transaction_id uuid NOT NULL,signature text NOT NULL,actor_id uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(user_id,workspace_id,transaction_id,signature),FOREIGN KEY(user_id,workspace_id,transaction_id) REFERENCES wallet.transactions(user_id,workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE wallet.recognition_previews (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id() REFERENCES wallet.workspaces(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id),payload jsonb NOT NULL,expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '30 minutes',confirmed_at timestamptz
);
CREATE TABLE wallet.recognition_changes (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id() REFERENCES wallet.workspaces(id) ON DELETE CASCADE,
 transaction_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES auth.users(id),before_data jsonb NOT NULL,after_version integer NOT NULL,undone_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(user_id,workspace_id,transaction_id) REFERENCES wallet.transactions(user_id,workspace_id,id) ON DELETE CASCADE
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['recognition_decisions','recognition_previews','recognition_changes'] LOOP
 EXECUTE format('ALTER TABLE wallet.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE wallet.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owned_read ON wallet.%I FOR SELECT USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id() AND wallet.workspace_access(workspace_id))',t);
 EXECUTE format('CREATE POLICY owned_write ON wallet.%I FOR ALL USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id() AND wallet.workspace_access(workspace_id,true)) WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id() AND wallet.workspace_access(workspace_id,true))',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON wallet.%I TO plannedwallet_runtime',t);
END LOOP;END $$;
