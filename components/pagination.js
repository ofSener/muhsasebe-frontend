/**
 * AppComponents.Pagination
 * Standalone pagination component.
 *
 * Usage:
 *   var pager = AppComponents.Pagination.create({
 *     container: '#myPagination',   // selector or element
 *     totalItems: 247,
 *     pageSize: 20,
 *     currentPage: 1,
 *     maxVisiblePages: 5,
 *     onPageChange: function(page) { ... }
 *   });
 *
 *   pager.update({ totalItems: 300, currentPage: 3 });
 *   pager.destroy();
 *
 * Relies on: components/base.js (AppComponents._utils — optional)
 */

(function() {
  'use strict';

  window.AppComponents = window.AppComponents || {};

  // ---------------------------------------------------------------
  // CSS injection (one-time)
  // ---------------------------------------------------------------

  var cssInjected = false;

  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var s = document.createElement('style');
    s.textContent =
      '.ac-pagination{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;padding:.75rem 0;font-size:.8rem;color:var(--text-muted,#94a3b8);}' +
      '.ac-pagination-info{white-space:nowrap;}' +
      '.ac-pagination-nav{display:flex;align-items:center;gap:.25rem;}' +
      '.ac-page-btn{min-width:32px;height:32px;padding:0 .5rem;display:flex;align-items:center;justify-content:center;border:1px solid var(--border-color,rgba(99,102,241,.15));background:var(--bg-elevated,#1e293b);color:var(--text-secondary,#c7d2fe);border-radius:8px;cursor:pointer;font-size:.8rem;transition:all .15s ease;font-family:inherit;}' +
      '.ac-page-btn:hover:not(:disabled):not(.active){background:var(--primary-glow,rgba(99,102,241,.15));color:var(--primary,#6366f1);border-color:var(--primary,#6366f1);}' +
      '.ac-page-btn.active{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border-color:#6366f1;font-weight:600;box-shadow:0 2px 8px rgba(99,102,241,.35);}' +
      '.ac-page-btn:disabled{opacity:.35;cursor:not-allowed;}' +
      '.ac-page-btn svg{width:16px;height:16px;}' +
      '.ac-page-ellipsis{padding:0 .25rem;color:var(--text-muted,#94a3b8);user-select:none;}';
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------
  // Arrow SVGs
  // ---------------------------------------------------------------

  var SVG_FIRST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="11,17 6,12 11,7"/><polyline points="18,17 13,12 18,7"/></svg>';
  var SVG_PREV  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>';
  var SVG_NEXT  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>';
  var SVG_LAST  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13,7 18,12 13,17"/><polyline points="6,7 11,12 6,17"/></svg>';

  // ---------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------

  function create(opts) {
    if (!opts) opts = {};
    injectCSS();

    var container = typeof opts.container === 'string'
      ? document.querySelector(opts.container)
      : opts.container;

    if (!container) {
      console.warn('[Pagination] Container not found.');
      return null;
    }

    var state = {
      totalItems: opts.totalItems || 0,
      pageSize: opts.pageSize || 20,
      currentPage: opts.currentPage || 1,
      maxVisible: opts.maxVisiblePages || 5,
      onPageChange: opts.onPageChange || null
    };

    var wrapperEl = document.createElement('div');
    wrapperEl.className = 'ac-pagination';
    container.appendChild(wrapperEl);

    function totalPages() {
      return Math.max(1, Math.ceil(state.totalItems / state.pageSize));
    }

    function goToPage(page) {
      var tp = totalPages();
      page = Math.max(1, Math.min(page, tp));
      if (page === state.currentPage) return;
      state.currentPage = page;
      render();
      if (typeof state.onPageChange === 'function') {
        state.onPageChange(page);
      }
    }

    function render() {
      var tp = totalPages();
      // Clamp
      if (state.currentPage > tp) state.currentPage = tp;
      if (state.currentPage < 1) state.currentPage = 1;

      var startItem = state.totalItems === 0 ? 0 : (state.currentPage - 1) * state.pageSize + 1;
      var endItem = Math.min(state.currentPage * state.pageSize, state.totalItems);

      // Info text
      var infoText = state.totalItems === 0
        ? 'Kayit bulunamadi'
        : startItem + '-' + endItem + ' / ' + state.totalItems + ' kayit';

      // Build page numbers
      var pages = getVisiblePages(state.currentPage, tp, state.maxVisible);

      var html = '<div class="ac-pagination-info">' + infoText + '</div>';
      html += '<div class="ac-pagination-nav">';

      // First & Prev
      html += btn(SVG_FIRST, 'first', state.currentPage <= 1);
      html += btn(SVG_PREV, 'prev', state.currentPage <= 1);

      // Page numbers
      for (var i = 0; i < pages.length; i++) {
        var p = pages[i];
        if (p === '...') {
          html += '<span class="ac-page-ellipsis">...</span>';
        } else {
          html += '<button class="ac-page-btn' + (p === state.currentPage ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
        }
      }

      // Next & Last
      html += btn(SVG_NEXT, 'next', state.currentPage >= tp);
      html += btn(SVG_LAST, 'last', state.currentPage >= tp);

      html += '</div>';

      wrapperEl.innerHTML = html;

      // Bind clicks
      var buttons = wrapperEl.querySelectorAll('.ac-page-btn[data-page]');
      for (var j = 0; j < buttons.length; j++) {
        buttons[j].addEventListener('click', onPageClick);
      }
      var navBtns = wrapperEl.querySelectorAll('.ac-page-btn[data-action]');
      for (var k = 0; k < navBtns.length; k++) {
        navBtns[k].addEventListener('click', onNavClick);
      }
    }

    function btn(svg, action, disabled) {
      return '<button class="ac-page-btn" data-action="' + action + '"' + (disabled ? ' disabled' : '') + '>' + svg + '</button>';
    }

    function onPageClick(e) {
      var page = parseInt(e.currentTarget.getAttribute('data-page'), 10);
      if (!isNaN(page)) goToPage(page);
    }

    function onNavClick(e) {
      var action = e.currentTarget.getAttribute('data-action');
      var tp = totalPages();
      switch (action) {
        case 'first': goToPage(1); break;
        case 'prev':  goToPage(state.currentPage - 1); break;
        case 'next':  goToPage(state.currentPage + 1); break;
        case 'last':  goToPage(tp); break;
      }
    }

    // Initial render
    render();

    // ---------------------------------------------------------------
    // Instance API
    // ---------------------------------------------------------------

    return {
      update: function(newOpts) {
        if (newOpts.totalItems !== undefined) state.totalItems = newOpts.totalItems;
        if (newOpts.currentPage !== undefined) state.currentPage = newOpts.currentPage;
        if (newOpts.pageSize !== undefined) state.pageSize = newOpts.pageSize;
        render();
      },
      getPage: function() { return state.currentPage; },
      destroy: function() {
        if (wrapperEl.parentNode) wrapperEl.parentNode.removeChild(wrapperEl);
      }
    };
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------

  function getVisiblePages(current, total, maxVisible) {
    if (total <= maxVisible + 2) {
      // Show all
      var all = [];
      for (var i = 1; i <= total; i++) all.push(i);
      return all;
    }

    var pages = [];
    var half = Math.floor(maxVisible / 2);
    var start = Math.max(2, current - half);
    var end = Math.min(total - 1, current + half);

    // Adjust range
    if (current - half < 2) {
      end = Math.min(total - 1, end + (2 - (current - half)));
    }
    if (current + half > total - 1) {
      start = Math.max(2, start - (current + half - (total - 1)));
    }

    pages.push(1);
    if (start > 2) pages.push('...');
    for (var j = start; j <= end; j++) pages.push(j);
    if (end < total - 1) pages.push('...');
    if (total > 1) pages.push(total);

    return pages;
  }

  // ---------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------

  AppComponents.Pagination = {
    create: create
  };

})();
