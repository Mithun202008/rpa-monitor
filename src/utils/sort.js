function compare(a, b, sortConfig) {
  for (const { field, dir } of sortConfig) {
    const va = a[field];
    const vb = b[field];
    const numA = Number(va);
    const numB = Number(vb);
    let cmp;
    if (!isNaN(numA) && !isNaN(numB)) {
      cmp = numA - numB;
    } else {
      cmp = String(va).localeCompare(String(vb));
    }
    if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
  }
  return 0;
}

export function sortRows(rows, sortConfig) {
  if (!sortConfig || sortConfig.length === 0) return rows;
  const sorted = rows.slice();
  sorted.sort((a, b) => compare(a, b, sortConfig));
  return sorted;
}

export function insertSortedRow(rows, newRow, sortConfig) {
  if (!sortConfig || sortConfig.length === 0) {
    rows.unshift(newRow);
    return rows;
  }
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compare(rows[mid], newRow, sortConfig) <= 0) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  rows.splice(lo, 0, newRow);
  return rows;
}
