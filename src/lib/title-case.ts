// Title Case for labels, headings, buttons, tabs and table headers (2026-11-16, the kopicalf-hrms rule, lib/title-case.ts
// there). Only the first letter of each word is raised; the rest is kept, so acronyms (PIC, ESB, SO, WW-WR) and names
// stay as written ("Kopi Calf Signature Soehat Malang"). Indonesian / English connectives stay lower case unless they
// open the text. Not for sentences: descriptions, hints and messages keep sentence case.

const MINOR = new Set([
  'dan', 'atau', 'di', 'ke', 'dari', 'untuk', 'yang', 'per', 'pada', 'dengan', 'dalam', 'oleh', 'serta', 'tanpa', 'vs',
  'and', 'or', 'of', 'the', 'a', 'an', 'to', 'in', 'on', 'for', 'at', 'by', 'via', 's.d.', 's/d', 'x',
]);

function word(w: string, first: boolean): string {
  const m = /^([^\p{L}]*)(\p{L})(.*)$/u.exec(w); // leading punctuation like "(" or "/"
  if (!m) return w;
  const [, pre, ch, rest] = m;
  if (ch !== ch.toLowerCase()) return w; // already capitalised or an acronym
  if (!first && !pre && MINOR.has(w.toLowerCase())) return w;
  if (/^(https?:|www\.)/i.test(w) || w.includes('@') || /^[a-z0-9._-]+\.[a-z]{2,}$/i.test(w)) return w; // links, e-mail, hosts
  if (/^\{\d+\}$/.test(w)) return w;
  return pre + ch.toUpperCase() + rest;
}

export function titleCaseText(s: string): string {
  let first = true;
  return s
    .split(/(\s+)/)
    .map((part) => {
      if (!part.trim()) return part;
      // words joined by "/" or "-" ("Outlet/HUB", "Clock-in") are each capitalised
      const out = part.split(/([/–-])/).map((p, i) => (i % 2 ? p : word(p, first && i === 0))).join('');
      first = false;
      return out;
    })
    .join('');
}

/** A label already translated: a plain string comes back in Title Case, any other React node unchanged. */
export function tc<T>(node: T): T {
  return (typeof node === 'string' ? titleCaseText(node) : node) as T;
}

/** Data written in capitals (ESB categories "BEVERAGE · ORIGINAL KOPI SUSU") shown as names: "Beverage · Original Kopi
 *  Susu". Words of 3 letters or fewer (PB1, SO, CK) and codes with "_" or digits stay as they are. */
export function nameCase(s: string | null | undefined): string {
  if (!s) return s ?? '';
  return s.replace(/[\p{L}\p{N}_]+/gu, (w) =>
    w.length > 3 && /^\p{Lu}+$/u.test(w) ? w[0] + w.slice(1).toLowerCase() : w);
}
