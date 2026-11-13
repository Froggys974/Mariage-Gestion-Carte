/**
 * CSV : lecture tolérante (séparateur « ; » ou « , », guillemets, BOM, fins de ligne Windows)
 * et écriture compatible Excel français (« ; » + BOM UTF-8). Protection contre l'injection de formules.
 */

export function detectDelimiter(firstLine: string): ';' | ',' | '\t' {
  const count = (c: string) => firstLine.split(c).length - 1;
  const candidates = [';', ',', '\t'] as const;
  return candidates.reduce((best, c) => (count(c) > count(best) ? c : best), ';' as ';' | ',' | '\t');
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\ufeff/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

/** Neutralise les cellules interprétées comme formules par les tableurs (=, +, -, @). */
export function safeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(s) && !/^[+-]\d[\d\s]*$/.test(s) ? `'${s}` : s;
  return /[;"\n\r,]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(header: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  const lines = [header, ...rows].map((r) => r.map(safeCell).join(';'));
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

/** Normalise un en-tête : minuscules, sans accents ni espaces (« Prénom » → « prenom »). */
export function headerKey(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export const IMPORT_ALIASES: Record<string, string> = {
  prenom: 'first',
  first_name: 'first',
  nom: 'last',
  last_name: 'last',
  nom_de_famille: 'last',
  email: 'email',
  mail: 'email',
  courriel: 'email',
  telephone: 'phone',
  tel: 'phone',
  portable: 'phone',
  mobile: 'phone',
  phone: 'phone',
  nom_affiche: 'displayName',
  famille: 'displayName',
  foyer: 'displayName',
  places: 'maxSeats',
  accord: 'agreement',
};

/** Lignes du fichier → objets bruts indexés par champ reconnu. */
export function rowsToRecords(rows: string[][]): Array<{ line: number; data: Record<string, string> }> {
  const [head, ...body] = rows;
  if (!head) return [];
  const fields = head.map((h) => IMPORT_ALIASES[headerKey(h)] ?? null);
  return body.map((r, i) => {
    const data: Record<string, string> = {};
    fields.forEach((f, k) => {
      if (f && r[k] !== undefined && r[k] !== '') data[f] = r[k]!;
    });
    return { line: i + 2, data };
  });
}
