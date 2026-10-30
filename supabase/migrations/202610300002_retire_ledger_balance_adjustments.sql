BEGIN;
-- Close the rolling-deploy window: convert any correction the old API wrote
-- after migration 001, then forbid future correction transactions.
LOCK TABLE wallet.transactions IN SHARE ROW EXCLUSIVE MODE;
DO $$ DECLARE a record; delta bigint; new_base bigint; anchor bigint; audit_id uuid; basis jsonb; old_rows jsonb; today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; active_count integer;
BEGIN
 FOR a IN SELECT f.* FROM wallet.financial_accounts f WHERE EXISTS(SELECT 1 FROM wallet.transactions t WHERE t.account_id=f.id AND t.balance_adjustment IS NOT NULL AND t.reversed_at IS NULL) LOOP
  SELECT coalesce(sum(amount_minor) FILTER(WHERE reversed_at IS NULL),0),count(*) FILTER(WHERE reversed_at IS NULL),
   jsonb_agg(jsonb_build_object('id',id,'amount',amount_minor,'date',transaction_date,'adjustment',balance_adjustment,'reversedAt',reversed_at) ORDER BY created_at,id)
   INTO delta,active_count,old_rows FROM wallet.transactions WHERE account_id=a.id AND balance_adjustment IS NOT NULL;
  new_base:=a.opening_balance_minor+delta; audit_id:=gen_random_uuid(); basis:=a.balance_basis;
  IF active_count>0 THEN
   SELECT new_base+coalesce(sum(amount_minor),0) INTO anchor FROM wallet.transactions WHERE account_id=a.id AND balance_adjustment IS NULL AND reversed_at IS NULL AND transaction_date<=today;
   basis:=jsonb_build_object('kind','manual','referenceDate',today::text,'referenceBalance',anchor,'originId',audit_id,'reviewRequired',false);
   UPDATE wallet.transactions SET balance_basis_included=true WHERE account_id=a.id;
  END IF;
  INSERT INTO wallet.account_balance_history(id,user_id,workspace_id,account_id,operation,previous_base_minor,new_base_minor,previous_basis,new_basis,reason,details)
   VALUES(audit_id,a.user_id,a.workspace_id,a.id,'legacy_conversion',a.opening_balance_minor,new_base,a.balance_basis,basis,'Conversão das correções anteriores para saldo base',jsonb_build_object('legacyCorrections',old_rows,'knownSameDayIds',coalesce((SELECT jsonb_agg(t.id) FROM wallet.transactions t WHERE t.account_id=a.id AND t.balance_adjustment IS NULL AND t.reversed_at IS NULL AND t.transaction_date=today),'[]'::jsonb)));
  UPDATE wallet.financial_accounts SET opening_balance_minor=new_base,balance_basis=basis,version=version+1 WHERE id=a.id;
  UPDATE wallet.transactions SET reversed_at=coalesce(reversed_at,now()) WHERE account_id=a.id AND balance_adjustment IS NOT NULL;
 END LOOP;
END $$;
ALTER TABLE wallet.transactions ADD CONSTRAINT balance_adjustments_retired CHECK(balance_adjustment IS NULL OR reversed_at IS NOT NULL);
COMMIT;
