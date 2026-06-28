export function createDiagnosticPanel(engine) {
  const panel = document.createElement('div');
  panel.className = 'diagnostic-panel hidden';
  panel.innerHTML = `
    <div class="dp-header">
      <span class="dp-title">⚙ Diagnostic Panel</span>
      <button class="dp-close" aria-label="Close diagnostic panel">×</button>
    </div>
    <div class="dp-body">
      <div class="dp-section">
        <div class="dp-section-title">Memory Metrics</div>
        <div class="dp-metric"><span class="dp-label">JS Heap Used</span><span class="dp-value" id="dp-heap-used">—</span></div>
        <div class="dp-metric"><span class="dp-label">JS Heap Total</span><span class="dp-value" id="dp-heap-total">—</span></div>
        <div class="dp-metric"><span class="dp-label">Heap Usage %</span>
          <div class="dp-bar-container"><div class="dp-bar" id="dp-heap-bar" style="width:0%"></div></div>
          <span class="dp-value" id="dp-heap-pct">0%</span>
        </div>
        <div class="dp-metric"><span class="dp-label">DOM Node Count</span><span class="dp-value" id="dp-dom-nodes">—</span></div>
        <div class="dp-metric"><span class="dp-label">Active Row Nodes</span><span class="dp-value" id="dp-row-nodes">—</span></div>
        <div class="dp-metric"><span class="dp-label">State Pool Size</span><span class="dp-value" id="dp-pool-size">—</span></div>
      </div>
      <div class="dp-section">
        <div class="dp-section-title">Stream Latency</div>
        <div class="dp-metric"><span class="dp-label">Last Batch Received</span><span class="dp-value" id="dp-last-batch">—</span></div>
        <div class="dp-metric"><span class="dp-label">Batch Interval (ms)</span><span class="dp-value" id="dp-batch-interval">—</span></div>
        <div class="dp-metric"><span class="dp-label">Batch Size</span><span class="dp-value" id="dp-batch-size">—</span></div>
        <div class="dp-metric"><span class="dp-label">Rows / sec</span><span class="dp-value" id="dp-rows-per-sec">—</span></div>
        <div class="dp-metric"><span class="dp-label">Buffer Queue Depth</span><span class="dp-value" id="dp-buffer-depth">0</span></div>
      </div>
      <div class="dp-section">
        <div class="dp-section-title">Render Metrics</div>
        <div class="dp-metric"><span class="dp-label">Last Render (ms)</span><span class="dp-value" id="dp-render-dur">—</span></div>
        <div class="dp-metric"><span class="dp-label">Frame Budget</span>
          <div class="dp-bar-container"><div class="dp-bar" id="dp-budget-bar" style="width:0%"></div></div>
          <span class="dp-value" id="dp-budget-pct">0%</span>
        </div>
        <div class="dp-metric"><span class="dp-label">Est. FPS</span><span class="dp-value" id="dp-fps">—</span></div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const closeBtn = panel.querySelector('.dp-close');
  let visible = false;

  function toggle() {
    visible = !visible;
    panel.classList.toggle('hidden', !visible);
  }

  function onKeydown(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      toggle();
    }
  }

  document.addEventListener('keydown', onKeydown);

  const diagnosticToggleBtn = document.createElement('button');
  diagnosticToggleBtn.className = 'dp-toggle-btn';
  diagnosticToggleBtn.textContent = '🔍';
  diagnosticToggleBtn.setAttribute('title', 'Toggle Diagnostic Panel (Ctrl+Shift+D)');
  document.body.appendChild(diagnosticToggleBtn);

  diagnosticToggleBtn.addEventListener('click', toggle);

  closeBtn.addEventListener('click', toggle);

  function colorPct(value) {
    if (value > 100) return 'red';
    if (value > 50) return 'yellow';
    return 'green';
  }

  function updateDOMNodeCount() {
    try {
      return document.querySelectorAll('*').length;
    } catch {
      return '—';
    }
  }

  function countRowNodes() {
    return document.querySelectorAll('.grid-row').length;
  }

  function update() {
    if (!visible) return;
    const diag = engine.getDiagnostics();
    const mem = performance.memory || null;

    if (mem) {
      const usedMB = (mem.usedJSHeapSize / 1048576).toFixed(1);
      const totalMB = (mem.jsHeapSizeLimit / 1048576).toFixed(1);
      const heapPct = ((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100);

      document.getElementById('dp-heap-used').textContent = usedMB + ' MB';
      document.getElementById('dp-heap-total').textContent = totalMB + ' MB';
      document.getElementById('dp-heap-pct').textContent = heapPct.toFixed(1) + '%';
      const heapBar = document.getElementById('dp-heap-bar');
      heapBar.style.width = Math.min(heapPct, 100) + '%';
      heapBar.className = 'dp-bar ' + colorPct(heapPct);
    } else {
      document.getElementById('dp-heap-used').textContent = 'unavailable';
      document.getElementById('dp-heap-total').textContent = 'unavailable';
      document.getElementById('dp-heap-pct').textContent = '—';
      document.getElementById('dp-heap-bar').style.width = '0%';
    }

    document.getElementById('dp-dom-nodes').textContent = updateDOMNodeCount();
    document.getElementById('dp-row-nodes').textContent = countRowNodes();
    document.getElementById('dp-pool-size').textContent = diag.statePoolSize;
    document.getElementById('dp-last-batch').textContent = diag.lastBatchTime;
    document.getElementById('dp-batch-interval').textContent = diag.avgBatchInterval;
    document.getElementById('dp-batch-size').textContent = diag.lastBatchSize;
    document.getElementById('dp-rows-per-sec').textContent = diag.rowsPerSec;
    document.getElementById('dp-buffer-depth').textContent = diag.bufferQueueDepth;

    document.getElementById('dp-render-dur').textContent = diag.renderDuration + ' ms';
    const renderMs = parseFloat(diag.renderDuration) || 0;
    const budgetPct = (renderMs / 16.67) * 100;
    const budgetEl = document.getElementById('dp-budget-pct');
    budgetEl.textContent = budgetPct.toFixed(1) + '%';
    budgetEl.className = 'dp-value ' + colorPct(budgetPct);
    const budgetBar = document.getElementById('dp-budget-bar');
    budgetBar.style.width = Math.min(budgetPct, 100) + '%';
    budgetBar.className = 'dp-bar ' + colorPct(budgetPct);

    const fps = renderMs > 0 ? Math.min(60, Math.round(1000 / renderMs)) : 60;
    const fpsEl = document.getElementById('dp-fps');
    fpsEl.textContent = fps;
    fpsEl.className = 'dp-value ' + (fps < 30 ? 'red' : fps < 50 ? 'yellow' : 'green');
  }

  setInterval(update, 500);

  const destroy = () => {
    panel.remove();
    diagnosticToggleBtn.remove();
    document.removeEventListener('keydown', onKeydown);
  };

  return { destroy, toggle };
}
