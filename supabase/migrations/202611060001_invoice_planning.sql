-- The funding account belongs to each payment, not to the card itself.
ALTER TABLE wallet.credit_cards ALTER COLUMN payment_account_id DROP NOT NULL;
ALTER TABLE wallet.monthly_plans ADD COLUMN card_plans jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(card_plans)='array');
