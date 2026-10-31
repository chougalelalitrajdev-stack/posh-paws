/** Downloads rows as a CSV file the user can open in Excel or Google Sheets. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]): void {
  const cell = (v: string | number) => {
    const text = String(v);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
