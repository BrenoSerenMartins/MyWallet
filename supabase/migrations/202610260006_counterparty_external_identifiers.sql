BEGIN;
ALTER TABLE wallet.counterparty_identifiers ADD COLUMN identifier_kind text NOT NULL DEFAULT 'description' CHECK(identifier_kind IN ('description','store_id'));
DO $$ DECLARE constraint_name text; BEGIN
 FOR constraint_name IN SELECT conname FROM pg_constraint WHERE conrelid='wallet.counterparty_identifiers'::regclass AND contype='u' LOOP
  EXECUTE format('ALTER TABLE wallet.counterparty_identifiers DROP CONSTRAINT %I',constraint_name);
 END LOOP;
END $$;
ALTER TABLE wallet.counterparty_identifiers ADD CONSTRAINT counterparty_identifier_value UNIQUE(user_id,workspace_id,account_id,source_kind,identifier_kind,normalized_value);
ALTER TABLE wallet.counterparty_identifiers ADD CHECK(identifier_kind='description' OR source_kind='settlement');
COMMIT;
