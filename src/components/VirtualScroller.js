import { formatCurrency, formatPercent, formatNumber } from '../utils/format.js';
import { applyAlertClass } from '../utils/alerts.js';

const ROW_HEIGHT = 36;
const BUFFER_ROWS = 2;

const COLUMNS = [
  { key: 'project_id', label: 'ID', width: 100 },
  { key: 'company_id', label: 'Company', width: 100 },
  { key: 'project_name', label: 'Project Name', width: 200 },
  { key: 'project_status', label: 'Status', width: 100 },
  { key: 'automation_type', label: 'Automation Type', width: 150 },
  { key: 'robots_deployed', label: 'Robots', width: 80, align: 'right' },
  { key: 'budget_usd', label: 'Budget', width: 120, align: 'right', sortable: true },
  { key: 'annual_savings_usd', label: 'Savings', width: 120, align: 'right' },
  { key: 'roi_percent', label: 'ROI %', width: 90, align: 'right', sortable: true },
  { key: 'employee_hours_saved', label: 'Hours Saved', width: 120, align: 'right', sortable: true },
  { key: 'department', label: 'Department', width: 150 },
  { key: 'industry', label: 'Industry', width: 150 },
  { key: 'implementation_partner', label: 'Partner', width: 150 },
  { key: 'country', label: 'Country', width: 120 },
];

function formatCell(col, row) {
  const val = row[col.key];
  if (val === undefined || val === null) return '—';
  if (col.align === 'right') {
    if (col.key === 'budget_usd' || col.key === 'annual_savings_usd') return formatCurrency(val);
    if (col.key === 'roi_percent') return formatPercent(val);
    return formatNumber(val);
  }
  return String(val);
}

function updateCellContent(cell, col, formatted, hasSearch, query) {
  if (!hasSearch) {
    if (cell._plainText !== formatted) {
      cell.textContent = formatted;
      cell._plainText = formatted;
      cell._highlighted = false;
    }
    return;
  }

  if (cell._plainText === formatted && cell._highlighted) return;

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    cell.textContent = formatted;
    cell._plainText = formatted;
    cell._highlighted = false;
    return;
  }

  const str = String(formatted);
  const lower = str.toLowerCase();
  const fragment = document.createDocumentFragment();
  let i = 0;

  while (i < str.length) {
    let found = -1;
    let matchLen = 0;
    for (const token of tokens) {
      const idx = lower.indexOf(token, i);
      if (idx >= 0 && (found < 0 || idx < found)) {
        found = idx;
        matchLen = token.length;
      }
    }
    if (found >= 0 && found === i) {
      const mark = document.createElement('mark');
      mark.textContent = str.slice(i, i + matchLen);
      fragment.appendChild(mark);
      i += matchLen;
    } else if (found >= 0) {
      fragment.appendChild(document.createTextNode(str.slice(i, found)));
      i = found;
    } else {
      fragment.appendChild(document.createTextNode(str.slice(i)));
      break;
    }
  }

  cell.textContent = '';
  cell.appendChild(fragment);
  cell._plainText = formatted;
  cell._highlighted = true;
}

function updateHeaderIndicators(el, cfg, columns) {
  el.querySelectorAll('.sort-indicator').forEach(ind => {
    const parentCell = ind.parentElement;
    const label = parentCell.textContent.replace(/[ ▲▼\d\[\]]/g, '').trim();
    const col = columns.find(c => c.label === label);
    if (!col) return;
    const match = cfg.find(s => s.field === col.key);
    if (match) {
      const idx = cfg.indexOf(match) + 1;
      ind.textContent = (match.dir === 'asc' ? ' ▲' : ' ▼') + (cfg.length > 1 ? `[${idx}]` : '');
    } else {
      ind.textContent = ' ';
    }
  });
}

export function createGridHeaders(engine) {
  const headerRow = document.querySelector('.grid-header-row');
  if (headerRow) {
    headerRow.style.width = '1750px';
  }

  function handleHeaderClick(e, col) {
    let cfg = engine.sortConfig;
    if (!e.shiftKey) {
      cfg = [];
    } else {
      cfg = cfg.slice();
    }
    const existing = cfg.findIndex(s => s.field === col.key);
    if (existing >= 0) {
      if (cfg[existing].dir === 'asc') {
        cfg[existing] = { field: col.key, dir: 'desc' };
      } else {
        cfg.splice(existing, 1);
      }
    } else {
      cfg.push({ field: col.key, dir: 'asc' });
    }
    engine.setSortConfig(cfg);
    updateHeaderIndicators(document.getElementById('grid-header'), cfg, COLUMNS);
  }

  document.querySelectorAll('.grid-header-cell[data-key]').forEach(cell => {
    const key = cell.dataset.key;
    const col = COLUMNS.find(c => c.key === key);
    if (col && col.sortable) {
      cell.addEventListener('click', function (e) { handleHeaderClick(e, col); });
    }
  });
}

export function createVirtualScroller(engine) {
  const viewport = document.getElementById('grid-viewport');

  const totalWidth = COLUMNS.reduce((s, c) => s + c.width, 0);
  const content = viewport.querySelector('.virtual-content') || (() => {
    const el = document.createElement('div');
    el.className = 'virtual-content';
    el.style.position = 'relative';
    el.style.width = totalWidth + 'px';
    viewport.appendChild(el);
    return el;
  })();

  const spacer = document.createElement('div');
  spacer.style.height = '0px';
  spacer.style.pointerEvents = 'none';
  content.appendChild(spacer);

  // Cached layout dimensions to avoid forced synchronous layout reads
  let cachedScrollTop = viewport.scrollTop;
  let cachedClientHeight = viewport.clientHeight;

  let dataRows = [];
  let rowNodes = [];
  let rafPending = false;
  let currentSearchQuery = '';
  let showSkeleton = false;

  let livePillClickHandler = null;
  let liveStateHandler = null;

  function getVisibleCount() {
    return Math.ceil(cachedClientHeight / ROW_HEIGHT) + BUFFER_ROWS * 2;
  }

  function render() {
    rafPending = false;

    // Zero DOM reads inside the layout loop
    const scrollTop = cachedScrollTop;
    const visCount = getVisibleCount();
    const totalHeight = dataRows.length * ROW_HEIGHT;

    spacer.style.height = totalHeight + 'px';
    if (rowNodes.length !== visCount) {
      rebuildPool(visCount);
    }

    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
    const hasSearch = currentSearchQuery.length > 0;

    for (let i = 0; i < rowNodes.length; i++) {
      const dataIdx = startIdx + i;
      const rowEl = rowNodes[i];
      if (dataIdx < dataRows.length) {
        const row = dataRows[dataIdx];
        rowEl.style.transform = `translateY(${dataIdx * ROW_HEIGHT}px)`;
        rowEl.style.display = 'flex';

        const needsContentUpdate = row._dirty || rowEl._lastDataIdx !== dataIdx || hasSearch;

        if (needsContentUpdate) {
          rowEl.className = 'grid-row';
          const cells = rowEl.children;
          for (let c = 0; c < COLUMNS.length; c++) {
            const col = COLUMNS[c];
            const formatted = formatCell(col, row);
            updateCellContent(cells[c], col, formatted, hasSearch, currentSearchQuery);
          }
          applyAlertClass(rowEl, row);
          row._dirty = false;
          rowEl._lastDataIdx = dataIdx;
        }
      } else if (showSkeleton) {
        rowEl.style.transform = `translateY(${dataIdx * ROW_HEIGHT}px)`;
        rowEl.style.display = 'flex';
        rowEl.className = 'grid-row skeleton-row';
        const cells = rowEl.children;
        for (let c = 0; c < COLUMNS.length; c++) {
          cells[c].textContent = '';
          cells[c]._plainText = '';
          cells[c]._highlighted = false;
        }
        rowEl._lastDataIdx = -1;
      } else {
        rowEl.style.display = 'none';
        rowEl._lastDataIdx = -1;
      }
    }
  }

  function rebuildPool(count) {
    while (rowNodes.length > count) {
      const el = rowNodes.pop();
      content.removeChild(el);
    }
    while (rowNodes.length < count) {
      const rowEl = document.createElement('div');
      rowEl.className = 'grid-row';
      rowEl.style.height = ROW_HEIGHT + 'px';
      rowEl.style.position = 'absolute';
      rowEl.style.left = '0';
      rowEl.style.right = '0';
      rowEl.style.top = '0';
      rowEl.style.display = 'flex';
      COLUMNS.forEach(col => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.style.width = col.width + 'px';
        cell.style.textAlign = col.align || 'left';
        cell.dataset.key = col.key;
        cell._plainText = '';
        cell._highlighted = false;
        rowEl.appendChild(cell);
      });
      content.appendChild(rowEl);
      rowNodes.push(rowEl);
    }
  }

  function scheduleRender() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(render);
    }
  }

  function onScroll() {
    cachedScrollTop = viewport.scrollTop;
    const scrollLeft = viewport.scrollLeft;

    const headerRow = document.querySelector('.grid-header-row');
    if (headerRow) {
      headerRow.style.transform = `translateX(-${scrollLeft}px)`;
    }

    if (cachedScrollTop <= ROW_HEIGHT) {
      engine.setScrollAway(false);
    } else {
      engine.setScrollAway(true);
    }
    scheduleRender();
  }

  viewport.addEventListener('scroll', onScroll, { passive: true });

  function onRowsChange(rows) {
    dataRows = rows;
    currentSearchQuery = engine.searchQuery || '';
    scheduleRender();
  }

  engine.onRowsChange(onRowsChange);

  function onResize() {
    cachedClientHeight = viewport.clientHeight;
    const count = getVisibleCount();
    if (rowNodes.length !== count) {
      rebuildPool(count);
      scheduleRender();
    }
  }

  window.addEventListener('resize', onResize, { passive: true });

  requestAnimationFrame(() => { rebuildPool(getVisibleCount()); scheduleRender(); });

  const livePill = document.createElement('button');
  livePill.className = 'live-pill hidden';
  livePill.setAttribute('aria-label', 'Return to live view');
  document.body.appendChild(livePill);

  livePillClickHandler = function () {
    viewport.scrollTop = 0;
    engine.setScrollAway(false);
  };
  livePill.addEventListener('click', livePillClickHandler);

  liveStateHandler = function (state) {
    if (state.isScrolledAway && state.pendingNewRowCount > 0) {
      livePill.textContent = `↑ ${state.pendingNewRowCount} new rows — Click to return live`;
      livePill.classList.remove('hidden');
    } else {
      livePill.classList.add('hidden');
    }
  };
  engine.onLiveStateChange(liveStateHandler);

  const destroy = () => {
    viewport.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    if (livePillClickHandler) {
      livePill.removeEventListener('click', livePillClickHandler);
    }
    engine.removeListener(onRowsChange);
    engine.removeListener(liveStateHandler);
    livePill.remove();
  };

  return { render, destroy, getViewport: () => viewport, setSkeleton: (v) => { showSkeleton = v; scheduleRender(); } };
}
