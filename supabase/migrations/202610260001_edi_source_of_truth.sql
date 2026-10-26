BEGIN;
ALTER TABLE wallet.import_batches DROP CONSTRAINT import_report_balances;
ALTER TABLE wallet.import_batches ADD CONSTRAINT import_report_balances CHECK(
 (report_type='account_statement' AND opening_balance_minor IS NOT NULL AND closing_balance_minor IS NOT NULL)
 OR (report_type='settlement' AND opening_balance_minor IS NULL AND closing_balance_minor IS NULL)
);
ALTER TABLE wallet.transactions ADD CONSTRAINT transaction_account_identity UNIQUE(user_id,workspace_id,account_id,id);
CREATE TABLE wallet.transaction_sources (
 user_id uuid NOT NULL,workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),account_id uuid NOT NULL,
 source_key text NOT NULL CHECK(source_key ~ '^[a-f0-9]{64}$'),transaction_id uuid NOT NULL,
 source_data jsonb NOT NULL CHECK(jsonb_typeof(source_data)='object'),
 PRIMARY KEY(user_id,workspace_id,account_id,source_key),
 FOREIGN KEY(user_id,workspace_id,account_id,transaction_id) REFERENCES wallet.transactions(user_id,workspace_id,account_id,id)
);
ALTER TABLE wallet.transaction_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.transaction_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY owned_data ON wallet.transaction_sources TO mywallet_runtime
 USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())
 WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON wallet.transaction_sources TO mywallet_runtime;
CREATE INDEX transaction_sources_transaction ON wallet.transaction_sources(user_id,workspace_id,transaction_id);
ALTER TABLE wallet.import_items ADD COLUMN linked_transaction_id uuid;
ALTER TABLE wallet.import_items ADD COLUMN confirm_new boolean NOT NULL DEFAULT false;
ALTER TABLE wallet.import_items ADD COLUMN source_key text CHECK(source_key IS NULL OR source_key ~ '^[a-f0-9]{64}$');
ALTER TABLE wallet.import_items ADD FOREIGN KEY(user_id,workspace_id,linked_transaction_id) REFERENCES wallet.transactions(user_id,workspace_id,id);
UPDATE wallet.import_items i SET selected=true,duplicate_candidate=false FROM wallet.import_batches b WHERE b.id=i.batch_id AND b.report_type='settlement' AND b.status IN ('draft','history');
COMMIT;
