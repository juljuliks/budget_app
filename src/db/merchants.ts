import { getDb } from './index';
import { groupIdOf, groupMerchantId, merchantIdSql } from './merchantId';
import { backfillRule, createRule } from '../categorize';
import { REMEMBERABLE_KINDS } from '../types';

// The "Мерчанты" screen: merchants of purchases / payments (the only ones with a category), a group as one.

const KINDS = `(${REMEMBERABLE_KINDS.map((k) => `'${k}'`).join(',')})`;

export type MerchantRow = {
  /** merchant id (merchantId.ts): a merchant_key or 'group:<id>' */
  id: string;
  name: string;
  group: boolean;
  /** names of a group's members */
  members: string[];
  count: number;
  /** the merchant's category (its exact rule), null = none */
  category_id: number | null;
};

/** The newest SMS spelling of each merchant_key. */
async function namesByKey(): Promise<Map<string, string>> {
  const db = await getDb();
  const rows = await db.all<{ k: string; name: string | null }>(
    `SELECT merchant_key AS k, (SELECT raw_merchant FROM transactions x WHERE x.merchant_key = t.merchant_key
        ORDER BY x.occurred_at DESC LIMIT 1) AS name
      FROM transactions t WHERE merchant_key IS NOT NULL GROUP BY merchant_key`);
  return new Map(rows.map((r) => [r.k, r.name || r.k]));
}

/** Every merchant with purchases / payments and every group, the most frequent first. */
export async function listMerchants(): Promise<MerchantRow[]> {
  const db = await getDb();
  const names = await namesByKey();
  const counts = await db.all<{ mid: string; n: number }>(
    `SELECT ${merchantIdSql('t')} AS mid, count(*) AS n FROM transactions t
      WHERE t.merchant_key IS NOT NULL AND t.kind IN ${KINDS} GROUP BY mid`);
  const countOf = new Map(counts.map((c) => [c.mid, c.n]));
  const rules = await db.all<{ pattern: string; category_id: number }>("SELECT pattern, category_id FROM merchant_rules WHERE match_type = 'exact'");
  const ruleOf = new Map(rules.map((r) => [r.pattern, r.category_id]));
  const groups = await db.all<{ id: number; name: string }>('SELECT id, name FROM merchant_groups');
  const members = await db.all<{ merchant_key: string; group_id: number }>('SELECT merchant_key, group_id FROM merchant_group_members ORDER BY merchant_key');

  const out: MerchantRow[] = groups.map((g) => {
    const id = groupMerchantId(g.id);
    return {
      id, name: g.name, group: true,
      members: members.filter((m) => m.group_id === g.id).map((m) => names.get(m.merchant_key) ?? m.merchant_key),
      count: countOf.get(id) ?? 0, category_id: ruleOf.get(id) ?? null,
    };
  });
  for (const [mid, n] of countOf) {
    if (groupIdOf(mid) !== null) continue;
    out.push({ id: mid, name: names.get(mid) ?? mid, group: false, members: [], count: n, category_id: ruleOf.get(mid) ?? null });
  }
  return out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export type MerchantDetails = MerchantRow & {
  totals: Array<{ currency: string; amount_minor: number }>;
  /** a group's members, to exclude some */
  memberRows: Array<{ key: string; name: string; count: number }>;
};

export async function getMerchant(id: string): Promise<MerchantDetails | null> {
  const row = (await listMerchants()).find((m) => m.id === id);
  if (!row) return null;
  const db = await getDb();
  // spent there: purchases / payments minus refunds not settled on a purchase (a settled one already reduced it)
  const totals = await db.all<{ currency: string; amount_minor: number }>(
    `SELECT currency, sum(CASE WHEN t.kind = 'refund' THEN -amount_minor ELSE amount_minor END) AS amount_minor FROM transactions t
      WHERE ${merchantIdSql('t')} = ? AND (t.kind IN ${KINDS} OR (t.kind = 'refund' AND t.refund_settled_at IS NULL))
      GROUP BY currency HAVING sum(CASE WHEN t.kind = 'refund' THEN -amount_minor ELSE amount_minor END) != 0
      ORDER BY amount_minor DESC`, [id]);
  const groupId = groupIdOf(id);
  const memberRows = groupId === null ? [] : await (async () => {
    const names = await namesByKey();
    const rows = await db.all<{ key: string; n: number }>(
      `SELECT gm.merchant_key AS key, (SELECT count(*) FROM transactions t WHERE t.merchant_key = gm.merchant_key AND t.kind IN ${KINDS}) AS n
        FROM merchant_group_members gm WHERE gm.group_id = ? ORDER BY n DESC, gm.merchant_key`, [groupId]);
    return rows.map((r) => ({ key: r.key, name: names.get(r.key) ?? r.key, count: r.n }));
  })();
  return { ...row, totals, memberRows };
}

/**
 * Sets (or with null removes) a merchant's category. Setting it also changes the merchant's transactions that
 * follow it (not the manual choices). Removing it changes no transaction: new ones just arrive without one.
 */
export async function setMerchantCategory(id: string, categoryId: number | null) {
  const db = await getDb();
  if (categoryId === null) {
    await db.run("DELETE FROM merchant_rules WHERE match_type = 'exact' AND pattern = ?", [id]);
    return;
  }
  await createRule('exact', id, categoryId);
  await backfillRule('exact', id, categoryId);
}

/** Distinct categories the merchants to merge have (to choose the group's), most used first. */
export async function categoriesOfMerchants(ids: string[]): Promise<number[]> {
  const rows = (await listMerchants()).filter((m) => ids.includes(m.id) && m.category_id !== null);
  const n = new Map<number, number>();
  for (const r of rows) n.set(r.category_id!, (n.get(r.category_id!) ?? 0) + r.count);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/**
 * Merges merchants (and groups) into one group named `name` with the category `categoryId` (null = none).
 * A selected group is reused (the first one), the other groups are dissolved into it; the members' own
 * categories are replaced by the group's, and their transactions that followed them follow the group.
 * Returns the group's merchant id.
 */
export async function mergeMerchants(ids: string[], name: string, categoryId: number | null): Promise<string> {
  const db = await getDb();
  const groupIds = ids.map(groupIdOf).filter((g): g is number => g !== null);
  const keys = ids.filter((id) => groupIdOf(id) === null);
  let target = groupIds[0];
  await db.transaction(async () => {
    if (target === undefined) {
      const { lastInsertRowid } = await db.run('INSERT INTO merchant_groups (name, created_at) VALUES (?, ?)',
        [name.trim(), Math.floor(Date.now() / 1000)]);
      target = lastInsertRowid;
    } else {
      await db.run('UPDATE merchant_groups SET name = ? WHERE id = ?', [name.trim(), target]);
    }
    for (const g of groupIds.slice(1)) {
      await db.run('UPDATE merchant_group_members SET group_id = ? WHERE group_id = ?', [target, g]);
      await db.run('DELETE FROM merchant_groups WHERE id = ?', [g]);
    }
    for (const k of keys) {
      await db.run('INSERT OR REPLACE INTO merchant_group_members (merchant_key, group_id) VALUES (?, ?)', [k, target]);
    }
    // one category for the group: the members' and the dissolved groups' own ones go
    const oldIds = [...keys, ...groupIds.map(groupMerchantId)];
    await db.run(`DELETE FROM merchant_rules WHERE match_type = 'exact' AND pattern IN (${oldIds.map(() => '?').join(',')})`, oldIds);
  });
  const id = groupMerchantId(target!);
  await setMerchantCategory(id, categoryId);
  return id;
}

export async function renameMerchantGroup(id: string, name: string) {
  const groupId = groupIdOf(id);
  if (groupId === null) return;
  const db = await getDb();
  await db.run('UPDATE merchant_groups SET name = ? WHERE id = ?', [name.trim(), groupId]);
}

/**
 * Takes merchants out of a group: each becomes a merchant of its own with the group's category (so nothing
 * changes until it's changed). A group left without members is removed with its category.
 */
export async function excludeFromGroup(id: string, keys: string[]) {
  const groupId = groupIdOf(id);
  if (groupId === null || keys.length === 0) return;
  const db = await getDb();
  await db.transaction(async () => {
    const rule = await db.get<{ category_id: number }>("SELECT category_id FROM merchant_rules WHERE match_type = 'exact' AND pattern = ?", [id]);
    for (const k of keys) {
      await db.run('DELETE FROM merchant_group_members WHERE merchant_key = ? AND group_id = ?', [k, groupId]);
      if (rule) await createRule('exact', k, rule.category_id);
    }
    const left = await db.get('SELECT 1 FROM merchant_group_members WHERE group_id = ? LIMIT 1', [groupId]);
    if (!left) {
      await db.run('DELETE FROM merchant_groups WHERE id = ?', [groupId]);
      await db.run("DELETE FROM merchant_rules WHERE match_type = 'exact' AND pattern = ?", [id]);
    }
  });
}

/** The name of a transaction's merchant as the app shows it: its group's name if it is in one. */
export async function groupNameOf(merchantKey: string): Promise<string | null> {
  const db = await getDb();
  const g = await db.get<{ name: string }>(
    'SELECT g.name FROM merchant_group_members gm JOIN merchant_groups g ON g.id = gm.group_id WHERE gm.merchant_key = ?', [merchantKey]);
  return g?.name ?? null;
}

export default { groupNameOf, listMerchants, getMerchant, setMerchantCategory, categoriesOfMerchants, mergeMerchants, renameMerchantGroup, excludeFromGroup };
