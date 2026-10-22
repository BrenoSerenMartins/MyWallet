BEGIN;
CREATE TABLE wallet.workspaces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=240),
 color text NOT NULL DEFAULT 'emerald' CHECK(color IN ('emerald','blue','violet','amber','rose')),
 is_default boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,id)
);
CREATE UNIQUE INDEX workspace_default_owner ON wallet.workspaces(user_id) WHERE is_default;
INSERT INTO wallet.workspaces(user_id,name,description,is_default)
 SELECT id,'Pessoal','Minhas finanças pessoais',true FROM auth.users;
CREATE FUNCTION wallet.current_workspace_id() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT nullif(current_setting('wallet.workspace_id',true),'')::uuid $$;
ALTER TABLE wallet.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_owner ON wallet.workspaces TO mywallet_runtime
 USING(user_id=wallet.current_user_id()) WITH CHECK(user_id=wallet.current_user_id());
GRANT SELECT,INSERT ON wallet.workspaces TO mywallet_runtime;
REVOKE ALL ON FUNCTION wallet.current_workspace_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION wallet.current_workspace_id() TO mywallet_runtime;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['financial_accounts','categories','transfer_groups','import_batches','import_items','transactions','command_receipts','restore_batches'] LOOP
  EXECUTE format('ALTER TABLE wallet.%I ADD COLUMN workspace_id uuid',tab);
  EXECUTE format('UPDATE wallet.%I t SET workspace_id=w.id FROM wallet.workspaces w WHERE w.user_id=t.user_id AND w.is_default',tab);
  EXECUTE format('ALTER TABLE wallet.%I ALTER COLUMN workspace_id SET NOT NULL',tab);
  EXECUTE format('ALTER TABLE wallet.%I ALTER COLUMN workspace_id SET DEFAULT wallet.current_workspace_id()',tab);
  EXECUTE format('ALTER TABLE wallet.%I ADD CONSTRAINT %I FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id)',tab,tab||'_workspace_owner');
  EXECUTE format('ALTER TABLE wallet.%I ADD CONSTRAINT %I UNIQUE(user_id,workspace_id,id)',tab,tab||'_workspace_identity');
  EXECUTE format('DROP POLICY owned_data ON wallet.%I',tab);
  EXECUTE format('CREATE POLICY owned_data ON wallet.%I TO mywallet_runtime USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id()) WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())',tab);
 END LOOP;
END $$;
ALTER TABLE wallet.categories DROP CONSTRAINT categories_user_id_name_type_key;
ALTER TABLE wallet.categories ADD UNIQUE(user_id,workspace_id,name,type);
ALTER TABLE wallet.command_receipts DROP CONSTRAINT command_receipts_user_id_operation_idempotency_key_key;
ALTER TABLE wallet.command_receipts ADD UNIQUE(user_id,workspace_id,operation,idempotency_key);
ALTER TABLE wallet.transactions
 ADD FOREIGN KEY(user_id,workspace_id,account_id) REFERENCES wallet.financial_accounts(user_id,workspace_id,id),
 ADD FOREIGN KEY(user_id,workspace_id,category_id) REFERENCES wallet.categories(user_id,workspace_id,id),
 ADD FOREIGN KEY(user_id,workspace_id,import_batch_id) REFERENCES wallet.import_batches(user_id,workspace_id,id),
 ADD FOREIGN KEY(user_id,workspace_id,transfer_group_id) REFERENCES wallet.transfer_groups(user_id,workspace_id,id);
ALTER TABLE wallet.import_batches ADD FOREIGN KEY(user_id,workspace_id,account_id) REFERENCES wallet.financial_accounts(user_id,workspace_id,id);
ALTER TABLE wallet.import_items
 ADD FOREIGN KEY(user_id,workspace_id,batch_id) REFERENCES wallet.import_batches(user_id,workspace_id,id),
 ADD FOREIGN KEY(user_id,workspace_id,category_id) REFERENCES wallet.categories(user_id,workspace_id,id);
CREATE INDEX transactions_workspace_date ON wallet.transactions(user_id,workspace_id,transaction_date DESC,id DESC);
COMMIT;
