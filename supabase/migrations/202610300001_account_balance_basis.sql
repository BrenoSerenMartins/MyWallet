BEGIN;
ALTER TABLE wallet.financial_accounts ADD COLUMN balance_basis jsonb NOT NULL DEFAULT '{"kind":"unknown"}'::jsonb;
ALTER TABLE wallet.financial_accounts ADD CONSTRAINT balance_basis_shape CHECK (
 jsonb_typeof(balance_basis)='object' AND balance_basis ? 'kind' AND balance_basis->>'kind' IN ('unknown','legacy','statement','manual')
 AND (balance_basis->>'kind' NOT IN ('statement','manual') OR (
  balance_basis ?& ARRAY['referenceDate','referenceBalance','originId'] AND jsonb_typeof(balance_basis->'referenceDate')='string' AND jsonb_typeof(balance_basis->'referenceBalance')='number'
  AND (balance_basis->>'referenceBalance')::numeric BETWEEN -9007199254740991 AND 9007199254740991
  AND trunc((balance_basis->>'referenceBalance')::numeric)=(balance_basis->>'referenceBalance')::numeric
 ))
);
UPDATE wallet.financial_accounts SET balance_basis='{"kind":"legacy"}' WHERE opening_balance_minor<>0;
ALTER TABLE wallet.transactions ADD COLUMN balance_basis_included boolean NOT NULL DEFAULT false;
CREATE TABLE wallet.account_balance_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(), account_id uuid NOT NULL,
 operation text NOT NULL CHECK(operation IN ('manual','statement','rebase','undo','legacy_conversion')),
 previous_base_minor bigint NOT NULL CHECK(previous_base_minor BETWEEN -9007199254740991 AND 9007199254740991),
 new_base_minor bigint NOT NULL CHECK(new_base_minor BETWEEN -9007199254740991 AND 9007199254740991),
 previous_basis jsonb NOT NULL, new_basis jsonb NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),
 details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(details)='object'),
 undo_of_id uuid, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(user_id,workspace_id,id), UNIQUE(user_id,workspace_id,undo_of_id),
 FOREIGN KEY(user_id,workspace_id,account_id) REFERENCES wallet.financial_accounts(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,undo_of_id) REFERENCES wallet.account_balance_history(user_id,workspace_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX account_balance_history_account ON wallet.account_balance_history(user_id,workspace_id,account_id,created_at);
ALTER TABLE wallet.account_balance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.account_balance_history FORCE ROW LEVEL SECURITY;
CREATE POLICY owned_data ON wallet.account_balance_history TO mywallet_runtime
 USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())
 WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id());
GRANT SELECT,INSERT ON wallet.account_balance_history TO mywallet_runtime;
-- Fold old correction transactions into the base, preserving every monetary total.
-- The original rows remain stored and the complete conversion is audited.
DO $$ DECLARE a record; delta bigint; new_base bigint; anchor bigint; audit_id uuid; basis jsonb; old_rows jsonb; today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; active_count integer;
BEGIN
 FOR a IN SELECT f.* FROM wallet.financial_accounts f WHERE EXISTS(SELECT 1 FROM wallet.transactions t WHERE t.account_id=f.id AND t.balance_adjustment IS NOT NULL) LOOP
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
COMMIT;
