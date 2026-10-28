/* Preview routes are static. The production template keeps its existing routes
   and booking handlers; the Isotope event/attribute contract below is unchanged. */
(() => {
  const header = document.querySelector('.site-header');
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const search = document.getElementById('nav-search-input');
  const grid = document.getElementById('events-grid');
  const reset = document.querySelector('[data-reset-search]');

  const compactHeader = () => header?.classList.toggle('is-compact', window.scrollY > 35);
  compactHeader();
  window.addEventListener('scroll', compactHeader, { passive: true });
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });

  // Matches the live #events-grid: fitRows, lowercase name/venue, <3 means all.
  // filter-grid detail is the query STRING, including for existing Livewire callers.
  const iso = grid && new window.Isotope(grid, {
    itemSelector: '.grid-item',
    layoutMode: 'fitRows',
    // The Bootstrap 5 theme uses Isotope's vanilla element callback, including
    // when dropped into the current site that still loads legacy jQuery.
    isJQueryFiltering: false,
    transitionDuration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : '0.18s'
  });
  const updateGrid = query => {
    if (!iso) return;
    query = query.toLowerCase();
    iso.arrange({
      filter: function (element) {
        const queryLower = query.toLowerCase();
        if (queryLower.length < 3) return true;
        const name = element.getAttribute('data-name') || '';
        const venue = element.getAttribute('data-venue') || '';
        return name.includes(queryLower) || venue.includes(queryLower);
      }
    });
    const count = iso.filteredItems.length;
    document.querySelectorAll('[data-result-count]').forEach(el => { el.textContent = String(count); });
    const empty = document.querySelector('.no-results');
    if (empty) empty.hidden = count > 0;
    if (reset) reset.hidden = query.length === 0;
    const queryLabel = document.querySelector('[data-query-label]');
    if (queryLabel) queryLabel.textContent = query.length >= 3 ? `“${search.value}”` : 'all events';
  };
  window.addEventListener('filter-grid', event => updateGrid(event.detail));
  search?.addEventListener('keyup', event => {
    const query = event.target.value;
    if (query.length >= 3 || query.length === 0) {
      window.dispatchEvent(new CustomEvent('filter-grid', { detail: query }));
    }
  });
  // Search's native clear control fires input rather than keyup in some browsers.
  search?.addEventListener('input', () => {
    if (search.value.length === 0) window.dispatchEvent(new CustomEvent('filter-grid', { detail: '' }));
  });
  reset?.addEventListener('click', () => {
    search.value = '';
    window.dispatchEvent(new CustomEvent('filter-grid', { detail: '' }));
    search.focus();
  });
  if (document.body.dataset.page === 'search') {
    const query = new URLSearchParams(window.location.search).get('q') || '';
    search.value = query;
    updateGrid(query);
  }
  if (iso) {
    // Dimensions are fixed by aspect-ratio; a layout after load also supports
    // replacing the sample art with differently-sized production banners.
    window.addEventListener('load', () => iso.layout(), { once: true });
  }

  const slides = [...document.querySelectorAll('.hero-slide')];
  const dots = [...document.querySelectorAll('.hero-dot')];
  let currentSlide = 0;
  const showSlide = index => {
    currentSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => { slide.hidden = i !== currentSlide; });
    dots.forEach((dot, i) => { dot.setAttribute('aria-pressed', String(i === currentSlide)); });
    const active = slides[currentSlide];
    document.querySelector('[data-featured-name]').textContent = active.dataset.name;
    document.querySelector('[data-featured-venue]').textContent = active.dataset.venue;
    document.querySelector('[data-featured-date]').textContent = active.dataset.date;
    document.querySelector('[data-featured-link]').href = active.dataset.link;
    document.querySelector('[data-slide-count]').textContent = `${currentSlide + 1} of ${slides.length}`;
  };
  if (slides.length) {
    document.querySelector('[data-hero-prev]').addEventListener('click', () => showSlide(currentSlide - 1));
    document.querySelector('[data-hero-next]').addEventListener('click', () => showSlide(currentSlide + 1));
    dots.forEach((dot, i) => dot.addEventListener('click', () => showSlide(i)));
  }

  const categoryButtons = [...document.querySelectorAll('.faq-category')];
  const faqGroups = [...document.querySelectorAll('.faq-group')];
  const selectCategory = slug => {
    if (!faqGroups.some(group => group.dataset.category === slug)) return;
    categoryButtons.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.category === slug)); });
    faqGroups.forEach(group => { group.hidden = group.dataset.category !== slug; });
  };
  categoryButtons.forEach(button => button.addEventListener('click', () => {
    selectCategory(button.dataset.category);
    history.replaceState(null, '', `#${button.dataset.category}`);
  }));
  if (faqGroups.length && window.location.hash) selectCategory(window.location.hash.slice(1));
})();
