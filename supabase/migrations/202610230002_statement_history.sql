BEGIN;
ALTER TABLE wallet.import_batches ADD COLUMN history_saved_at timestamptz;
ALTER TABLE wallet.import_batches DROP CONSTRAINT import_batches_status_check;
ALTER TABLE wallet.import_batches ADD CONSTRAINT import_batches_status_check CHECK(status IN ('draft','confirmed','reversed','history'));
DROP INDEX wallet.import_active_file;
CREATE UNIQUE INDEX import_active_file ON wallet.import_batches(user_id,account_id,file_hash) WHERE status IN ('draft','confirmed','history');
COMMIT;
