// The banks the app reads (built in; adding one by hand — later, IMPROVEMENTS). Each: who its SMS come from, which app
// its pushes come from (the same patterns are in the native side: sms/BankSources.kt), whether a built-in parser reads
// them (else the user's templates, "Не распознано"). Which are on: the setting BANKS_SETTING.

export type BankId = 'tbc' | 'bog';

export type Bank = {
  id: BankId;
  name: string;
  /** on the operation's row and the balances, when there are several */
  short: string;
  /** its badge in "Банки" and the balances */
  color: string;
  /** the SMS sender, as the phone shows it (an alphanumeric name, never a number) */
  sms: RegExp;
  /** the push's app (its package name) */
  app: (pkg: string) => boolean;
  /** how its SMS sender is shown in "Банки" */
  smsLabel: string;
  /** a built-in parser (TBC); otherwise the templates of "Не распознано" */
  builtIn: boolean;
};

export const BANKS: Bank[] = [
  {
    id: 'tbc', name: 'TBC', short: 'TBC', color: '#00A3E0', smsLabel: '«TBC SMS»', builtIn: true,
    sms: /^TBC ?(SMS|BANK)?$/i,
    // "ge.tbcbank…", "com.tbc…": matched loosely until the exact package is confirmed (IMPROVEMENTS)
    app: (pkg) => pkg.toLowerCase().includes('tbc'),
  },
  {
    id: 'bog', name: 'Bank of Georgia', short: 'BoG', color: '#F26722', smsLabel: '«BOG»', builtIn: false,
    // not confirmed against a real SMS yet (IMPROVEMENTS)
    sms: /^(BOG|BANK ?OF ?GEORGIA)$/i,
    app: (pkg) => pkg.toLowerCase().startsWith('ge.bog'),
  },
];

/** The setting holding the ids of the banks on (JSON); TBC alone until changed. */
export const BANKS_SETTING = 'banks_enabled';
export const DEFAULT_BANKS: BankId[] = ['tbc'];

export const bankById = (id: string): Bank | undefined => BANKS.find((b) => b.id === id);

/**
 * The bank a message came from: a push's sender is "push:<package>" (BankPushListener), an SMS's its sender name. An
 * SMS without one (an old import, a test) is TBC's, the only bank read before.
 */
export function bankOfSender(sender: string): Bank {
  const s = sender.trim();
  if (s.startsWith('push:')) {
    const pkg = s.slice(5);
    return BANKS.find((b) => b.app(pkg)) ?? BANKS[0];
  }
  return BANKS.find((b) => b.sms.test(s)) ?? BANKS[0];
}
