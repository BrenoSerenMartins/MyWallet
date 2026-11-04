BEGIN;
ALTER TABLE wallet.financial_accounts ADD COLUMN benefit_credit_month text NOT NULL DEFAULT 'received'
 CHECK(benefit_credit_month IN ('received','following'));
ALTER TABLE wallet.financial_accounts ADD CONSTRAINT benefit_credit_month_product
 CHECK(benefit_credit_month='received' OR type IN ('benefit_food','benefit_meal'));
COMMIT;
