/**
 * Finance Policies - API Integration
 * Poliçe bazlı finans sayfası için dinamik veri yükleme
 */

(function() {
  'use strict';

  // State
  let employees = [];
  let agencyCodes = [];
  let policiesData = [];
  let summaryStats = null;
  let currentFilters = {
    dateRange: 'this_month',
    policyType: '',
    employeeId: '',
    paymentStatus: '',
    agencyCode: ''
  };
  let pagination = {
    page: 1,
    pageSize: 20,
    totalCount: 0
  };

  /**
   * Para formatı
   */
  function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '0 TL';
    return Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL';
  }

  /**
   * Tarih formatı
   */
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /**
   * İsimden baş harfleri al
   */
  function getInitials(name) {
    if (!name) return 'XX';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  /**
   * Çalışanları yükle
   */
  async function loadEmployees() {
    try {
      const response = await apiGet('kullanicilar');
      employees = Array.isArray(response) ? response : (response.users || response.data || []);
      populateEmployeeFilter();
    } catch (error) {
      console.error('Çalışanlar yüklenemedi:', error);
    }
  }

  /**
   * Acente kodlarını yükle
   */
  async function loadAgencyCodes() {
    try {
      const response = await apiGet('agency-codes');
      agencyCodes = Array.isArray(response) ? response : (response.codes || response.data || []);
      populateAgencyFilter();
    } catch (error) {
      console.error('Acente kodları yüklenemedi:', error);
    }
  }

  /**
   * Çalışan filter'ını doldur
   */
  function populateEmployeeFilter() {
    const select = document.querySelector('.form-group:nth-child(3) .form-select');
    if (!select) return;

    // Mevcut "Tumu" seçeneğini koru
    select.innerHTML = '<option value="">Tumu</option>';

    employees.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.id || emp.kullaniciId;
      option.textContent = emp.adSoyad || emp.name || `${emp.ad} ${emp.soyad}`;
      select.appendChild(option);
    });
  }

  /**
   * Acente filter'ını doldur
   */
  function populateAgencyFilter() {
    const select = document.querySelector('.form-group:nth-child(5) .form-select');
    if (!select) return;

    // Mevcut "Tumu" seçeneğini koru
    select.innerHTML = '<option value="">Tumu</option>';

    agencyCodes.forEach(agency => {
      const option = document.createElement('option');
      option.value = agency.kod || agency.code || agency.id;
      option.textContent = agency.kod || agency.code || agency.name;
      select.appendChild(option);
    });
  }

  /**
   * Poliçe verilerini yükle
   */
  async function loadPolicies() {
    try {
      const params = buildQueryParams();
      const response = await apiGet(`policies?${params}`);

      // Response yapısına göre verileri al
      if (Array.isArray(response)) {
        policiesData = response;
        pagination.totalCount = response.length;
      } else {
        policiesData = response.policies || response.data || [];
        pagination.totalCount = response.totalCount || response.total || policiesData.length;
      }

      updatePoliciesTable();
      updateSummaryStats();
      updatePagination();

    } catch (error) {
      console.error('Poliçe verileri yüklenemedi:', error);
      showEmptyState();
    }
  }

  /**
   * Query parametrelerini oluştur
   */
  function buildQueryParams() {
    const params = new URLSearchParams();

    // Tarih aralığı
    const dateRange = getDateRange(currentFilters.dateRange);
    if (dateRange.startDate) params.append('startDate', dateRange.startDate);
    if (dateRange.endDate) params.append('endDate', dateRange.endDate);

    // Diğer filtreler
    if (currentFilters.policyType) params.append('brans', currentFilters.policyType);
    if (currentFilters.employeeId) params.append('kullaniciId', currentFilters.employeeId);
    if (currentFilters.paymentStatus) params.append('odemeDurumu', currentFilters.paymentStatus);
    if (currentFilters.agencyCode) params.append('acenteKodu', currentFilters.agencyCode);

    // Pagination
    params.append('page', pagination.page);
    params.append('pageSize', pagination.pageSize);

    return params.toString();
  }

  /**
   * Tarih aralığını hesapla
   */
  function getDateRange(period) {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'last_7_days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        endDate = now;
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      case 'last_30_days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        endDate = now;
        break;
      case 'last_3_months':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        endDate = now;
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
    }

    return {
      startDate: formatDateForApi(startDate),
      endDate: formatDateForApi(endDate)
    };
  }

  /**
   * Tarihi API formatına çevir
   */
  function formatDateForApi(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Poliçe tablosunu güncelle
   */
  function updatePoliciesTable() {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    if (policiesData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center text-muted" style="padding: 2rem;">
            Filtrelere uygun poliçe bulunamadı
          </td>
        </tr>
      `;
      return;
    }

    const avatarColors = ['cyan', 'rose', 'amber', 'violet', 'emerald'];

    tbody.innerHTML = policiesData.map((policy, index) => {
      const policeNo = policy.policeNo || policy.policeNumarasi || '-';
      const musteriAdi = policy.musteriAdi || policy.customerName || '-';
      const initials = getInitials(musteriAdi);
      const brans = policy.bransAdi || policy.brans || policy.tip || '-';
      const calisan = policy.calisanAdi || policy.kullaniciAdi || policy.employeeName || '-';
      const tarih = formatDate(policy.policeTarihi || policy.eklenmeTarihi || policy.date);
      const prim = policy.brutPrim || policy.prim || policy.premium || 0;
      const komisyonOrani = policy.komisyonOrani || policy.commissionRate || 0;
      const komisyon = policy.komisyon || (prim * komisyonOrani / 100) || 0;
      const durum = policy.odemeDurumu || policy.paymentStatus || 'Bekliyor';
      const avatarColor = avatarColors[index % avatarColors.length];

      const durumBadge = getDurumBadge(durum);
      const bransBadge = getBransBadge(brans);

      return `
        <tr data-policy-id="${policy.id || policy.policeId}">
          <td><input type="checkbox" class="form-checkbox"></td>
          <td><span class="font-mono font-semibold">#${policeNo}</span></td>
          <td>
            <div class="customer-cell">
              <div class="avatar avatar-${avatarColor}">${initials}</div>
              <span>${musteriAdi}</span>
            </div>
          </td>
          <td>${bransBadge}</td>
          <td>${calisan}</td>
          <td>${tarih}</td>
          <td class="font-mono font-semibold">${formatCurrency(prim)}</td>
          <td class="text-center">%${komisyonOrani}</td>
          <td class="font-mono font-semibold text-emerald">${formatCurrency(komisyon)}</td>
          <td>${durumBadge}</td>
        </tr>
      `;
    }).join('');

    // Table footer'ı güncelle
    updateTableFooter();
  }

  /**
   * Branş badge'i oluştur
   */
  function getBransBadge(brans) {
    const bransMap = {
      'Kasko': 'kasko',
      'Trafik': 'trafik',
      'DASK': 'dask',
      'Sağlık': 'saglik',
      'Saglik': 'saglik',
      'Konut': 'konut',
      'İşyeri': 'isyeri',
      'Isyeri': 'isyeri'
    };
    const className = bransMap[brans] || 'diger';
    return `<span class="policy-badge ${className}">${brans}</span>`;
  }

  /**
   * Durum badge'i oluştur
   */
  function getDurumBadge(durum) {
    const statusMap = {
      'Odendi': { class: 'status-success', text: 'Odendi' },
      'Ödendi': { class: 'status-success', text: 'Odendi' },
      'Bekliyor': { class: 'status-warning', text: 'Bekliyor' },
      'Gecikmis': { class: 'status-danger', text: 'Gecikmis' },
      'Gecikmiş': { class: 'status-danger', text: 'Gecikmis' },
      'Kismi': { class: 'status-info', text: 'Kismi' },
      'Kısmi': { class: 'status-info', text: 'Kismi' }
    };
    const badge = statusMap[durum] || { class: 'status-secondary', text: durum || 'Bilinmiyor' };
    return `<span class="status-badge ${badge.class}">${badge.text}</span>`;
  }

  /**
   * Tablo footer'ını güncelle
   */
  function updateTableFooter() {
    const tfoot = document.querySelector('.data-table tfoot');
    if (!tfoot) return;

    const totalPrim = policiesData.reduce((sum, p) => sum + (p.brutPrim || p.prim || 0), 0);
    const totalKomisyon = policiesData.reduce((sum, p) => {
      const prim = p.brutPrim || p.prim || 0;
      const oran = p.komisyonOrani || 0;
      return sum + (p.komisyon || (prim * oran / 100));
    }, 0);
    const avgOran = policiesData.length > 0 ?
      (policiesData.reduce((sum, p) => sum + (p.komisyonOrani || 0), 0) / policiesData.length).toFixed(1) : 0;

    tfoot.innerHTML = `
      <tr class="summary-footer">
        <td colspan="6" class="text-right">Sayfa Toplami:</td>
        <td class="font-mono font-semibold">${formatCurrency(totalPrim)}</td>
        <td class="text-center">%${avgOran}</td>
        <td class="font-mono font-semibold text-emerald">${formatCurrency(totalKomisyon)}</td>
        <td></td>
      </tr>
    `;
  }

  /**
   * Özet istatistikleri güncelle
   */
  function updateSummaryStats() {
    // Toplam kayıt
    const totalRecordsEl = document.querySelector('.summary-item:nth-child(1) .summary-value');
    if (totalRecordsEl) {
      totalRecordsEl.textContent = pagination.totalCount.toLocaleString('tr-TR');
    }

    // Toplam prim
    const totalPrim = policiesData.reduce((sum, p) => sum + (p.brutPrim || p.prim || 0), 0);
    const totalPrimEl = document.querySelector('.summary-item:nth-child(2) .summary-value');
    if (totalPrimEl) {
      totalPrimEl.textContent = formatCurrency(totalPrim);
    }

    // Toplam komisyon
    const totalKomisyon = policiesData.reduce((sum, p) => {
      const prim = p.brutPrim || p.prim || 0;
      const oran = p.komisyonOrani || 0;
      return sum + (p.komisyon || (prim * oran / 100));
    }, 0);
    const totalKomisyonEl = document.querySelector('.summary-item:nth-child(3) .summary-value');
    if (totalKomisyonEl) {
      totalKomisyonEl.textContent = formatCurrency(totalKomisyon);
    }

    // Ortalama komisyon oranı
    const avgOran = policiesData.length > 0 ?
      (policiesData.reduce((sum, p) => sum + (p.komisyonOrani || 0), 0) / policiesData.length).toFixed(1) : 0;
    const avgOranEl = document.querySelector('.summary-item:nth-child(4) .summary-value');
    if (avgOranEl) {
      avgOranEl.textContent = `%${avgOran}`;
    }
  }

  /**
   * Pagination'ı güncelle
   */
  function updatePagination() {
    const paginationInfo = document.querySelector('.pagination-info');
    if (paginationInfo) {
      const start = (pagination.page - 1) * pagination.pageSize + 1;
      const end = Math.min(pagination.page * pagination.pageSize, pagination.totalCount);
      paginationInfo.textContent = `${pagination.totalCount} kayittan ${start}-${end} arasi gosteriliyor`;
    }

    // Pagination butonlarını güncelle
    const paginationContainer = document.querySelector('.pagination');
    if (paginationContainer) {
      const totalPages = Math.ceil(pagination.totalCount / pagination.pageSize);
      updatePaginationButtons(totalPages);
    }
  }

  /**
   * Pagination butonlarını güncelle
   */
  function updatePaginationButtons(totalPages) {
    const container = document.querySelector('.pagination');
    if (!container || totalPages <= 1) return;

    let html = '';

    // Önceki butonu
    html += `<button class="btn btn-sm btn-ghost" ${pagination.page <= 1 ? 'disabled' : ''} onclick="FinancePolicies.goToPage(${pagination.page - 1})">&laquo;</button>`;

    // Sayfa numaraları
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(totalPages, pagination.page + 2);

    if (startPage > 1) {
      html += `<button class="btn btn-sm btn-ghost" onclick="FinancePolicies.goToPage(1)">1</button>`;
      if (startPage > 2) html += `<button class="btn btn-sm btn-ghost" disabled>...</button>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="btn btn-sm ${i === pagination.page ? 'btn-primary' : 'btn-ghost'}" onclick="FinancePolicies.goToPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<button class="btn btn-sm btn-ghost" disabled>...</button>`;
      html += `<button class="btn btn-sm btn-ghost" onclick="FinancePolicies.goToPage(${totalPages})">${totalPages}</button>`;
    }

    // Sonraki butonu
    html += `<button class="btn btn-sm btn-ghost" ${pagination.page >= totalPages ? 'disabled' : ''} onclick="FinancePolicies.goToPage(${pagination.page + 1})">&raquo;</button>`;

    container.innerHTML = html;
  }

  /**
   * Boş durum göster
   */
  function showEmptyState() {
    const tbody = document.querySelector('.data-table tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center text-muted" style="padding: 2rem;">
            Veri yüklenemedi
          </td>
        </tr>
      `;
    }
  }

  /**
   * Event listener'ları kur
   */
  function setupEventListeners() {
    // Tarih aralığı
    const dateSelect = document.querySelector('.form-group:nth-child(1) .form-select');
    if (dateSelect) {
      dateSelect.addEventListener('change', function(e) {
        const periodMap = {
          'Bu Ay': 'this_month',
          'Son 7 Gun': 'last_7_days',
          'Son 30 Gun': 'last_30_days',
          'Son 3 Ay': 'last_3_months',
          'Bu Yil': 'this_year'
        };
        currentFilters.dateRange = periodMap[e.target.value] || 'this_month';
      });
    }

    // Poliçe tipi
    const typeSelect = document.querySelector('.form-group:nth-child(2) .form-select');
    if (typeSelect) {
      typeSelect.addEventListener('change', function(e) {
        currentFilters.policyType = e.target.value;
      });
    }

    // Çalışan
    const employeeSelect = document.querySelector('.form-group:nth-child(3) .form-select');
    if (employeeSelect) {
      employeeSelect.addEventListener('change', function(e) {
        currentFilters.employeeId = e.target.value;
      });
    }

    // Ödeme durumu
    const statusSelect = document.querySelector('.form-group:nth-child(4) .form-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', function(e) {
        const statusMap = {
          'Odendi': 'Odendi',
          'Ödendi': 'Odendi',
          'Bekliyor': 'Bekliyor',
          'Gecikmis': 'Gecikmis',
          'Gecikmiş': 'Gecikmis',
          'Kismi Odeme': 'Kismi',
          'Kısmi Ödeme': 'Kismi'
        };
        currentFilters.paymentStatus = statusMap[e.target.value] || e.target.value;
      });
    }

    // Acente
    const agencySelect = document.querySelector('.form-group:nth-child(5) .form-select');
    if (agencySelect) {
      agencySelect.addEventListener('change', function(e) {
        currentFilters.agencyCode = e.target.value;
      });
    }

    // Filtrele butonu
    const filterBtn = document.querySelector('.filter-btn');
    if (filterBtn) {
      filterBtn.addEventListener('click', function(e) {
        e.preventDefault();
        pagination.page = 1; // Filtre değiştiğinde ilk sayfaya dön
        loadPolicies();
      });
    }
  }

  /**
   * Sayfaya git
   */
  function goToPage(page) {
    pagination.page = page;
    loadPolicies();
  }

  /**
   * Sayfa yüklendiğinde başlat
   */
  async function init() {
    // Event listener'ları kur
    setupEventListeners();

    // Çalışanları ve acente kodlarını yükle
    await Promise.all([
      loadEmployees(),
      loadAgencyCodes()
    ]);

    // Poliçeleri yükle
    loadPolicies();
  }

  // DOMContentLoaded'da başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  // Global'e expose et
  window.FinancePolicies = {
    reload: loadPolicies,
    goToPage: goToPage,
    getData: () => ({ policies: policiesData, stats: summaryStats })
  };

})();
