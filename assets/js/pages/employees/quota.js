    // ═══════════════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════
    let kotalar = [];
    let currentKotaId = null;
    let insuranceCompanies = [];
    let branches = [];
    let allSubeler = [];
    let confirmCallback = null;

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', async function() {
      requirePermission('komisyonOranlariniDuzenleyebilsin');

      await Promise.all([
        loadKotalar(),
        loadInsuranceCompanies(),
        loadBranches(),
        loadSubeler()
      ]);

      // Toggle label update
      document.getElementById('kotaAktif').addEventListener('change', function() {
        document.getElementById('kotaAktifLabel').textContent = this.checked ? 'Aktif' : 'Pasif';
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // API CALLS
    // ═══════════════════════════════════════════════════════════════
    async function loadKotalar() {
      try {
        const response = await apiGet('kota-islemleri');
        kotalar = response || [];
        renderKotalar();
        updateStats();
      } catch (error) {
        console.error('Kotalar yüklenirken hata:', error);
        showToast('Kotalar yüklenirken hata oluştu', 'error');
        kotalar = [];
        renderKotalar();
      }
    }

    async function loadInsuranceCompanies() {
      try {
        const response = await apiGet('insurance-companies');
        insuranceCompanies = response || [];
      } catch (error) {
        console.error('Sigorta şirketleri yüklenirken hata:', error);
        insuranceCompanies = [];
      }
    }

    async function loadBranches() {
      try {
        const response = await apiGet('insurance-types');
        branches = response || [];
      } catch (error) {
        console.error('Branşlar yüklenirken hata:', error);
        branches = [];
      }
    }

    async function loadSubeler() {
      try {
        const user = APP_CONFIG.AUTH.getUser();
        const firmaId = user?.firmaId;
        if (firmaId) {
          const response = await apiGet('branches', { firmaId });
          allSubeler = response || [];
        }
      } catch (error) {
        console.error('Şubeler yüklenirken hata:', error);
        allSubeler = [];
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function renderKotalar() {
      const grid = document.getElementById('kotalarGrid');
      const countEl = document.getElementById('kotalarCount');

      if (!kotalar || kotalar.length === 0) {
        grid.innerHTML = `
          <div class="group-card group-card-add" onclick="openKotaModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>İlk Kotanızı Oluşturun</span>
          </div>
        `;
        countEl.textContent = '0 kota';
        return;
      }

      countEl.textContent = `${kotalar.length} kota`;

      grid.innerHTML = kotalar.map(kota => {
        const subeAdi = kota.subeAdi || 'Tüm Şubeler';
        const sirketAdi = kota.sigortaSirketAdi || 'Tüm Şirketler';
        const bransAdi = kota.bransAdi || 'Tüm Branşlar';
        const turuLabel = getMaksimumTuruLabel(kota.maksimumTuru);
        const limitText = getLimitText(kota);
        const isAktif = kota.aktif === true || kota.aktif === 1;
        const iconClass = isAktif ? 'emerald' : '';

        return `
          <div class="group-card">
            <div class="group-card-header">
              <div class="group-card-icon ${iconClass}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <div class="group-card-actions">
                <button class="btn-icon" onclick="event.stopPropagation(); openKotaModal(${kota.id})" title="Düzenle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn-icon btn-icon-danger" onclick="event.stopPropagation(); confirmDeleteKota(${kota.id})" title="Sil">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="group-card-title">${escapeHtml(subeAdi)}</div>
            <div class="group-card-desc">${escapeHtml(sirketAdi)} — ${escapeHtml(bransAdi)}${formatDateRange(kota)}</div>
            <div class="group-card-stats">
              <div class="group-stat">
                <div class="group-stat-value">${escapeHtml(turuLabel)}</div>
                <div class="group-stat-label">Kota Türü</div>
              </div>
              <div class="group-stat">
                <div class="group-stat-value">${limitText}</div>
                <div class="group-stat-label">Limit</div>
              </div>
              <span class="status-badge ${isAktif ? 'aktif' : 'pasif'}">
                <span class="status-badge-dot"></span>
                ${isAktif ? 'Aktif' : 'Pasif'}
              </span>
            </div>
          </div>
        `;
      }).join('') + `
        <div class="group-card group-card-add" onclick="openKotaModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Yeni Kota Ekle</span>
        </div>
      `;
    }

    function updateStats() {
      const total = kotalar.length;
      const aktif = kotalar.filter(k => k.aktif === true || k.aktif === 1).length;
      const pasif = total - aktif;

      document.getElementById('statTotalKota').textContent = total;
      document.getElementById('statAktifKota').textContent = aktif;
      document.getElementById('statPasifKota').textContent = pasif;
    }

    function getMaksimumTuruLabel(turu) {
      switch (turu) {
        case 0: return 'Maks. Brüt Prim';
        case 1: return 'Maks. Poliçe Adedi';
        case 2: return 'Brüt Prim / Poliçe Adedi';
        case 3: return 'Trafik Prim Oranı';
        default: return 'Bilinmiyor';
      }
    }

    function getLimitText(kota) {
      switch (kota.maksimumTuru) {
        case 0:
          return formatCurrency(kota.maksBrutPrim);
        case 1:
          return `${kota.maksPoliceAdeti ?? 0} Adet`;
        case 2:
          return `${formatCurrency(kota.maksBrutPrim)} / ${kota.maksPoliceAdeti ?? 0} Adet`;
        case 3:
          return `%${kota.trafikPrimDigerPrimeOrani ?? 0}`;
        default:
          return '-';
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CUSTOM DROPDOWN COMPONENT
    // ═══════════════════════════════════════════════════════════════
    function createCustomDropdown(selectId, options, placeholder = 'Seçiniz') {
      const container = document.getElementById(selectId + 'Container');
      if (!container) return;

      const currentValue = container.dataset.value || '';
      const currentLabel = options.find(o => o.value == currentValue)?.label || placeholder;

      container.innerHTML = `
        <div class="custom-select-wrapper" data-select-id="${selectId}">
          <input type="hidden" id="${selectId}" name="${selectId}" value="${currentValue}">
          <div class="custom-select-trigger" onclick="toggleDropdown('${selectId}')">
            <span>${escapeHtml(currentLabel)}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="custom-select-dropdown">
            <div class="custom-select-search">
              <input type="text" placeholder="Ara..." oninput="filterDropdownOptions('${selectId}', this.value)">
            </div>
            <div class="custom-select-options">
              ${options.map(opt => `
                <div class="custom-select-option ${opt.value == currentValue ? 'selected' : ''}"
                     data-value="${opt.value}"
                     onclick="selectDropdownOption('${selectId}', '${opt.value}', '${escapeHtml(opt.label)}')">
                  ${escapeHtml(opt.label)}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    function toggleDropdown(selectId) {
      const wrapper = document.querySelector(`[data-select-id="${selectId}"]`);
      const isOpen = wrapper.classList.contains('open');

      document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));

      if (!isOpen) {
        wrapper.classList.add('open');
        const searchInput = wrapper.querySelector('.custom-select-search input');
        if (searchInput) {
          setTimeout(() => searchInput.focus(), 50);
        }
      }
    }

    function selectDropdownOption(selectId, value, label) {
      const wrapper = document.querySelector(`[data-select-id="${selectId}"]`);
      const hiddenInput = document.getElementById(selectId);
      const trigger = wrapper.querySelector('.custom-select-trigger span');

      hiddenInput.value = value;
      trigger.textContent = label;

      wrapper.querySelectorAll('.custom-select-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });

      wrapper.classList.remove('open');
      wrapper.parentElement.dataset.value = value;
    }

    function filterDropdownOptions(selectId, searchTerm) {
      const wrapper = document.querySelector(`[data-select-id="${selectId}"]`);
      const options = wrapper.querySelectorAll('.custom-select-option');
      const term = searchTerm.toLowerCase();

      options.forEach(opt => {
        const text = opt.textContent.toLowerCase();
        opt.style.display = text.includes(term) ? '' : 'none';
      });
    }

    function setDropdownValue(selectId, value) {
      const container = document.getElementById(selectId + 'Container');
      if (container) {
        container.dataset.value = value;
      }
    }

    function getDropdownValue(selectId) {
      const input = document.getElementById(selectId);
      return input ? input.value : '';
    }

    // Close dropdowns on outside click
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // DROPDOWN POPULATION
    // ═══════════════════════════════════════════════════════════════
    function populateSubeDropdown() {
      const options = [
        { value: '', label: 'Tüm Şubeler' },
        ...allSubeler.map(s => ({ value: s.id.toString(), label: s.subeAdi || s.name || 'İsimsiz' }))
      ];
      createCustomDropdown('kotaSube', options, 'Tüm Şubeler');
    }

    function populateSirketDropdown() {
      const options = [
        { value: '', label: 'Tüm Şirketler' },
        ...insuranceCompanies.map(c => ({ value: c.id.toString(), label: c.sirketAdi || c.ad }))
      ];
      createCustomDropdown('kotaSirket', options, 'Tüm Şirketler');
    }

    function populateBransDropdown() {
      const options = [
        { value: '', label: 'Tüm Branşlar' },
        ...branches.map(b => ({ value: b.id.toString(), label: b.bransAdi }))
      ];
      createCustomDropdown('kotaBrans', options, 'Tüm Branşlar');
    }

    // ═══════════════════════════════════════════════════════════════
    // MODAL HANDLERS
    // ═══════════════════════════════════════════════════════════════
    function openKotaModal(editId = null) {
      const modal = document.getElementById('kotaModal');
      const title = document.getElementById('kotaModalTitle');
      const submitBtn = document.getElementById('kotaSubmitBtn');

      // Reset form
      document.getElementById('kotaMaksBrutPrim').value = '';
      document.getElementById('kotaMaksPoliceAdeti').value = '';
      document.getElementById('kotaTrafikOrani').value = '';
      document.getElementById('kotaBaslangicTarihi').value = '';
      document.getElementById('kotaBitisTarihi').value = '';
      document.getElementById('kotaAktif').checked = true;
      document.getElementById('kotaAktifLabel').textContent = 'Aktif';
      document.getElementById('kotaMaksimumTuru').value = '0';

      if (editId) {
        const kota = kotalar.find(k => k.id === editId);
        if (!kota) return;

        title.textContent = 'Kota Düzenle';
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Kaydet';
        currentKotaId = editId;

        // Set dropdown values before populating
        setDropdownValue('kotaSube', kota.subeId?.toString() || '');
        setDropdownValue('kotaSirket', kota.sigortaSirketId?.toString() || '');
        setDropdownValue('kotaBrans', kota.bransId?.toString() || '');

        document.getElementById('kotaMaksimumTuru').value = kota.maksimumTuru?.toString() || '0';
        document.getElementById('kotaMaksBrutPrim').value = kota.maksBrutPrim ?? '';
        document.getElementById('kotaMaksPoliceAdeti').value = kota.maksPoliceAdeti ?? '';
        document.getElementById('kotaTrafikOrani').value = kota.trafikPrimDigerPrimeOrani ?? '';
        document.getElementById('kotaBaslangicTarihi').value = kota.baslangicTarihi ? kota.baslangicTarihi.substring(0, 10) : '';
        document.getElementById('kotaBitisTarihi').value = kota.bitisTarihi ? kota.bitisTarihi.substring(0, 10) : '';

        const isAktif = kota.aktif === true || kota.aktif === 1;
        document.getElementById('kotaAktif').checked = isAktif;
        document.getElementById('kotaAktifLabel').textContent = isAktif ? 'Aktif' : 'Pasif';
      } else {
        title.textContent = 'Yeni Kota Ekle';
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Oluştur';
        currentKotaId = null;

        setDropdownValue('kotaSube', '');
        setDropdownValue('kotaSirket', '');
        setDropdownValue('kotaBrans', '');
      }

      // Populate dropdowns after setting values
      populateSubeDropdown();
      populateSirketDropdown();
      populateBransDropdown();

      // Update dynamic fields visibility
      handleMaksimumTuruChange();

      modal.classList.add('active');
    }

    function closeKotaModal() {
      document.getElementById('kotaModal').classList.remove('active');
      currentKotaId = null;
    }

    function handleMaksimumTuruChange() {
      const turu = parseInt(document.getElementById('kotaMaksimumTuru').value);

      const fieldBrutPrim = document.getElementById('fieldMaksBrutPrim');
      const fieldPoliceAdeti = document.getElementById('fieldMaksPoliceAdeti');
      const fieldTrafikOrani = document.getElementById('fieldTrafikOrani');

      // Hide all
      fieldBrutPrim.classList.remove('visible');
      fieldPoliceAdeti.classList.remove('visible');
      fieldTrafikOrani.classList.remove('visible');

      // Show relevant fields based on type
      switch (turu) {
        case 0: // Maks Brüt Prim
          fieldBrutPrim.classList.add('visible');
          break;
        case 1: // Maks Poliçe Adedi
          fieldPoliceAdeti.classList.add('visible');
          break;
        case 2: // Her ikisi
          fieldBrutPrim.classList.add('visible');
          fieldPoliceAdeti.classList.add('visible');
          break;
        case 3: // Trafik Oranı
          fieldTrafikOrani.classList.add('visible');
          break;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFIRM MODAL
    // ═══════════════════════════════════════════════════════════════
    function openConfirmModal(title, message, callback) {
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message;
      confirmCallback = callback;
      document.getElementById('confirmModal').classList.add('active');
    }

    function closeConfirmModal() {
      document.getElementById('confirmModal').classList.remove('active');
      confirmCallback = null;
    }

    function confirmAction() {
      if (confirmCallback) {
        confirmCallback();
      }
      closeConfirmModal();
    }

    // ═══════════════════════════════════════════════════════════════
    // CRUD OPERATIONS
    // ═══════════════════════════════════════════════════════════════
    async function saveKota() {
      const turu = parseInt(document.getElementById('kotaMaksimumTuru').value);
      const subeId = getDropdownValue('kotaSube') || null;
      const sirketId = getDropdownValue('kotaSirket') || null;
      const bransId = getDropdownValue('kotaBrans') || null;
      const aktif = document.getElementById('kotaAktif').checked;

      const maksBrutPrim = document.getElementById('kotaMaksBrutPrim').value;
      const maksPoliceAdeti = document.getElementById('kotaMaksPoliceAdeti').value;
      const trafikOrani = document.getElementById('kotaTrafikOrani').value;
      const baslangicTarihi = document.getElementById('kotaBaslangicTarihi').value || null;
      const bitisTarihi = document.getElementById('kotaBitisTarihi').value || null;

      // Validation based on type
      if (turu === 0 && !maksBrutPrim) {
        showToast('Maksimum brüt prim alanı zorunludur', 'error');
        return;
      }
      if (turu === 1 && !maksPoliceAdeti) {
        showToast('Maksimum poliçe adedi alanı zorunludur', 'error');
        return;
      }
      if (turu === 2 && (!maksBrutPrim || !maksPoliceAdeti)) {
        showToast('Brüt prim ve poliçe adedi alanları zorunludur', 'error');
        return;
      }
      if (turu === 3 && !trafikOrani) {
        showToast('Trafik prim oranı alanı zorunludur', 'error');
        return;
      }

      const btn = document.getElementById('kotaSubmitBtn');
      btn.classList.add('btn-loading');
      btn.disabled = true;

      try {
        const data = {
          aktif: aktif,
          subeId: subeId ? parseInt(subeId) : null,
          sigortaSirketId: sirketId ? parseInt(sirketId) : null,
          bransId: bransId ? parseInt(bransId) : null,
          maksimumTuru: turu,
          maksBrutPrim: maksBrutPrim ? parseInt(maksBrutPrim) : null,
          maksPoliceAdeti: maksPoliceAdeti ? parseInt(maksPoliceAdeti) : null,
          trafikPrimDigerPrimeOrani: trafikOrani ? parseInt(trafikOrani) : null,
          baslangicTarihi: baslangicTarihi,
          bitisTarihi: bitisTarihi
        };

        if (currentKotaId) {
          await apiPut(`kota-islemleri/${currentKotaId}`, data);
          showToast('Kota başarıyla güncellendi', 'success');
        } else {
          await apiPost('kota-islemleri', data);
          showToast('Kota başarıyla oluşturuldu', 'success');
        }

        closeKotaModal();
        await loadKotalar();
      } catch (error) {
        console.error('Kota kaydedilirken hata:', error);
        showToast(error.message || 'Kota kaydedilirken hata oluştu', 'error');
      } finally {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
      }
    }

    function confirmDeleteKota(kotaId) {
      openConfirmModal(
        'Kotayı Sil',
        'Bu kotayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
        () => deleteKota(kotaId)
      );
    }

    async function deleteKota(kotaId) {
      try {
        await apiDelete(`kota-islemleri/${kotaId}`);
        showToast('Kota başarıyla silindi', 'success');
        await loadKotalar();
      } catch (error) {
        console.error('Kota silinirken hata:', error);
        showToast(error.message || 'Kota silinirken hata oluştu', 'error');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatDate(dateStr) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatDateRange(kota) {
      const start = formatDate(kota.baslangicTarihi);
      const end = formatDate(kota.bitisTarihi);
      if (!start && !end) return '';
      if (start && end) return `<br>${start} — ${end}`;
      if (start) return `<br>${start} —`;
      return `<br>— ${end}`;
    }

    function formatCurrency(amount) {
      if (amount == null) return '-';
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    }
