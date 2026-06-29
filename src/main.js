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
import CsvWorker from './workers/csvWorker.js?worker';
import './styles/main.css';

const skeletonEl = document.getElementById('loading-skeleton');
if (skeletonEl) skeletonEl.remove();

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

let scrollerViewport = null;
let skeletonHandler = null;
let baselineScrollHandler = null;

const worker = new CsvWorker();
worker.postMessage({ type: 'load-csv', url: '/automation_projects.csv' });

worker.onmessage = function (e) {
  const msg = e.data;

  if (msg.type === 'baseline-chunk') {
    engine.loadBaselineChunk(msg.rows);
    return;
  }

  if (msg.type === 'baseline-complete') {
    engine.finalizeBaseline(msg.distinctValues);

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

    worker.terminate();
    return;
  }

  if (msg.type === 'error') {
    console.error('CSV Worker error:', msg.message);
  }
};

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
