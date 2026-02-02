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

      // YENİ: Backend artık PoliceListDto döndürüyor (camelCase)
      policiesData = response.items || [];
      pagination.totalCount = response.totalCount || 0;
      pagination.page = response.currentPage || pagination.page;
      pagination.pageSize = response.pageSize || pagination.pageSize;

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

    // Diğer filtreler (backend parametre adları)
    if (currentFilters.policyType) params.append('policeTuruId', currentFilters.policyType);
    if (currentFilters.employeeId) params.append('uyeId', currentFilters.employeeId);
    if (currentFilters.paymentStatus) params.append('onayDurumu', currentFilters.paymentStatus);
    // agencyCode için backend'de henüz parametre yok

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
          <td colspan="9" style="text-align: center; padding: 2rem;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin: 0 auto 1rem; display: block;">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style="color: #64748b;">Filtrelere uygun poliçe bulunamadı</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = policiesData.map((policy) => {
      // camelCase property names (JSON serialization düzeltildi)
      const sigortaSirketiId = policy.sigortaSirketiId || 0;
      const sigortaSirketiAdi = policy.sigortaSirketiAdi || '-';
      const policeNo = policy.policeNumarasi || '-';
      const plaka = policy.plaka || '-';
      const policeTuru = policy.policeTuruAdi || '-';
      const brutPrim = policy.brutPrim || 0;
      const komisyon = policy.komisyon || 0;
      const onayDurumu = policy.onayDurumu === 1 ? 'Onaylı' : 'Beklemede';
      const onayClass = policy.onayDurumu === 1 ? 'status-success' : 'status-warning';

      // Tarih formatlama
      const baslangicTarihi = formatDate(policy.baslangicTarihi);
      const bitisTarihi = formatDate(policy.bitisTarihi);

      // Sigorta şirketi logosu
      const logoHtml = getSigortaSirketiLogo(sigortaSirketiId, sigortaSirketiAdi);

      return `
        <tr data-id="${policy.id}" style="cursor: pointer;" onclick="viewPolicyDetail(${policy.id})">
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              ${logoHtml}
              <div>
                <div class="font-mono font-semibold">${policeNo}</div>
                ${plaka !== '-' ? `<div style="font-size: 0.75rem; color: #64748b;">${plaka}</div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span class="policy-badge">${policeTuru}</span>
          </td>
          <td>
            <div style="font-size: 0.875rem;">${baslangicTarihi}</div>
          </td>
          <td>
            <div style="font-size: 0.875rem;">${bitisTarihi}</div>
          </td>
          <td style="text-align: right;">
            <div class="font-mono font-semibold">${formatCurrency(brutPrim)}</div>
          </td>
          <td style="text-align: right;">
            <div class="font-mono">${formatCurrency(komisyon)}</div>
          </td>
          <td>
            <span class="status-badge ${onayClass}">${onayDurumu}</span>
          </td>
          <td>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); viewPolicyDetail(${policy.id})" title="Görüntüle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Table footer'ı güncelle
    updateTableFooter();
  }

  /**
   * Sigorta şirketi logo/icon
   */
  function getSigortaSirketiLogo(id, name) {
    // Logo mapping (sigorta şirketi ID'sine göre)
    const logoMap = {
      110: 'anadolu-sigorta.svg',
      111: 'aksigorta.svg'
      // ... daha fazla şirket eklenebilir
    };

    const logoFile = logoMap[id];
    // Logo dosyası için basit fallback (dosya var mı kontrolü yapılamaz browser'da)
    if (logoFile) {
      return `<img src="../../assets/images/insurance-logos/${logoFile}" alt="${name}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: contain; background: #f8fafc; padding: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <div style="width: 32px; height: 32px; border-radius: 6px; background: linear-gradient(135deg, #60a5fa, #2563eb); color: white; display: none; align-items: center; justify-content: center; font-weight: 600; font-size: 14px;">${name.charAt(0).toUpperCase()}</div>`;
    }

    // Fallback: İlk harf ikonu
    const initial = name.charAt(0).toUpperCase();
    return `<div style="width: 32px; height: 32px; border-radius: 6px; background: linear-gradient(135deg, #60a5fa, #2563eb); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px;">${initial}</div>`;
  }

  /**
   * Poliçe detayını görüntüle
   */
  function viewPolicyDetail(policyId) {
    console.log('Poliçe detayı:', policyId);
    // TODO: Modal veya detay sayfası aç
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

    const totalPrim = policiesData.reduce((sum, p) => sum + (p.brutPrim || 0), 0);
    const totalKomisyon = policiesData.reduce((sum, p) => sum + (p.komisyon || 0), 0);

    tfoot.innerHTML = `
      <tr class="summary-footer">
        <td colspan="4" style="text-align: right; font-weight: 600;">Sayfa Toplamı:</td>
        <td style="text-align: right;" class="font-mono font-semibold">${formatCurrency(totalPrim)}</td>
        <td style="text-align: right;" class="font-mono font-semibold">${formatCurrency(totalKomisyon)}</td>
        <td colspan="2"></td>
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

    // Toplam prim (sayfa bazlı)
    const totalPrim = policiesData.reduce((sum, p) => sum + (p.brutPrim || 0), 0);
    const totalPrimEl = document.querySelector('.summary-item:nth-child(2) .summary-value');
    if (totalPrimEl) {
      totalPrimEl.textContent = formatCurrency(totalPrim);
    }

    // Toplam komisyon (sayfa bazlı)
    const totalKomisyon = policiesData.reduce((sum, p) => sum + (p.komisyon || 0), 0);
    const totalKomisyonEl = document.querySelector('.summary-item:nth-child(3) .summary-value');
    if (totalKomisyonEl) {
      totalKomisyonEl.textContent = formatCurrency(totalKomisyon);
    }

    // Ortalama komisyon oranı (sayfa bazlı)
    const avgOran = policiesData.length > 0 && totalPrim > 0 ?
      ((totalKomisyon / totalPrim) * 100).toFixed(1) : 0;
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
