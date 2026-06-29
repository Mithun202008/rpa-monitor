const CHUNK_SIZE = 500;
const FILTER_FIELDS = ['automation_type', 'department', 'industry'];

self.onmessage = async function (e) {
  const { type, url } = e.data;
  if (type !== 'load-csv') return;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const distinct = { automation_type: new Set(), department: new Set(), industry: new Set() };
    let chunk = [];
    let totalRows = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const vals = line.split(',');
      if (vals.length < headers.length) continue;

      const row = {};
      for (let h = 0; h < headers.length; h++) {
        row[headers[h]] = vals[h]?.trim() ?? '';
      }

      for (const field of FILTER_FIELDS) {
        const val = row[field];
        if (val) distinct[field].add(val);
      }

      chunk.push(row);
      totalRows++;

      if (chunk.length >= CHUNK_SIZE) {
        self.postMessage({ type: 'baseline-chunk', rows: chunk });
        chunk = [];
      }
    }

    if (chunk.length > 0) {
      self.postMessage({ type: 'baseline-chunk', rows: chunk });
    }

    self.postMessage({
      type: 'baseline-complete',
      totalRows,
      distinctValues: {
        automation_type: [...distinct.automation_type].sort(),
        department: [...distinct.department].sort(),
        industry: [...distinct.industry].sort(),
      },
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
