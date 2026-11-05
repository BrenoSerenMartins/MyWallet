BEGIN;
ALTER TABLE wallet.financial_accounts DROP CONSTRAINT financial_accounts_type_check;
ALTER TABLE wallet.financial_accounts ADD CONSTRAINT financial_accounts_type_check CHECK(type IN ('checking','savings','cash','reserve','benefit_food','benefit_meal','credit_card','investment'));
ALTER TABLE wallet.financial_accounts ADD CONSTRAINT managed_institution CHECK((type NOT IN ('credit_card','investment') AND institution NOT IN ('credit_card','investment')) OR type=institution);
ALTER TABLE wallet.transactions ADD COLUMN managed_kind text CHECK(managed_kind IN ('card','investment'));
CREATE TABLE wallet.transaction_claims (
 user_id uuid NOT NULL REFERENCES auth.users(id), workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 transaction_id uuid NOT NULL, purpose text NOT NULL CHECK(purpose IN ('commitment','card','investment')), owner_key text NOT NULL CHECK(length(owner_key) BETWEEN 1 AND 120),
 PRIMARY KEY(user_id,workspace_id,transaction_id),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,transaction_id) REFERENCES wallet.transactions(user_id,workspace_id,id) ON DELETE CASCADE
);
INSERT INTO wallet.transaction_claims(user_id,workspace_id,transaction_id,purpose,owner_key)
 SELECT user_id,workspace_id,transaction_id,'commitment',schedule_id::text||':'||due_date::text FROM wallet.commitment_occurrences WHERE status='settled';
CREATE TABLE wallet.credit_cards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id), workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 account_id uuid NOT NULL, payment_account_id uuid NOT NULL, name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 closing_day integer NOT NULL CHECK(closing_day BETWEEN 1 AND 31), due_day integer NOT NULL CHECK(due_day BETWEEN 1 AND 31),
 limit_minor bigint NOT NULL CHECK(limit_minor BETWEEN 0 AND 1000000000000), archived boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(user_id,workspace_id,id), UNIQUE(user_id,workspace_id,account_id),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,account_id) REFERENCES wallet.financial_accounts(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,payment_account_id) REFERENCES wallet.financial_accounts(user_id,workspace_id,id)
);
CREATE TABLE wallet.credit_card_bills (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id), workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 card_id uuid NOT NULL, month text NOT NULL CHECK(month ~ '^\d{4}-(0[1-9]|1[0-2])$'), closing_date date NOT NULL, due_date date NOT NULL CHECK(due_date>=closing_date),
 UNIQUE(user_id,workspace_id,id), UNIQUE(user_id,workspace_id,card_id,month),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,card_id) REFERENCES wallet.credit_cards(user_id,workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE wallet.card_purchases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id), workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 card_id uuid NOT NULL, category_id uuid, description text NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 120), purchase_date date NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000000), installments integer NOT NULL CHECK(installments BETWEEN 1 AND 120),
 first_bill_month text NOT NULL CHECK(first_bill_month ~ '^\d{4}-(0[1-9]|1[0-2])$'), canceled boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,card_id) REFERENCES wallet.credit_cards(user_id,workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,category_id) REFERENCES wallet.categories(user_id,workspace_id,id)
);
CREATE TABLE wallet.card_bill_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id), workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 card_id uuid NOT NULL, purchase_id uuid, transaction_id uuid, bill_month text NOT NULL CHECK(bill_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 kind text NOT NULL CHECK(kind IN ('purchase','opening','refund')), installment_number integer CHECK(installment_number BETWEEN 1 AND 120),
 amount_minor bigint NOT NULL CHECK(amount_minor<>0), description text NOT NULL,
 UNIQUE(user_id,workspace_id,id), UNIQUE(user_id,workspace_id,transaction_id),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,card_id) REFERENCES wallet.credit_cards(user_id,workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,purchase_id) REFERENCES wallet.card_purchases(user_id,workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,transaction_id) REFERENCES wallet.transactions(user_id,workspace_id,id)
);
CREATE TABLE wallet.card_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id), workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 card_id uuid NOT NULL, bill_month text NOT NULL, debit_id uuid, credit_id uuid, amount_minor bigint NOT NULL CHECK(amount_minor>0),
 payment_date date NOT NULL, mode text NOT NULL CHECK(mode IN ('create','link')), voided boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,card_id) REFERENCES wallet.credit_cards(user_id,workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,debit_id) REFERENCES wallet.transactions(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,credit_id) REFERENCES wallet.transactions(user_id,workspace_id,id)
);
CREATE UNIQUE INDEX card_payment_live_debit ON wallet.card_payments(user_id,workspace_id,debit_id) WHERE NOT voided;
CREATE UNIQUE INDEX card_payment_live_credit ON wallet.card_payments(user_id,workspace_id,credit_id) WHERE NOT voided;
CREATE TABLE wallet.investment_holdings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id), workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 account_id uuid NOT NULL, name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100), provider text NOT NULL DEFAULT '' CHECK(length(provider)<=100),
 product_type text NOT NULL CHECK(product_type IN ('fixed_income','fund','stock','etf','crypto','other')),
 capital_minor bigint NOT NULL CHECK(capital_minor BETWEEN 0 AND 1000000000000), market_minor bigint NOT NULL CHECK(market_minor BETWEEN 0 AND 1000000000000),
 valuation_date date NOT NULL, valuation_method text NOT NULL DEFAULT 'manual' CHECK(valuation_method IN ('manual','flow_estimate')), opened_date date NOT NULL, last_event_id uuid, archived boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(user_id,workspace_id,id), UNIQUE(user_id,workspace_id,account_id),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,account_id) REFERENCES wallet.financial_accounts(user_id,workspace_id,id)
);
CREATE TABLE wallet.investment_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id), workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 holding_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('contribution','redemption','income','valuation','capital','edit','undo')),
 event_date date NOT NULL, amount_minor bigint NOT NULL DEFAULT 0 CHECK(amount_minor>=0), capital_removed_minor bigint NOT NULL DEFAULT 0 CHECK(capital_removed_minor>=0),
 before_state jsonb NOT NULL CHECK(jsonb_typeof(before_state)='object'), details jsonb NOT NULL DEFAULT '{}',
 debit_id uuid, credit_id uuid, result_id uuid, linked_id uuid, undone boolean NOT NULL DEFAULT false, undo_of_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,holding_id) REFERENCES wallet.investment_holdings(user_id,workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,debit_id) REFERENCES wallet.transactions(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,credit_id) REFERENCES wallet.transactions(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,result_id) REFERENCES wallet.transactions(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,linked_id) REFERENCES wallet.transactions(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,undo_of_id) REFERENCES wallet.investment_events(user_id,workspace_id,id) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE wallet.investment_holdings ADD FOREIGN KEY(user_id,workspace_id,last_event_id) REFERENCES wallet.investment_events(user_id,workspace_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE wallet.wealth_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id), workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100), kind text NOT NULL CHECK(kind IN ('asset','debt')),
 value_minor bigint NOT NULL CHECK(value_minor BETWEEN 0 AND 1000000000000), valuation_date date NOT NULL, notes text NOT NULL DEFAULT '' CHECK(length(notes)<=500),
 archived boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(user_id,workspace_id,id), FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE
);
CREATE TABLE wallet.wealth_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id), workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 kind text NOT NULL CHECK(kind IN ('snapshot','item_change')), data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,workspace_id,id), FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE
);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['transaction_claims','credit_cards','credit_card_bills','card_purchases','card_bill_entries','card_payments','investment_holdings','investment_events','wealth_items','wealth_history'] LOOP
  EXECUTE format('ALTER TABLE wallet.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE wallet.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY owned_managed_data ON wallet.%I TO plannedwallet_runtime USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id()) WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())',tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON wallet.%I TO plannedwallet_runtime',tab);
 END LOOP;
END $$;
GRANT DELETE ON wallet.transaction_claims TO plannedwallet_runtime;
COMMIT;
