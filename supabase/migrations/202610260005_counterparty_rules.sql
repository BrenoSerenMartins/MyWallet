BEGIN;
CREATE TABLE wallet.counterparties(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(), name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 150),
 enabled boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1,
 UNIQUE(user_id,workspace_id,id), FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id)
);
CREATE TABLE wallet.counterparty_identifiers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(), counterparty_id uuid NOT NULL, account_id uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN ('manual','account_statement','settlement','benefit_statement')),
 enabled boolean NOT NULL DEFAULT true,
 value text NOT NULL CHECK(length(value) BETWEEN 1 AND 500), normalized_value text NOT NULL CHECK(length(normalized_value) BETWEEN 1 AND 500),
 UNIQUE(user_id,workspace_id,account_id,source_kind,normalized_value),
 FOREIGN KEY(user_id,workspace_id,counterparty_id) REFERENCES wallet.counterparties(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,account_id) REFERENCES wallet.financial_accounts(user_id,workspace_id,id)
);
CREATE TABLE wallet.classification_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(), counterparty_id uuid NOT NULL, account_id uuid NOT NULL,
 transaction_type text NOT NULL CHECK(transaction_type IN ('income','expense')), category_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1,
 UNIQUE(user_id,workspace_id,account_id,counterparty_id,transaction_type),
 UNIQUE(user_id,workspace_id,account_id,counterparty_id,transaction_type,id),
 FOREIGN KEY(user_id,workspace_id,counterparty_id) REFERENCES wallet.counterparties(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,account_id) REFERENCES wallet.financial_accounts(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,category_id) REFERENCES wallet.categories(user_id,workspace_id,id)
);
ALTER TABLE wallet.transactions ADD COLUMN counterparty_id uuid;
ALTER TABLE wallet.transactions ADD COLUMN classification_rule_id uuid;
ALTER TABLE wallet.transactions ADD COLUMN source_kind text NOT NULL DEFAULT 'manual' CHECK(source_kind IN ('manual','account_statement','settlement','benefit_statement'));
ALTER TABLE wallet.transactions ADD FOREIGN KEY(user_id,workspace_id,counterparty_id) REFERENCES wallet.counterparties(user_id,workspace_id,id);
ALTER TABLE wallet.transactions ADD FOREIGN KEY(user_id,workspace_id,account_id,counterparty_id,transaction_type,classification_rule_id) REFERENCES wallet.classification_rules(user_id,workspace_id,account_id,counterparty_id,transaction_type,id);
ALTER TABLE wallet.transactions ADD CHECK(classification_rule_id IS NULL OR counterparty_id IS NOT NULL);
ALTER TABLE wallet.import_items ADD COLUMN classification_intent jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(classification_intent)='object');
UPDATE wallet.transactions t SET source_kind=b.report_type FROM wallet.import_batches b WHERE b.id=t.import_batch_id;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['counterparties','counterparty_identifiers','classification_rules'] LOOP
  EXECUTE format('ALTER TABLE wallet.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY owned_data ON wallet.%I TO mywallet_runtime USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id()) WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())',tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON wallet.%I TO mywallet_runtime',tab);
 END LOOP;
END $$;
GRANT DELETE ON wallet.counterparty_identifiers TO mywallet_runtime;
COMMIT;
