/**
 * AppComponents.DataTable
 * Configurable data table with sorting, pagination, search, and selection.
 *
 * Usage:
 *   var table = AppComponents.DataTable.create({
 *     container: '#tableContainer',
 *     columns: [
 *       { key: 'name',   label: 'Musteri',    sortable: true },
 *       { key: 'prim',   label: 'Brut Prim',  sortable: true, format: 'currency' },
 *       { key: 'tarih',  label: 'Tarih',       sortable: true, format: 'date' },
 *       { key: 'oran',   label: 'Oran',        format: 'percent' },
 *       { key: 'islem',  label: 'Islem',       render: function(val, row) { return '<button>Detay</button>'; } }
 *     ],
 *     data: [ ... ],
 *     pageSize: 20,
 *     searchable: true,
 *     selectable: true,
 *     emptyMessage: 'Kayit bulunamadi.',
 *     onSort:       function(key, dir) {},
 *     onPageChange: function(page) {},
 *     onSelect:     function(selectedRows) {}
 *   });
 *
 *   table.updateData(newData);
 *   table.getSelected();
 *   table.setPage(3);
 *   table.destroy();
 *
 * Relies on:
 *   - components/base.js   (AppComponents._utils)
 *   - components/pagination.js (AppComponents.Pagination) — optional, falls back to built-in
 */

(function() {
  'use strict';

  window.AppComponents = window.AppComponents || {};

  var u = AppComponents._utils || {};

  // ---------------------------------------------------------------
  // CSS injection (one-time)
  // ---------------------------------------------------------------

  var cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var s = document.createElement('style');
    s.textContent =
      '.ac-dt-wrapper{background:var(--bg-card,#1e293b);border:1px solid var(--border-color,rgba(99,102,241,.15));border-radius:12px;overflow:hidden;}' +
      '.ac-dt-toolbar{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;border-bottom:1px solid var(--border-color,rgba(99,102,241,.12));gap:.75rem;flex-wrap:wrap;}' +
      '.ac-dt-search{display:flex;align-items:center;gap:.5rem;padding:.4rem .75rem;background:var(--bg-elevated,#0f172a);border:1px solid var(--border-color,rgba(99,102,241,.15));border-radius:8px;min-width:200px;}' +
      '.ac-dt-search svg{width:16px;height:16px;color:var(--text-muted,#94a3b8);flex-shrink:0;}' +
      '.ac-dt-search input{border:none;background:transparent;font-size:.8rem;color:var(--text-primary,#e2e8f0);width:100%;outline:none;font-family:inherit;}' +
      '.ac-dt-search input::placeholder{color:var(--text-muted,#94a3b8);}' +
      '.ac-dt-selected-info{font-size:.8rem;color:var(--primary,#6366f1);font-weight:500;}' +
      '.ac-dt-table-wrap{overflow-x:auto;}' +
      '.ac-dt-table{width:100%;border-collapse:collapse;font-size:.8rem;}' +
      '.ac-dt-table th{padding:.6rem .75rem;text-align:left;font-weight:600;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted,#94a3b8);background:var(--bg-elevated,#0f172a);border-bottom:1px solid var(--border-color,rgba(99,102,241,.12));white-space:nowrap;user-select:none;}' +
      '.ac-dt-table th.sortable{cursor:pointer;transition:color .15s;}.ac-dt-table th.sortable:hover{color:var(--text-primary,#e2e8f0);}' +
      '.ac-dt-table th .sort-icon{display:inline-block;vertical-align:middle;margin-left:4px;opacity:.4;transition:opacity .15s;}' +
      '.ac-dt-table th.asc .sort-icon,.ac-dt-table th.desc .sort-icon{opacity:1;color:var(--primary,#6366f1);}' +
      '.ac-dt-table td{padding:.6rem .75rem;border-bottom:1px solid var(--border-color,rgba(99,102,241,.08));color:var(--text-secondary,#c7d2fe);vertical-align:middle;}' +
      '.ac-dt-table tbody tr{transition:background .12s;}.ac-dt-table tbody tr:hover{background:var(--bg-elevated,rgba(99,102,241,.05));}' +
      '.ac-dt-table tbody tr.selected{background:var(--primary-glow,rgba(99,102,241,.12));}' +
      '.ac-dt-table input[type="checkbox"]{width:16px;height:16px;accent-color:var(--primary,#6366f1);cursor:pointer;}' +
      '.ac-dt-empty{padding:3rem 1rem;text-align:center;color:var(--text-muted,#94a3b8);font-size:.9rem;}' +
      '.ac-dt-empty svg{width:48px;height:48px;margin-bottom:.75rem;opacity:.3;}' +
      '.ac-dt-loading{padding:3rem 1rem;text-align:center;color:var(--text-muted,#94a3b8);font-size:.85rem;}' +
      '.ac-dt-footer{padding:.75rem 1rem;border-top:1px solid var(--border-color,rgba(99,102,241,.12));}' +
      '.ac-dt-currency{font-family:"SF Mono","Fira Code",monospace;font-weight:500;white-space:nowrap;}' +
      '.ac-dt-date{white-space:nowrap;}';
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------
  // Sort icons
  // ---------------------------------------------------------------

  var SORT_SVG = '<svg class="sort-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>';
  var SEARCH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';

  // ---------------------------------------------------------------
  // Formatters
  // ---------------------------------------------------------------

  var formatters = {
    currency: function(val) {
      if (val == null || isNaN(val)) return '0,00 TL';
      if (u.formatCurrency) return u.formatCurrency(val);
      try {
        return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' TL';
      } catch (_) { return val + ' TL'; }
    },
    date: function(val) {
      if (!val) return '-';
      if (u.formatDate) return u.formatDate(val);
      var d = new Date(val);
      if (isNaN(d.getTime())) return '-';
      return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
    },
    percent: function(val) {
      if (val == null || isNaN(val)) return '%0';
      if (u.formatPercent) return u.formatPercent(val);
      return '%' + Number(val).toFixed(1).replace('.', ',');
    }
  };

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
      console.warn('[DataTable] Container not found.');
      return null;
    }

    // -- State --
    var allData = opts.data ? opts.data.slice() : [];
    var filteredData = allData;
    var columns = opts.columns || [];
    var pageSize = opts.pageSize || 20;
    var currentPage = 1;
    var sortKey = null;
    var sortDir = null; // 'asc' | 'desc'
    var searchTerm = '';
    var selected = {}; // row index -> true
    var isLoading = false;

    var searchable = opts.searchable !== false;
    var selectable = opts.selectable === true;
    var emptyMessage = opts.emptyMessage || 'Kayit bulunamadi.';

    // -- Build DOM --
    var wrapper = document.createElement('div');
    wrapper.className = 'ac-dt-wrapper';

    // Toolbar
    var toolbar = null;
    if (searchable || selectable) {
      toolbar = document.createElement('div');
      toolbar.className = 'ac-dt-toolbar';
      wrapper.appendChild(toolbar);
    }

    // Table area
    var tableWrap = document.createElement('div');
    tableWrap.className = 'ac-dt-table-wrap';
    wrapper.appendChild(tableWrap);

    // Footer (pagination)
    var footer = document.createElement('div');
    footer.className = 'ac-dt-footer';
    wrapper.appendChild(footer);

    container.appendChild(wrapper);

    // Pagination instance
    var pager = null;

    // ---------------------------------------------------------------
    // Search
    // ---------------------------------------------------------------

    var searchInput = null;
    var selectedInfo = null;

    function buildToolbar() {
      if (!toolbar) return;
      toolbar.innerHTML = '';

      if (searchable) {
        var searchBox = document.createElement('div');
        searchBox.className = 'ac-dt-search';
        searchBox.innerHTML = SEARCH_SVG;
        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Ara...';
        searchInput.addEventListener('input', debounce(function() {
          searchTerm = searchInput.value.trim().toLowerCase();
          applyFilters();
        }, 250));
        searchBox.appendChild(searchInput);
        toolbar.appendChild(searchBox);
      }

      if (selectable) {
        selectedInfo = document.createElement('div');
        selectedInfo.className = 'ac-dt-selected-info';
        toolbar.appendChild(selectedInfo);
      }
    }

    // ---------------------------------------------------------------
    // Filtering / Sorting
    // ---------------------------------------------------------------

    function applyFilters() {
      // Search filter
      if (searchTerm) {
        filteredData = allData.filter(function(row) {
          for (var i = 0; i < columns.length; i++) {
            var val = row[columns[i].key];
            if (val != null && String(val).toLowerCase().indexOf(searchTerm) !== -1) {
              return true;
            }
          }
          return false;
        });
      } else {
        filteredData = allData.slice();
      }

      // Sort
      if (sortKey) {
        var dir = sortDir === 'desc' ? -1 : 1;
        filteredData.sort(function(a, b) {
          var va = a[sortKey], vb = b[sortKey];
          if (va == null) va = '';
          if (vb == null) vb = '';
          if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
          return String(va).localeCompare(String(vb), 'tr') * dir;
        });
      }

      // Reset to page 1
      currentPage = 1;
      selected = {};
      render();
    }

    // ---------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------

    function render() {
      renderTable();
      renderPagination();
      updateSelectedInfo();
    }

    function renderTable() {
      var total = filteredData.length;
      var start = (currentPage - 1) * pageSize;
      var end = Math.min(start + pageSize, total);
      var pageData = filteredData.slice(start, end);

      if (isLoading) {
        tableWrap.innerHTML = '<div class="ac-dt-loading">Yukleniyor...</div>';
        return;
      }

      if (total === 0) {
        tableWrap.innerHTML =
          '<div class="ac-dt-empty">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
            '<div>' + escapeText(emptyMessage) + '</div>' +
          '</div>';
        return;
      }

      var html = '<table class="ac-dt-table"><thead><tr>';

      // Select-all checkbox
      if (selectable) {
        html += '<th style="width:40px;"><input type="checkbox" class="ac-dt-select-all"></th>';
      }

      // Column headers
      for (var c = 0; c < columns.length; c++) {
        var col = columns[c];
        var cls = '';
        var sortIndicator = '';
        if (col.sortable) {
          cls = 'sortable';
          if (sortKey === col.key) {
            cls += ' ' + sortDir;
          }
          sortIndicator = SORT_SVG;
        }
        var widthStyle = col.width ? ' style="width:' + col.width + ';"' : '';
        html += '<th class="' + cls + '" data-col-key="' + col.key + '"' + widthStyle + '>' +
          escapeText(col.label || col.key) + sortIndicator + '</th>';
      }
      html += '</tr></thead><tbody>';

      // Rows
      for (var r = 0; r < pageData.length; r++) {
        var row = pageData[r];
        var globalIdx = start + r;
        var rowClass = selected[globalIdx] ? ' class="selected"' : '';
        html += '<tr data-idx="' + globalIdx + '"' + rowClass + '>';

        if (selectable) {
          html += '<td><input type="checkbox"' + (selected[globalIdx] ? ' checked' : '') + '></td>';
        }

        for (var ci = 0; ci < columns.length; ci++) {
          var column = columns[ci];
          var value = row[column.key];
          var cellHtml;

          if (typeof column.render === 'function') {
            cellHtml = column.render(value, row, globalIdx);
          } else if (column.format && formatters[column.format]) {
            cellHtml = formatters[column.format](value);
            if (column.format === 'currency') {
              cellHtml = '<span class="ac-dt-currency">' + cellHtml + '</span>';
            } else if (column.format === 'date') {
              cellHtml = '<span class="ac-dt-date">' + cellHtml + '</span>';
            }
          } else {
            cellHtml = value != null ? escapeText(String(value)) : '-';
          }

          html += '<td>' + cellHtml + '</td>';
        }

        html += '</tr>';
      }

      html += '</tbody></table>';
      tableWrap.innerHTML = html;

      // Bind events
      bindTableEvents();
    }

    function renderPagination() {
      footer.innerHTML = '';

      if (filteredData.length <= pageSize) {
        // Single page — still show info
        var infoOnly = document.createElement('div');
        infoOnly.style.fontSize = '.8rem';
        infoOnly.style.color = 'var(--text-muted, #94a3b8)';
        infoOnly.textContent = filteredData.length === 0
          ? 'Kayit bulunamadi'
          : 'Toplam ' + filteredData.length + ' kayit';
        footer.appendChild(infoOnly);
        return;
      }

      if (AppComponents.Pagination) {
        if (pager) pager.destroy();
        pager = AppComponents.Pagination.create({
          container: footer,
          totalItems: filteredData.length,
          pageSize: pageSize,
          currentPage: currentPage,
          onPageChange: function(page) {
            currentPage = page;
            selected = {};
            renderTable();
            updateSelectedInfo();
            if (typeof opts.onPageChange === 'function') opts.onPageChange(page);
          }
        });
      } else {
        // Basic info text
        var total = filteredData.length;
        var start = (currentPage - 1) * pageSize + 1;
        var end = Math.min(currentPage * pageSize, total);
        footer.innerHTML = '<div style="font-size:.8rem;color:var(--text-muted,#94a3b8);">' +
          start + '-' + end + ' / ' + total + ' kayit</div>';
      }
    }

    // ---------------------------------------------------------------
    // Table events
    // ---------------------------------------------------------------

    function bindTableEvents() {
      var table = tableWrap.querySelector('.ac-dt-table');
      if (!table) return;

      // Sort
      var headers = table.querySelectorAll('th.sortable');
      for (var h = 0; h < headers.length; h++) {
        headers[h].addEventListener('click', onSortClick);
      }

      // Select all
      var selectAllCb = table.querySelector('.ac-dt-select-all');
      if (selectAllCb) {
        selectAllCb.addEventListener('change', function() {
          var checked = selectAllCb.checked;
          var start = (currentPage - 1) * pageSize;
          var end = Math.min(start + pageSize, filteredData.length);
          for (var i = start; i < end; i++) {
            if (checked) selected[i] = true;
            else delete selected[i];
          }
          renderTable();
          updateSelectedInfo();
          fireSelectCallback();
        });
      }

      // Row click / checkbox
      if (selectable) {
        var rows = table.querySelectorAll('tbody tr');
        for (var ri = 0; ri < rows.length; ri++) {
          rows[ri].addEventListener('click', onRowClick);
        }
      }
    }

    function onSortClick(e) {
      var key = e.currentTarget.getAttribute('data-col-key');
      if (sortKey === key) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey = key;
        sortDir = 'asc';
      }
      applyFilters();
      if (typeof opts.onSort === 'function') opts.onSort(sortKey, sortDir);
    }

    function onRowClick(e) {
      // Don't toggle if clicking on interactive elements (links, buttons) other than checkbox
      var tag = e.target.tagName.toLowerCase();
      if (tag === 'a' || tag === 'button') return;

      var idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
      if (isNaN(idx)) return;

      if (selected[idx]) {
        delete selected[idx];
      } else {
        selected[idx] = true;
      }
      renderTable();
      updateSelectedInfo();
      fireSelectCallback();
    }

    function updateSelectedInfo() {
      if (!selectedInfo) return;
      var count = Object.keys(selected).length;
      selectedInfo.textContent = count > 0 ? count + ' secili' : '';
    }

    function fireSelectCallback() {
      if (typeof opts.onSelect !== 'function') return;
      opts.onSelect(getSelectedRows());
    }

    function getSelectedRows() {
      var rows = [];
      var keys = Object.keys(selected);
      for (var i = 0; i < keys.length; i++) {
        var idx = parseInt(keys[i], 10);
        if (filteredData[idx]) rows.push(filteredData[idx]);
      }
      return rows;
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function escapeText(str) {
      if (!str) return '';
      var d = document.createElement('div');
      d.appendChild(document.createTextNode(str));
      return d.innerHTML;
    }

    function debounce(fn, delay) {
      var timer;
      return function() {
        var ctx = this, args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
      };
    }

    // ---------------------------------------------------------------
    // Initial build
    // ---------------------------------------------------------------

    buildToolbar();
    render();

    // ---------------------------------------------------------------
    // Instance API
    // ---------------------------------------------------------------

    return {
      updateData: function(data) {
        allData = data ? data.slice() : [];
        searchTerm = '';
        sortKey = null;
        sortDir = null;
        selected = {};
        if (searchInput) searchInput.value = '';
        filteredData = allData;
        currentPage = 1;
        render();
      },
      getSelected: function() {
        return getSelectedRows();
      },
      setPage: function(n) {
        var tp = Math.max(1, Math.ceil(filteredData.length / pageSize));
        currentPage = Math.max(1, Math.min(n, tp));
        selected = {};
        render();
      },
      setLoading: function(loading) {
        isLoading = !!loading;
        render();
      },
      destroy: function() {
        if (pager) pager.destroy();
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      }
    };
  }

  // ---------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------

  AppComponents.DataTable = {
    create: create
  };

})();
