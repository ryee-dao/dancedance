/**
 * Just enough wikitext reading for song infoboxes: find `{{Infobox song}}`
 * (and its alias `{{Infobox single}}`) or other infoboxes, split their
 * parameters, and turn a parameter such as `genre` or `artist` into the list
 * of names it shows. Pure.
 */

export interface Infobox {
  /** Template name, lowercase with single spaces: "infobox song", "infobox album". */
  kind: string;
  params: Record<string, string>;
}

/** Index of the "}}" that closes the template opened at `start` ("{{"), or -1. */
function templateEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{') {
      depth++;
      i++;
    } else if (two === '}}') {
      depth--;
      i++;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Split on `sep` at the top level (not inside {{ }}, [[ ]] or <ref>). */
function splitTop(body: string, sep: string): string[] {
  const out: string[] = [];
  let depthT = 0;
  let depthL = 0;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{') { depthT++; cur += two; i++; continue; }
    if (two === '}}') { depthT = Math.max(0, depthT - 1); cur += two; i++; continue; }
    if (two === '[[') { depthL++; cur += two; i++; continue; }
    if (two === ']]') { depthL = Math.max(0, depthL - 1); cur += two; i++; continue; }
    if (body[i] === sep && depthT === 0 && depthL === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += body[i];
  }
  out.push(cur);
  return out;
}

/** Drop comments, references and footnotes. */
export function stripNoise(text: string): string {
  return text
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<ref[^>/]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<\/?(?:small|span|div|nowiki|sup|sub|abbr)[^>]*>/gi, '');
}

/** Every infobox in the text, in order. */
export function parseInfoboxes(wikitext: string): Infobox[] {
  const text = stripNoise(wikitext);
  const out: Infobox[] = [];
  const re = /\{\{\s*(infobox[ _][^|}\n]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    const end = templateEnd(text, start);
    if (end < 0) break;
    const body = text.slice(start + 2, end - 2);
    const parts = splitTop(body, '|');
    const kind = parts[0].replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const params: Record<string, string> = {};
    for (const p of parts.slice(1)) {
      const eq = p.indexOf('=');
      if (eq < 0) continue;
      const name = p.slice(0, eq).trim().toLowerCase();
      if (name && !(name in params)) params[name] = p.slice(eq + 1).trim();
    }
    out.push({ kind, params });
    re.lastIndex = start + 2; // nested infoboxes (rare) are found too
  }
  return out;
}

/** Templates whose arguments are the list items. */
const LIST_TEMPLATES = /^(?:hlist|flatlist|flat list|plainlist|plain list|ubl|ubil|unbulleted list|bulleted list|nowrap|nobr|small|lang|nowrap begin)$/;

/** Expand list templates into newline-separated items; drop every other template (footnotes, dates...). */
function expandTemplates(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('{{', i)) {
      const end = templateEnd(text, i);
      if (end < 0) break;
      const body = text.slice(i + 2, end - 2);
      const parts = splitTop(body, '|');
      const name = parts[0].trim().toLowerCase().replace(/_/g, ' ');
      if (LIST_TEMPLATES.test(name)) {
        const args = parts.slice(1).filter((a) => !/^\s*[a-z]+\s*=/.test(a) || /\[\[/.test(a.split('=')[0]));
        // {{lang|xx|text}}: only the text
        const items = name === 'lang' ? args.slice(1) : args;
        out += `\n${items.map(expandTemplates).join('\n')}\n`;
      }
      i = end;
    } else {
      out += text[i];
      i++;
    }
  }
  return out;
}

export interface LinkedName {
  /** Shown text ("Pop" in [[Pop music|Pop]]). */
  label: string;
  /** Link target without "(disambiguation)" parts ("Pop music"); equals label for plain text. */
  target: string;
}

/** A parameter value -> the names it lists, in order. */
export function listItems(value: string | undefined): LinkedName[] {
  if (!value) return [];
  const text = expandTemplates(stripNoise(value)).replace(/<br\s*\/?>/gi, '\n');
  const out: LinkedName[] = [];
  for (const raw of splitItems(text)) {
    const links = [...raw.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g)];
    if (links.length) {
      for (const l of links) {
        const target = l[1].replace(/\s*\([^)]*\)\s*$/, '').trim();
        const label = (l[2] ?? l[1]).replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (label || target) out.push({ label: clean(label || target), target: clean(target || label) });
      }
    } else {
      const t = clean(raw);
      if (t) out.push({ label: t, target: t });
    }
  }
  return out.filter((n) => n.label.length > 0 && n.label.length <= 80);
}

/** Split on newlines, bullets, commas, semicolons and middots, outside links. */
function splitItems(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '[[') { depth++; cur += two; i++; continue; }
    if (two === ']]') { depth = Math.max(0, depth - 1); cur += two; i++; continue; }
    const c = text[i];
    if (depth === 0 && (c === '\n' || c === '*' || c === ',' || c === ';' || c === '·' || c === '•')) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Remove quotes, bold/italic marks and stray punctuation. */
function clean(s: string): string {
  return s
    .replace(/'{2,}/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/^[\s"“”'‘’:]+|[\s"“”'‘’.:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A parameter as plain text (links shown as their labels). */
export function plainText(value: string | undefined): string {
  if (!value) return '';
  return clean(
    expandTemplates(stripNoise(value))
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\n/g, ' '),
  );
}

/** Whether the text is a disambiguation page. */
export function isDisambiguation(wikitext: string): boolean {
  return /\{\{\s*(?:disambiguation|disambig|dab|disamb|song disambiguation|hndis|geodis|set index)\b[^}]*\}\}/i.test(wikitext);
}
