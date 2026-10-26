BEGIN;
ALTER TABLE wallet.transactions ADD COLUMN balance_adjustment jsonb;
ALTER TABLE wallet.transactions ADD CONSTRAINT balance_adjustment_shape CHECK(balance_adjustment IS NULL OR (
 jsonb_typeof(balance_adjustment)='object' AND balance_adjustment ?& ARRAY['previousBalance','targetBalance','reason']
 AND jsonb_typeof(balance_adjustment->'previousBalance')='number' AND jsonb_typeof(balance_adjustment->'targetBalance')='number'
 AND jsonb_typeof(balance_adjustment->'reason')='string' AND length(trim(balance_adjustment->>'reason')) BETWEEN 1 AND 500
 AND transaction_type='transfer' AND category_id IS NULL AND transfer_group_id IS NULL AND import_batch_id IS NULL
 AND (balance_adjustment->>'targetBalance')::numeric-(balance_adjustment->>'previousBalance')::numeric=amount_minor
));
COMMIT;
