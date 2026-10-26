BEGIN;
ALTER TABLE wallet.transactions ADD COLUMN refund_of_id uuid;
ALTER TABLE wallet.transactions ADD FOREIGN KEY(user_id,workspace_id,account_id,refund_of_id) REFERENCES wallet.transactions(user_id,workspace_id,account_id,id);
ALTER TABLE wallet.transactions DROP CONSTRAINT transactions_check2;
ALTER TABLE wallet.transactions DROP CONSTRAINT transactions_check1;
ALTER TABLE wallet.transactions ADD CONSTRAINT financial_direction CHECK(
 (refund_of_id IS NULL AND (transaction_type<>'income' OR amount_minor>0) AND (transaction_type<>'expense' OR amount_minor<0))
 OR (refund_of_id IS NOT NULL AND ((transaction_type='expense' AND amount_minor>0) OR (transaction_type='income' AND amount_minor<0)))
);
ALTER TABLE wallet.transactions ADD CONSTRAINT refund_shape CHECK(refund_of_id IS NULL OR (refund_of_id<>id AND balance_adjustment IS NULL AND transfer_group_id IS NULL));
CREATE INDEX transaction_refund_origin ON wallet.transactions(user_id,workspace_id,refund_of_id) WHERE refund_of_id IS NOT NULL AND reversed_at IS NULL;
ALTER TABLE wallet.import_items ADD COLUMN refund_of_id uuid;
ALTER TABLE wallet.import_items ADD FOREIGN KEY(user_id,workspace_id,refund_of_id) REFERENCES wallet.transactions(user_id,workspace_id,id);
COMMIT;
