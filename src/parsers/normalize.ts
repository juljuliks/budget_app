// Location tokens banks append to the merchant name; removed only at the end of the name,
// so "TBILISI MALL" stays intact while "SPAR TBILISI GE" -> "SPAR".
const TRAILING_LOCATION = new Set(['TBILISI', 'BATUMI', 'KUTAISI', 'VARDZIA', 'GE', 'GEO', 'GEORGIA']);

export function normalizeMerchant(raw: string): string {
  if (!raw) return '';
  let s = raw.toUpperCase();
  // remove card/terminal markers like (*1234) or masked (*XXXX)
  s = s.replace(/\(\*[^)]+\)/g, ' ');
  // remove urls
  s = s.replace(/https?:\/\/\S+/g, ' ');
  // punctuation -> space (keeps acronyms like MC or LLC intact)
  s = s.replace(/[*#@!\-_.,'"]+/g, ' ');
  const tokens = s.split(/\s+/).filter(Boolean);

  // Strip trailing location and branch-number tokens ("SPAR 123" and "SPAR 45" -> "SPAR"),
  // but never strip the name down to nothing.
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (TRAILING_LOCATION.has(last) || /^\d+$/.test(last)) tokens.pop();
    else break;
  }
  return tokens.join(' ');
}

export default normalizeMerchant;
