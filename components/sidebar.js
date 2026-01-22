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
        <div class="nav-item has-submenu" data-submenu="policies">
          <a href="#" class="nav-link">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            <span class="nav-text">Policeler</span>
            <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg>
          </a>
          <div class="nav-submenu">
            <a href="${pagesPath}policies/my-policies.html" class="nav-link" data-page="my-policies.html"><span class="nav-text">Policelerim</span></a>
            <a href="${pagesPath}policies/captured.html" class="nav-link" data-page="captured.html"><span class="nav-text">Yakalanan Policeler</span></a>
            <a href="${pagesPath}policies/pool.html" class="nav-link" data-page="pool.html"><span class="nav-text">Police Havuzu</span></a>
            <a href="${pagesPath}policies/add-manual.html" class="nav-link" data-page="add-manual.html"><span class="nav-text">Manuel Ekle</span></a>
            <a href="${pagesPath}policies/bulk-import.html" class="nav-link" data-page="bulk-import.html"><span class="nav-text">Toplu Aktar</span></a>
          </div>
        </div>
      </div>
      <div class="nav-section">
        <div class="nav-section-title">Yonetim</div>
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
            <a href="${pagesPath}employees/commission.html" class="nav-link" data-page="commission.html"><span class="nav-text">Komisyon Ayarlari</span></a>
          </div>
        </div>
        <div class="nav-item has-submenu" data-submenu="customers">
          <a href="#" class="nav-link">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span class="nav-text">Musterilerimiz</span>
            <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg>
          </a>
          <div class="nav-submenu">
            <a href="${pagesPath}customers/list.html" class="nav-link" data-page="list.html" data-folder="customers"><span class="nav-text">Musteri Listesi</span></a>
            <a href="${pagesPath}customers/detail.html" class="nav-link" data-page="detail.html"><span class="nav-text">Musteri Detay</span></a>
            <a href="${pagesPath}customers/renewals.html" class="nav-link" data-page="renewals.html"><span class="nav-text">Yenileme Takibi</span></a>
          </div>
        </div>
      </div>
      <div class="nav-section">
        <div class="nav-section-title">Finans</div>
        <div class="nav-item has-submenu" data-submenu="finance">
          <a href="#" class="nav-link">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            <span class="nav-text">Finans</span>
            <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg>
          </a>
          <div class="nav-submenu">
            <a href="${pagesPath}finance/dashboard.html" class="nav-link" data-page="dashboard.html" data-folder="finance"><span class="nav-text">Ozet Dashboard</span></a>
            <a href="${pagesPath}finance/policies.html" class="nav-link" data-page="policies.html" data-folder="finance"><span class="nav-text">Police Bazli</span></a>
            <a href="${pagesPath}finance/collections.html" class="nav-link" data-page="collections.html"><span class="nav-text">Tahsilat Takibi</span></a>
            <a href="${pagesPath}finance/reports.html" class="nav-link" data-page="reports.html" data-folder="finance"><span class="nav-text">Raporlar</span></a>
            <a href="${pagesPath}finance/my-earnings.html" class="nav-link" data-page="my-earnings.html"><span class="nav-text">Kazanclarim</span></a>
          </div>
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
        document.getElementById('sidebar').classList.toggle('collapsed');
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
