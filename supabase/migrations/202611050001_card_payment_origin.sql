-- Retain source classification when linking an existing bank debit to a card bill.
ALTER TABLE wallet.card_payments ADD COLUMN original_debit jsonb;
ALTER TABLE wallet.card_payments ADD CONSTRAINT card_payment_original_debit_valid CHECK (
  original_debit IS NULL OR coalesce((mode='link' AND jsonb_typeof(original_debit)='object'
    AND original_debit->>'transactionType' IN ('expense','transfer','unclassified')
    AND original_debit ? 'categoryId'),false)
);
