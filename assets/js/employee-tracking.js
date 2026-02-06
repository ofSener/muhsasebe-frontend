/**
 * Employee Tracking / Hakediş - API Integration
 * Çalışan hakediş takip sayfası için dinamik veri yükleme
 */

(function() {
  'use strict';

  // State
  let employees = [];
  let selectedEmployeeId = null;
  let selectedPeriod = null;
  let earningsData = null;
  let policiesData = [];
  let chart = null;

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
   * Aktif çalışanları yükle
   */
  async function loadEmployees() {
    try {
      const response = await apiGet('kullanicilar/aktif');
      employees = Array.isArray(response) ? response : (response.users || response.data || []);
      populateEmployeeDropdown();
    } catch (error) {
      console.error('Çalışanlar yüklenemedi:', error);
      // Hata durumunda alternatif endpoint dene
      try {
        const response = await apiGet('kullanicilar');
        employees = Array.isArray(response) ? response : (response.users || response.data || []);
        employees = employees.filter(e => e.aktif !== false && e.status !== 'inactive');
        populateEmployeeDropdown();
      } catch (e) {
        console.error('Alternatif endpoint de başarısız:', e);
      }
    }
  }

  /**
   * Çalışan dropdown'ını doldur
   */
  function populateEmployeeDropdown() {
    const select = document.getElementById('employeeSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Çalışan Seçin</option>';

    employees.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.id || emp.kullaniciId;
      option.textContent = emp.adSoyad || emp.name || emp.ad + ' ' + emp.soyad;
      select.appendChild(option);
    });

    // İlk çalışanı seç
    if (employees.length > 0) {
      select.value = employees[0].id || employees[0].kullaniciId;
      selectedEmployeeId = select.value;
    }
  }

  /**
   * Dönem dropdown'ını doldur
   */
  function populatePeriodDropdown() {
    const select = document.getElementById('periodSelect');
    if (!select) return;

    const now = new Date();
    const periods = [];

    // Son 12 ay
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

      periods.push({
        value: `${year}-${String(month).padStart(2, '0')}`,
        label: `${monthNames[month - 1]} ${year}`
      });
    }

    select.innerHTML = periods.map(p =>
      `<option value="${p.value}">${p.label}</option>`
    ).join('');

    // İlk dönemi seç
    if (periods.length > 0) {
      selectedPeriod = periods[0].value;
    }
  }

  /**
   * Çalışan hakediş verilerini yükle
   */
  async function loadEarningsData() {
    if (!selectedEmployeeId || !selectedPeriod) {
      console.warn('Çalışan veya dönem seçilmedi');
      return;
    }

    try {
      // Hakediş özet bilgilerini al
      const params = new URLSearchParams({
        kullaniciId: selectedEmployeeId,
        donem: selectedPeriod
      });

      const response = await apiGet(`earnings/my?${params}`);
      earningsData = response;
      updateEarningsSummary(response);

      // Poliçe detaylarını al
      await loadPoliciesData();

    } catch (error) {
      console.error('Hakediş verileri yüklenemedi:', error);
      // Alternatif endpoint dene
      try {
        const response = await apiGet(`hakedis/${selectedEmployeeId}?donem=${selectedPeriod}`);
        earningsData = response;
        updateEarningsSummary(response);
      } catch (e) {
        console.error('Alternatif endpoint de başarısız:', e);
        showEmptyState();
      }
    }
  }

  /**
   * Poliçe detaylarını yükle
   */
  async function loadPoliciesData() {
    try {
      const [year, month] = selectedPeriod.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Ayın son günü

      const params = new URLSearchParams({
        kullaniciId: selectedEmployeeId,
        startDate: startDate,
        endDate: endDate
      });

      const response = await apiGet(`policies?${params}`);
      policiesData = Array.isArray(response) ? response : (response.policies || response.data || []);
      updatePoliciesTable();
      updateCommissionChart();

    } catch (error) {
      console.error('Poliçe detayları yüklenemedi:', error);
    }
  }

  /**
   * Hakediş özeti kartlarını güncelle
   */
  function updateEarningsSummary(data) {
    if (!data) return;

    const employee = employees.find(e => (e.id || e.kullaniciId) == selectedEmployeeId);
    const employeeName = employee ? (employee.adSoyad || employee.name) : 'Seçili Çalışan';

    // Kart başlığı
    const cardTitle = document.querySelector('.card-header .card-title');
    if (cardTitle && cardTitle.textContent.includes('Hakediş Özeti')) {
      cardTitle.textContent = `Hakediş Özeti - ${employeeName}`;
    }

    // Dönem badge
    const periodBadge = document.querySelector('.card-header .badge-info');
    if (periodBadge) {
      const [year, month] = selectedPeriod.split('-');
      const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      periodBadge.textContent = `${monthNames[parseInt(month) - 1]} ${year}`;
    }

    // Stat kartları
    updateStatValue('.stat-cyan .stat-value', formatCurrency(data.toplamPrim || data.totalPremium || 0));
    updateStatValue('.stat-emerald .stat-value', formatCurrency(data.toplamKomisyon || data.totalCommission || 0));
    updateStatValue('.stat-violet .stat-value', formatCurrency(data.odenen || data.paid || 0));
    updateStatValue('.stat-amber .stat-value', formatCurrency(data.kalan || data.remaining || 0));
  }

  /**
   * Stat değerini güncelle
   */
  function updateStatValue(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
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
          <td colspan="9" class="text-center text-muted" style="padding: 2rem;">
            Bu dönemde poliçe bulunamadı
          </td>
        </tr>
      `;
      return;
    }

    const avatarColors = ['cyan', 'emerald', 'amber', 'violet', 'rose'];

    tbody.innerHTML = policiesData.map((policy, index) => {
      const policeNo = policy.policeNo || policy.policeNumarasi || '-';
      const musteriAdi = policy.musteriAdi || policy.customerName || '-';
      const initials = getInitials(musteriAdi);
      const brans = policy.bransAdi || policy.brans || policy.tip || '-';
      const prim = policy.brutPrim || policy.prim || policy.premium || 0;
      const oran = policy.komisyonOrani || policy.commissionRate || 10;
      const komisyon = policy.komisyon || (prim * oran / 100) || 0;
      const durum = policy.odemeDurumu || policy.paymentStatus || 'Bekliyor';
      const tarih = formatDate(policy.policeTarihi || policy.eklenmeTarihi || policy.date);
      const avatarColor = avatarColors[index % avatarColors.length];

      const durumBadge = getDurumBadge(durum);

      return `
        <tr>
          <td><input type="checkbox" style="accent-color: var(--primary);"></td>
          <td class="font-mono font-semibold">${policeNo}</td>
          <td>
            <div class="flex items-center gap-2">
              <div class="avatar avatar-xs avatar-${avatarColor}">${initials}</div>
              <span>${musteriAdi}</span>
            </div>
          </td>
          <td><span class="badge badge-info">${brans}</span></td>
          <td class="font-mono font-semibold">${formatCurrency(prim)}</td>
          <td class="font-mono">%${oran}</td>
          <td class="font-mono text-success font-semibold">${formatCurrency(komisyon)}</td>
          <td>${durumBadge}</td>
          <td class="text-muted">${tarih}</td>
        </tr>
      `;
    }).join('');

    // Toplam satırını güncelle
    updateTableFooter();
  }

  /**
   * Durum badge'i oluştur
   */
  function getDurumBadge(durum) {
    const statusMap = {
      'Ödendi': { class: 'badge-success', text: 'Ödendi' },
      'Paid': { class: 'badge-success', text: 'Ödendi' },
      'Bekliyor': { class: 'badge-warning', text: 'Bekliyor' },
      'Pending': { class: 'badge-warning', text: 'Bekliyor' },
      'İptal': { class: 'badge-danger', text: 'İptal' },
      'Cancelled': { class: 'badge-danger', text: 'İptal' }
    };
    const badge = statusMap[durum] || { class: 'badge-secondary', text: durum || 'Bilinmiyor' };
    return `<span class="badge ${badge.class}">${badge.text}</span>`;
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
      const oran = p.komisyonOrani || 10;
      return sum + (p.komisyon || (prim * oran / 100));
    }, 0);

    tfoot.innerHTML = `
      <tr style="background: var(--bg-elevated);">
        <td colspan="4" class="font-semibold">Toplam (${policiesData.length} poliçe gösteriliyor)</td>
        <td class="font-mono font-semibold">${formatCurrency(totalPrim)}</td>
        <td></td>
        <td class="font-mono text-success font-semibold">${formatCurrency(totalKomisyon)}</td>
        <td colspan="2"></td>
      </tr>
    `;

    // Pagination bilgisini güncelle
    const paginationInfo = document.querySelector('.card-footer .text-muted');
    if (paginationInfo) {
      paginationInfo.textContent = `${policiesData.length} / ${policiesData.length} poliçe gösteriliyor`;
    }
  }

  /**
   * Komisyon dağılımı chart'ını güncelle
   */
  function updateCommissionChart() {
    const chartEl = document.getElementById('commission-chart');
    if (!chartEl) return;

    // Branş bazında grupla
    const bransMap = {};
    policiesData.forEach(p => {
      const brans = p.bransAdi || p.brans || 'Diğer';
      const prim = p.brutPrim || p.prim || 0;
      const oran = p.komisyonOrani || 10;
      const komisyon = p.komisyon || (prim * oran / 100);

      if (!bransMap[brans]) {
        bransMap[brans] = { prim: 0, komisyon: 0 };
      }
      bransMap[brans].prim += prim;
      bransMap[brans].komisyon += komisyon;
    });

    const labels = Object.keys(bransMap);
    const primValues = labels.map(l => bransMap[l].prim);
    const komisyonValues = labels.map(l => bransMap[l].komisyon);

    // Chart güncelle veya oluştur
    if (chart) {
      chart.updateOptions({
        xaxis: { categories: labels }
      });
      chart.updateSeries([
        { name: 'Prim', data: primValues },
        { name: 'Komisyon', data: komisyonValues }
      ]);
    } else if (typeof createBarChart === 'function') {
      chart = createBarChart('commission-chart', {
        labels: labels,
        datasets: [
          { name: 'Prim', values: primValues },
          { name: 'Komisyon', values: komisyonValues }
        ]
      }, {
        colors: [chartColors?.primary || '#00d4ff', chartColors?.success || '#10b981'],
        height: 280
      });
    }
  }

  /**
   * Boş durum göster
   */
  function showEmptyState() {
    updateStatValue('.stat-cyan .stat-value', '0 TL');
    updateStatValue('.stat-emerald .stat-value', '0 TL');
    updateStatValue('.stat-violet .stat-value', '0 TL');
    updateStatValue('.stat-amber .stat-value', '0 TL');

    const tbody = document.querySelector('.data-table tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center text-muted" style="padding: 2rem;">
            Veri bulunamadı
          </td>
        </tr>
      `;
    }
  }

  /**
   * Event listener'ları kur
   */
  function setupEventListeners() {
    // Çalışan seçimi
    const employeeSelect = document.getElementById('employeeSelect');
    if (employeeSelect) {
      employeeSelect.addEventListener('change', function(e) {
        selectedEmployeeId = e.target.value;
      });
    }

    // Dönem seçimi
    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) {
      periodSelect.addEventListener('change', function(e) {
        selectedPeriod = e.target.value;
      });
    }

    // Görüntüle butonu
    const viewButton = document.querySelector('.card-body .btn-primary');
    if (viewButton) {
      viewButton.addEventListener('click', function(e) {
        e.preventDefault();
        loadEarningsData();
      });
    }
  }

  /**
   * Sayfa yüklendiğinde başlat
   */
  async function init() {
    // Dönem dropdown'ını doldur
    populatePeriodDropdown();

    // Event listener'ları kur
    setupEventListeners();

    // Çalışanları yükle
    await loadEmployees();

    // İlk çalışan seçiliyse verileri yükle
    if (selectedEmployeeId) {
      loadEarningsData();
    }
  }

  // DOMContentLoaded'da başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  // Global'e expose et
  window.EmployeeTracking = {
    reload: loadEarningsData,
    getData: () => ({ earnings: earningsData, policies: policiesData })
  };

})();
