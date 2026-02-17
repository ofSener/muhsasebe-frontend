/**
 * Employee Tracking / Hakediş - API Integration
 * Çalışan hakediş takip sayfası
 */

(function() {
  'use strict';

  // State
  let employees = [];
  let selectedEmployeeId = null;
  let selectedPeriod = null;
  let hakedisData = null;

  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                       'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

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
   * XSS koruması
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Dönem dropdown'ını doldur
   */
  function populatePeriodDropdown() {
    const select = document.getElementById('periodSelect');
    const odemeDonem = document.getElementById('odemeDonem');
    if (!select) return;

    const now = new Date();
    const monthPeriods = [];

    // Son 12 ay
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      monthPeriods.push({
        value: `${year}-${String(month).padStart(2, '0')}`,
        label: `${monthNames[month - 1]} ${year}`
      });
    }

    // "Tarihten itibaren" + aylık seçenekler
    select.innerHTML =
      '<option value="from-date">Tarihten itibaren...</option>' +
      monthPeriods.map(p => `<option value="${p.value}">${p.label}</option>`).join('');

    // Ödeme modal'ındaki dönem dropdown'ını da doldur (sadece aylar)
    if (odemeDonem) {
      odemeDonem.innerHTML = '<option value="">Dönem seçin</option>' +
        monthPeriods.map(p => `<option value="${p.value}">${p.label}</option>`).join('');
    }

    // Varsayılan: ilk ay
    select.value = monthPeriods[0].value;
    selectedPeriod = monthPeriods[0].value;

    // Tarih input'unu bugünün tarihiyle doldur
    const fromDateInput = document.getElementById('fromDateInput');
    if (fromDateInput) {
      fromDateInput.value = now.toISOString().split('T')[0];
    }
  }

  /**
   * "Tarihten itibaren" seçilince tarih input'unu göster/gizle
   */
  function toggleFromDateInput() {
    const select = document.getElementById('periodSelect');
    const fromDateGroup = document.getElementById('fromDateGroup');
    if (!select || !fromDateGroup) return;

    if (select.value === 'from-date') {
      fromDateGroup.style.display = '';
      // Seçili tarihi kullan
      const fromDateInput = document.getElementById('fromDateInput');
      selectedPeriod = fromDateInput ? `from:${fromDateInput.value}` : 'from:' + new Date().toISOString().split('T')[0];
    } else {
      fromDateGroup.style.display = 'none';
      selectedPeriod = select.value;
    }
  }

  /**
   * Aktif çalışanları yükle
   */
  async function loadEmployees() {
    try {
      const response = await apiGet('kullanicilar/aktif');
      employees = Array.isArray(response) ? response : (response.data || []);
      populateEmployeeDropdown();
    } catch (error) {
      console.error('Çalışanlar yüklenemedi:', error);
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
      option.value = emp.id;
      const name = [emp.adi, emp.soyadi].filter(Boolean).join(' ');
      option.textContent = name || emp.email || `Kullanıcı #${emp.id}`;
      select.appendChild(option);
    });

    // İlk çalışanı seç
    if (employees.length > 0) {
      select.value = employees[0].id;
      selectedEmployeeId = employees[0].id;
    }
  }

  /**
   * Seçili çalışanın adını al
   */
  function getSelectedEmployeeName() {
    if (!selectedEmployeeId) return '';
    const emp = employees.find(e => e.id == selectedEmployeeId);
    if (!emp) return '';
    return [emp.adi, emp.soyadi].filter(Boolean).join(' ');
  }

  /**
   * Seçili dönemin label'ını al
   */
  function getSelectedPeriodLabel() {
    if (!selectedPeriod) return '';
    if (selectedPeriod.startsWith('from:')) {
      const dateStr = selectedPeriod.replace('from:', '');
      const date = new Date(dateStr);
      return `${date.toLocaleDateString('tr-TR')} tarihinden itibaren`;
    }
    const [year, month] = selectedPeriod.split('-');
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }

  /**
   * Hakediş verilerini yükle
   */
  async function loadHakedisData() {
    if (!selectedEmployeeId || !selectedPeriod) {
      showToast('Çalışan ve dönem seçin', 'warning');
      return;
    }

    try {
      const response = await apiGet('hakedis', {
        uyeId: selectedEmployeeId,
        donem: selectedPeriod
      });

      hakedisData = response;
      updateSummaryCards(response);
      renderKomisyonDagilimi(response.komisyonDagilimi || []);
      renderPoliceler(response.policeler || []);
    } catch (error) {
      console.error('Hakediş verileri yüklenemedi:', error);
      showToast('Veriler yüklenirken hata oluştu', 'error');
      showEmptyState();
    }
  }

  /**
   * Özet kartlarını güncelle
   */
  function updateSummaryCards(data) {
    if (!data) return;

    const employeeName = getSelectedEmployeeName();
    const periodLabel = getSelectedPeriodLabel();

    // Başlık güncelle
    const titleEl = document.getElementById('ozetTitle');
    if (titleEl) titleEl.textContent = `Hakediş Özeti - ${employeeName || 'Seçili Çalışan'}`;

    const periodEl = document.getElementById('ozetPeriod');
    if (periodEl) periodEl.textContent = periodLabel;

    // Stat kartları
    const statToplamKomisyon = document.getElementById('statToplamKomisyon');
    const statToplamHakedis = document.getElementById('statToplamHakedis');
    const statOdenen = document.getElementById('statOdenen');
    const statKalan = document.getElementById('statKalan');

    if (statToplamKomisyon) statToplamKomisyon.textContent = formatCurrency(data.toplamKomisyon);
    if (statToplamHakedis) statToplamHakedis.textContent = formatCurrency(data.toplamHakedis);
    if (statOdenen) statOdenen.textContent = formatCurrency(data.odenen);
    if (statKalan) statKalan.textContent = formatCurrency(data.kalan);
  }

  /**
   * Komisyon dağılımı tablosunu render et
   */
  function renderKomisyonDagilimi(dagilim) {
    const tbody = document.getElementById('dagilimBody');
    if (!tbody) return;

    if (!dagilim || dagilim.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted" style="padding: 2rem;">
            Komisyon dağılımı bulunamadı
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = dagilim.map(item => `
      <tr>
        <td class="font-semibold" style="color: var(--text-primary);">${escapeHtml(item.label)}</td>
        <td class="font-mono">${item.policeAdeti}</td>
        <td class="font-mono font-semibold" style="color: var(--success);">${formatCurrency(item.toplamKomisyon)}</td>
        <td class="font-mono font-semibold" style="color: var(--warning);">${formatCurrency(item.toplamHakedis)}</td>
      </tr>
    `).join('');
  }

  /**
   * Poliçe tablosunu render et
   */
  function renderPoliceler(policeler) {
    const tbody = document.getElementById('policelerBody');
    const countEl = document.getElementById('policelerCount');
    const tfoot = document.getElementById('policelerFoot');
    if (!tbody) return;

    if (countEl) countEl.textContent = `${policeler.length} poliçe`;

    if (!policeler || policeler.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted" style="padding: 2rem;">
            Bu dönemde poliçe bulunamadı
          </td>
        </tr>
      `;
      if (tfoot) tfoot.style.display = 'none';
      return;
    }

    const avatarColors = ['cyan', 'emerald', 'amber', 'violet', 'rose'];

    tbody.innerHTML = policeler.map((p, i) => {
      const avatarColor = avatarColors[i % avatarColors.length];
      const initials = getInitials(p.sigortaliAdi);

      return `
        <tr>
          <td class="font-mono font-semibold">${escapeHtml(p.policeNumarasi)}</td>
          <td>
            <div class="flex items-center gap-2">
              <div class="avatar avatar-xs avatar-${avatarColor}">${initials}</div>
              <span>${escapeHtml(p.sigortaliAdi || '-')}</span>
            </div>
          </td>
          <td><span class="badge badge-info">${escapeHtml(p.bransAdi || '-')}</span></td>
          <td class="font-mono font-semibold">${formatCurrency(p.brutPrim)}</td>
          <td class="font-mono">${formatCurrency(p.komisyon)}</td>
          <td class="font-mono text-success font-semibold">${formatCurrency(p.hakedis)}</td>
          <td class="text-muted">${formatDate(p.tanzimTarihi)}</td>
        </tr>
      `;
    }).join('');

    // Footer toplamları
    if (tfoot) {
      const topPrim = policeler.reduce((s, p) => s + (p.brutPrim || 0), 0);
      const topKomisyon = policeler.reduce((s, p) => s + (p.komisyon || 0), 0);
      const topHakedis = policeler.reduce((s, p) => s + (p.hakedis || 0), 0);

      document.getElementById('footToplamPrim').textContent = formatCurrency(topPrim);
      document.getElementById('footToplamKomisyon').textContent = formatCurrency(topKomisyon);
      document.getElementById('footToplamHakedis').textContent = formatCurrency(topHakedis);
      tfoot.style.display = '';
    }
  }

  /**
   * Boş durum göster
   */
  function showEmptyState() {
    updateSummaryCards({ toplamKomisyon: 0, toplamHakedis: 0, odenen: 0, kalan: 0 });
    renderKomisyonDagilimi([]);
    renderPoliceler([]);
  }

  /**
   * Ödeme modalını aç
   */
  function openOdemeModal() {
    const modal = document.getElementById('odemeModal');
    if (!modal) return;

    // Çalışan adını doldur
    const calisanInput = document.getElementById('odemeCalisan');
    if (calisanInput) {
      calisanInput.value = getSelectedEmployeeName() || 'Çalışan seçilmedi';
    }

    // Dönem seç (mevcut seçili dönem)
    const donemSelect = document.getElementById('odemeDonem');
    if (donemSelect && selectedPeriod && selectedPeriod !== 'today') {
      donemSelect.value = selectedPeriod;
    }

    // Tutar ve açıklamayı temizle
    const tutarInput = document.getElementById('odemeTutar');
    const aciklamaInput = document.getElementById('odemeAciklama');
    if (tutarInput) tutarInput.value = '';
    if (aciklamaInput) aciklamaInput.value = '';

    modal.classList.add('active');
  }

  /**
   * Ödeme modalını kapat
   */
  function closeOdemeModal() {
    const modal = document.getElementById('odemeModal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Ödeme kaydet
   */
  async function submitOdeme() {
    const donem = document.getElementById('odemeDonem')?.value;
    const tutar = parseFloat(document.getElementById('odemeTutar')?.value);
    const aciklama = document.getElementById('odemeAciklama')?.value?.trim();

    if (!selectedEmployeeId) {
      showToast('Lütfen bir çalışan seçin', 'warning');
      return;
    }

    if (!donem) {
      showToast('Lütfen dönem seçin', 'warning');
      return;
    }

    if (!tutar || tutar <= 0) {
      showToast('Lütfen geçerli bir tutar girin', 'warning');
      return;
    }

    try {
      await apiPost('hakedis/odeme', {
        uyeId: parseInt(selectedEmployeeId),
        donem: donem,
        tutar: tutar,
        aciklama: aciklama || null
      });

      showToast('Ödeme başarıyla kaydedildi', 'success');
      closeOdemeModal();

      // Verileri yenile
      await loadHakedisData();
    } catch (error) {
      console.error('Ödeme kaydedilemedi:', error);
      showToast('Ödeme kaydedilirken hata oluştu', 'error');
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
      periodSelect.addEventListener('change', function() {
        toggleFromDateInput();
      });
    }

    // Tarih input değişikliği
    const fromDateInput = document.getElementById('fromDateInput');
    if (fromDateInput) {
      fromDateInput.addEventListener('change', function() {
        if (document.getElementById('periodSelect')?.value === 'from-date') {
          selectedPeriod = `from:${fromDateInput.value}`;
        }
      });
    }

    // Görüntüle butonu
    const btnGoruntule = document.getElementById('btnGoruntule');
    if (btnGoruntule) {
      btnGoruntule.addEventListener('click', function(e) {
        e.preventDefault();
        loadHakedisData();
      });
    }

    // Ödeme Gir butonu
    const btnOdemeGir = document.getElementById('btnOdemeGir');
    if (btnOdemeGir) {
      btnOdemeGir.addEventListener('click', function(e) {
        e.preventDefault();
        openOdemeModal();
      });
    }

    // Modal kapatma
    const modalClose = document.getElementById('odemeModalClose');
    const modalCancel = document.getElementById('odemeModalCancel');
    if (modalClose) modalClose.addEventListener('click', closeOdemeModal);
    if (modalCancel) modalCancel.addEventListener('click', closeOdemeModal);

    // Modal kaydet
    const modalSave = document.getElementById('odemeModalSave');
    if (modalSave) modalSave.addEventListener('click', submitOdeme);

    // Modal backdrop click ile kapatma
    const modalBackdrop = document.getElementById('odemeModal');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', function(e) {
        if (e.target === modalBackdrop) closeOdemeModal();
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
      loadHakedisData();
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
    reload: loadHakedisData,
    getData: () => hakedisData
  };

})();
