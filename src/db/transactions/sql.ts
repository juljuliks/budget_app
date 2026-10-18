// The SQL every operations query starts from: the columns, the join with the category, the newest first.


export const CATEGORY_COLUMNS = 'c.name AS category_name, c.emoji AS category_emoji, ct.name AS category_type_name';

/**
 * A split operation's parts in other categories (null: not split), the biggest first: per part (char(30) between)
 * its category id, amount, emoji, type and name (char(31) between); parsed by parseParts.
 */
export const PARTS_COLUMN = `(SELECT group_concat(x, char(30)) FROM (
    SELECT p.category_id || char(31) || p.amount_minor || char(31) || coalesce(pc.emoji, '') || char(31)
      || coalesce(pct.name, '') || char(31) || pc.name AS x
    FROM transaction_parts p JOIN categories pc ON pc.id = p.category_id LEFT JOIN category_types pct ON pct.id = pc.type_id
    WHERE p.tx_id = t.id ORDER BY p.amount_minor DESC, p.category_id)) AS parts`;

/** In a category with "Повторяющиеся платежи": its merchant's payment's period (months), if it has a day; else null. */
export const PAYMENT_PERIOD_COLUMN = `CASE WHEN c.recurring = 1 THEN (SELECT s.period_months FROM recurring_payments s
    WHERE s.merchant_key = t.merchant_key AND s.category_id = c.id AND s.deleted_at IS NULL AND s.due IS NOT NULL) END AS payment_period`;

export const TX_COLUMNS = `t.id, t.bank, t.kind, t.amount_minor, t.currency, t.raw_merchant, t.merchant_key, t.note, t.category_id,
    t.category_source, t.occurred_at, t.seen_at, t.refund_settled_at, ${CATEGORY_COLUMNS}, ${PARTS_COLUMN}, ${PAYMENT_PERIOD_COLUMN}`;

export const FROM_TX = `FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN category_types ct ON ct.id = c.type_id`;

export const SELECT_TX = `SELECT ${TX_COLUMNS} ${FROM_TX}`;

export const NEWEST_FIRST = 'ORDER BY t.occurred_at DESC, t.id DESC';
