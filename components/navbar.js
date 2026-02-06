/**
 * AppComponents.Navbar
 * Top navigation bar component.
 *
 * Usage:
 *   AppComponents.Navbar.init({
 *     breadcrumbs: [
 *       { label: 'Police Islemleri' },
 *       { label: 'Yakalanan Policeler', href: '#' }
 *     ],
 *     showNotifications: true
 *   });
 *
 * Relies on:
 *   - components/base.js  (AppComponents._utils)
 *   - assets/js/config.js (APP_CONFIG.AUTH, updateNavbarUser, setupUserDropdown)
 */

(function() {
  'use strict';

  window.AppComponents = window.AppComponents || {};
  var u = (AppComponents._utils || {});

  // ---------------------------------------------------------------
  // Default options
  // ---------------------------------------------------------------

  var defaults = {
    container: null,          // Selector or element; if null, looks for <nav class="navbar">
    breadcrumbs: [],          // [{ label, href? }]
    showNotifications: false,
    notificationCount: 0
  };

  // ---------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------

  function renderBreadcrumbs(items) {
    if (!items || !items.length) return '';
    var html = '';
    items.forEach(function(item, i) {
      if (i > 0) {
        html += '<span class="breadcrumb-separator">/</span>';
      }
      var isLast = (i === items.length - 1);
      if (item.href && !isLast) {
        html += '<a href="' + item.href + '" class="breadcrumb-item">' + escapeText(item.label) + '</a>';
      } else {
        html += '<span class="breadcrumb-item' + (isLast ? ' active' : '') + '">' + escapeText(item.label) + '</span>';
      }
    });
    return html;
  }

  function escapeText(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function notificationBell(count) {
    var badge = count > 0
      ? '<span class="badge">' + (count > 99 ? '99+' : count) + '</span>'
      : '';
    return '<button class="navbar-btn" data-navbar-action="notifications" aria-label="Bildirimler">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>' +
        '<path d="M13.73 21a2 2 0 01-3.46 0"/>' +
      '</svg>' +
      badge +
    '</button>';
  }

  function userSection() {
    return '<div class="navbar-divider"></div>' +
      '<div class="navbar-user">' +
        '<div class="navbar-avatar"></div>' +
        '<div class="navbar-user-info">' +
          '<div class="navbar-user-name">Yukleniyor...</div>' +
          '<div class="navbar-user-role"></div>' +
        '</div>' +
      '</div>';
  }

  // ---------------------------------------------------------------
  // Build full navbar HTML
  // ---------------------------------------------------------------

  function buildNavbarHTML(opts) {
    var leftHTML = '' +
      '<button class="mobile-menu-toggle" id="mobileMenuToggle" aria-label="Menu">' +
        '<span class="hamburger-line"></span>' +
        '<span class="hamburger-line"></span>' +
        '<span class="hamburger-line"></span>' +
      '</button>' +
      '<div class="navbar-breadcrumb">' +
        renderBreadcrumbs(opts.breadcrumbs) +
      '</div>';

    var rightHTML = '';
    if (opts.showNotifications) {
      rightHTML += notificationBell(opts.notificationCount || 0);
    }
    rightHTML += userSection();

    return '<div class="navbar-left">' + leftHTML + '</div>' +
           '<div class="navbar-right">' + rightHTML + '</div>';
  }

  // ---------------------------------------------------------------
  // Event binding
  // ---------------------------------------------------------------

  function bindEvents(navEl) {
    // Mobile menu toggle
    var mobileBtn = navEl.querySelector('#mobileMenuToggle') || navEl.querySelector('.mobile-menu-toggle');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', function() {
        var sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.toggle('open');
      });
    }
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------

  /**
   * Initialize (or re-initialize) the navbar.
   * If opts.container is provided, renders into that element.
   * Otherwise looks for an existing <nav class="navbar"> and fills it.
   *
   * @param {Object} opts
   */
  function init(opts) {
    opts = Object.assign({}, defaults, opts || {});

    var navEl;

    if (opts.container) {
      navEl = typeof opts.container === 'string'
        ? document.querySelector(opts.container)
        : opts.container;
    } else {
      navEl = document.querySelector('nav.navbar');
    }

    if (!navEl) {
      console.warn('[Navbar] Container element not found.');
      return;
    }

    navEl.innerHTML = buildNavbarHTML(opts);

    bindEvents(navEl);

    // Load user info using the global helper from config.js
    loadUserInfo();
  }

  /**
   * Update only the breadcrumb section without re-rendering everything.
   * @param {Array} breadcrumbs
   */
  function updateBreadcrumbs(breadcrumbs) {
    var container = document.querySelector('.navbar-breadcrumb');
    if (container) {
      container.innerHTML = renderBreadcrumbs(breadcrumbs);
    }
  }

  /**
   * Update notification badge count.
   * @param {number} count
   */
  function setNotificationCount(count) {
    var badge = document.querySelector('.navbar-btn[data-navbar-action="notifications"] .badge');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? '' : 'none';
    }
  }

  // ---------------------------------------------------------------
  // Internal: user info loading
  // ---------------------------------------------------------------

  function loadUserInfo() {
    // If the global updateNavbarUser is available (from config.js), use it.
    if (typeof updateNavbarUser === 'function') {
      updateNavbarUser();
      return;
    }

    // Fallback: read from APP_CONFIG.AUTH.getUser()
    if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.AUTH && APP_CONFIG.AUTH.getUser) {
      var user = APP_CONFIG.AUTH.getUser();
      if (user) {
        var nameEl = document.querySelector('.navbar-user-name');
        if (nameEl) nameEl.textContent = user.name || 'Kullanici';

        var roleEl = document.querySelector('.navbar-user-role');
        if (roleEl) roleEl.textContent = user.subeAdi || 'Kullanici';

        var avatarEl = document.querySelector('.navbar-avatar');
        if (avatarEl && user.name) {
          var initials = user.name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
          avatarEl.textContent = initials;
        }
      }
    }
  }

  // ---------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------

  AppComponents.Navbar = {
    init: init,
    updateBreadcrumbs: updateBreadcrumbs,
    setNotificationCount: setNotificationCount
  };

})();
