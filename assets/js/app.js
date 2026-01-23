/**
 * Sigorta Poliçe Yönetim Sistemi - Main Application JS
 * Handles navigation, modals, dropdowns, and global functionality
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  initSidebar();
  initDropdowns();
  initModals();
  initTabs();
  initFileUpload();
  initTooltips();
  initNavigation();
  initSearch();
  initTableSort();
  initAnimations();
});

/**
 * Sidebar Toggle & Navigation
 */
function initSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const toggleBtn = document.querySelector('.sidebar-toggle');
  const mobileToggle = document.querySelector('.mobile-menu-toggle');

  // Toggle collapse
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    });
  }

  // Mobile toggle
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Restore state from localStorage
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    sidebar?.classList.add('collapsed');
  }

  // Submenu toggles
  const navItems = document.querySelectorAll('.nav-item.has-submenu');
  navItems.forEach(item => {
    const link = item.querySelector('.nav-link');
    link?.addEventListener('click', (e) => {
      e.preventDefault();

      // Close other submenus
      navItems.forEach(other => {
        if (other !== item) other.classList.remove('open');
      });

      item.classList.toggle('open');
    });
  });

  // Close sidebar on mobile when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024) {
      if (!sidebar?.contains(e.target) && !mobileToggle?.contains(e.target)) {
        sidebar?.classList.remove('open');
      }
    }
  });

  // Swipe gesture support for sidebar
  let touchStartX = 0;
  let touchStartY = 0;
  const SWIPE_THRESHOLD = 50;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const swipeDistanceX = touchEndX - touchStartX;
    const swipeDistanceY = Math.abs(touchEndY - touchStartY);

    // Only trigger horizontal swipe if vertical movement is minimal
    if (swipeDistanceY < 100) {
      // Swipe right to open (from left edge)
      if (swipeDistanceX > SWIPE_THRESHOLD && touchStartX < 50) {
        sidebar?.classList.add('open');
      }

      // Swipe left to close
      if (swipeDistanceX < -SWIPE_THRESHOLD && sidebar?.classList.contains('open')) {
        sidebar?.classList.remove('open');
      }
    }
  }, { passive: true });

  // Add overlay element dynamically for mobile sidebar
  if (!document.querySelector('.sidebar-overlay')) {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', () => {
      sidebar?.classList.remove('open');
    });
    document.querySelector('.app-container')?.appendChild(overlay);
  }
}

/**
 * Navigation Highlighting
 */
function initNavigation() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.includes(href.replace('.html', ''))) {
      link.classList.add('active');
      // Open parent submenu if exists
      const parentSubmenu = link.closest('.nav-submenu');
      if (parentSubmenu) {
        parentSubmenu.closest('.nav-item')?.classList.add('open');
      }
    }
  });
}

/**
 * Dropdown Menus
 */
function initDropdowns() {
  const dropdowns = document.querySelectorAll('.dropdown');

  dropdowns.forEach(dropdown => {
    const trigger = dropdown.querySelector('.dropdown-trigger');

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();

      // Close other dropdowns
      dropdowns.forEach(other => {
        if (other !== dropdown) other.classList.remove('open');
      });

      dropdown.classList.toggle('open');
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    dropdowns.forEach(dropdown => dropdown.classList.remove('open'));
  });
}

/**
 * Modal System
 */
function initModals() {
  // Open modal triggers
  document.querySelectorAll('[data-modal-open]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const modalId = trigger.dataset.modalOpen;
      openModal(modalId);
    });
  });

  // Close modal triggers
  document.querySelectorAll('[data-modal-close]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const modal = trigger.closest('.modal-overlay');
      closeModal(modal);
    });
  });

  // Close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-overlay.active');
      if (activeModal) closeModal(activeModal);
    }
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modal) {
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Global modal functions
window.openModal = openModal;
window.closeModal = closeModal;

/**
 * Tab System
 */
function initTabs() {
  const tabContainers = document.querySelectorAll('.tabs');

  tabContainers.forEach(container => {
    const tabs = container.querySelectorAll('.tab');
    const tabContents = container.parentElement.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.tab;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update content
        tabContents.forEach(content => {
          content.classList.toggle('hidden', content.id !== targetId);
        });
      });
    });
  });
}

/**
 * File Upload
 */
function initFileUpload() {
  const uploadAreas = document.querySelectorAll('.file-upload');

  uploadAreas.forEach(area => {
    const input = area.querySelector('input[type="file"]');

    // Click to upload
    area.addEventListener('click', () => input?.click());

    // Drag and drop
    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('dragover');
    });

    area.addEventListener('dragleave', () => {
      area.classList.remove('dragover');
    });

    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('dragover');

      const files = e.dataTransfer.files;
      if (files.length > 0 && input) {
        input.files = files;
        handleFileSelect(area, files);
      }
    });

    // File input change
    input?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelect(area, e.target.files);
      }
    });
  });
}

function handleFileSelect(area, files) {
  const preview = area.querySelector('.file-preview');
  const title = area.querySelector('.file-upload-title');

  if (preview) {
    preview.innerHTML = Array.from(files).map(file => `
      <div class="file-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/>
          <polyline points="14,2 14,8 20,8"/>
        </svg>
        <span>${file.name}</span>
        <span class="text-muted">(${formatFileSize(file.size)})</span>
      </div>
    `).join('');
  }

  if (title) {
    title.textContent = `${files.length} dosya seçildi`;
  }

  // Trigger custom event
  area.dispatchEvent(new CustomEvent('filesSelected', { detail: files }));
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Tooltips
 */
function initTooltips() {
  // Tooltips are handled via CSS [data-tooltip] attribute
  // This function can be extended for dynamic tooltip positioning
}

/**
 * Search Functionality
 */
function initSearch() {
  const searchInput = document.querySelector('.navbar-search input');
  const searchResults = document.querySelector('.search-results');

  if (!searchInput) return;

  let debounceTimer;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = e.target.value.trim();
      if (query.length >= 2) {
        performSearch(query);
      } else {
        hideSearchResults();
      }
    }, 300);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2) {
      showSearchResults();
    }
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults?.contains(e.target)) {
      hideSearchResults();
    }
  });
}

function performSearch(query) {
  // Mock search - in real app, this would call an API
  console.log('Searching for:', query);
}

function showSearchResults() {
  document.querySelector('.search-results')?.classList.add('active');
}

function hideSearchResults() {
  document.querySelector('.search-results')?.classList.remove('active');
}

/**
 * Table Sorting
 */
function initTableSort() {
  const sortableHeaders = document.querySelectorAll('.data-table th[data-sort]');

  sortableHeaders.forEach(header => {
    header.style.cursor = 'pointer';
    header.addEventListener('click', () => {
      const table = header.closest('.data-table');
      const tbody = table.querySelector('tbody');
      const columnIndex = Array.from(header.parentElement.children).indexOf(header);
      const sortKey = header.dataset.sort;
      const currentOrder = header.dataset.order || 'asc';
      const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';

      // Update sort indicators
      sortableHeaders.forEach(h => {
        h.dataset.order = '';
        h.classList.remove('sorted-asc', 'sorted-desc');
      });
      header.dataset.order = newOrder;
      header.classList.add(`sorted-${newOrder}`);

      // Sort rows
      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.sort((a, b) => {
        const aValue = a.children[columnIndex]?.textContent.trim() || '';
        const bValue = b.children[columnIndex]?.textContent.trim() || '';

        // Try numeric comparison first
        const aNum = parseFloat(aValue.replace(/[^0-9.-]/g, ''));
        const bNum = parseFloat(bValue.replace(/[^0-9.-]/g, ''));

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return newOrder === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // Fall back to string comparison
        return newOrder === 'asc'
          ? aValue.localeCompare(bValue, 'tr')
          : bValue.localeCompare(aValue, 'tr');
      });

      // Re-append sorted rows
      rows.forEach(row => tbody.appendChild(row));
    });
  });
}

/**
 * Animations on scroll
 */
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });
}

/**
 * Format currency
 */
function formatCurrency(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Format date
 */
function formatDate(date, options = {}) {
  const defaults = { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Date(date).toLocaleDateString('tr-TR', { ...defaults, ...options });
}

/**
 * Format number
 */
function formatNumber(number) {
  return new Intl.NumberFormat('tr-TR').format(number);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      ${getToastIcon(type)}
    </div>
    <div class="toast-message">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  const container = document.querySelector('.toast-container') || createToastContainer();
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('show'));

  // Auto remove
  if (duration > 0) {
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

function createToastContainer() {
  const container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

function getToastIcon(type) {
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  return icons[type] || icons.info;
}

// Global utility functions
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatNumber = formatNumber;
window.showToast = showToast;

/**
 * Confirm dialog
 */
function confirmAction(message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 400px;">
      <div class="modal-header">
        <h3 class="modal-title">Onay</h3>
      </div>
      <div class="modal-body">
        <p>${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="confirm-cancel">İptal</button>
        <button class="btn btn-danger" id="confirm-ok">Onayla</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  overlay.querySelector('#confirm-ok').addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
    onConfirm?.();
  });

  overlay.querySelector('#confirm-cancel').addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
    onCancel?.();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      document.body.style.overflow = '';
      onCancel?.();
    }
  });
}

window.confirmAction = confirmAction;

/**
 * Table row selection
 */
function initTableSelection() {
  const tables = document.querySelectorAll('.data-table[data-selectable]');

  tables.forEach(table => {
    const selectAllCheckbox = table.querySelector('thead input[type="checkbox"]');
    const rowCheckboxes = table.querySelectorAll('tbody input[type="checkbox"]');

    selectAllCheckbox?.addEventListener('change', (e) => {
      rowCheckboxes.forEach(cb => cb.checked = e.target.checked);
      updateSelectionCount(table);
    });

    rowCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const allChecked = Array.from(rowCheckboxes).every(c => c.checked);
        const someChecked = Array.from(rowCheckboxes).some(c => c.checked);

        if (selectAllCheckbox) {
          selectAllCheckbox.checked = allChecked;
          selectAllCheckbox.indeterminate = someChecked && !allChecked;
        }

        updateSelectionCount(table);
      });
    });
  });
}

function updateSelectionCount(table) {
  const rowCheckboxes = table.querySelectorAll('tbody input[type="checkbox"]');
  const selected = Array.from(rowCheckboxes).filter(cb => cb.checked).length;
  const counter = table.closest('.card')?.querySelector('.selection-count');

  if (counter) {
    counter.textContent = selected > 0 ? `${selected} seçili` : '';
  }

  // Trigger custom event
  table.dispatchEvent(new CustomEvent('selectionChange', {
    detail: { selected, total: rowCheckboxes.length }
  }));
}

window.initTableSelection = initTableSelection;

// Initialize table selection after DOM load
document.addEventListener('DOMContentLoaded', initTableSelection);
