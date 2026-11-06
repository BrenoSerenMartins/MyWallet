CREATE TABLE wallet.card_recurring_rules (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),card_id uuid NOT NULL,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=1000000000000),
 category_id uuid,charge_day integer NOT NULL CHECK(charge_day BETWEEN 1 AND 31),start_month text NOT NULL,end_month text,
 archived boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,
 UNIQUE(user_id,workspace_id,id),FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,card_id) REFERENCES wallet.credit_cards(user_id,workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,category_id) REFERENCES wallet.categories(user_id,workspace_id,id) ON DELETE CASCADE,
 CHECK(start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND (end_month IS NULL OR end_month>=start_month))
);
CREATE TABLE wallet.card_recurring_charges (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),rule_id uuid NOT NULL,
 charge_month text NOT NULL,purchase_id uuid NOT NULL,actor_id uuid NOT NULL,
 UNIQUE(user_id,workspace_id,rule_id,charge_month),UNIQUE(user_id,workspace_id,purchase_id),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,workspace_id,rule_id) REFERENCES wallet.card_recurring_rules(user_id,workspace_id,id),
 FOREIGN KEY(user_id,workspace_id,purchase_id) REFERENCES wallet.card_purchases(user_id,workspace_id,id) ON DELETE CASCADE
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['card_recurring_rules','card_recurring_charges'] LOOP
 EXECUTE format('ALTER TABLE wallet.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE wallet.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owned_data ON wallet.%I TO plannedwallet_runtime USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id()) WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON wallet.%I TO plannedwallet_runtime',t);
END LOOP;END $$;
