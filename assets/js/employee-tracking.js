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

  // Calendar state
  let calYear, calMonth, calSelectedDate = null;

  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                       'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const dayHeaders = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

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

  // ═══════════════════════════════════════════════════════════════
  // CUSTOM PERIOD DROPDOWN
  // ═══════════════════════════════════════════════════════════════

  function buildPeriodOptions() {
    const now = new Date();
    const options = [];

    // "Tarihten itibaren" seçeneği
    options.push({ value: 'from-date', label: 'Tarihten itibaren...', special: true });

    // Son 12 ay
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      options.push({
        value: `${year}-${String(month).padStart(2, '0')}`,
        label: `${monthNames[month - 1]} ${year}`
      });
    }

    return options;
  }

  function populatePeriodDropdown() {
    const panel = document.getElementById('periodPanel');
    const triggerText = document.getElementById('periodTriggerText');
    const odemeDonem = document.getElementById('odemeDonem');
    if (!panel) return;

    const options = buildPeriodOptions();

    // Custom dropdown panel
    panel.innerHTML = options.map((opt, i) => {
      let html = '';
      if (i === 1) html += '<div class="custom-dropdown-divider"></div>';
      html += `<div class="custom-dropdown-option${i === 1 ? ' selected' : ''}" data-value="${opt.value}">${escapeHtml(opt.label)}</div>`;
      return html;
    }).join('');

    // Default: first month
    const defaultOpt = options[1];
    if (triggerText) triggerText.textContent = defaultOpt.label;
    selectedPeriod = defaultOpt.value;

    // Ödeme modal dönem dropdown
    if (odemeDonem) {
      odemeDonem.innerHTML = '<option value="">Dönem seçin</option>' +
        options.filter(o => !o.special).map(p => `<option value="${p.value}">${escapeHtml(p.label)}</option>`).join('');
    }
  }

  function togglePeriodDropdown() {
    const trigger = document.getElementById('periodTrigger');
    const panel = document.getElementById('periodPanel');
    if (!trigger || !panel) return;

    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      closePeriodDropdown();
    } else {
      trigger.classList.add('open');
      panel.classList.add('open');
    }
  }

  function closePeriodDropdown() {
    const trigger = document.getElementById('periodTrigger');
    const panel = document.getElementById('periodPanel');
    if (trigger) trigger.classList.remove('open');
    if (panel) panel.classList.remove('open');
  }

  function selectPeriodOption(value, label) {
    const triggerText = document.getElementById('periodTriggerText');
    const panel = document.getElementById('periodPanel');
    const calWrapper = document.getElementById('calendarWrapper');

    // Update trigger text
    if (triggerText) triggerText.textContent = label;

    // Update selected state
    if (panel) {
      panel.querySelectorAll('.custom-dropdown-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.value === value);
      });
    }

    closePeriodDropdown();

    if (value === 'from-date') {
      // Show calendar
      if (calWrapper) calWrapper.classList.add('open');
      const now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth();
      calSelectedDate = now;
      selectedPeriod = `from:${formatDateISO(now)}`;
      renderCalendar();
    } else {
      // Hide calendar, set period
      if (calWrapper) calWrapper.classList.remove('open');
      selectedPeriod = value;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CUSTOM CALENDAR
  // ═══════════════════════════════════════════════════════════════

  function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function renderCalendar() {
    const grid = document.getElementById('calGrid');
    const title = document.getElementById('calTitle');
    if (!grid || !title) return;

    title.textContent = `${monthNames[calMonth]} ${calYear}`;

    const today = new Date();
    const todayStr = formatDateISO(today);
    const selectedStr = calSelectedDate ? formatDateISO(calSelectedDate) : '';

    // First day of month (Monday = 0)
    const firstDay = new Date(calYear, calMonth, 1);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6; // Sunday → 6

    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

    let html = dayHeaders.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    // Previous month trailing days
    for (let i = startDow - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      html += `<button class="calendar-day other-month" data-date="${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}" tabindex="-1">${day}</button>`;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let cls = 'calendar-day';
      if (dateStr === todayStr) cls += ' today';
      if (dateStr === selectedStr) cls += ' selected';
      html += `<button class="${cls}" data-date="${dateStr}">${d}</button>`;
    }

    // Next month leading days
    const totalCells = startDow + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
      html += `<button class="calendar-day other-month" tabindex="-1">${d}</button>`;
    }

    grid.innerHTML = html;
  }

  function onCalendarDayClick(dateStr) {
    if (!dateStr) return;
    calSelectedDate = new Date(dateStr + 'T00:00:00');
    selectedPeriod = `from:${dateStr}`;

    // Update trigger text
    const triggerText = document.getElementById('periodTriggerText');
    if (triggerText) {
      const d = calSelectedDate;
      triggerText.textContent = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()} itibaren`;
    }

    renderCalendar();

    // Close calendar after selection
    const calWrapper = document.getElementById('calendarWrapper');
    if (calWrapper) calWrapper.classList.remove('open');
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  async function loadEmployees() {
    try {
      const response = await apiGet('kullanicilar/aktif');
      employees = Array.isArray(response) ? response : (response.data || []);
      populateEmployeeDropdown();
    } catch (error) {
      console.error('Çalışanlar yüklenemedi:', error);
    }
  }

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

    if (employees.length > 0) {
      select.value = employees[0].id;
      selectedEmployeeId = employees[0].id;
    }
  }

  function getSelectedEmployeeName() {
    if (!selectedEmployeeId) return '';
    const emp = employees.find(e => e.id == selectedEmployeeId);
    if (!emp) return '';
    return [emp.adi, emp.soyadi].filter(Boolean).join(' ');
  }

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
      await loadOdemeler();
    } catch (error) {
      console.error('Hakediş verileri yüklenemedi:', error);
      showToast('Veriler yüklenirken hata oluştu', 'error');
      showEmptyState();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  function updateSummaryCards(data) {
    if (!data) return;

    const employeeName = getSelectedEmployeeName();
    const periodLabel = getSelectedPeriodLabel();

    const titleEl = document.getElementById('ozetTitle');
    if (titleEl) titleEl.textContent = `Hakediş Özeti - ${employeeName || 'Seçili Çalışan'}`;

    const periodEl = document.getElementById('ozetPeriod');
    if (periodEl) periodEl.textContent = periodLabel;

    const statToplamKomisyon = document.getElementById('statToplamKomisyon');
    const statToplamHakedis = document.getElementById('statToplamHakedis');
    const statOdenen = document.getElementById('statOdenen');
    const statKalan = document.getElementById('statKalan');

    if (statToplamKomisyon) statToplamKomisyon.textContent = formatCurrency(data.toplamKomisyon);
    if (statToplamHakedis) statToplamHakedis.textContent = formatCurrency(data.toplamHakedis);
    if (statOdenen) statOdenen.textContent = formatCurrency(data.odenen);
    if (statKalan) statKalan.textContent = formatCurrency(data.kalan);
  }

  function renderKomisyonDagilimi(dagilim) {
    const tbody = document.getElementById('dagilimBody');
    if (!tbody) return;

    if (!dagilim || dagilim.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted" style="padding: 2rem;">
            Komisyon dağılımı bulunamadı
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = dagilim.map(item => {
      const isPaid = item.toplamHakedis > 0 && item.odenen >= item.toplamHakedis;
      const rowClass = isPaid ? ' class="row-paid"' : '';
      const odenenColor = isPaid ? 'color: #34d399;' : 'color: var(--text-secondary);';

      return `
      <tr${rowClass}>
        <td class="font-semibold" style="color: var(--text-primary);">${escapeHtml(item.label)}</td>
        <td class="font-mono">${item.policeAdeti}</td>
        <td class="font-mono font-semibold" style="color: var(--success);">${formatCurrency(item.toplamKomisyon)}</td>
        <td class="font-mono font-semibold" style="color: var(--warning);">${formatCurrency(item.toplamHakedis)}</td>
        <td class="font-mono font-semibold" style="${odenenColor}">${formatCurrency(item.odenen)}${isPaid ? ' <span class="badge-paid">Tamamlandı</span>' : ''}</td>
      </tr>
      `;
    }).join('');
  }

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

  async function loadOdemeler() {
    if (!selectedEmployeeId) return;

    try {
      const odemeler = await apiGet('hakedis/odemeler', { uyeId: selectedEmployeeId });
      renderOdemeler(odemeler || []);
    } catch (error) {
      console.error('Ödemeler yüklenemedi:', error);
      renderOdemeler([]);
    }
  }

  function renderOdemeler(odemeler) {
    const tbody = document.getElementById('odemelerBody');
    const countEl = document.getElementById('odemelerCount');
    if (!tbody) return;

    if (countEl) countEl.textContent = odemeler.length > 0 ? `${odemeler.length} ödeme` : '';

    if (!odemeler || odemeler.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted" style="padding: 2rem;">
            Ödeme kaydı bulunamadı
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = odemeler.map(item => `
      <tr>
        <td class="font-semibold" style="color: var(--text-primary);">${escapeHtml(item.donem)}</td>
        <td class="font-mono font-semibold" style="color: var(--success);">${formatCurrency(item.tutar)}</td>
        <td class="text-muted">${item.aciklama ? escapeHtml(item.aciklama) : '-'}</td>
        <td class="font-mono">${formatDate(item.eklenmeTarihi)}</td>
      </tr>
    `).join('');
  }

  function showEmptyState() {
    updateSummaryCards({ toplamKomisyon: 0, toplamHakedis: 0, odenen: 0, kalan: 0 });
    renderKomisyonDagilimi([]);
    renderOdemeler([]);
    renderPoliceler([]);
  }

  // ═══════════════════════════════════════════════════════════════
  // PAYMENT MODAL
  // ═══════════════════════════════════════════════════════════════

  function openOdemeModal() {
    const modal = document.getElementById('odemeModal');
    if (!modal) return;

    const calisanInput = document.getElementById('odemeCalisan');
    if (calisanInput) {
      calisanInput.value = getSelectedEmployeeName() || 'Çalışan seçilmedi';
    }

    const donemSelect = document.getElementById('odemeDonem');
    if (donemSelect && selectedPeriod && !selectedPeriod.startsWith('from:')) {
      donemSelect.value = selectedPeriod;
    }

    const tutarInput = document.getElementById('odemeTutar');
    const aciklamaInput = document.getElementById('odemeAciklama');
    if (tutarInput) tutarInput.value = '';
    if (aciklamaInput) aciklamaInput.value = '';

    modal.classList.add('active');
  }

  function closeOdemeModal() {
    const modal = document.getElementById('odemeModal');
    if (modal) modal.classList.remove('active');
  }

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
      await loadHakedisData();
    } catch (error) {
      console.error('Ödeme kaydedilemedi:', error);
      showToast('Ödeme kaydedilirken hata oluştu', 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Employee select
    const employeeSelect = document.getElementById('employeeSelect');
    if (employeeSelect) {
      employeeSelect.addEventListener('change', function(e) {
        selectedEmployeeId = e.target.value;
      });
    }

    // Custom period dropdown trigger
    const periodTrigger = document.getElementById('periodTrigger');
    if (periodTrigger) {
      periodTrigger.addEventListener('click', function(e) {
        e.stopPropagation();
        togglePeriodDropdown();
      });
    }

    // Period dropdown option clicks
    const periodPanel = document.getElementById('periodPanel');
    if (periodPanel) {
      periodPanel.addEventListener('click', function(e) {
        const option = e.target.closest('.custom-dropdown-option');
        if (!option) return;
        selectPeriodOption(option.dataset.value, option.textContent);
      });
    }

    // Calendar navigation
    const calPrev = document.getElementById('calPrev');
    const calNext = document.getElementById('calNext');
    if (calPrev) {
      calPrev.addEventListener('click', function() {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        renderCalendar();
      });
    }
    if (calNext) {
      calNext.addEventListener('click', function() {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
        renderCalendar();
      });
    }

    // Calendar day clicks
    const calGrid = document.getElementById('calGrid');
    if (calGrid) {
      calGrid.addEventListener('click', function(e) {
        const dayBtn = e.target.closest('.calendar-day');
        if (!dayBtn || dayBtn.classList.contains('other-month')) return;
        onCalendarDayClick(dayBtn.dataset.date);
      });
    }

    // Close dropdown and calendar on outside click
    document.addEventListener('click', function(e) {
      const dropdown = document.getElementById('periodDropdown');
      const calWrapper = document.getElementById('calendarWrapper');

      if (dropdown && !dropdown.contains(e.target)) {
        closePeriodDropdown();
      }

      if (calWrapper && calWrapper.classList.contains('open') &&
          !calWrapper.contains(e.target) &&
          !(dropdown && dropdown.contains(e.target))) {
        calWrapper.classList.remove('open');
      }
    });

    // Görüntüle button
    const btnGoruntule = document.getElementById('btnGoruntule');
    if (btnGoruntule) {
      btnGoruntule.addEventListener('click', function(e) {
        e.preventDefault();
        loadHakedisData();
      });
    }

    // Ödeme button
    const btnOdemeGir = document.getElementById('btnOdemeGir');
    if (btnOdemeGir) {
      btnOdemeGir.addEventListener('click', function(e) {
        e.preventDefault();
        openOdemeModal();
      });
    }

    // Modal controls
    const modalClose = document.getElementById('odemeModalClose');
    const modalCancel = document.getElementById('odemeModalCancel');
    if (modalClose) modalClose.addEventListener('click', closeOdemeModal);
    if (modalCancel) modalCancel.addEventListener('click', closeOdemeModal);

    const modalSave = document.getElementById('odemeModalSave');
    if (modalSave) modalSave.addEventListener('click', submitOdeme);

    const modalBackdrop = document.getElementById('odemeModal');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', function(e) {
        if (e.target === modalBackdrop) closeOdemeModal();
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════

  async function init() {
    populatePeriodDropdown();
    setupEventListeners();
    await loadEmployees();

    if (selectedEmployeeId) {
      loadHakedisData();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  window.EmployeeTracking = {
    reload: loadHakedisData,
    getData: () => hakedisData
  };

})();
