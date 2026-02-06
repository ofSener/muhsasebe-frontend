/**
 * AppComponents.Toast
 * Toast notification system (top-right stacking).
 *
 * Usage:
 *   AppComponents.Toast.success('Islem basarili!');
 *   AppComponents.Toast.error('Bir hata olustu.', 8000);
 *   AppComponents.Toast.warning('Dikkat!');
 *   AppComponents.Toast.info('Bilgi mesaji.');
 *
 * Relies on: components/base.js (optional, works standalone)
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
    var style = document.createElement('style');
    style.textContent =
      '.ac-toast-container{position:fixed;top:1rem;right:1rem;z-index:10000;display:flex;flex-direction:column;gap:.5rem;pointer-events:none;max-width:380px;width:100%;}' +
      '.ac-toast{display:flex;align-items:flex-start;gap:.75rem;padding:.875rem 1rem;border-radius:12px;background:var(--bg-surface,#ffffff);border:1px solid var(--border-default,rgba(148,163,184,.3));box-shadow:0 8px 30px rgba(0,0,0,.12);pointer-events:auto;transform:translateX(110%);transition:transform .3s ease,opacity .3s ease;opacity:0;}' +
      '.ac-toast.show{transform:translateX(0);opacity:1;}' +
      '.ac-toast-icon{flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;}' +
      '.ac-toast-icon svg{width:20px;height:20px;}' +
      '.ac-toast-body{flex:1;font-size:.85rem;line-height:1.4;color:var(--text-primary,#e2e8f0);word-break:break-word;}' +
      '.ac-toast-close{flex-shrink:0;background:none;border:none;cursor:pointer;padding:2px;color:var(--text-muted,#94a3b8);border-radius:4px;display:flex;align-items:center;justify-content:center;transition:color .15s;}' +
      '.ac-toast-close:hover{color:var(--text-primary,#e2e8f0);}' +
      '.ac-toast.success{border-left:3px solid #10b981;}.ac-toast.success .ac-toast-icon{color:#10b981;}' +
      '.ac-toast.error{border-left:3px solid #ef4444;}.ac-toast.error .ac-toast-icon{color:#ef4444;}' +
      '.ac-toast.warning{border-left:3px solid #f59e0b;}.ac-toast.warning .ac-toast-icon{color:#f59e0b;}' +
      '.ac-toast.info{border-left:3px solid #6366f1;}.ac-toast.info .ac-toast-icon{color:#6366f1;}';
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------

  var ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  var CLOSE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // ---------------------------------------------------------------
  // Default durations
  // ---------------------------------------------------------------

  var DEFAULT_DURATIONS = {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000
  };

  // ---------------------------------------------------------------
  // Container management
  // ---------------------------------------------------------------

  var _container = null;

  function getContainer() {
    if (_container && _container.parentNode) return _container;
    _container = document.createElement('div');
    _container.className = 'ac-toast-container';
    document.body.appendChild(_container);
    return _container;
  }

  // ---------------------------------------------------------------
  // Core
  // ---------------------------------------------------------------

  function show(type, message, duration) {
    injectCSS();
    var container = getContainer();

    if (duration === undefined || duration === null) {
      duration = DEFAULT_DURATIONS[type] || 3000;
    }

    var toast = document.createElement('div');
    toast.className = 'ac-toast ' + type;
    toast.innerHTML =
      '<div class="ac-toast-icon">' + (ICONS[type] || ICONS.info) + '</div>' +
      '<div class="ac-toast-body"></div>' +
      '<button class="ac-toast-close" aria-label="Kapat">' + CLOSE_SVG + '</button>';

    // Set message as text (safe)
    toast.querySelector('.ac-toast-body').textContent = message;

    // Close button
    var closeBtn = toast.querySelector('.ac-toast-close');
    closeBtn.addEventListener('click', function() { dismiss(toast); });

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(function() {
      toast.classList.add('show');
    });

    // Auto dismiss
    var timer = null;
    if (duration > 0) {
      timer = setTimeout(function() { dismiss(toast); }, duration);
    }

    // Pause on hover
    toast.addEventListener('mouseenter', function() {
      if (timer) { clearTimeout(timer); timer = null; }
    });
    toast.addEventListener('mouseleave', function() {
      if (duration > 0) {
        timer = setTimeout(function() { dismiss(toast); }, duration);
      }
    });

    return toast;
  }

  function dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('show');
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------

  AppComponents.Toast = {
    success: function(message, duration) { return show('success', message, duration); },
    error:   function(message, duration) { return show('error',   message, duration); },
    warning: function(message, duration) { return show('warning', message, duration); },
    info:    function(message, duration) { return show('info',    message, duration); },
    dismiss: dismiss
  };

})();
