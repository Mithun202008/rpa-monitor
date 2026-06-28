export function createSearchBar(engine) {
  const el = document.getElementById('search-bar');
  el.innerHTML = `
    <input type="text" id="search-input" class="search-input" placeholder="Fuzzy search: project_name, company_id, partner, country..." />
  `;

  const input = document.getElementById('search-input');
  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      engine.setSearchQuery(input.value);
    }, 150);
  });
}
