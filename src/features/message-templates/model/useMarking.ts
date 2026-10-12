// The marking of one message: the role being marked, the marked words, the type; what it gives as an operation.
import { useMemo, useState } from 'react';
import type { Kind, ParsedTx } from '@/domain/types';
import type { UnparsedMessage } from '@/db/messages';
import { buildTemplate, readByTemplate, Role, wordsOf } from '@/parsers/template';

export function useMarking(message: UnparsedMessage) {
  const words = useMemo(() => wordsOf(message.body), [message.body]);
  const [role, setRole] = useState<Role>('amount');
  const [marks, setMarks] = useState<Record<number, Role>>({});
  const [kind, setKind] = useState<Kind>('purchase');

  /** A word tapped: marked with the role (an amount, a currency, a balance: one word), or unmarked */
  function toggle(i: number) {
    setMarks((prev) => {
      const next = { ...prev };
      if (next[i] === role) { delete next[i]; return next; }
      if (role !== 'merchant' && role !== 'date') for (const k of Object.keys(next)) if (next[Number(k)] === role) delete next[Number(k)];
      next[i] = role;
      return next;
    });
  }

  const has = (r: Role) => Object.values(marks).includes(r);
  const missing = [!has('amount') && 'сумму', !has('currency') && !currencyInAmount(words, marks) && 'валюту'].filter((x): x is string => !!x);
  // the operation it gives: by a template of this message (so the same as the template's)
  const result: ParsedTx | null = useMemo(
    () => (missing.length ? null : readByTemplate(buildTemplate(message.body, marks), kind, message.body)),
    [message.body, marks, kind, missing.length]);
  return { words, role, setRole, marks, toggle, kind, setKind, missing, result };
}

/** "45.00GEL": the currency is in the amount's word, nothing more to mark */
function currencyInAmount(words: Array<{ text: string }>, marks: Record<number, Role>) {
  const i = Object.keys(marks).map(Number).find((k) => marks[k] === 'amount');
  return i !== undefined && /[A-Z₾$€]/i.test(words[i].text);
}
