/**
 * AppComponents - Base Utilities
 * Shared utilities for the component system.
 * All components register under window.AppComponents namespace.
 */

(function() {
  'use strict';

  // Initialize namespace
  window.AppComponents = window.AppComponents || {};

  // ---------------------------------------------------------------
  // DOM Helpers
  // ---------------------------------------------------------------

  /**
   * Create an element with optional attributes and children.
   * @param {string} tag - HTML tag name
   * @param {Object} [attrs] - Attribute map (class, id, style, data-*, etc.)
   * @param {Array|string|HTMLElement} [children] - Child nodes or text
   * @returns {HTMLElement}
   */
  function createElement(tag, attrs, children) {
    var el = document.createElement(tag);

    if (attrs) {
      Object.keys(attrs).forEach(function(key) {
        if (key === 'className') {
          el.className = attrs[key];
        } else if (key === 'style' && typeof attrs[key] === 'object') {
          Object.assign(el.style, attrs[key]);
        } else if (key.indexOf('on') === 0) {
          // Event listeners: onClick -> click
          var event = key.substring(2).toLowerCase();
          el.addEventListener(event, attrs[key]);
        } else if (key === 'html') {
          el.innerHTML = attrs[key];
        } else {
          el.setAttribute(key, attrs[key]);
        }
      });
    }

    if (children !== undefined && children !== null) {
      if (Array.isArray(children)) {
        children.forEach(function(child) {
          if (child == null) return;
          if (typeof child === 'string' || typeof child === 'number') {
            el.appendChild(document.createTextNode(child));
          } else {
            el.appendChild(child);
          }
        });
      } else if (typeof children === 'string' || typeof children === 'number') {
        el.appendChild(document.createTextNode(children));
      } else {
        el.appendChild(children);
      }
    }

    return el;
  }

  /**
   * querySelector shorthand (scoped)
   * @param {string} selector
   * @param {HTMLElement} [scope=document]
   * @returns {HTMLElement|null}
   */
  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  /**
   * querySelectorAll shorthand (scoped), returns real Array
   * @param {string} selector
   * @param {HTMLElement} [scope=document]
   * @returns {HTMLElement[]}
   */
  function qsa(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  // ---------------------------------------------------------------
  // Template Helper
  // ---------------------------------------------------------------

  /**
   * Simple template interpolation.
   * Replaces {{key}} tokens with values from a data object.
   * Values are HTML-escaped by default; use {{{key}}} for raw.
   * @param {string} tpl
   * @param {Object} data
   * @returns {string}
   */
  function template(tpl, data) {
    if (!data) return tpl;
    // Raw (unescaped) first
    var result = tpl.replace(/\{\{\{(\w+)\}\}\}/g, function(_, key) {
      return data[key] != null ? String(data[key]) : '';
    });
    // Escaped
    result = result.replace(/\{\{(\w+)\}\}/g, function(_, key) {
      return data[key] != null ? escapeHtml(String(data[key])) : '';
    });
    return result;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ---------------------------------------------------------------
  // Event Delegation
  // ---------------------------------------------------------------

  /**
   * Attach a delegated event listener.
   * @param {HTMLElement} root - Container element
   * @param {string} eventType - e.g. 'click'
   * @param {string} selector - CSS selector to match target
   * @param {Function} handler - Receives (event, matchedElement)
   * @returns {Function} remove listener function
   */
  function delegate(root, eventType, selector, handler) {
    function listener(e) {
      var target = e.target;
      while (target && target !== root) {
        if (target.matches && target.matches(selector)) {
          handler.call(target, e, target);
          return;
        }
        target = target.parentNode;
      }
    }
    root.addEventListener(eventType, listener);
    return function() {
      root.removeEventListener(eventType, listener);
    };
  }

  // ---------------------------------------------------------------
  // Formatting Utilities (Turkish locale)
  // ---------------------------------------------------------------

  /**
   * Format number as Turkish Lira currency string.
   * @param {number} amount
   * @returns {string}  e.g. "1.234,56 TL"
   */
  function formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return '0,00 TL';
    // Use Intl if available, fall back to manual
    try {
      return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' TL';
    } catch (_) {
      return String(amount) + ' TL';
    }
  }

  /**
   * Format a date value as DD.MM.YYYY
   * @param {string|Date} value
   * @returns {string}
   */
  function formatDate(value) {
    if (!value) return '-';
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '-';
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var yyyy = d.getFullYear();
    return dd + '.' + mm + '.' + yyyy;
  }

  /**
   * Format a number as percentage string.
   * @param {number} value
   * @param {number} [decimals=1]
   * @returns {string}
   */
  function formatPercent(value, decimals) {
    if (value == null || isNaN(value)) return '%0';
    decimals = decimals != null ? decimals : 1;
    return '%' + Number(value).toFixed(decimals).replace('.', ',');
  }

  // ---------------------------------------------------------------
  // Misc helpers
  // ---------------------------------------------------------------

  /** Generate a short unique id */
  var _idCounter = 0;
  function uid(prefix) {
    _idCounter++;
    return (prefix || 'ac') + '_' + _idCounter + '_' + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Debounce helper
   * @param {Function} fn
   * @param {number} delay - milliseconds
   * @returns {Function}
   */
  function debounce(fn, delay) {
    var timer;
    return function() {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
    };
  }

  // ---------------------------------------------------------------
  // Export to namespace
  // ---------------------------------------------------------------

  AppComponents._utils = {
    createElement: createElement,
    qs: qs,
    qsa: qsa,
    template: template,
    escapeHtml: escapeHtml,
    delegate: delegate,
    formatCurrency: formatCurrency,
    formatDate: formatDate,
    formatPercent: formatPercent,
    uid: uid,
    debounce: debounce
  };

})();
