/**
 * Minimal RFC 4180 CSV serialization/parsing. Browser-safe (no Node or AWS deps).
 *
 * Fields are quoted only when they contain a comma, double quote, or line break;
 * embedded double quotes are escaped by doubling. The parser round-trips anything
 * `toCsv` produces and tolerates both LF and CRLF line endings plus a leading BOM.
 */

function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
  if (rows.length === 0) return '';
  return `${rows.map(row => row.map(escapeField).join(',')).join('\r\n')}\r\n`;
}

export function parseCsv(input: string): string[][] {
  // Strip a UTF-8 BOM that spreadsheet apps often prepend.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (text[i + 1] === '\n') i++;
    } else {
      field += char;
    }
  }

  // Flush the final field/row unless the input ended cleanly on a line break.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
