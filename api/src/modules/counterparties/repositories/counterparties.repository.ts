import { normalizeCounterpartyIdentifier } from '../../../core/integration/index.js';
import { comparableTextSql } from '../../../core/database/normalized-text.js';
import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/index.js';
import type {
  CounterpartyRecord,
  CounterpartyIdentifier,
  ClassificationRule,
  SourceKind,
} from '../../../core/integration/index.js';
@Injectable()
export class CounterpartiesRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async agents() {
    return this.db.query<CounterpartyRecord>(
      'SELECT id,name,enabled,version FROM wallet.counterparties WHERE user_id=$1 ORDER BY name,id',
      [this.db.userId],
    );
  }
  async identifiers() {
    return this.db.query<CounterpartyIdentifier>(
      'SELECT id,counterparty_id AS "counterpartyId",account_id AS "accountId",source_kind AS "sourceKind",identifier_kind AS "identifierKind",value,enabled FROM wallet.counterparty_identifiers WHERE user_id=$1 ORDER BY value,id',
      [this.db.userId],
    );
  }
  async rules() {
    return this.db.query<ClassificationRule>(
      'SELECT id,counterparty_id AS "counterpartyId",account_id AS "accountId",transaction_type AS "transactionType",category_id AS "categoryId",enabled,version FROM wallet.classification_rules WHERE user_id=$1 ORDER BY id',
      [this.db.userId],
    );
  }
  async create(name: string, enabled = true) {
    const [row] = await this.db.query<CounterpartyRecord>(
      'INSERT INTO wallet.counterparties(user_id,name,enabled) VALUES($1,$2,$3) RETURNING id,name,enabled,version',
      [this.db.userId, name, enabled],
    );
    return row;
  }
  async update(id: string, name: string, enabled: boolean, version: number) {
    return this.db.query(
      'UPDATE wallet.counterparties SET name=$3,enabled=$4,version=version+1 WHERE user_id=$1 AND id=$2 AND version=$5 RETURNING id',
      [this.db.userId, id, name, enabled, version],
    );
  }
  async identify(
    accountId: string,
    sourceKind: SourceKind,
    description: string | null,
    storeId?: string,
  ) {
    const rows = await this.db.query<{ counterpartyId: string }>(
      `
      SELECT min(i.counterparty_id::text)::uuid AS "counterpartyId"
      FROM wallet.counterparty_identifiers i JOIN wallet.counterparties c ON c.id=i.counterparty_id
      WHERE i.user_id=$1 AND i.account_id=$2 AND i.source_kind=$3 AND i.enabled AND c.enabled
        AND ((i.identifier_kind='description' AND ${comparableTextSql('i.value')}=${comparableTextSql('$4::text')})
          OR (i.identifier_kind='store_id' AND $3='settlement' AND btrim(i.value)=$5))
      HAVING count(DISTINCT i.counterparty_id)=1`,
      [this.db.userId, accountId, sourceKind, description, storeId?.trim() ?? null],
    );
    return rows[0]?.counterpartyId ?? null;
  }
  async addIdentifier(
    counterpartyId: string,
    accountId: string,
    sourceKind: SourceKind,
    value: string,
    normalized: string,
    enabled = true,
    explicit = false,
    identifierKind: 'description' | 'store_id' = 'description',
  ) {
    const rows = await this.db.query(
      `INSERT INTO wallet.counterparty_identifiers(user_id,counterparty_id,account_id,source_kind,value,normalized_value,enabled,identifier_kind)
      SELECT $1,$2,$3,$4,$5,$6,$7,$9 WHERE NOT EXISTS(
        SELECT 1 FROM wallet.counterparty_identifiers existing WHERE existing.user_id=$1 AND existing.account_id=$3
          AND existing.source_kind=$4 AND existing.identifier_kind=$9 AND existing.enabled AND existing.counterparty_id<>$2
          AND CASE WHEN existing.identifier_kind='store_id' THEN btrim(existing.value) ELSE ${comparableTextSql('existing.value')} END =
            CASE WHEN $9='store_id' THEN btrim($5::text) ELSE ${comparableTextSql('$5::text')} END
      ) ON CONFLICT(user_id,workspace_id,account_id,source_kind,identifier_kind,normalized_value) DO UPDATE SET counterparty_id=excluded.counterparty_id,enabled=CASE WHEN $8 THEN excluded.enabled ELSE wallet.counterparty_identifiers.enabled END WHERE wallet.counterparty_identifiers.counterparty_id=excluded.counterparty_id OR (NOT wallet.counterparty_identifiers.enabled AND $8) RETURNING id`,
      [
        this.db.userId,
        counterpartyId,
        accountId,
        sourceKind,
        value,
        normalized,
        enabled,
        explicit,
        identifierKind,
      ],
    );
    return rows.length > 0;
  }
  // Backups may contain old aliases that become ambiguous under newer comparison
  // rules. Preserve both; recognition refuses ambiguity rather than losing history.
  async restoreIdentifier(
    counterpartyId: string,
    accountId: string,
    identifier: CounterpartyIdentifier,
  ) {
    await this.db.query(
      'INSERT INTO wallet.counterparty_identifiers(user_id,counterparty_id,account_id,source_kind,value,normalized_value,enabled,identifier_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        this.db.userId,
        counterpartyId,
        accountId,
        identifier.sourceKind,
        identifier.value,
        normalizeCounterpartyIdentifier(identifier.value, identifier.identifierKind),
        identifier.enabled,
        identifier.identifierKind ?? 'description',
      ],
    );
  }
  async removeIdentifier(id: string, counterpartyId: string) {
    return this.db.query(
      'UPDATE wallet.counterparty_identifiers SET enabled=false WHERE user_id=$1 AND id=$2 AND counterparty_id=$3 RETURNING id',
      [this.db.userId, id, counterpartyId],
    );
  }
  async rule(counterpartyId: string, accountId: string, type: string) {
    const [row] = await this.db.query<{ id: string; categoryId: string }>(
      'SELECT r.id,r.category_id AS "categoryId" FROM wallet.classification_rules r JOIN wallet.categories c ON c.id=r.category_id WHERE r.user_id=$1 AND r.counterparty_id=$2 AND r.account_id=$3 AND r.transaction_type=$4 AND r.enabled AND c.archived_at IS NULL',
      [this.db.userId, counterpartyId, accountId, type],
    );
    return row;
  }
  async saveRule(
    counterpartyId: string,
    accountId: string,
    type: string,
    categoryId: string,
    enabled = true,
  ) {
    const [row] = await this.db.query<{ id: string }>(
      'INSERT INTO wallet.classification_rules(user_id,counterparty_id,account_id,transaction_type,category_id,enabled) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,workspace_id,account_id,counterparty_id,transaction_type) DO UPDATE SET category_id=excluded.category_id,enabled=excluded.enabled,version=wallet.classification_rules.version+1 RETURNING id',
      [this.db.userId, counterpartyId, accountId, type, categoryId, enabled],
    );
    return row.id;
  }
  async toggleRule(id: string, enabled: boolean, version: number) {
    return this.db.query(
      'UPDATE wallet.classification_rules SET enabled=$3,version=version+1 WHERE user_id=$1 AND id=$2 AND version=$4 RETURNING id',
      [this.db.userId, id, enabled, version],
    );
  }
}
