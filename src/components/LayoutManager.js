const STORAGE_KEY = 'rpa_monitor_layout_v1';
const PANELS = [
  { id: 'kpi-dashboard', label: 'KPI Strip', default: true },
  { id: 'filter-panel', label: 'Filter Bar', default: true },
  { id: 'grid-container', label: 'Grid Window', default: true },
  { id: 'search-bar', label: 'Search', default: true },
  { id: 'pause-play', label: 'Pause/Play', default: true },
];

export function createLayoutManager() {
  const el = document.getElementById('layout-toggles');

  let state;
  try {
    state = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch { state = null; }

  if (!state) {
    state = {};
    PANELS.forEach(p => { state[p.id] = p.default; });
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function apply() {
    PANELS.forEach(p => {
      const panelEl = document.getElementById(p.id);
      if (panelEl) {
        panelEl.style.display = state[p.id] ? '' : 'none';
      }
    });
  }

  el.innerHTML = `<div class="layout-toggle-group">
    <button class="layout-toggle-btn" id="layout-settings-toggle">⚙ Panels</button>
    <div class="layout-toggle-menu hidden" id="layout-toggle-menu">
      ${PANELS.map(p => `
        <label class="layout-toggle">
          <input type="checkbox" data-panel="${p.id}" ${state[p.id] ? 'checked' : ''} />
          ${p.label}
        </label>
      `).join('')}
    </div>
  </div>`;

  const toggleBtn = document.getElementById('layout-settings-toggle');
  const menu = document.getElementById('layout-toggle-menu');

  function onDocClick(e) {
    if (!menu.contains(e.target) && e.target !== toggleBtn) {
      menu.classList.add('hidden');
    }
  }

  toggleBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });

  document.addEventListener('click', onDocClick);

  menu.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  menu.addEventListener('change', function (e) {
    if (e.target.type === 'checkbox') {
      state[e.target.dataset.panel] = e.target.checked;
      save();
      apply();
    }
  });

  apply();

  const destroy = () => {
    document.removeEventListener('click', onDocClick);
  };

  return { state, save, apply, destroy };
}
