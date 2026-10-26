BEGIN;
ALTER TABLE wallet.financial_accounts DROP CONSTRAINT financial_accounts_type_check;
ALTER TABLE wallet.financial_accounts ADD CONSTRAINT financial_accounts_type_check CHECK(type IN ('checking','savings','cash','reserve','benefit_food','benefit_meal'));
ALTER TABLE wallet.financial_accounts ADD CONSTRAINT benefit_institution CHECK((institution='alelo' AND type IN ('benefit_food','benefit_meal')) OR (institution<>'alelo' AND type NOT IN ('benefit_food','benefit_meal')));
ALTER TABLE wallet.import_batches DROP CONSTRAINT import_batches_report_type_check;
ALTER TABLE wallet.import_batches ADD CONSTRAINT import_batches_report_type_check CHECK(report_type IN ('account_statement','settlement','benefit_statement'));
ALTER TABLE wallet.import_batches DROP CONSTRAINT import_report_balances;
ALTER TABLE wallet.import_batches ADD CONSTRAINT import_report_balances CHECK(
 (report_type='account_statement' AND opening_balance_minor IS NOT NULL AND closing_balance_minor IS NOT NULL)
 OR (report_type IN ('settlement','benefit_statement') AND opening_balance_minor IS NULL AND closing_balance_minor IS NULL)
);
COMMIT;
