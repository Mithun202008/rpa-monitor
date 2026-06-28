export function createSearchBar(engine) {
  const el = document.getElementById('search-bar');
  el.innerHTML = `
    <input type="text" id="search-input" class="search-input" placeholder="Fuzzy search: project_name, company_id, partner, country..." />
  `;

  const input = document.getElementById('search-input');
  let debounceTimer;

  function onInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      engine.setSearchQuery(input.value);
    }, 150);
  }

  input.addEventListener('input', onInput);

  const destroy = () => {
    clearTimeout(debounceTimer);
    input.removeEventListener('input', onInput);
  };

  return { destroy };
}
