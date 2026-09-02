(function () {
  'use strict';

  var STORAGE_KEY = 'sp_sidebar_collapsed';

  function $(id) { return document.getElementById(id); }

  function isCollapsed() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; }
    catch (e) { return false; }
  }

  function setCollapsed(on) {
    document.body.classList.toggle('sb-collapsed', !!on);
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (e) {}
    var btn = $('sbToggle');
    if (btn) btn.textContent = on ? '»' : '«';
    btn && btn.setAttribute('title', on ? 'ขยายเมนู' : 'ย่อเมนู');
  }

  function currentPage() {
    var path = (window.location.pathname || '').split('/').pop() || 'index.html';
    if (!path || path === '') path = 'index.html';
    return path.toLowerCase();
  }

  function markActive() {
    var page = currentPage();
    var hash = (window.location.hash || '').toLowerCase();
    document.querySelectorAll('.app-sidebar .sb-link[data-page]').forEach(function (a) {
      var pages = (a.getAttribute('data-page') || '').split(',');
      var active = pages.indexOf(page) !== -1;
      if (page === 'index.html' && hash === '#products' && pages.indexOf('products') !== -1) {
        active = true;
      }
      // if on index with #products, prefer products link
      if (page === 'index.html' && !hash && pages.indexOf('index.html') !== -1 && pages.length === 1) {
        active = true;
      }
      if (page === 'index.html' && hash === '#products') {
        active = pages.indexOf('products') !== -1;
      }
      if (page === 'index.html' && hash === '#about') {
        active = pages.indexOf('about') !== -1;
      }
      a.classList.toggle('active', active);
    });
  }

  function updateCartBadge() {
    var el = $('sbCartBadge');
    if (!el) return;
    var n = 0;
    try {
      if (typeof getCartCount === 'function') n = getCartCount();
      else {
        var cart = JSON.parse(localStorage.getItem('sp_furniture_cart') || '[]');
        n = cart.reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
      }
    } catch (e) {}
    el.textContent = n > 0 ? String(n) : '';
    el.style.display = n > 0 ? 'flex' : 'none';
  }

  function bindSearch() {
    var input = $('sbSearch');
    if (!input) return;
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var q = (input.value || '').trim();
      var page = currentPage();
      if (page === 'index.html') {
        var mainSearch = document.getElementById('productSearch');
        if (mainSearch) {
          mainSearch.value = q;
          if (typeof onProductSearch === 'function') onProductSearch(q);
          var sec = document.getElementById('products');
          if (sec) sec.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        window.location.href = 'index.html#products';
        try { sessionStorage.setItem('sp_product_search', q); } catch (ex) {}
      }
    });
  }

  function applyPendingSearch() {
    try {
      var q = sessionStorage.getItem('sp_product_search');
      if (!q) return;
      sessionStorage.removeItem('sp_product_search');
      var mainSearch = document.getElementById('productSearch');
      if (mainSearch) {
        mainSearch.value = q;
        if (typeof onProductSearch === 'function') onProductSearch(q);
      }
    } catch (e) {}
  }

  function init() {
    if (!$('appSidebar')) return;
    document.body.classList.add('has-sidebar');
    setCollapsed(isCollapsed());
    markActive();
    updateCartBadge();
    bindSearch();
    applyPendingSearch();

    var toggle = $('sbToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        if (window.innerWidth <= 900) {
          document.body.classList.remove('sb-mobile-open');
          return;
        }
        setCollapsed(!document.body.classList.contains('sb-collapsed'));
      });
    }

    var mobileBtn = $('sbMobileBtn');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', function () {
        document.body.classList.toggle('sb-mobile-open');
      });
    }
    var overlay = $('sbOverlay');
    if (overlay) {
      overlay.addEventListener('click', function () {
        document.body.classList.remove('sb-mobile-open');
      });
    }

    // refresh badge when cart changes
    setInterval(updateCartBadge, 2000);
    window.addEventListener('hashchange', markActive);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SPSidebar = { updateCartBadge: updateCartBadge, markActive: markActive };
})();
