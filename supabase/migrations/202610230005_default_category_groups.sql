BEGIN;
ALTER TABLE wallet.category_groups ADD COLUMN is_default boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX category_group_default ON wallet.category_groups(user_id,workspace_id,type) WHERE is_default;
-- Invoked only by the workspace trigger. New workspaces have no active financial
-- scope yet, so the trusted trigger provisions their two owned default groups.
CREATE FUNCTION wallet.create_default_category_groups() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,wallet AS $$
BEGIN
 INSERT INTO wallet.category_groups(user_id,workspace_id,name,type,color,is_default)
 VALUES(NEW.user_id,NEW.id,'Geral','income','#5ee9b5',true),
       (NEW.user_id,NEW.id,'Geral','expense','#5ee9b5',true);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION wallet.create_default_category_groups() FROM PUBLIC,mywallet_runtime;
CREATE TRIGGER workspace_category_defaults AFTER INSERT ON wallet.workspaces
 FOR EACH ROW EXECUTE FUNCTION wallet.create_default_category_groups();
-- Choose a free name instead of renaming a user-created group called Geral.
DO $$ DECLARE space record; kind text; candidate text; suffix integer; BEGIN
 FOR space IN SELECT id,user_id FROM wallet.workspaces LOOP
  FOREACH kind IN ARRAY ARRAY['income','expense'] LOOP
   candidate:='Geral'; suffix:=0;
   WHILE EXISTS(SELECT 1 FROM wallet.category_groups WHERE user_id=space.user_id AND workspace_id=space.id AND type=kind AND name=candidate) LOOP
    suffix:=suffix+1;
    candidate:=CASE WHEN suffix=1 THEN 'Geral (padrão)' ELSE 'Geral (padrão '||suffix||')' END;
   END LOOP;
   INSERT INTO wallet.category_groups(user_id,workspace_id,name,type,color,is_default)
    VALUES(space.user_id,space.id,candidate,kind,'#5ee9b5',true);
  END LOOP;
 END LOOP;
END $$;
UPDATE wallet.categories c SET group_id=g.id FROM wallet.category_groups g
 WHERE c.group_id IS NULL AND g.user_id=c.user_id AND g.workspace_id=c.workspace_id AND g.type=c.type AND g.is_default;
ALTER TABLE wallet.categories ALTER COLUMN group_id SET NOT NULL;
-- Keep older clients that send null group_id working during the rollout.
CREATE FUNCTION wallet.assign_default_category_group() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,wallet AS $$
BEGIN
 IF NEW.group_id IS NULL THEN
  SELECT id INTO NEW.group_id FROM wallet.category_groups
   WHERE user_id=NEW.user_id AND workspace_id=NEW.workspace_id AND type=NEW.type AND is_default;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION wallet.assign_default_category_group() FROM PUBLIC,mywallet_runtime;
CREATE TRIGGER category_default_assignment BEFORE INSERT OR UPDATE OF group_id ON wallet.categories
 FOR EACH ROW EXECUTE FUNCTION wallet.assign_default_category_group();
GRANT DELETE ON wallet.category_groups TO mywallet_runtime;
CREATE FUNCTION wallet.protect_default_category_groups() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,wallet AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.is_default THEN RAISE EXCEPTION 'Default category groups are protected' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 IF OLD.is_default AND (NOT NEW.is_default OR NEW.user_id<>OLD.user_id OR NEW.workspace_id<>OLD.workspace_id OR NEW.type<>OLD.type OR NEW.name<>OLD.name) THEN
  RAISE EXCEPTION 'Default category groups are protected' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION wallet.protect_default_category_groups() FROM PUBLIC,mywallet_runtime;
CREATE TRIGGER protect_category_defaults BEFORE UPDATE OR DELETE ON wallet.category_groups
 FOR EACH ROW EXECUTE FUNCTION wallet.protect_default_category_groups();
COMMIT;
