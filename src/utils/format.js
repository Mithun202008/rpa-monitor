const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat('en-US');

export function formatCurrency(val) {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return currencyFmt.format(n);
}

export function formatPercent(val) {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  const clamped = Math.max(-999.99, Math.min(999.99, n));
  return clamped.toFixed(2) + '%';
}

export function formatNumber(val) {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return numberFmt.format(n);
}
