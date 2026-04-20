/* =========================================================
   Termpolis docs — sidebar highlighting + client search
   No build step. Pure vanilla JS.
   ========================================================= */

(function () {
  var sections = Array.prototype.slice.call(document.querySelectorAll('.docs-section'));
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.docs-toc a'));
  var searchInput = document.getElementById('docs-search-input');
  var sidebarGroups = Array.prototype.slice.call(document.querySelectorAll('.docs-sidebar-eyebrow'));

  // Map section-id -> toc link for O(1) highlight updates.
  var tocById = {};
  tocLinks.forEach(function (link) {
    var href = link.getAttribute('href') || '';
    var id = href.indexOf('#') === 0 ? href.slice(1) : '';
    if (id) tocById[id] = link;
  });

  // ---- Scroll spy -----------------------------------------

  function setActive(id) {
    tocLinks.forEach(function (l) { l.classList.remove('is-active'); });
    var link = tocById[id];
    if (link) link.classList.add('is-active');
  }

  if ('IntersectionObserver' in window) {
    var visible = {};
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          visible[e.target.id] = e.isIntersecting;
        });
        // Pick the earliest visible section in DOM order.
        for (var i = 0; i < sections.length; i++) {
          if (visible[sections[i].id]) {
            setActive(sections[i].id);
            return;
          }
        }
      },
      { rootMargin: '-28% 0px -60% 0px', threshold: 0 }
    );
    sections.forEach(function (s) { obs.observe(s); });
  }

  // ---- Client-side search --------------------------------

  // Pre-index each section's text so filtering is fast.
  var index = sections.map(function (s) {
    return {
      id: s.id,
      el: s,
      text: (s.textContent || '').toLowerCase(),
      heading: (s.querySelector('h2') || {}).textContent || ''
    };
  });

  function getEmptyNode() {
    var node = document.getElementById('docs-search-empty');
    if (!node) {
      node = document.createElement('div');
      node.id = 'docs-search-empty';
      node.className = 'docs-search-empty';
      node.textContent = 'No sections match your search.';
      var container = document.getElementById('docs-content');
      if (container) container.appendChild(node);
    }
    return node;
  }

  function clearFilter() {
    index.forEach(function (entry) { entry.el.classList.remove('is-hidden'); });
    tocLinks.forEach(function (l) { l.classList.remove('is-hidden'); });
    sidebarGroups.forEach(function (g) { g.classList.remove('is-hidden'); });
    var empty = document.getElementById('docs-search-empty');
    if (empty) empty.remove();
  }

  function runFilter(q) {
    if (!q) { clearFilter(); return; }
    var query = q.toLowerCase().trim();
    if (!query) { clearFilter(); return; }

    var anyMatch = false;
    var matchedIds = {};
    index.forEach(function (entry) {
      var matches = entry.text.indexOf(query) !== -1;
      if (matches) { matchedIds[entry.id] = true; anyMatch = true; }
      entry.el.classList.toggle('is-hidden', !matches);
    });

    tocLinks.forEach(function (l) {
      var href = l.getAttribute('href') || '';
      var id = href.indexOf('#') === 0 ? href.slice(1) : '';
      var shouldHide = id && !matchedIds[id];
      l.classList.toggle('is-hidden', !!shouldHide);
    });

    // Hide sidebar-group eyebrows whose items are all hidden.
    sidebarGroups.forEach(function (eyebrow) {
      var list = eyebrow.nextElementSibling;
      if (!list) return;
      var items = list.querySelectorAll('a');
      var anyVisible = false;
      for (var i = 0; i < items.length; i++) {
        if (!items[i].classList.contains('is-hidden')) { anyVisible = true; break; }
      }
      eyebrow.classList.toggle('is-hidden', !anyVisible);
    });

    var empty = document.getElementById('docs-search-empty');
    if (!anyMatch) {
      getEmptyNode();
    } else if (empty) {
      empty.remove();
    }
  }

  if (searchInput) {
    var timer = null;
    searchInput.addEventListener('input', function () {
      if (timer) clearTimeout(timer);
      var val = searchInput.value;
      timer = setTimeout(function () { runFilter(val); }, 120);
    });
    // '/' focuses the search unless a field is already focused.
    window.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== searchInput) {
        var tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          searchInput.focus();
        }
      }
      if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        clearFilter();
        searchInput.blur();
      }
    });
  }
})();
