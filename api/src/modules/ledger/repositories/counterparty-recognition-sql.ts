import { comparableTextSql as comparable } from '../../../core/database/normalized-text.js';
export const recognizedCounterpartiesSql = `WITH descriptions AS (
  SELECT t.id,t.source_kind,'description' AS identifier_kind,${comparable('t.description')} AS value
  FROM wallet.transactions t WHERE t.user_id=$1 AND t.account_id=$2 AND t.reversed_at IS NULL
  UNION
  SELECT s.transaction_id,s.source_data->>'reportType','description',${comparable("s.source_data->>'description'")}
  FROM wallet.transaction_sources s WHERE s.user_id=$1 AND s.account_id=$2 AND s.source_data->>'description' IS NOT NULL
  UNION
  SELECT s.transaction_id,'settlement','store_id',btrim(s.source_data->>'storeId') FROM wallet.transaction_sources s WHERE s.user_id=$1 AND s.account_id=$2 AND s.source_data->>'reportType'='settlement' AND s.source_data->>'storeId' IS NOT NULL
), observed AS (
  SELECT d.id,i.counterparty_id FROM descriptions d
  JOIN wallet.counterparty_identifiers i ON i.user_id=$1 AND i.account_id=$2 AND i.enabled AND i.source_kind=d.source_kind AND i.identifier_kind=d.identifier_kind
    AND CASE WHEN i.identifier_kind='store_id' THEN btrim(i.value) ELSE ${comparable('i.value')} END=d.value
  JOIN wallet.counterparties c ON c.id=i.counterparty_id AND c.enabled
), recognized AS (SELECT id,min(counterparty_id::text)::uuid AS counterparty_id FROM observed GROUP BY id HAVING count(DISTINCT counterparty_id)=1)`;
