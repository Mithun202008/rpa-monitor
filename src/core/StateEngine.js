import { sortRows, insertSortedRow } from '../utils/sort.js';
import { fuzzyFilter } from '../utils/fuzzy.js';

const MICRO_BATCH_SIZE = 50;
const FILTER_FIELDS = ['automation_type', 'department', 'industry'];

export class StateEngine {
  constructor() {
    this.statePool = new Map();
    this.allRows = [];
    this.displayRows = [];
    this.paused = false;

    this.filters = { automation_type: [], department: [], industry: [] };
    this.distinctValues = { automation_type: [], department: [], industry: [] };
    this.sortConfig = [];
    this.searchQuery = '';

    this.kpis = { totalProcessed: 0, activeRobots: 0, globalSavings: 0 };
    this._kpiAccumRobots = 0;
    this._kpiAccumSavings = 0;

    this.listeners = [];
    this.kpiListeners = [];
    this.filterListeners = [];
    this.bufferDepthListeners = [];
    this.flushStateListeners = [];
    this.liveStateListeners = [];

    this.baselineRows = [];
    this.baselinePage = 0;
    this.baselineComplete = false;
    this.progressiveMode = false;
    this.streamBuffer = [];
    this.skeletonListeners = [];

    this.bufferQueue = [];

    this.isUserScrolledAway = false;
    this.pendingNewRowCount = 0;

    this.lastBatchTime = 0;
    this.lastBatchRealTime = 0;
    this.batchDeltas = [];
    this.lastBatchSize = 0;
    this.renderDuration = 0;
    this.batchTimestamps = [];
    this.batchRowCounts = [];

    this._flushRafId = null;
    this._loadingPage = false;
    this._destroyed = false;
  }

  onRowsChange(fn) { this.listeners.push(fn); }
  onKpiChange(fn) { this.kpiListeners.push(fn); }
  onFilterValuesChange(fn) { this.filterListeners.push(fn); }
  onBufferDepthChange(fn) { this.bufferDepthListeners.push(fn); }
  onFlushStateChange(fn) { this.flushStateListeners.push(fn); }
  onLiveStateChange(fn) { this.liveStateListeners.push(fn); }
  onSkeletonChange(fn) { this.skeletonListeners.push(fn); }

  removeListener(fn) {
    const lists = [this.listeners, this.kpiListeners, this.filterListeners,
      this.bufferDepthListeners, this.flushStateListeners,
      this.liveStateListeners, this.skeletonListeners];
    for (const list of lists) {
      const idx = list.indexOf(fn);
      if (idx >= 0) { list.splice(idx, 1); break; }
    }
  }

  destroy() {
    this._destroyed = true;
    if (this._flushRafId) cancelAnimationFrame(this._flushRafId);
    this.listeners.length = 0;
    this.kpiListeners.length = 0;
    this.filterListeners.length = 0;
    this.bufferDepthListeners.length = 0;
    this.flushStateListeners.length = 0;
    this.liveStateListeners.length = 0;
    this.skeletonListeners.length = 0;
  }

  setDistinctValues(values) {
    Object.keys(values).forEach(key => {
      if (this.distinctValues[key]) {
        this.distinctValues[key] = values[key];
      }
    });
    this._notifyFilterValues();
  }

  setBaseline(rows) {
    this.baselineRows = rows;
    this._kpiAccumRobots = 0;
    this._kpiAccumSavings = 0;
    for (const row of rows) {
      const clone = { ...row };
      this.statePool.set(row.project_id, clone);
      this.allRows.push(clone);
      this._kpiAccumRobots += Number(row.robots_deployed) || 0;
      this._kpiAccumSavings += Number(row.annual_savings_usd) || 0;
    }
    this.kpis.activeRobots = this._kpiAccumRobots;
    this.kpis.globalSavings = this._kpiAccumSavings;
    this._notifyKpi();
    this.baselineComplete = true;
    this.progressiveMode = false;
    if (this.streamBuffer.length > 0) {
      this._ingest(this.streamBuffer);
      this.streamBuffer = [];
    }
    this._notifySkeleton(false);
    this._recompute();
  }

  _loadBaselinePage() {
  }

  loadNextBaselinePage() {
    if (!this.progressiveMode || this.baselineComplete || this._loadingPage) return;
    this._notifySkeleton(true);
    setTimeout(() => {
      if (this._destroyed) return;
      this._loadBaselinePage();
    }, 0);
  }

  isBaselineComplete() { return this.baselineComplete; }

  process(batch) {
    if (!Array.isArray(batch) || batch.length === 0 || this._destroyed) return;

    const now = performance.now();
    this.lastBatchTime = now;
    this.lastBatchRealTime = Date.now();
    this.lastBatchSize = batch.length;

    if (this.batchTimestamps.length >= 50) {
      this.batchTimestamps.shift();
      this.batchRowCounts.shift();
    }
    this.batchTimestamps.push(now);
    this.batchRowCounts.push(batch.length);
    if (this.batchTimestamps.length >= 2) {
      const delta = this.batchTimestamps[this.batchTimestamps.length - 1] - this.batchTimestamps[this.batchTimestamps.length - 2];
      if (this.batchDeltas.length >= 25) this.batchDeltas.shift();
      this.batchDeltas.push(delta);
    }

    this.kpis.totalProcessed += batch.length;

    if (this.progressiveMode) {
      this.streamBuffer.push(...batch);
      return;
    }

    if (this.paused) {
      this.bufferQueue.push(batch);
      this._notifyBufferDepth();
      return;
    }

    this._ingest(batch);
    this._recomputeKpis();
    this._recompute();
  }

  _recomputeKpis() {
    this.kpis.activeRobots = this._kpiAccumRobots;
    this.kpis.globalSavings = this._kpiAccumSavings;
    this._notifyKpi();
  }

  _collectDistinctFromPool() {
    let changed = false;
    for (const row of this.statePool.values()) {
      for (const field of FILTER_FIELDS) {
        const val = row[field];
        if (val && !this.distinctValues[field].includes(val)) {
          this.distinctValues[field].push(val);
          this.distinctValues[field].sort();
          changed = true;
        }
      }
    }
    if (changed) this._notifyFilterValues();
  }

  _ingest(rows) {
    let newRowsAdded = false;
    const sortActive = this.sortConfig && this.sortConfig.length > 0;
    for (const row of rows) {
      if (this.isUserScrolledAway) {
        this.pendingNewRowCount++;
      }

      const existing = this.statePool.get(row.project_id);
      if (existing) {
        const oldStatus = existing.project_status;
        const oldRoi = Number(existing.roi_percent);
        const oldRobots = Number(existing.robots_deployed) || 0;
        const oldSavings = Number(existing.annual_savings_usd) || 0;

        let sortKeyChanged = false;
        if (sortActive) {
          for (const { field } of this.sortConfig) {
            if (String(existing[field]) !== String(row[field])) {
              sortKeyChanged = true;
              break;
            }
          }
        }

        Object.assign(existing, row);
        existing._dirty = true;

        const newRobots = Number(existing.robots_deployed) || 0;
        const newSavings = Number(existing.annual_savings_usd) || 0;
        this._kpiAccumRobots += newRobots - oldRobots;
        this._kpiAccumSavings += newSavings - oldSavings;

        if (sortActive && sortKeyChanged) {
          const idx = this.allRows.indexOf(existing);
          if (idx >= 0) {
            this.allRows.splice(idx, 1);
            insertSortedRow(this.allRows, existing, this.sortConfig);
          }
        }

        if (existing.project_status === 'Failed' && oldStatus !== 'Failed') {
          existing._flashRed = true;
        }
        if (existing.project_status !== 'Failed' && oldStatus === 'Failed') {
        }
        if (Number(existing.roi_percent) < 0 && oldRoi >= 0) {
          existing._flashAmber = true;
        }
      } else {
        const newRow = { ...row, _dirty: true };
        this.statePool.set(row.project_id, newRow);
        this._kpiAccumRobots += Number(newRow.robots_deployed) || 0;
        this._kpiAccumSavings += Number(newRow.annual_savings_usd) || 0;
        if (sortActive) {
          insertSortedRow(this.allRows, newRow, this.sortConfig);
        } else {
          this.allRows.push(newRow);
        }
        newRowsAdded = true;
      }
    }
    if (newRowsAdded) this._collectDistinctFromPool();
  }

  _recompute() {
    const start = performance.now();
    let rows = this.allRows;

    if (this.searchQuery) {
      rows = fuzzyFilter(rows, this.searchQuery);
    }

    for (const key of Object.keys(this.filters)) {
      const vals = this.filters[key];
      if (vals.length > 0) {
        rows = rows.filter(r => vals.includes(r[key]));
      }
    }

    if (this.sortConfig.length > 0) {
      rows = sortRows(rows, this.sortConfig);
    }

    this.displayRows = rows;
    this.renderDuration = performance.now() - start;
    this._notifyRows();
    this._notifyLiveState();
  }

  setPaused(val) {
    this.paused = val;
    if (!val) {
      if (this.bufferQueue.length > 0) {
        this._startMicroBatchFlush();
      }
    } else {
      if (this._flushRafId) {
        cancelAnimationFrame(this._flushRafId);
        this._flushRafId = null;
      }
    }
  }

  togglePaused() {
    this.setPaused(!this.paused);
  }

  _startMicroBatchFlush() {
    this._notifyFlushState(true);
    const flushTick = () => {
      if (this._destroyed) return;
      let processed = 0;
      while (this.bufferQueue.length > 0 && processed < MICRO_BATCH_SIZE) {
        const batch = this.bufferQueue.shift();
        this._ingest(batch);
        processed += batch.length;
      }
      this._notifyBufferDepth();
      this._recomputeKpis();
      this._recompute();
      if (this.bufferQueue.length > 0) {
        this._flushRafId = requestAnimationFrame(flushTick);
      } else {
        this._flushRafId = null;
        this._notifyFlushState(false);
      }
    };
    this._flushRafId = requestAnimationFrame(flushTick);
  }

  _notifyFlushState(flushing) {
    for (const fn of this.flushStateListeners) fn(flushing);
  }

  _notifyBufferDepth() {
    for (const fn of this.bufferDepthListeners) fn(this.getBufferDepth());
  }

  getBufferDepth() {
    let depth = 0;
    for (const batch of this.bufferQueue) {
      depth += batch.length;
    }
    return depth;
  }

  setScrollAway(val) {
    this.isUserScrolledAway = val;
    if (!val) {
      this.pendingNewRowCount = 0;
      this._notifyLiveState();
    }
  }

  isLiveAnchored() { return !this.isUserScrolledAway; }

  _notifyLiveState() {
    for (const fn of this.liveStateListeners) {
      fn({ pendingNewRowCount: this.pendingNewRowCount, isScrolledAway: this.isUserScrolledAway });
    }
  }

  _notifySkeleton(show) {
    for (const fn of this.skeletonListeners) fn(show);
  }

  setFilter(key, values) {
    this.filters[key] = values;
    this._recompute();
  }

  setSortConfig(config) {
    this.sortConfig = config;
    this._recompute();
  }

  setSearchQuery(query) {
    this.searchQuery = query;
    this._recompute();
  }

  getDiagnostics() {
    const deltas = this.batchDeltas;
    const avgInterval = deltas.length > 0
      ? (deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(1)
      : '—';

    const timestamps = this.batchTimestamps;
    const rowCounts = this.batchRowCounts;
    let rowsPerSec = 0;
    if (timestamps.length >= 2) {
      const now = performance.now();
      const cutoff = now - 5000;
      let recentRows = 0;
      let firstRecent = 0;
      for (let i = timestamps.length - 1; i >= 0; i--) {
        if (timestamps[i] >= cutoff) {
          recentRows += rowCounts[i];
          firstRecent = timestamps[i];
        } else {
          break;
        }
      }
      const elapsed = Math.max(0.001, (firstRecent - cutoff) / 1000);
      rowsPerSec = Math.round(recentRows / elapsed);
    }

    return {
      lastBatchTime: this.lastBatchRealTime > 0 ? new Date(this.lastBatchRealTime).toLocaleTimeString('en-US', { hour12: false }) + '.' + String(this.lastBatchRealTime % 1000).padStart(3, '0') : '—',
      avgBatchInterval: avgInterval,
      lastBatchSize: this.lastBatchSize,
      rowsPerSec,
      bufferQueueDepth: this.getBufferDepth(),
      renderDuration: this.renderDuration.toFixed(2),
      statePoolSize: this.statePool.size,
      totalProcessed: this.kpis.totalProcessed
    };
  }

  _notifyRows() {
    for (const fn of this.listeners) fn(this.displayRows);
  }

  _notifyKpi() {
    for (const fn of this.kpiListeners) fn({ ...this.kpis });
  }

  _notifyFilterValues() {
    for (const fn of this.filterListeners) fn({ ...this.distinctValues });
  }
}
