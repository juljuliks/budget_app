import { getDb } from './index';

// A merchant as the app sees it: a group ('group:<id>', see migration 16) if the transaction's merchant_key
// belongs to one, otherwise the merchant_key itself. Merchant categories (exact rules), the "Мерчант" filter
// and refund matching all go by this id, so a group acts as one merchant.

const GROUP_PREFIX = 'group:';

/** SQL expression: the merchant id of `<alias>.merchant_key` (null without a merchant). */
export function merchantIdSql(alias: string): string {
  return `coalesce((SELECT '${GROUP_PREFIX}' || gm.group_id FROM merchant_group_members gm WHERE gm.merchant_key = ${alias}.merchant_key), ${alias}.merchant_key)`;
}

export function groupMerchantId(groupId: number): string {
  return `${GROUP_PREFIX}${groupId}`;
}

/** The group id of a merchant id, or null for a single merchant. */
export function groupIdOf(merchantId: string): number | null {
  return merchantId.startsWith(GROUP_PREFIX) ? Number(merchantId.slice(GROUP_PREFIX.length)) : null;
}

export async function merchantIdOf(merchantKey: string): Promise<string> {
  const db = await getDb();
  const m = await db.get<{ group_id: number }>('SELECT group_id FROM merchant_group_members WHERE merchant_key = ?', [merchantKey]);
  return m ? groupMerchantId(m.group_id) : merchantKey;
}
