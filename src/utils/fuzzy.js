const SEARCH_FIELDS = ['project_name', 'company_id', 'implementation_partner', 'country'];

export function fuzzyFilter(rows, query) {
  if (!query || query.trim() === '') return rows;
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return rows;
  const deadline = performance.now() + 10;
  const result = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (tokens.every(token => {
      return SEARCH_FIELDS.some(field => {
        const val = row[field];
        return val && String(val).toLowerCase().includes(token);
      });
    })) {
      result.push(row);
    }
    if (i % 100 === 0 && performance.now() > deadline) {
      break;
    }
  }
  if (result.length < rows.length && performance.now() > deadline) {
    return rows.filter(row => {
      return tokens.every(token => {
        return SEARCH_FIELDS.some(field => {
          const val = row[field];
          return val && String(val).toLowerCase().includes(token);
        });
      });
    });
  }
  return result;
}
