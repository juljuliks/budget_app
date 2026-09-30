const CITY_SUFFIXES = ['TBILISI', 'BATUMI', 'KUTAISI', 'VARDZIA'];

export function normalizeMerchant(raw: string): string {
  if (!raw) return '';
  let s = raw.toUpperCase().trim();
  s = s.replace(/\s+/g, ' ');
  // remove card/terminal markers like (*1234) or masked (*XXXX)
  s = s.replace(/\(\*[^)]+\)/g, '').trim();
  // remove urls
  s = s.replace(/https?:\/\/\S+/g, '').trim();
  // remove city suffixes
  for (const city of CITY_SUFFIXES) {
    s = s.replace(new RegExp('\\b' + city + '\\b', 'g'), '').trim();
  }
  // collapse punctuation (keep acronyms like MC or LLC intact)
  s = s.replace(/[\*#@!\-_.]+/g, ' ').replace(/\s+/g, ' ');
  return s;
}

export default normalizeMerchant;
