const CSV_HEADERS = [
  'project_id', 'company_id', 'project_name', 'project_status',
  'automation_type', 'robots_deployed', 'annual_savings_usd',
  'budget_usd', 'roi_percent', 'employee_hours_saved',
  'start_date', 'department', 'industry',
  'implementation_partner', 'country'
];

let exportInProgress = false;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function generateFilename() {
  const d = new Date();
  return 'rpa_snapshot_' +
    d.getFullYear() + '-' +
    pad2(d.getMonth() + 1) + '-' +
    pad2(d.getDate()) + '_' +
    pad2(d.getHours()) + '-' +
    pad2(d.getMinutes()) + '-' +
    pad2(d.getSeconds()) + '.csv';
}

async function compileCSV(rows) {
  const CHUNK_SIZE = 100;
  const lines = [CSV_HEADERS.join(',')];

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    for (const row of chunk) {
      const line = CSV_HEADERS.map(key => {
        const value = row[key] ?? '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(',');
      lines.push(line);
    }

    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return lines.join('\n');
}

function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildSortDescription(sortConfig) {
  if (!sortConfig || sortConfig.length === 0) return 'unsorted';
  const parts = sortConfig.map(s => `${s.field} ${s.dir}`);
  return 'sorted by ' + parts.join(', ');
}

function buildFilterDescription(filters) {
  const active = [];
  for (const key of Object.keys(filters)) {
    if (filters[key].length > 0) {
      active.push(key.replace(/_/g, ' ') + ': ' + filters[key].join(', '));
    }
  }
  if (active.length === 0) return 'no filters applied';
  return 'filtered by ' + active.join(' | ');
}

function buildSearchDescription(searchQuery) {
  if (!searchQuery || !searchQuery.trim()) return '';
  return "search: '" + searchQuery + "'";
}

function buildToastMessage(rowCount, sortConfig, filters, searchQuery) {
  const parts = [
    'Snapshot exported — ' + rowCount + ' rows',
    buildSortDescription(sortConfig),
    buildFilterDescription(filters),
  ];
  const search = buildSearchDescription(searchQuery);
  if (search) parts.push(search);
  return parts.join(' | ');
}

function showToast(message) {
  const existing = document.querySelector('.export-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'export-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('export-toast-hide');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 400);
  }, 3000);
}

function updateExportButton(btn, state) {
  if (state === 'exporting') {
    btn.disabled = true;
    btn.innerHTML = '<span class="export-spinner"></span> Exporting...';
  } else {
    btn.disabled = false;
    btn.innerHTML = '<span class="export-icon">📷</span> Export Snapshot';
  }
}

export function createSnapshotExport(engine) {
  const toolbar = document.getElementById('toolbar');
  const layoutToggles = document.getElementById('layout-toggles');

  const exportBtn = document.createElement('button');
  exportBtn.className = 'export-btn';
  exportBtn.innerHTML = '<span class="export-icon">📷</span> Export Snapshot';
  exportBtn.title = 'Export Snapshot (Ctrl+Shift+E / Cmd+Shift+E)';

  toolbar.insertBefore(exportBtn, layoutToggles);

  async function trigger() {
    if (exportInProgress) return;
    exportInProgress = true;
    updateExportButton(exportBtn, 'exporting');

    const snapshot = engine.displayRows.slice();
    const csvString = await compileCSV(snapshot);
    const filename = generateFilename();
    downloadCSV(csvString, filename);

    showToast(
      buildToastMessage(
        snapshot.length,
        engine.sortConfig,
        engine.filters,
        engine.searchQuery
      )
    );

    updateExportButton(exportBtn, 'ready');
    exportInProgress = false;
  }

  exportBtn.addEventListener('click', trigger);

  function onKeydown(e) {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const modKey = isMac ? e.metaKey : e.ctrlKey;
    if (modKey && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      trigger();
    }
  }

  document.addEventListener('keydown', onKeydown);

  const destroy = () => {
    exportBtn.remove();
    document.removeEventListener('keydown', onKeydown);
  };

  return { destroy, trigger };
}
