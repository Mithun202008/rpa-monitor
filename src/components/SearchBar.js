export function createSearchBar(engine) {
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
