BEGIN;
CREATE TABLE wallet.category_groups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 workspace_id uuid NOT NULL DEFAULT wallet.current_workspace_id(),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
 type text NOT NULL CHECK(type IN ('income','expense')),
 color text NOT NULL CHECK(color ~ '^#[0-9a-fA-F]{6}$'),
 UNIQUE(user_id,workspace_id,name,type),
 UNIQUE(user_id,workspace_id,id,type),
 FOREIGN KEY(user_id,workspace_id) REFERENCES wallet.workspaces(user_id,id)
);
ALTER TABLE wallet.category_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.category_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY owned_data ON wallet.category_groups TO mywallet_runtime
 USING(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id())
 WITH CHECK(user_id=wallet.current_user_id() AND workspace_id=wallet.current_workspace_id());
GRANT SELECT,INSERT,UPDATE ON wallet.category_groups TO mywallet_runtime;
ALTER TABLE wallet.categories ADD COLUMN group_id uuid;
ALTER TABLE wallet.categories ADD FOREIGN KEY(user_id,workspace_id,group_id,type)
 REFERENCES wallet.category_groups(user_id,workspace_id,id,type);
ALTER TABLE wallet.categories DROP CONSTRAINT categories_user_id_workspace_id_name_type_key;
CREATE UNIQUE INDEX categories_group_name ON wallet.categories(user_id,workspace_id,coalesce(group_id,'00000000-0000-0000-0000-000000000000'::uuid),name,type);
COMMIT;
