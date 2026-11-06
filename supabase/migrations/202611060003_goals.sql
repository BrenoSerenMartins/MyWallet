CREATE TABLE wallet.savings_goals (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),target_minor bigint NOT NULL CHECK(target_minor>0 AND target_minor<=1000000000000),
 deadline date,priority integer NOT NULL DEFAULT 2 CHECK(priority BETWEEN 1 AND 3),status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','archived')),
 version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,workspace_id,id),FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE
);
CREATE TABLE wallet.goal_allocations (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 goal_id uuid NOT NULL,account_id uuid NOT NULL,delta_minor bigint NOT NULL CHECK(delta_minor<>0 AND abs(delta_minor)<=1000000000000),
 reverse_of_id uuid UNIQUE,actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,workspace_id,id),FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,goal_id) REFERENCES wallet.savings_goals(user_id,workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,account_id) REFERENCES wallet.financial_accounts(user_id,workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,reverse_of_id) REFERENCES wallet.goal_allocations(user_id,workspace_id,id) ON DELETE CASCADE
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['savings_goals','goal_allocations'] LOOP
 EXECUTE format('ALTER TABLE wallet.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE wallet.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owned_data ON wallet.%I TO plannedwallet_runtime USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id()) WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON wallet.%I TO plannedwallet_runtime',t);
END LOOP;END $$;
CREATE INDEX goal_allocations_account ON wallet.goal_allocations(user_id,workspace_id,account_id);
