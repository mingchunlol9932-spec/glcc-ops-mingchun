// Tiny dependency-free CSV writer. Handles quoted fields, embedded
// commas/quotes/newlines, and CRLF — enough for the daily report export.

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (!rows.length && !columns) return ''
  const cols = columns ?? Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = [cols.join(',')]
  for (const r of rows) lines.push(cols.map(c => esc(r[c])).join(','))
  return lines.join('\r\n')
}
