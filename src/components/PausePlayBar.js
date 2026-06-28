export function createPausePlayBar(engine) {
  const container = document.getElementById('pause-play');
  container.innerHTML = `
    <button id="btn-pause-play" class="pp-btn">⏸ Pause</button>
    <span id="pp-status" class="pp-status live">Live</span>
    <span id="buffer-badge" class="buffer-badge hidden"></span>
  `;

  const btn = document.getElementById('btn-pause-play');
  const status = document.getElementById('pp-status');
  const badge = document.getElementById('buffer-badge');

  const flushOverlay = document.createElement('div');
  flushOverlay.className = 'flush-overlay hidden';
  flushOverlay.textContent = 'Flushing buffer...';
  document.body.appendChild(flushOverlay);

  function updateBadge(depth) {
    if (engine.paused && depth > 0) {
      badge.textContent = `⏸ Buffered: ${depth} rows waiting`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function onToggle() {
    engine.togglePaused();
    const p = engine.paused;
    btn.textContent = p ? '▶ Play' : '⏸ Pause';
    status.textContent = p ? 'PAUSED' : 'Live';
    status.className = 'pp-status ' + (p ? 'paused' : 'live');
    document.getElementById('grid-viewport').classList.toggle('grid-paused', p);
    if (p) {
      updateBadge(engine.getBufferDepth());
    }
  }

  btn.addEventListener('click', onToggle);

  function onBufferDepth(depth) {
    updateBadge(depth);
  }

  function onFlushState(flushing) {
    flushOverlay.classList.toggle('hidden', !flushing);
  }

  engine.onBufferDepthChange(onBufferDepth);
  engine.onFlushStateChange(onFlushState);

  const destroy = () => {
    btn.removeEventListener('click', onToggle);
    engine.removeListener(onBufferDepth);
    engine.removeListener(onFlushState);
    flushOverlay.remove();
  };

  return { destroy };
}
