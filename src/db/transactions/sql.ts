// The SQL every operations query starts from: the columns, the join with the category, the newest first.


export const CATEGORY_COLUMNS = 'c.name AS category_name, c.emoji AS category_emoji, ct.name AS category_type_name';

export const TX_COLUMNS = `t.id, t.bank, t.kind, t.amount_minor, t.currency, t.raw_merchant, t.merchant_key, t.note, t.category_id,
    t.category_source, t.occurred_at, t.seen_at, t.refund_settled_at, ${CATEGORY_COLUMNS}`;

export const FROM_TX = `FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN category_types ct ON ct.id = c.type_id`;

export const SELECT_TX = `SELECT ${TX_COLUMNS} ${FROM_TX}`;

export const NEWEST_FIRST = 'ORDER BY t.occurred_at DESC, t.id DESC';
