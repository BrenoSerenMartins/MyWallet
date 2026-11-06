CREATE TABLE wallet.alert_preferences (
 user_id uuid NOT NULL REFERENCES auth.users(id),workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id() REFERENCES wallet.workspaces(id) ON DELETE CASCADE,
 due_days integer NOT NULL DEFAULT 3 CHECK(due_days BETWEEN 0 AND 30),budget_percent integer NOT NULL DEFAULT 100 CHECK(budget_percent BETWEEN 1 AND 100),
 bills boolean NOT NULL DEFAULT true,budgets boolean NOT NULL DEFAULT true,negative_balance boolean NOT NULL DEFAULT true,goals boolean NOT NULL DEFAULT true,
 PRIMARY KEY(user_id,workspace_id)
);
CREATE TABLE wallet.financial_alerts (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id() REFERENCES wallet.workspaces(id) ON DELETE CASCADE,
 origin_key text NOT NULL,kind text NOT NULL,title text NOT NULL,href text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),read_at timestamptz,dismissed_at timestamptz,resolved_at timestamptz,
 UNIQUE(user_id,workspace_id,origin_key)
);
ALTER TABLE wallet.alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.alert_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE wallet.financial_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.financial_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY personal_alert_preferences ON wallet.alert_preferences USING(user_id=wallet.actor_id() AND workspace_id=wallet.current_workspace_id() AND wallet.workspace_access(workspace_id)) WITH CHECK(user_id=wallet.actor_id() AND workspace_id=wallet.current_workspace_id() AND wallet.workspace_access(workspace_id));
CREATE POLICY personal_alerts ON wallet.financial_alerts USING(user_id=wallet.actor_id() AND workspace_id=wallet.current_workspace_id() AND wallet.workspace_access(workspace_id)) WITH CHECK(user_id=wallet.actor_id() AND workspace_id=wallet.current_workspace_id() AND wallet.workspace_access(workspace_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON wallet.alert_preferences,wallet.financial_alerts TO plannedwallet_runtime;
