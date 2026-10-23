BEGIN;
ALTER TABLE wallet.import_batches ADD COLUMN report_type text NOT NULL DEFAULT 'account_statement' CHECK(report_type IN ('account_statement','settlement'));
ALTER TABLE wallet.import_batches ALTER COLUMN opening_balance_minor DROP NOT NULL;
ALTER TABLE wallet.import_batches ALTER COLUMN closing_balance_minor DROP NOT NULL;
ALTER TABLE wallet.import_batches ADD CONSTRAINT import_report_balances CHECK(
 (report_type='account_statement' AND opening_balance_minor IS NOT NULL AND closing_balance_minor IS NOT NULL)
 OR (report_type='settlement' AND opening_balance_minor IS NULL AND closing_balance_minor IS NULL AND status IN ('draft','history'))
);
ALTER TABLE wallet.import_items ALTER COLUMN balance_after_minor DROP NOT NULL;
ALTER TABLE wallet.import_items ADD COLUMN report_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(report_metadata)='object');
ALTER TABLE wallet.import_items DROP CONSTRAINT import_items_amount_minor_check;
ALTER TABLE wallet.import_items ADD CONSTRAINT import_items_amount_minor_check CHECK(abs(amount_minor)<=9007199254740991);
COMMIT;
