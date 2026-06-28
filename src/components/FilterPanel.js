const FILTER_FIELDS = ['automation_type', 'department', 'industry'];

export function createFilterPanel(engine) {
  const el = document.getElementById('filter-panel');
  el.innerHTML = `<div class="filter-row" id="filter-row"></div><div class="filter-chips" id="filter-chips"></div>`;
  const row = document.getElementById('filter-row');
  const chipsContainer = document.getElementById('filter-chips');

  const popupMap = {};

  FILTER_FIELDS.forEach(field => {
    const wrapper = document.createElement('div');
    wrapper.className = 'filter-wrapper';

    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.textContent = field.replace(/_/g, ' ');
    btn.dataset.field = field;
    wrapper.appendChild(btn);

    const popup = document.createElement('div');
    popup.className = 'filter-popup hidden';
    popup.id = `filter-popup-${field}`;
    wrapper.appendChild(popup);

    row.appendChild(wrapper);
    popupMap[field] = { btn, popup, selected: new Set() };
  });

  function onDocClick(e) {
    FILTER_FIELDS.forEach(field => {
      const { btn, popup } = popupMap[field];
      if (!popup.contains(e.target) && e.target !== btn) {
        popup.classList.add('hidden');
      }
    });
  }

  document.addEventListener('click', onDocClick);

  function rebuildPopup(field, values) {
    const { popup, selected } = popupMap[field];
    popup.innerHTML = '';
    values.forEach(v => {
      const label = document.createElement('label');
      label.className = 'filter-option';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selected.has(v);
      cb.addEventListener('change', function () {
        if (cb.checked) {
          selected.add(v);
        } else {
          selected.delete(v);
        }
        engine.setFilter(field, Array.from(selected));
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + v));
      popup.appendChild(label);
    });
  }

  function updateChips() {
    chipsContainer.innerHTML = '';
    FILTER_FIELDS.forEach(field => {
      const { selected } = popupMap[field];
      selected.forEach(val => {
        const chip = document.createElement('span');
        chip.className = 'filter-chip';
        chip.innerHTML = `${field.replace(/_/g, ' ')}: ${val} <span class="filter-chip-remove" data-field="${field}" data-val="${val}">×</span>`;
        chipsContainer.appendChild(chip);
      });
    });
  }

  chipsContainer.addEventListener('click', function (e) {
    const removeBtn = e.target.closest('.filter-chip-remove');
    if (removeBtn) {
      const field = removeBtn.dataset.field;
      const val = removeBtn.dataset.val;
      const { selected, popup } = popupMap[field];
      selected.delete(val);
      engine.setFilter(field, Array.from(selected));
      const labels = popup.querySelectorAll('.filter-option');
      for (const label of labels) {
        if (label.textContent.trim() === val || label.textContent.trim().endsWith(' ' + val)) {
          const cb = label.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = false;
          break;
        }
      }
    }
  });

  engine.onFilterValuesChange(values => {
    FILTER_FIELDS.forEach(field => {
      if (values[field] && values[field].length > 0) {
        const existing = popupMap[field].popup.querySelectorAll('.filter-option').length;
        if (existing !== values[field].length) {
          rebuildPopup(field, values[field]);
        }
      }
    });
  });

  const origSetFilter = engine.setFilter.bind(engine);
  engine.setFilter = function (field, values) {
    origSetFilter(field, values);
    updateChips();
  };

  FILTER_FIELDS.forEach(field => {
    const { btn } = popupMap[field];
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const popup = popupMap[field].popup;
      const hidden = popup.classList.contains('hidden');
      FILTER_FIELDS.forEach(f => {
        if (f !== field) popupMap[f].popup.classList.add('hidden');
      });
      popup.classList.toggle('hidden', !hidden);
    });
  });

  const destroy = () => {
    document.removeEventListener('click', onDocClick);
  };

  return { destroy };
}
