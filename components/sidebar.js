/**
 * Global Sidebar Component
 * Dinamik olarak sidebar'ı yükler ve aktif sayfayı işaretler
 */

(function() {
  'use strict';

  // Sayfa yolunu belirle
  const currentPath = window.location.pathname;
  const pathParts = currentPath.split('/');
  const currentPage = pathParts[pathParts.length - 1] || 'index.html';
  const currentFolder = pathParts[pathParts.length - 2] || '';

  // Base path hesapla (sayfanın konumuna göre)
  let basePath = '';
  if (currentPath.includes('/pages/')) {
    // /pages/finance/dashboard.html -> ../../
    basePath = '../../';
  } else {
    // /index.html -> ./
    basePath = './';
  }

  // Relative path hesapla (pages klasörü için)
  let pagesPath = basePath === './' ? './pages/' : '../';

  // Sidebar HTML template
  const sidebarHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <img src="${basePath}assets/images/logos/ihsanai-logo.png" alt="IHSAN AI" onerror="this.style.display='none'; this.parentElement.innerHTML='IA';">
      </div>
      <div class="sidebar-brand">
        <h1>IHSAN AI</h1>
        <span>Sigorta Yonetimi</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section">
        <div class="nav-section-title">Ana Menu</div>
        <div class="nav-item">
          <a href="${basePath}index.html" class="nav-link" data-page="index.html">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <span class="nav-text">Dashboard</span>
          </a>
        </div>
      </div>
      <div class="nav-section">
        <div class="nav-section-title">Police Islemleri</div>
        <div class="nav-item">
          <a href="${pagesPath}policies/my-policies.html" class="nav-link" data-page="my-policies.html">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span class="nav-text">Policelerim</span>
          </a>
        </div>
        <div class="nav-item">
          <a href="${pagesPath}policies/captured.html" class="nav-link" data-page="captured.html">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            <span class="nav-text">Yakalanan Policeler</span>
          </a>
        </div>
        <div class="nav-item">
          <a href="${pagesPath}policies/pool.html" class="nav-link" data-page="pool.html">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 16,12 14,15 10,15 8,12 2,12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
            <span class="nav-text">Police Havuzu</span>
          </a>
        </div>
        <div class="nav-item">
          <a href="${pagesPath}policies/add-manual.html" class="nav-link" data-page="add-manual.html">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            <span class="nav-text">Manuel Ekle</span>
          </a>
        </div>
        <div class="nav-item">
          <a href="${pagesPath}policies/bulk-import.html" class="nav-link" data-page="bulk-import.html">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>
            <span class="nav-text">Toplu Aktar</span>
          </a>
        </div>
      </div>
      <div class="nav-section">
        <div class="nav-section-title">Yonetim</div>
        <div class="nav-item has-submenu" data-submenu="customers">
          <a href="#" class="nav-link">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span class="nav-text">Musterilerimiz</span>
            <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg>
          </a>
          <div class="nav-submenu">
            <a href="${pagesPath}customers/list.html" class="nav-link" data-page="list.html" data-folder="customers"><span class="nav-text">Musteri Listesi</span></a>
          </div>
        </div>
        <div class="nav-item has-submenu" data-submenu="employees">
          <a href="#" class="nav-link">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            <span class="nav-text">Calisanlarim</span>
            <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg>
          </a>
          <div class="nav-submenu">
            <a href="${pagesPath}employees/list.html" class="nav-link" data-page="list.html" data-folder="employees"><span class="nav-text">Calisan Listesi</span></a>
            <a href="${pagesPath}employees/performance.html" class="nav-link" data-page="performance.html"><span class="nav-text">Performans</span></a>
            <a href="${pagesPath}employees/tracking.html" class="nav-link" data-page="tracking.html"><span class="nav-text">Takip/Hakedis</span></a>
          </div>
        </div>
        <div class="nav-item">
          <a href="${pagesPath}customers/renewals.html" class="nav-link" data-page="renewals.html">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9"/></svg>
            <span class="nav-text">Yenileme Takibi</span>
          </a>
        </div>
      </div>
      <div class="nav-section">
        <div class="nav-section-title">Finans</div>
        <div class="nav-item">
          <a href="${pagesPath}finance/dashboard.html" class="nav-link" data-page="dashboard.html" data-folder="finance">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
            <span class="nav-text">Ozet Dashboard</span>
          </a>
        </div>
        <div class="nav-item">
          <a href="${pagesPath}finance/policies.html" class="nav-link" data-page="policies.html" data-folder="finance">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            <span class="nav-text">Police Bazli</span>
          </a>
        </div>
        <div class="nav-item">
          <a href="${pagesPath}finance/collections.html" class="nav-link" data-page="collections.html">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <span class="nav-text">Tahsilat Takibi</span>
          </a>
        </div>
        <div class="nav-item">
          <a href="${pagesPath}finance/reports.html" class="nav-link" data-page="reports.html" data-folder="finance">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
            <span class="nav-text">Raporlar</span>
          </a>
        </div>
        <div class="nav-item">
          <a href="${pagesPath}finance/my-earnings.html" class="nav-link" data-page="my-earnings.html">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4h-4z"/></svg>
            <span class="nav-text">Kazanclarim</span>
          </a>
        </div>
      </div>
      <div class="nav-section">
        <div class="nav-section-title">Sistem</div>
        <div class="nav-item has-submenu" data-submenu="settings">
          <a href="#" class="nav-link">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            <span class="nav-text">Ayarlar</span>
            <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg>
          </a>
          <div class="nav-submenu">
            <a href="${pagesPath}settings/permissions.html" class="nav-link" data-page="permissions.html"><span class="nav-text">Yetki Yonetimi</span></a>
            <a href="${pagesPath}settings/agency-codes.html" class="nav-link" data-page="agency-codes.html"><span class="nav-text">Acente Kodlari</span></a>
            <a href="${pagesPath}employees/commission.html" class="nav-link" data-page="commission.html"><span class="nav-text">Komisyon Ayarlari</span></a>
            <a href="${pagesPath}settings/drive-integration.html" class="nav-link" data-page="drive-integration.html"><span class="nav-text">Drive Entegrasyonu</span></a>
            <a href="${pagesPath}settings/report-settings.html" class="nav-link" data-page="report-settings.html"><span class="nav-text">Rapor Ayarlari</span></a>
          </div>
        </div>
      </div>
    </nav>
    <div class="sidebar-footer">
      <button class="sidebar-toggle" id="sidebarToggleBtn">
        <svg class="collapse-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="11,17 6,12 11,7"/><polyline points="18,17 13,12 18,7"/></svg>
        <svg class="expand-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13,7 18,12 13,17"/><polyline points="6,7 11,12 6,17"/></svg>
        <span class="nav-text">Daralt</span>
      </button>
    </div>
  `;

  // Sidebar'ı DOM'a ekle
  function initSidebar() {
    const sidebarElement = document.getElementById('sidebar');
    if (!sidebarElement) {
      console.error('Sidebar element not found');
      return;
    }

    sidebarElement.innerHTML = sidebarHTML;

    // Aktif sayfayı işaretle
    highlightActivePage();

    // Submenu toggle işlevselliği
    initSubmenuToggles();

    // Apply permissions AFTER sidebar is rendered
    if (typeof applyPermissions === 'function') {
      applyPermissions();
    }
  }

  // Aktif sayfayı işaretle
  function highlightActivePage() {
    const links = document.querySelectorAll('#sidebar .nav-link[data-page]');

    links.forEach(link => {
      const linkPage = link.getAttribute('data-page');
      const linkFolder = link.getAttribute('data-folder');

      // Sayfa ve klasör eşleşmesi kontrol et
      let isActive = false;

      if (linkPage === currentPage) {
        // Aynı isimde birden fazla sayfa varsa (list.html gibi) klasör kontrolü yap
        if (linkFolder) {
          isActive = currentFolder === linkFolder;
        } else if (linkPage === 'list.html' || linkPage === 'dashboard.html' || linkPage === 'policies.html' || linkPage === 'reports.html') {
          // Bu sayfalar birden fazla klasörde var, href'ten klasör çıkar
          const href = link.getAttribute('href');
          const hrefFolder = href.split('/').slice(-2, -1)[0];
          isActive = currentFolder === hrefFolder;
        } else {
          isActive = true;
        }
      }

      if (isActive) {
        link.classList.add('active');

        // Parent submenu'yu aç
        const parentSubmenu = link.closest('.nav-item.has-submenu');
        if (parentSubmenu) {
          parentSubmenu.classList.add('open');
        }
      }
    });
  }

  // Submenu toggle işlevselliği
  function initSubmenuToggles() {
    const submenuItems = document.querySelectorAll('#sidebar .nav-item.has-submenu > .nav-link');

    submenuItems.forEach(item => {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        const parent = this.parentElement;

        // Accordion davranışı - diğer açık menüleri kapat
        document.querySelectorAll('#sidebar .nav-item.has-submenu.open').forEach(openItem => {
          if (openItem !== parent) openItem.classList.remove('open');
        });

        parent.classList.toggle('open');
      });
    });

    // Sidebar toggle button
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        const sb = document.getElementById('sidebar');
        sb.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sb.classList.contains('collapsed'));
      });
    }
  }

  // DOM hazır olduğunda sidebar'ı init et
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
  } else {
    initSidebar();
  }
})();
