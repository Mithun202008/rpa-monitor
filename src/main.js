import { StateEngine } from './core/StateEngine.js';
import { wrapStreamCallback } from './core/streamWire.js';
import { createKPIDisplay } from './components/KPIDisplay.js';
import { createPausePlayBar } from './components/PausePlayBar.js';
import { createFilterPanel } from './components/FilterPanel.js';
import { createSearchBar } from './components/SearchBar.js';
import { createLayoutManager } from './components/LayoutManager.js';
import { createGridHeaders, createVirtualScroller } from './components/VirtualScroller.js';
import { createDiagnosticPanel } from './components/DiagnosticPanel.js';
import { createSnapshotExport } from './core/SnapshotExport.js';
import './styles/main.css';

const engine = new StateEngine();

const kpiDisplay = createKPIDisplay(engine);
const pausePlayBar = createPausePlayBar(engine);
const filterPanel = createFilterPanel(engine);
const searchBar = createSearchBar(engine);
const snapshotExport = createSnapshotExport(engine);
const layoutManager = createLayoutManager();
createGridHeaders(engine);
const scroller = createVirtualScroller(engine);
const diagnosticPanel = createDiagnosticPanel(engine);

let baselineRows = [];
let scrollerViewport = null;
let skeletonHandler = null;
let baselineScrollHandler = null;

fetch('/automation_projects.csv')
  .then(r => r.text())
  .then(csvText => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const distinct = { automation_type: new Set(), department: new Set(), industry: new Set() };
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = lines[i].split(',');
      if (vals.length < headers.length) continue;
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx]?.trim(); });
      if (row.automation_type) distinct.automation_type.add(row.automation_type);
      if (row.department) distinct.department.add(row.department);
      if (row.industry) distinct.industry.add(row.industry);
      rows.push(row);
    }

    baselineRows = rows;

    engine.setDistinctValues({
      automation_type: [...distinct.automation_type].sort(),
      department: [...distinct.department].sort(),
      industry: [...distinct.industry].sort(),
    });

    engine.setBaseline(baselineRows);

    scrollerViewport = scroller.getViewport ? scroller.getViewport() : document.getElementById('grid-viewport');

    skeletonHandler = function (show) {
      if (scroller.setSkeleton) scroller.setSkeleton(show);
    };
    engine.onSkeletonChange(skeletonHandler);

    baselineScrollHandler = () => {
      if (!engine.isBaselineComplete() && scrollerViewport) {
        const { scrollTop, clientHeight, scrollHeight } = scrollerViewport;
        if (scrollHeight - scrollTop - clientHeight < 200) {
          engine.loadNextBaselinePage();
        }
      }
    };

    scrollerViewport.addEventListener('scroll', baselineScrollHandler, { passive: true });

    if (window.initializeRpaStream) {
      window.initializeRpaStream(
        wrapStreamCallback(engine),
        '/automation_projects.csv'
      );
    }
  })
  .catch(err => {
    console.error('Failed to load CSV:', err);
  });

function onBeforeUnload() {
  window.stopRpaStream?.();
  engine.destroy();
  if (skeletonHandler) engine.removeListener(skeletonHandler);
  if (baselineScrollHandler && scrollerViewport) {
    scrollerViewport.removeEventListener('scroll', baselineScrollHandler);
  }
  if (scroller.destroy) scroller.destroy();
  if (diagnosticPanel.destroy) diagnosticPanel.destroy();
  if (filterPanel.destroy) filterPanel.destroy();
  if (searchBar.destroy) searchBar.destroy();
  if (kpiDisplay.destroy) kpiDisplay.destroy();
  if (pausePlayBar.destroy) pausePlayBar.destroy();
  if (snapshotExport.destroy) snapshotExport.destroy();
  if (layoutManager.destroy) layoutManager.destroy();
}

window.addEventListener('beforeunload', onBeforeUnload);
