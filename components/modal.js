/**
 * AppComponents.Modal
 * Generic modal dialog component.
 *
 * Usage:
 *   AppComponents.Modal.open({
 *     title: 'Baslik',
 *     content: '<p>Icerik</p>',
 *     size: 'md',          // 'sm' | 'md' | 'lg'
 *     onClose: function(){},
 *     footer: '<button class="btn btn-primary">Tamam</button>'
 *   });
 *
 *   AppComponents.Modal.close();
 *
 *   AppComponents.Modal.confirm('Onay', 'Emin misiniz?', {
 *     onConfirm: function(){ ... },
 *     confirmText: 'Evet',
 *     confirmClass: 'btn btn-danger'
 *   });
 *
 *   AppComponents.Modal.alert('Bilgi', 'Islem basarili.');
 *
 * Relies on:
 *   - components/base.js (optional, works standalone too)
 *   - assets/css/main.css (modal-overlay, modal, etc.)
 */

(function() {
  'use strict';

  window.AppComponents = window.AppComponents || {};

  // ---------------------------------------------------------------
  // CSS injection (one-time, minimal overrides for sizes)
  // ---------------------------------------------------------------

  var cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var style = document.createElement('style');
    style.textContent =
      '.ac-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s ease;backdrop-filter:blur(2px);}' +
      '.ac-modal-overlay.active{opacity:1;}' +
      '.ac-modal{background:var(--bg-card,#1e1b4b);border:1px solid var(--border-color,rgba(99,102,241,.2));border-radius:16px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.4);transform:translateY(12px);transition:transform .25s ease;display:flex;flex-direction:column;max-height:85vh;}' +
      '.ac-modal-overlay.active .ac-modal{transform:translateY(0);}' +
      '.ac-modal.sm{max-width:380px;}.ac-modal.md{max-width:520px;}.ac-modal.lg{max-width:720px;}' +
      '.ac-modal-header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;border-bottom:1px solid var(--border-color,rgba(99,102,241,.15));}' +
      '.ac-modal-header h3{margin:0;font-size:1rem;font-weight:600;color:var(--text-primary,#e0e7ff);}' +
      '.ac-modal-close{background:none;border:none;cursor:pointer;padding:4px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--text-muted,#94a3b8);transition:all .15s ease;}' +
      '.ac-modal-close:hover{background:rgba(239,68,68,.15);color:#ef4444;}' +
      '.ac-modal-body{padding:1.25rem 1.5rem;overflow-y:auto;color:var(--text-secondary,#c7d2fe);font-size:.9rem;line-height:1.6;}' +
      '.ac-modal-footer{display:flex;justify-content:flex-end;gap:.75rem;padding:1rem 1.5rem;border-top:1px solid var(--border-color,rgba(99,102,241,.15));}';
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------

  var activeOverlay = null;
  var _onCloseCallback = null;
  var _focusBefore = null;
  var _escHandler = null;

  // Close icon SVG
  var CLOSE_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  // ---------------------------------------------------------------
  // Core
  // ---------------------------------------------------------------

  function open(opts) {
    if (!opts) opts = {};
    injectCSS();
    close(true); // close any existing

    _focusBefore = document.activeElement;
    _onCloseCallback = opts.onClose || null;

    var sizeClass = opts.size || 'md';

    // Overlay
    var overlay = document.createElement('div');
    overlay.className = 'ac-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    // Modal box
    var modal = document.createElement('div');
    modal.className = 'ac-modal ' + sizeClass;

    // Header
    if (opts.title !== undefined) {
      var header = document.createElement('div');
      header.className = 'ac-modal-header';
      header.innerHTML = '<h3>' + (opts.title || '') + '</h3>';
      var closeBtn = document.createElement('button');
      closeBtn.className = 'ac-modal-close';
      closeBtn.setAttribute('aria-label', 'Kapat');
      closeBtn.innerHTML = CLOSE_SVG;
      closeBtn.addEventListener('click', function() { close(); });
      header.appendChild(closeBtn);
      modal.appendChild(header);
    }

    // Body
    var body = document.createElement('div');
    body.className = 'ac-modal-body';
    if (typeof opts.content === 'string') {
      body.innerHTML = opts.content;
    } else if (opts.content instanceof HTMLElement) {
      body.appendChild(opts.content);
    }
    modal.appendChild(body);

    // Footer
    if (opts.footer) {
      var footer = document.createElement('div');
      footer.className = 'ac-modal-footer';
      if (typeof opts.footer === 'string') {
        footer.innerHTML = opts.footer;
      } else if (opts.footer instanceof HTMLElement) {
        footer.appendChild(opts.footer);
      }
      modal.appendChild(footer);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    activeOverlay = overlay;

    // Animate in
    requestAnimationFrame(function() {
      overlay.classList.add('active');
    });

    // Backdrop click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close();
    });

    // Escape key
    _escHandler = function(e) {
      if (e.key === 'Escape' || e.keyCode === 27) close();
    };
    document.addEventListener('keydown', _escHandler);

    // Focus trap — focus first focusable
    setTimeout(function() {
      var focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus();
    }, 50);

    // Return body element so callers can manipulate
    return { overlay: overlay, body: body, modal: modal };
  }

  function close(silent) {
    if (!activeOverlay) return;
    var overlay = activeOverlay;
    activeOverlay = null;

    overlay.classList.remove('active');
    setTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 220);

    if (_escHandler) {
      document.removeEventListener('keydown', _escHandler);
      _escHandler = null;
    }

    // Restore focus
    if (_focusBefore && _focusBefore.focus) {
      try { _focusBefore.focus(); } catch (_) {}
    }
    _focusBefore = null;

    if (!silent && typeof _onCloseCallback === 'function') {
      _onCloseCallback();
      _onCloseCallback = null;
    }
  }

  // ---------------------------------------------------------------
  // Convenience: confirm dialog
  // ---------------------------------------------------------------

  function confirm(title, message, opts) {
    opts = opts || {};
    var confirmText = opts.confirmText || 'Onayla';
    var cancelText = opts.cancelText || 'Iptal';
    var confirmClass = opts.confirmClass || 'btn btn-primary';

    var footer = document.createElement('div');
    footer.style.display = 'contents';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = cancelText;
    cancelBtn.addEventListener('click', function() {
      close();
      if (typeof opts.onCancel === 'function') opts.onCancel();
    });

    var okBtn = document.createElement('button');
    okBtn.className = confirmClass;
    okBtn.textContent = confirmText;
    okBtn.addEventListener('click', function() {
      close(true);
      if (typeof opts.onConfirm === 'function') opts.onConfirm();
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);

    return open({
      title: title,
      content: '<p>' + (message || '') + '</p>',
      size: 'sm',
      footer: footer,
      onClose: opts.onCancel
    });
  }

  // ---------------------------------------------------------------
  // Convenience: alert dialog
  // ---------------------------------------------------------------

  function alert(title, message) {
    var okBtn = document.createElement('button');
    okBtn.className = 'btn btn-primary';
    okBtn.textContent = 'Tamam';
    okBtn.addEventListener('click', function() { close(); });

    return open({
      title: title,
      content: '<p>' + (message || '') + '</p>',
      size: 'sm',
      footer: okBtn
    });
  }

  // ---------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------

  AppComponents.Modal = {
    open: open,
    close: close,
    confirm: confirm,
    alert: alert
  };

})();
