BEGIN;
CREATE SCHEMA IF NOT EXISTS wallet;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mywallet_runtime') THEN
    CREATE ROLE mywallet_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
CREATE FUNCTION wallet.current_user_id() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('wallet.user_id', true), '')::uuid $$;
CREATE TABLE wallet.financial_accounts (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100), institution text NOT NULL,
 type text NOT NULL CHECK (type IN ('checking','savings','cash','reserve')),
 currency text NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'),
 opening_balance_minor bigint NOT NULL DEFAULT 0 CHECK(abs(opening_balance_minor)<=9007199254740991),
 opening_date date NOT NULL, archived_at timestamptz, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,id)
);
CREATE TABLE wallet.categories (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 type text NOT NULL CHECK(type IN ('income','expense')),color text NOT NULL DEFAULT '#5ee9b5',
 archived_at timestamptz,UNIQUE(user_id,id),UNIQUE(user_id,name,type)
);
CREATE TABLE wallet.transfer_groups (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,id)
);
CREATE TABLE wallet.import_batches (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),account_id uuid NOT NULL,
 file_hash text NOT NULL, file_name text NOT NULL, mapper_version text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','reversed')),
 opening_balance_minor bigint NOT NULL,closing_balance_minor bigint NOT NULL,
 version integer NOT NULL DEFAULT 1,expires_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours'),
 created_at timestamptz NOT NULL DEFAULT now(),confirmed_at timestamptz,reversed_at timestamptz,
 UNIQUE(user_id,id),FOREIGN KEY(user_id,account_id) REFERENCES wallet.financial_accounts(user_id,id)
);
CREATE UNIQUE INDEX import_active_file ON wallet.import_batches(user_id,account_id,file_hash) WHERE status IN ('draft','confirmed');
CREATE TABLE wallet.import_items (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),batch_id uuid NOT NULL,
 source_row integer NOT NULL,transaction_date date NOT NULL,description text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor<>0 AND abs(amount_minor)<=9007199254740991),
 balance_after_minor bigint NOT NULL,source_operation_id text,
 transaction_type text NOT NULL CHECK(transaction_type IN ('income','expense','transfer','unclassified')),
 selected boolean NOT NULL DEFAULT true,duplicate_candidate boolean NOT NULL DEFAULT false,
 category_id uuid,UNIQUE(user_id,id),UNIQUE(batch_id,source_row),
 FOREIGN KEY(user_id,batch_id) REFERENCES wallet.import_batches(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,category_id) REFERENCES wallet.categories(user_id,id)
);
CREATE TABLE wallet.transactions (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),account_id uuid NOT NULL,
 category_id uuid,transaction_date date NOT NULL,description text NOT NULL CHECK(length(description) BETWEEN 1 AND 500),
 amount_minor bigint NOT NULL CHECK(amount_minor<>0 AND abs(amount_minor)<=9007199254740991),
 transaction_type text NOT NULL CHECK(transaction_type IN ('income','expense','transfer','unclassified')),
 source_operation_id text,import_batch_id uuid,source_row integer,transfer_group_id uuid,
 brand text,installments integer CHECK(installments>0),installment_number integer CHECK(installment_number>0),
 merchant text,counterparty text,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),reversed_at timestamptz,
 UNIQUE(user_id,id),UNIQUE(import_batch_id,source_row),
 CHECK(installments IS NULL OR installment_number IS NULL OR installment_number<=installments),
 CHECK(transaction_type<>'income' OR amount_minor>0), CHECK(transaction_type<>'expense' OR amount_minor<0),
 FOREIGN KEY(user_id,account_id) REFERENCES wallet.financial_accounts(user_id,id),
 FOREIGN KEY(user_id,category_id) REFERENCES wallet.categories(user_id,id),
 FOREIGN KEY(user_id,import_batch_id) REFERENCES wallet.import_batches(user_id,id),
 FOREIGN KEY(user_id,transfer_group_id) REFERENCES wallet.transfer_groups(user_id,id)
);
CREATE INDEX transactions_account_date ON wallet.transactions(user_id,account_id,transaction_date DESC,id DESC);
CREATE INDEX transactions_reference ON wallet.transactions(user_id,account_id,source_operation_id);
CREATE INDEX import_expiry ON wallet.import_batches(user_id,status,expires_at);
CREATE TABLE wallet.command_receipts (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),operation text NOT NULL,
 idempotency_key text NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,operation,idempotency_key)
);
CREATE TABLE wallet.restore_batches (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed')),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours'),created_at timestamptz NOT NULL DEFAULT now(),
 confirmed_at timestamptz,UNIQUE(user_id,id)
);
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['financial_accounts','categories','transfer_groups','import_batches','import_items','transactions','command_receipts','restore_batches'] LOOP
  EXECUTE format('ALTER TABLE wallet.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('ALTER TABLE wallet.%I FORCE ROW LEVEL SECURITY',name);
  EXECUTE format('CREATE POLICY owned_data ON wallet.%I TO mywallet_runtime USING (user_id=wallet.current_user_id()) WITH CHECK (user_id=wallet.current_user_id())',name);
 END LOOP;
END $$;
REVOKE ALL ON SCHEMA wallet FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA wallet FROM PUBLIC;
REVOKE ALL ON FUNCTION wallet.current_user_id() FROM PUBLIC;
GRANT USAGE ON SCHEMA wallet TO mywallet_runtime;
GRANT EXECUTE ON FUNCTION wallet.current_user_id() TO mywallet_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA wallet TO mywallet_runtime;
COMMIT;
