BEGIN;
CREATE TABLE wallet.commitment_schedules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 account_id uuid NOT NULL,
 category_id uuid,
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 120),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000000),
 transaction_type text NOT NULL CHECK(transaction_type IN ('income','expense')),
 frequency text NOT NULL CHECK(frequency IN ('once','monthly')),
 start_date date NOT NULL CHECK(start_date BETWEEN '1900-01-01' AND '9998-12-31'),
 end_date date CHECK(end_date BETWEEN start_date AND '9998-12-31'),
 ended_on date,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,account_id) REFERENCES wallet.financial_accounts(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,category_id) REFERENCES wallet.categories(user_id,workspace_id,id)
);
CREATE TABLE wallet.commitment_occurrences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 schedule_id uuid NOT NULL,
 due_date date NOT NULL,
 status text NOT NULL CHECK(status IN ('settled','skipped','review')),
 transaction_id uuid,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 CHECK((status='settled')=(transaction_id IS NOT NULL)),
 UNIQUE(user_id,workspace_id,schedule_id,due_date),
 UNIQUE(user_id,workspace_id,transaction_id),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,schedule_id) REFERENCES wallet.commitment_schedules(user_id,workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,transaction_id) REFERENCES wallet.transactions(user_id,workspace_id,id)
);
ALTER TABLE wallet.commitment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.commitment_schedules FORCE ROW LEVEL SECURITY;
ALTER TABLE wallet.commitment_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.commitment_occurrences FORCE ROW LEVEL SECURITY;
CREATE POLICY owned_commitment ON wallet.commitment_schedules TO mywallet_runtime
 USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())
 WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id());
CREATE POLICY owned_occurrence ON wallet.commitment_occurrences TO mywallet_runtime
 USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())
 WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id());
GRANT SELECT,INSERT,UPDATE ON wallet.commitment_schedules TO mywallet_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON wallet.commitment_occurrences TO mywallet_runtime;
COMMIT;
