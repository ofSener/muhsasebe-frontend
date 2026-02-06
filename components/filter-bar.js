/**
 * AppComponents.FilterBar
 * Configurable filter bar with various filter types.
 *
 * Usage:
 *   var filters = AppComponents.FilterBar.create({
 *     container: '#filterArea',
 *     filters: [
 *       { type: 'search',    key: 'q',        label: 'Arama',      placeholder: 'Ara...' },
 *       { type: 'select',    key: 'sirket',    label: 'Sirket',     options: [{value:'1',label:'Allianz'}, ...] },
 *       { type: 'daterange', key: 'tarih',     label: 'Tarih Araligi' },
 *       { type: 'checkbox',  key: 'onaylandi', label: 'Sadece Onaylilar' }
 *     ],
 *     onFilter: function(values) { console.log(values); },
 *     onReset:  function() { console.log('reset'); }
 *   });
 *
 *   filters.getValues();  // { q: 'test', sirket: '1', tarih: { start: '...', end: '...' }, onaylandi: true }
 *   filters.reset();
 *   filters.destroy();
 *
 * Relies on:
 *   - components/base.js (AppComponents._utils — optional)
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
      '.ac-fb{display:flex;flex-wrap:wrap;align-items:flex-end;gap:.75rem;padding:1rem 1.25rem;background:var(--bg-surface,#1e293b);border:1px solid var(--border-subtle,rgba(99,102,241,.12));border-radius:var(--radius-lg,12px);margin-bottom:1rem;}' +
      '.ac-fb-group{display:flex;flex-direction:column;gap:.25rem;}' +
      '.ac-fb-label{font-size:.7rem;color:var(--text-muted,#94a3b8);text-transform:uppercase;letter-spacing:.5px;font-weight:600;}' +
      '.ac-fb-input,.ac-fb-select{min-width:150px;padding:.45rem .7rem;background:var(--bg-base,#0f172a);border:1px solid var(--border-default,rgba(99,102,241,.15));border-radius:var(--radius-sm,8px);color:var(--text-primary,#e2e8f0);font-size:.85rem;font-family:inherit;transition:border-color .15s,box-shadow .15s;}' +
      '.ac-fb-input:focus,.ac-fb-select:focus{outline:none;border-color:var(--primary,#6366f1);box-shadow:0 0 0 3px var(--primary-glow,rgba(99,102,241,.15));}' +
      '.ac-fb-select option{background:var(--bg-surface,#1e293b);color:var(--text-primary,#e2e8f0);}' +
      '.ac-fb-daterange{display:flex;align-items:center;gap:.35rem;}' +
      '.ac-fb-daterange input{width:120px;padding:.45rem .7rem;background:var(--bg-base,#0f172a);border:1px solid var(--border-default,rgba(99,102,241,.15));border-radius:var(--radius-sm,8px);color:var(--text-primary,#e2e8f0);font-size:.8rem;font-family:inherit;}' +
      '.ac-fb-daterange input:focus{outline:none;border-color:var(--primary,#6366f1);box-shadow:0 0 0 3px var(--primary-glow,rgba(99,102,241,.15));}' +
      '.ac-fb-daterange .ac-fb-sep{color:var(--text-muted,#94a3b8);font-size:.75rem;}' +
      '.ac-fb-checkbox{display:flex;align-items:center;gap:.4rem;padding:.45rem 0;cursor:pointer;font-size:.85rem;color:var(--text-primary,#e2e8f0);}' +
      '.ac-fb-checkbox input{accent-color:var(--primary,#6366f1);width:16px;height:16px;cursor:pointer;}' +
      '.ac-fb-actions{display:flex;align-items:flex-end;gap:.5rem;margin-left:auto;}' +
      '.ac-fb-btn{padding:.45rem .85rem;border:1px solid var(--border-default,rgba(99,102,241,.15));background:var(--bg-elevated,#0f172a);color:var(--text-secondary,#c7d2fe);border-radius:var(--radius-sm,8px);font-size:.8rem;cursor:pointer;transition:all .15s;font-family:inherit;}' +
      '.ac-fb-btn:hover{border-color:var(--primary,#6366f1);color:var(--primary,#6366f1);}' +
      '.ac-fb-btn.primary{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border-color:#6366f1;}.ac-fb-btn.primary:hover{box-shadow:0 2px 8px rgba(99,102,241,.35);}';
    document.head.appendChild(s);
  }

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
      console.warn('[FilterBar] Container not found.');
      return null;
    }

    var filterDefs = opts.filters || [];
    var onFilter = opts.onFilter || null;
    var onReset = opts.onReset || null;

    // Build DOM
    var bar = document.createElement('div');
    bar.className = 'ac-fb';

    var inputs = {}; // key -> element(s)

    for (var i = 0; i < filterDefs.length; i++) {
      var def = filterDefs[i];
      var group = document.createElement('div');
      group.className = 'ac-fb-group';

      if (def.type !== 'checkbox' && def.label) {
        var label = document.createElement('div');
        label.className = 'ac-fb-label';
        label.textContent = def.label;
        group.appendChild(label);
      }

      switch (def.type) {
        case 'search':
          var inp = document.createElement('input');
          inp.className = 'ac-fb-input';
          inp.type = 'text';
          inp.placeholder = def.placeholder || 'Ara...';
          inp.addEventListener('input', debounce(fireFilter, 300));
          group.appendChild(inp);
          inputs[def.key] = { type: 'search', el: inp };
          break;

        case 'select':
          var sel = document.createElement('select');
          sel.className = 'ac-fb-select';
          // Default option
          var defOpt = document.createElement('option');
          defOpt.value = '';
          defOpt.textContent = def.placeholder || 'Tumu';
          sel.appendChild(defOpt);
          if (def.options) {
            for (var oi = 0; oi < def.options.length; oi++) {
              var o = def.options[oi];
              var opt = document.createElement('option');
              opt.value = o.value != null ? o.value : o.label;
              opt.textContent = o.label || o.value;
              sel.appendChild(opt);
            }
          }
          sel.addEventListener('change', fireFilter);
          group.appendChild(sel);
          inputs[def.key] = { type: 'select', el: sel };
          break;

        case 'daterange':
          var dr = document.createElement('div');
          dr.className = 'ac-fb-daterange';
          var startInp = document.createElement('input');
          startInp.type = 'date';
          startInp.placeholder = 'Baslangic';
          startInp.addEventListener('change', fireFilter);
          var sep = document.createElement('span');
          sep.className = 'ac-fb-sep';
          sep.textContent = '-';
          var endInp = document.createElement('input');
          endInp.type = 'date';
          endInp.placeholder = 'Bitis';
          endInp.addEventListener('change', fireFilter);
          dr.appendChild(startInp);
          dr.appendChild(sep);
          dr.appendChild(endInp);
          group.appendChild(dr);
          inputs[def.key] = { type: 'daterange', start: startInp, end: endInp };
          break;

        case 'checkbox':
          var cbLabel = document.createElement('label');
          cbLabel.className = 'ac-fb-checkbox';
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.addEventListener('change', fireFilter);
          cbLabel.appendChild(cb);
          cbLabel.appendChild(document.createTextNode(' ' + (def.label || '')));
          group.appendChild(cbLabel);
          inputs[def.key] = { type: 'checkbox', el: cb };
          break;
      }

      bar.appendChild(group);
    }

    // Action buttons
    var actions = document.createElement('div');
    actions.className = 'ac-fb-actions';

    var resetBtn = document.createElement('button');
    resetBtn.className = 'ac-fb-btn';
    resetBtn.type = 'button';
    resetBtn.textContent = 'Sifirla';
    resetBtn.addEventListener('click', function() {
      resetAll();
      if (typeof onReset === 'function') onReset();
      fireFilter();
    });
    actions.appendChild(resetBtn);

    bar.appendChild(actions);
    container.appendChild(bar);

    // ---------------------------------------------------------------
    // Get values
    // ---------------------------------------------------------------

    function getValues() {
      var vals = {};
      var keys = Object.keys(inputs);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var entry = inputs[key];
        switch (entry.type) {
          case 'search':
          case 'select':
            vals[key] = entry.el.value;
            break;
          case 'daterange':
            vals[key] = {
              start: entry.start.value || '',
              end: entry.end.value || ''
            };
            break;
          case 'checkbox':
            vals[key] = entry.el.checked;
            break;
        }
      }
      return vals;
    }

    // ---------------------------------------------------------------
    // Reset
    // ---------------------------------------------------------------

    function resetAll() {
      var keys = Object.keys(inputs);
      for (var k = 0; k < keys.length; k++) {
        var entry = inputs[keys[k]];
        switch (entry.type) {
          case 'search':
            entry.el.value = '';
            break;
          case 'select':
            entry.el.selectedIndex = 0;
            break;
          case 'daterange':
            entry.start.value = '';
            entry.end.value = '';
            break;
          case 'checkbox':
            entry.el.checked = false;
            break;
        }
      }
    }

    // ---------------------------------------------------------------
    // Fire filter callback
    // ---------------------------------------------------------------

    function fireFilter() {
      if (typeof onFilter === 'function') {
        onFilter(getValues());
      }
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function debounce(fn, delay) {
      var timer;
      return function() {
        var ctx = this, args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
      };
    }

    // ---------------------------------------------------------------
    // Instance API
    // ---------------------------------------------------------------

    return {
      getValues: getValues,
      reset: function() {
        resetAll();
        fireFilter();
      },
      destroy: function() {
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      }
    };
  }

  // ---------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------

  AppComponents.FilterBar = {
    create: create
  };

})();
