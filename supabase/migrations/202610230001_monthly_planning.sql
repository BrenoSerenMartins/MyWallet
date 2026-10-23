BEGIN;
CREATE TABLE wallet.monthly_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 month date NOT NULL CHECK(extract(day FROM month)=1 AND month BETWEEN '1900-01-01' AND '9998-12-01'),
 contribution_minor bigint CHECK(contribution_minor BETWEEN 0 AND 1000000000000),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1000),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,workspace_id,id), UNIQUE(user_id,workspace_id,month),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id)
);
CREATE TABLE wallet.monthly_plan_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 plan_id uuid NOT NULL, category_id uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 0 AND 1000000000000),
 UNIQUE(user_id,workspace_id,plan_id,category_id),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id),
 FOREIGN KEY(user_id,workspace_id,plan_id) REFERENCES wallet.monthly_plans(user_id,workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,category_id) REFERENCES wallet.categories(user_id,workspace_id,id)
);
ALTER TABLE wallet.monthly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.monthly_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE wallet.monthly_plan_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.monthly_plan_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY owned_plan ON wallet.monthly_plans TO mywallet_runtime
 USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())
 WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id());
CREATE POLICY owned_plan_line ON wallet.monthly_plan_lines TO mywallet_runtime
 USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())
 WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON wallet.monthly_plans,wallet.monthly_plan_lines TO mywallet_runtime;
COMMIT;
