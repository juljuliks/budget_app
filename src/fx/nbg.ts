// The rates of the National Bank of Georgia: the only network call of the app. The cache of the rates is db/fx.ts.

const NBG_URL = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/';

type NbgDay = Array<{ currencies: Array<{ code: string; quantity: number; rate: number }> }>;
type Fetcher = (url: string) => Promise<unknown>;

let fetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`rates ${res.status}`);
  return res.json();
};

/** Tests (no network) replace the HTTP call. */
export function setRatesFetcher(f: Fetcher) {
  fetcher = f;
}

/** A day's lari per unit of these currencies, as the bank gives them (bad rates left out). */
export async function fetchRates(date: string, codes: readonly string[]): Promise<Array<{ code: string; gelPerUnit: number }>> {
  const query = codes.map((c) => `currencies=${c}`).join('&');
  const days = (await fetcher(`${NBG_URL}?${query}&date=${date}`)) as NbgDay;
  return (days?.[0]?.currencies ?? [])
    .filter((c) => c.rate > 0)
    .map((c) => ({ code: c.code, gelPerUnit: c.rate / (c.quantity || 1) }));
}
