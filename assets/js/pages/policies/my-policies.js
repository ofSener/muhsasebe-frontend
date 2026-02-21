    // ═══════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════
    let policies = [];
    let filteredPolicies = [];
    let policyDriveLinks = {};

    // Reference data
    let policyTypes = [];
    let producersList = [];
    let branchesList = [];
    let insuranceCompanies = [];
    let companyCodeMap = {};

    // Logo path constants
    const LOGO_BASE_PATH = '../../assets/images/logos/insurance-companies/';
    const LOGO_EXTENSION = '.png';

    // Sort, pagination, editing
    let currentSort = { field: 'startDate', direction: 'desc' };
    let currentPage = 1;
    let pageSize = 20;
    let currentEditingPolicyId = null;

    // Search debounce
    let searchTimeout = null;

    // ═══════════════════════════════════════════════════════════════
    // PAGE INITIALIZATION
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', async () => {
      if (!hasViewPermission()) {
        showToast('Bu sayfaya erişim yetkiniz yok', 'error');
        setTimeout(() => window.location.href = '../../index.html', 1500);
        return;
      }

      initializeDatePickers();

      try {
        // Load reference data in parallel
        await Promise.all([
          loadProducers(),
          loadBranches(),
          loadPolicyTypes(),
          loadInsuranceCompanies()
        ]);

        // Load policies
        await loadPolicies();
      } catch (error) {
        console.error('Sayfa yüklenirken hata:', error);
        showToast('Sayfa yüklenirken hata oluştu', 'error');
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // DATE PILLS & RANGE PICKER
    // ═══════════════════════════════════════════════════════════════
    let currentDateRange = { startDate: null, endDate: null };
    let dateRangePicker = null;

    function initializeDatePickers() {
      // Range pill flatpickr
      dateRangePicker = flatpickr('#dateRangeFilter', {
        locale: 'tr',
        mode: 'range',
        dateFormat: 'd.m.Y',
        onChange: function(selectedDates) {
          if (selectedDates.length === 2) {
            // Deactivate pill buttons
            document.querySelectorAll('.date-pill:not(.date-pill-range)').forEach(btn => btn.classList.remove('active'));
            document.getElementById('rangePill').classList.add('active');

            currentDateRange.startDate = selectedDates[0];
            currentDateRange.endDate = selectedDates[1];
            currentPage = 1;
            loadPolicies();
          }
        }
      });
    }

    function setQuickDate(preset, btnEl) {
      const today = new Date();
      let startDate, endDate = today;

      switch (preset) {
        case 'today':
          startDate = new Date(today);
          break;
        case 'yesterday':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 1);
          endDate = new Date(startDate);
          break;
        case 'week':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - today.getDay() + 1);
          break;
        case 'month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(today.getFullYear(), 0, 1);
          break;
        case 'last30':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 29);
          break;
        case 'last365':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 364);
          break;
        default:
          return;
      }

      // Update active pill
      document.querySelectorAll('.date-pill').forEach(btn => btn.classList.remove('active'));
      if (btnEl) btnEl.classList.add('active');
      document.getElementById('rangePill').classList.remove('active');

      // Clear flatpickr selection
      if (dateRangePicker) dateRangePicker.clear();

      currentDateRange.startDate = startDate;
      currentDateRange.endDate = endDate;
      currentPage = 1;
      loadPolicies();
    }

    // ═══════════════════════════════════════════════════════════════
    // REFERENCE DATA LOADING
    // ═══════════════════════════════════════════════════════════════
    async function loadProducers() {
      try {
        const user = APP_CONFIG.AUTH.getUser();
        const firmaId = user?.firmaId;
        const endpoint = firmaId ? `kullanicilar/aktif?firmaId=${firmaId}` : 'kullanicilar/aktif';
        const data = await apiGet(endpoint);
        const colors = ['emerald', 'cyan', 'violet', 'amber'];
        producersList = (data || []).map((u, idx) => {
          const name = `${u.adi || ''} ${u.soyadi || ''}`.trim() || `Kullanıcı #${u.id}`;
          const nameParts = name.split(' ').filter(p => p.length > 0);
          const initials = nameParts.length >= 2
            ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase();
          return {
            id: u.id,
            name: name,
            initials: initials,
            color: colors[idx % colors.length],
            branchId: u.subeId,
            subeId: u.subeId,
            branch: u.subeAdi || ''
          };
        });
        populateProducerFilter();
      } catch (error) {
        console.error('Prodüktör listesi alınamadı:', error);
        producersList = [];
      }
    }

    async function loadBranches() {
      try {
        const user = APP_CONFIG.AUTH.getUser();
        const firmaId = user?.firmaId;
        const endpoint = firmaId ? `branches?firmaId=${firmaId}` : 'branches';
        const data = await apiGet(endpoint);
        branchesList = (data || []).map(b => b.subeAdi || b.name);
        populateBranchFilter();
      } catch (error) {
        console.error('Şube listesi alınamadı:', error);
        branchesList = [];
      }
    }

    async function loadPolicyTypes() {
      try {
        const data = await apiGet('policy-types');
        policyTypes = (data || []).map(pt => ({
          id: pt.id,
          value: pt.turu,
          class: pt.turu ? pt.turu.toLowerCase().replace(/ı/g, 'i') : 'kasko'
        }));
        populateInsuranceTypeFilter();
      } catch (error) {
        console.error('Poliçe tipleri alınamadı:', error);
        policyTypes = [
          { id: null, value: 'Kasko', class: 'kasko' },
          { id: null, value: 'Trafik', class: 'trafik' },
          { id: null, value: 'DASK', class: 'dask' },
          { id: null, value: 'Sağlık', class: 'saglik' },
          { id: null, value: 'Konut', class: 'konut' }
        ];
        populateInsuranceTypeFilter();
      }
    }

    async function loadInsuranceCompanies() {
      try {
        const data = await apiGet('insurance-companies');
        insuranceCompanies = data || [];
        companyCodeMap = {};
        insuranceCompanies.forEach(company => {
          companyCodeMap[company.id] = company.kod;
        });
        populateCompanyFilter();
      } catch (error) {
        console.error('Sigorta şirketleri alınamadı:', error);
        insuranceCompanies = [];
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // POLICY LOADING
    // ═══════════════════════════════════════════════════════════════
    async function loadPolicies() {
      try {
        let queryParams = 'pageSize=1000';

        if (currentDateRange.startDate) {
          const start = new Date(currentDateRange.startDate);
          start.setHours(0, 0, 0, 0);
          queryParams += `&startDate=${start.toISOString()}`;
        }
        if (currentDateRange.endDate) {
          const end = new Date(currentDateRange.endDate);
          end.setHours(23, 59, 59, 999);
          queryParams += `&endDate=${end.toISOString()}`;
        }

        const response = await apiGet(`policies?${queryParams}`);
        const rawItems = response.items || [];

        // Map each policy from API format
        policies = rawItems.map(mapPolicyFromApi);

        // Load Drive links
        const policeIds = policies.map(p => p.id?.toString()).filter(Boolean);
        if (policeIds.length > 0) {
          try {
            const driveResult = await apiPost('drive/by-police-batch', { policeIds });
            policyDriveLinks = driveResult?.links || {};
          } catch (e) {
            console.log('Drive linkleri alınamadı:', e);
            policyDriveLinks = {};
          }
        }

        // Re-populate company filter with actual data
        populateCompanyFilter();
        populateInsuranceTypeFilter();

        applyFilters();
      } catch (error) {
        console.error('Poliçeler yüklenirken hata:', error);
        document.getElementById('policyTableBody').innerHTML = `
          <tr>
            <td colspan="11" style="text-align: center; padding: 2rem; color: var(--danger);">
              Poliçeler yüklenirken hata oluştu: ${error.message}
            </td>
          </tr>
        `;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // MAP POLICY FROM API
    // ═══════════════════════════════════════════════════════════════
    function mapPolicyFromApi(p) {
      const producer = producersList.find(pr => pr.id === p.produktorId);
      const producerName = producer ? producer.name : (p.produktorAdi || `Prodüktör #${p.produktorId || '?'}`);

      const typeName = p.policeTuruAdi || p.policeTuru || 'Bilinmiyor';
      const typeClass = getTypeClass(typeName);

      const branch = p.subeAdi || (producer?.branch) || '';

      // Find kesen uye info (UyeId = poliçeyi kesen üye)
      const kesenUye = producersList.find(pr => pr.id === p.uyeId);
      const kesenUyeName = kesenUye ? kesenUye.name : (p.uyeAdi || '');
      const kesenUyeInitials = kesenUye?.initials || (kesenUyeName ? kesenUyeName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '');
      const kesenUyeColor = kesenUye?.color || 'violet';
      const kesenUyeBranch = kesenUye?.branch || '';

      return {
        id: p.id,
        policyNo: p.policeNumarasi || p.policeNo || '',
        customer: p.sigortaliAdi || p.musteriAdi || 'Bilinmiyor',
        musteriId: p.musteriId || null,
        tcKimlikNo: p.tcKimlikNo || '',
        vergiNo: p.vergiNo || '',
        type: typeName,
        typeClass: typeClass,
        netPremium: p.netPrim || 0,
        grossPremium: p.brutPrim || 0,
        komisyon: p.komisyon || 0,
        producer: producerName,
        producerId: p.produktorId,
        producerInitials: producer?.initials || producerName.substring(0, 2).toUpperCase(),
        producerColor: producer?.color || 'emerald',
        branch: branch,
        branchId: p.subeId,
        kesenUyeName: kesenUyeName,
        kesenUyeInitials: kesenUyeInitials,
        kesenUyeColor: kesenUyeColor,
        kesenUyeBranch: kesenUyeBranch,
        kesenUyeId: p.uyeId,
        sigortaSirketiId: p.sigortaSirketiId || 0,
        sigortaSirketiAdi: p.sigortaSirketiAdi || '',
        plaka: p.plaka || '',
        acenteAdi: p.acenteAdi || '',
        acenteNo: p.acenteNo || '',
        zeyilNo: p.zeyilNo || 0,
        tanzimTarihi: p.tanzimTarihi ? new Date(p.tanzimTarihi) : null,
        tanzimFormatted: p.tanzimTarihi ? new Date(p.tanzimTarihi).toLocaleDateString('tr-TR') : '-',
        startDate: p.baslangicTarihi ? new Date(p.baslangicTarihi) : null,
        startDateFormatted: p.baslangicTarihi ? new Date(p.baslangicTarihi).toLocaleDateString('tr-TR') : '-',
        endDate: p.bitisTarihi ? new Date(p.bitisTarihi) : null,
        endDateFormatted: p.bitisTarihi ? new Date(p.bitisTarihi).toLocaleDateString('tr-TR') : '-',
        // Keep raw API data for edit form
        _raw: p
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function getInsuranceCompanyLogo(sirketId) {
      const companyCode = companyCodeMap[sirketId];
      if (companyCode) {
        return `${LOGO_BASE_PATH}${companyCode.toLowerCase()}${LOGO_EXTENSION}`;
      }
      return '';
    }

    function getInsuranceCompanyInitials(sirketAdi) {
      if (!sirketAdi) return '?';
      const words = sirketAdi.split(' ').filter(w => w.length > 0);
      if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
      }
      return sirketAdi.substring(0, 2).toUpperCase();
    }

    function getTypeClass(typeName) {
      const name = (typeName || '').toLowerCase();
      if (name.includes('kasko')) return 'kasko';
      if (name.includes('trafik')) return 'trafik';
      if (name.includes('dask')) return 'dask';
      if (name.includes('konut')) return 'konut';
      if (name.includes('sağlık') || name.includes('saglik')) return 'saglik';
      return '';
    }

    function getColorGradient(color) {
      const gradients = {
        'emerald': '#10b981, #059669',
        'cyan': '#06b6d4, #0891b2',
        'violet': '#8b5cf6, #7c3aed',
        'amber': '#f59e0b, #d97706'
      };
      return gradients[color] || '#6366f1, #4f46e5';
    }

    function formatNumber(num) {
      if (num === null || num === undefined) return '0';
      return Number(num).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(dateStr) {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      return date.toLocaleDateString('tr-TR');
    }

    // ═══════════════════════════════════════════════════════════════
    // DROPDOWN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function closeAllDropdowns(except) {
      document.querySelectorAll('.custom-dropdown.open').forEach(d => {
        if (d !== except) d.classList.remove('open');
      });
    }

    // Click outside to close
    document.addEventListener('click', function(event) {
      ['producerDropdown', 'branchDropdown', 'companyDropdown', 'insuranceTypeDropdown'].forEach(id => {
        const dropdown = document.getElementById(id);
        if (dropdown && !dropdown.contains(event.target)) {
          dropdown.classList.remove('open');
        }
      });
    });

    // ── Producer Dropdown ──
    function populateProducerFilter() {
      const list = document.getElementById('producerList');
      if (!list) return;

      const avatarColors = [
        'linear-gradient(135deg, #10b981, #059669)',
        'linear-gradient(135deg, #06b6d4, #0891b2)',
        'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        'linear-gradient(135deg, #f59e0b, #d97706)',
        'linear-gradient(135deg, #f43f5e, #e11d48)',
        'linear-gradient(135deg, #3b82f6, #2563eb)'
      ];

      let html = `
        <div class="dropdown-item selected" data-value="" onclick="selectProducer(this, '', 'Tüm Prodüktörler')">
          <span class="dropdown-item-avatar" style="background: linear-gradient(135deg, #64748b, #475569);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </span>
          <span class="dropdown-item-name">Tüm Prodüktörler</span>
        </div>
      `;

      producersList.forEach((p, index) => {
        const initials = p.initials;
        const color = avatarColors[index % avatarColors.length];
        const escapedName = p.name.replace(/'/g, "\\'");
        html += `
          <div class="dropdown-item" data-value="${p.name}" onclick="selectProducer(this, '${escapedName}', '${escapedName}')">
            <span class="dropdown-item-avatar" style="background: ${color};">${initials}</span>
            <span class="dropdown-item-name">${p.name}</span>
          </div>
        `;
      });
      list.innerHTML = html;
    }

    function toggleProducerDropdown(event) {
      event.stopPropagation();
      const dropdown = document.getElementById('producerDropdown');
      closeAllDropdowns(dropdown);
      dropdown.classList.toggle('open');
      if (dropdown.classList.contains('open')) {
        document.getElementById('producerSearchInput').value = '';
        filterProducerList();
        document.getElementById('producerSearchInput').focus();
      }
    }

    function filterProducerList() {
      const searchTerm = document.getElementById('producerSearchInput').value.toLowerCase();
      document.querySelectorAll('#producerList .dropdown-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
      });
    }

    function selectProducer(element, value, displayText) {
      document.getElementById('producerFilter').value = value;
      document.getElementById('producerFilterText').textContent = displayText;
      document.querySelectorAll('#producerList .dropdown-item').forEach(item => item.classList.remove('selected'));
      element.classList.add('selected');
      document.getElementById('producerDropdown').classList.remove('open');
      currentPage = 1;
      applyFilters();
    }

    // ── Branch Dropdown ──
    function populateBranchFilter() {
      const list = document.getElementById('branchList');
      if (!list) return;

      const avatarColors = [
        'linear-gradient(135deg, #10b981, #059669)',
        'linear-gradient(135deg, #06b6d4, #0891b2)',
        'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        'linear-gradient(135deg, #f59e0b, #d97706)'
      ];

      let html = `
        <div class="dropdown-item selected" data-value="" onclick="selectBranch(this, '', 'Tüm Şubeler')">
          <span class="dropdown-item-avatar" style="background: linear-gradient(135deg, #64748b, #475569);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
          </span>
          <span class="dropdown-item-name">Tüm Şubeler</span>
        </div>
      `;

      branchesList.forEach((name, index) => {
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const color = avatarColors[index % avatarColors.length];
        const escapedName = name.replace(/'/g, "\\'");
        html += `
          <div class="dropdown-item" data-value="${name}" onclick="selectBranch(this, '${escapedName}', '${escapedName}')">
            <span class="dropdown-item-avatar" style="background: ${color};">${initials}</span>
            <span class="dropdown-item-name">${name}</span>
          </div>
        `;
      });
      list.innerHTML = html;
    }

    function toggleBranchDropdown(event) {
      event.stopPropagation();
      const dropdown = document.getElementById('branchDropdown');
      closeAllDropdowns(dropdown);
      dropdown.classList.toggle('open');
      if (dropdown.classList.contains('open')) {
        document.getElementById('branchSearchInput').value = '';
        filterBranchList();
        document.getElementById('branchSearchInput').focus();
      }
    }

    function filterBranchList() {
      const searchTerm = document.getElementById('branchSearchInput').value.toLowerCase();
      document.querySelectorAll('#branchList .dropdown-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
      });
    }

    function selectBranch(element, value, displayText) {
      document.getElementById('branchFilter').value = value;
      document.getElementById('branchFilterText').textContent = displayText;
      document.querySelectorAll('#branchList .dropdown-item').forEach(item => item.classList.remove('selected'));
      element.classList.add('selected');
      document.getElementById('branchDropdown').classList.remove('open');
      currentPage = 1;
      applyFilters();
    }

    // ── Company Dropdown ──
    function populateCompanyFilter() {
      const list = document.getElementById('companyList');
      if (!list) return;

      const avatarColors = [
        'linear-gradient(135deg, #10b981, #059669)',
        'linear-gradient(135deg, #06b6d4, #0891b2)',
        'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        'linear-gradient(135deg, #f59e0b, #d97706)'
      ];

      let html = `
        <div class="dropdown-item selected" data-value="" onclick="selectCompany(this, '', 'Tüm Şirketler')">
          <span class="dropdown-item-avatar" style="background: linear-gradient(135deg, #64748b, #475569);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 3h-8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/>
            </svg>
          </span>
          <span class="dropdown-item-name">Tüm Şirketler</span>
        </div>
      `;

      let companyNames = [];
      if (policies.length > 0) {
        companyNames = [...new Set(policies.map(p => p.sigortaSirketiAdi))].filter(n => n && n.trim() !== '');
      } else {
        companyNames = insuranceCompanies.map(c => c.adi || c.ad || '').filter(n => n && n.trim() !== '');
      }
      companyNames.sort((a, b) => String(a).localeCompare(String(b), 'tr'));

      companyNames.forEach((name, index) => {
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const color = avatarColors[index % avatarColors.length];
        const escapedName = name.replace(/'/g, "\\'");
        html += `
          <div class="dropdown-item" data-value="${name}" onclick="selectCompany(this, '${escapedName}', '${escapedName}')">
            <span class="dropdown-item-avatar" style="background: ${color};">${initials}</span>
            <span class="dropdown-item-name">${name}</span>
          </div>
        `;
      });
      list.innerHTML = html;
    }

    function toggleCompanyDropdown(event) {
      event.stopPropagation();
      const dropdown = document.getElementById('companyDropdown');
      closeAllDropdowns(dropdown);
      dropdown.classList.toggle('open');
      if (dropdown.classList.contains('open')) {
        document.getElementById('companySearchInput').value = '';
        filterCompanyList();
        document.getElementById('companySearchInput').focus();
      }
    }

    function filterCompanyList() {
      const searchTerm = document.getElementById('companySearchInput').value.toLowerCase();
      document.querySelectorAll('#companyList .dropdown-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
      });
    }

    function selectCompany(element, value, displayText) {
      document.getElementById('companyFilter').value = value;
      document.getElementById('companyFilterText').textContent = displayText;
      document.querySelectorAll('#companyList .dropdown-item').forEach(item => item.classList.remove('selected'));
      element.classList.add('selected');
      document.getElementById('companyDropdown').classList.remove('open');
      currentPage = 1;
      applyFilters();
    }

    // ── Insurance Type Dropdown ──
    function populateInsuranceTypeFilter() {
      const list = document.getElementById('insuranceTypeList');
      if (!list) return;

      const typeColors = {
        'kasko': 'linear-gradient(135deg, #3b82f6, #2563eb)',
        'trafik': 'linear-gradient(135deg, #f59e0b, #d97706)',
        'dask': 'linear-gradient(135deg, #ef4444, #dc2626)',
        'konut': 'linear-gradient(135deg, #10b981, #059669)',
        'saglik': 'linear-gradient(135deg, #ec4899, #db2777)',
        'default': 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
      };

      let html = `
        <div class="dropdown-item selected" data-value="" onclick="selectInsuranceType(this, '', 'Tüm Ürünler')">
          <span class="dropdown-item-avatar" style="background: linear-gradient(135deg, #64748b, #475569);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </span>
          <span class="dropdown-item-name">Tüm Ürünler</span>
        </div>
      `;

      let types = [];
      if (policies.length > 0) {
        types = [...new Set(policies.map(p => p.type))].filter(t => t && t !== 'Bilinmiyor');
      } else if (policyTypes.length > 0) {
        types = policyTypes.map(t => t.value).filter(Boolean);
      }
      types.sort((a, b) => String(a).localeCompare(String(b), 'tr'));

      types.forEach((typeName) => {
        const initials = typeName.substring(0, 2).toUpperCase();
        const colorKey = typeName.toLowerCase().replace('ı', 'i').replace('ğ', 'g').replace('ü', 'u').replace('ş', 's').replace('ö', 'o').replace('ç', 'c');
        const color = typeColors[colorKey] || typeColors['default'];
        const escapedName = typeName.replace(/'/g, "\\'");
        html += `
          <div class="dropdown-item" data-value="${typeName}" onclick="selectInsuranceType(this, '${escapedName}', '${escapedName}')">
            <span class="dropdown-item-avatar" style="background: ${color};">${initials}</span>
            <span class="dropdown-item-name">${typeName}</span>
          </div>
        `;
      });
      list.innerHTML = html;
    }

    function toggleInsuranceTypeDropdown(event) {
      event.stopPropagation();
      const dropdown = document.getElementById('insuranceTypeDropdown');
      closeAllDropdowns(dropdown);
      dropdown.classList.toggle('open');
      if (dropdown.classList.contains('open')) {
        document.getElementById('insuranceTypeSearchInput').value = '';
        filterInsuranceTypeList();
        document.getElementById('insuranceTypeSearchInput').focus();
      }
    }

    function filterInsuranceTypeList() {
      const searchTerm = document.getElementById('insuranceTypeSearchInput').value.toLowerCase();
      document.querySelectorAll('#insuranceTypeList .dropdown-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
      });
    }

    function selectInsuranceType(element, value, displayText) {
      document.getElementById('insuranceTypeFilter').value = value;
      document.getElementById('insuranceTypeFilterText').textContent = displayText;
      document.querySelectorAll('#insuranceTypeList .dropdown-item').forEach(item => item.classList.remove('selected'));
      element.classList.add('selected');
      document.getElementById('insuranceTypeDropdown').classList.remove('open');
      currentPage = 1;
      applyFilters();
    }

    // ═══════════════════════════════════════════════════════════════
    // FILTER & SORT
    // ═══════════════════════════════════════════════════════════════
    function applyFilters() {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase();
      const producerFilter = document.getElementById('producerFilter').value;
      const branchFilter = document.getElementById('branchFilter').value;
      const companyFilter = document.getElementById('companyFilter').value;
      const insuranceTypeFilter = document.getElementById('insuranceTypeFilter').value;

      let result = [...policies];

      // Search
      if (searchTerm) {
        result = result.filter(p =>
          p.policyNo.toLowerCase().includes(searchTerm) ||
          p.customer.toLowerCase().includes(searchTerm) ||
          p.plaka.toLowerCase().includes(searchTerm) ||
          p.producer.toLowerCase().includes(searchTerm) ||
          (p.sigortaSirketiAdi || '').toLowerCase().includes(searchTerm) ||
          p.type.toLowerCase().includes(searchTerm)
        );
      }

      if (producerFilter) result = result.filter(p => p.producer === producerFilter);
      if (branchFilter) result = result.filter(p => p.branch === branchFilter);
      if (companyFilter) result = result.filter(p => p.sigortaSirketiAdi === companyFilter);
      if (insuranceTypeFilter) result = result.filter(p => p.type === insuranceTypeFilter);

      // Sort
      if (currentSort.field && currentSort.direction) {
        result.sort((a, b) => {
          let aVal, bVal;

          switch (currentSort.field) {
            case 'grossPremium':
              aVal = a.grossPremium || 0;
              bVal = b.grossPremium || 0;
              break;
            case 'producer':
              aVal = (a.producer || '').toLocaleLowerCase('tr');
              bVal = (b.producer || '').toLocaleLowerCase('tr');
              break;
            case 'startDate':
              aVal = a.startDate ? a.startDate.getTime() : 0;
              bVal = b.startDate ? b.startDate.getTime() : 0;
              break;
            case 'endDate':
              aVal = a.endDate ? a.endDate.getTime() : 0;
              bVal = b.endDate ? b.endDate.getTime() : 0;
              break;
            default:
              aVal = a[currentSort.field] || '';
              bVal = b[currentSort.field] || '';
          }

          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;

          let comparison = 0;
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal;
          } else {
            comparison = String(aVal).localeCompare(String(bVal), 'tr', { sensitivity: 'base', numeric: true });
          }

          return currentSort.direction === 'asc' ? comparison : -comparison;
        });
      }

      filteredPolicies = result;
      renderTable();
      updateStats();
    }

    function handleSearchKeyup(event) {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentPage = 1;
        applyFilters();
      }, 300);
    }

    function clearFilters() {
      document.getElementById('searchInput').value = '';
      document.getElementById('producerFilter').value = '';
      document.getElementById('producerFilterText').textContent = 'Tüm Prodüktörler';
      document.getElementById('branchFilter').value = '';
      document.getElementById('branchFilterText').textContent = 'Tüm Şubeler';
      document.getElementById('companyFilter').value = '';
      document.getElementById('companyFilterText').textContent = 'Tüm Şirketler';
      document.getElementById('insuranceTypeFilter').value = '';
      document.getElementById('insuranceTypeFilterText').textContent = 'Tüm Ürünler';

      // Clear date pills
      document.querySelectorAll('.date-pill').forEach(btn => btn.classList.remove('active'));
      document.getElementById('rangePill').classList.remove('active');
      if (dateRangePicker) dateRangePicker.clear();
      currentDateRange = { startDate: null, endDate: null };

      // Reset selected states
      document.querySelectorAll('.dropdown-list .dropdown-item').forEach(item => item.classList.remove('selected'));
      document.querySelectorAll('.dropdown-list .dropdown-item:first-child').forEach(item => item.classList.add('selected'));

      currentPage = 1;
      loadPolicies();
    }

    function sortTable(field) {
      if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.field = field;
        const numericOrDateFields = ['grossPremium', 'startDate', 'endDate'];
        currentSort.direction = numericOrDateFields.includes(field) ? 'desc' : 'asc';
      }

      // Update sort indicators
      document.querySelectorAll('.sortable').forEach(th => th.classList.remove('asc', 'desc'));
      const currentTh = document.querySelector(`[data-sort="${field}"]`);
      if (currentTh) currentTh.classList.add(currentSort.direction);

      currentPage = 1;
      applyFilters();
    }

    // ═══════════════════════════════════════════════════════════════
    // TABLE RENDERING
    // ═══════════════════════════════════════════════════════════════
    function renderTable() {
      const tbody = document.getElementById('policyTableBody');
      const totalItems = filteredPolicies.length;
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalItems);
      const pageData = filteredPolicies.slice(startIndex, endIndex);

      if (totalItems === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="11" style="text-align: center; padding: 2rem; color: var(--text-muted);">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.5rem; opacity: 0.5;">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <br>Poliçe bulunamadı.
            </td>
          </tr>
        `;
        document.getElementById('tableInfo').textContent = '0 poliçe';
        updatePaginationControls(0, 0);
        return;
      }

      tbody.innerHTML = pageData.map(p => {
        const logoUrl = getInsuranceCompanyLogo(p.sigortaSirketiId);
        const initials = getInsuranceCompanyInitials(p.sigortaSirketiAdi);
        const driveLink = policyDriveLinks[p.id];

        // Kesen üye hover card HTML
        let kesenUyeHoverHtml = '';
        if (p.kesenUyeName) {
          kesenUyeHoverHtml = `
            <div class="kesen-uye-hover">
              <div class="kesen-uye-hover-label">Kesen Üye</div>
              <div class="kesen-uye-hover-body">
                <div class="producer-avatar ${p.kesenUyeColor}" style="width:24px;height:24px;font-size:0.55rem;">${p.kesenUyeInitials}</div>
                <div class="producer-info">
                  <span class="producer-name">${p.kesenUyeName}</span>
                  ${p.kesenUyeBranch ? `<span class="producer-branch">${p.kesenUyeBranch}</span>` : ''}
                </div>
              </div>
            </div>
          `;
        }

        return `
        <tr>
          <td data-label="Şirket" style="overflow:visible; position:relative;">
            <div class="company-logo" data-tooltip="${p.sigortaSirketiAdi}">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="${p.sigortaSirketiAdi}" onerror="this.parentElement.innerHTML='${initials}'">`
                : initials}
            </div>
          </td>
          <td data-label="Poliçe No">
            ${driveLink
              ? `<span class="clickable-link font-mono" style="font-weight: 600;" onclick="window.open('${driveLink}', '_blank')" title="PDF'i görüntüle">
                  ${p.policyNo}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15,3 21,3 21,9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </span>`
              : `<span class="font-mono" style="font-weight: 600;">${p.policyNo}</span>`
            }
            ${p.plaka ? `<div class="cell-sub" style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono,monospace);">${p.plaka}</div>` : ''}
          </td>
          <td data-label="Müşteri">
            <div class="cell-main clickable-customer" onclick="openCustomerModal('${p.customer.replace(/'/g, "\\'")}', ${p.id}, ${p.musteriId || 'null'})">${p.customer}</div>
          </td>
          <td data-label="Tip">
            <span class="policy-type-badge ${p.typeClass}">${p.type}</span>
          </td>
          <td data-label="Brüt Prim" style="white-space:nowrap; overflow:visible; position:relative;">
            <span class="font-mono font-semibold" style="white-space:nowrap" data-tooltip="Net Prim: ${formatNumber(p.netPremium)} TL">${formatNumber(p.grossPremium)} TL</span>
          </td>
          <td data-label="Prodüktör" style="overflow:visible; position:relative;">
            <div class="producer-cell">
              <div class="producer-avatar ${p.producerColor}">${p.producerInitials}</div>
              <div class="producer-info">
                <span class="producer-name clickable-producer" onclick="openProducerModal('${p.producer.replace(/'/g, "\\'")}', '${p.producerInitials}', '${p.producerColor}', ${p.id}, ${p.producerId})">${p.producer}</span>
                <span class="producer-branch">${p.branch}</span>
              </div>
              ${kesenUyeHoverHtml}
            </div>
          </td>
          <td data-label="Acente No" style="overflow:visible; position:relative;">
            <span class="acente-no" data-tooltip="${p.acenteAdi || 'Acente bilgisi yok'}">${p.acenteNo || '-'}</span>
          </td>
          <td data-label="Başlangıç">
            <span class="cell-sub">${p.startDateFormatted}</span>
          </td>
          <td data-label="Bitiş">
            <span class="cell-sub">${p.endDateFormatted}</span>
          </td>
          <td data-label="Komisyon" style="white-space:nowrap;">
            <span class="font-mono" style="white-space:nowrap">${formatNumber(p.komisyon)} TL</span>
          </td>
          <td data-label="İşlem">
            <div class="table-actions">
              <button class="action-btn" onclick="viewPolicy(${p.id})" title="Detay">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button class="action-btn edit-btn" onclick="openEditPolicyModal(${p.id})" title="Düzenle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="action-btn" onclick="openZeyilModal(${p.id})" title="Zeyil Geçmişi" style="font-size:0.65rem;font-weight:700;color:var(--text-muted);">
                Z
              </button>
            </div>
          </td>
        </tr>
      `}).join('');

      document.getElementById('tableInfo').textContent = `${startIndex + 1}-${endIndex} / ${totalItems} poliçe`;
      updatePaginationControls(currentPage, totalPages);
    }

    function updateStats() {
      document.getElementById('totalCount').textContent = `${filteredPolicies.length} poliçe`;

      // KPI Cards
      const totalBrut = filteredPolicies.reduce((sum, p) => sum + (p.grossPremium || 0), 0);
      const totalKomisyon = filteredPolicies.reduce((sum, p) => sum + (p.komisyon || 0), 0);

      document.getElementById('kpiBrutPrim').textContent = formatNumber(totalBrut) + ' TL';
      document.getElementById('kpiKomisyon').textContent = formatNumber(totalKomisyon) + ' TL';
      document.getElementById('kpiPoliceAdet').textContent = filteredPolicies.length.toLocaleString('tr-TR');
    }

    // ═══════════════════════════════════════════════════════════════
    // PAGINATION
    // ═══════════════════════════════════════════════════════════════
    function updatePaginationControls(current, total) {
      const prevBtn = document.getElementById('prevPageBtn');
      const nextBtn = document.getElementById('nextPageBtn');
      const pageNumbersContainer = document.getElementById('pageNumbers');

      prevBtn.disabled = current <= 1;
      nextBtn.disabled = current >= total;

      if (total <= 1) {
        pageNumbersContainer.innerHTML = '';
        return;
      }

      let html = '';
      html += `<button class="page-number ${current === 1 ? 'active' : ''}" onclick="goToPage(1)">1</button>`;

      if (current > 3) html += '<span class="page-ellipsis">...</span>';

      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        html += `<button class="page-number ${i === current ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
      }

      if (current < total - 2) html += '<span class="page-ellipsis">...</span>';

      if (total > 1) {
        html += `<button class="page-number ${current === total ? 'active' : ''}" onclick="goToPage(${total})">${total}</button>`;
      }

      pageNumbersContainer.innerHTML = html;
    }

    function goToPage(page) {
      currentPage = page;
      applyFilters();
    }

    function prevPage() {
      if (currentPage > 1) {
        currentPage--;
        applyFilters();
      }
    }

    function nextPage() {
      const totalPages = Math.ceil(filteredPolicies.length / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        applyFilters();
      }
    }

    function changePageSize(newSize) {
      pageSize = parseInt(newSize);
      currentPage = 1;
      applyFilters();
    }

    // ═══════════════════════════════════════════════════════════════
    // POLICY DETAIL MODAL
    // ═══════════════════════════════════════════════════════════════
    function viewPolicy(id) {
      const policy = policies.find(p => p.id === id);
      if (!policy) return;

      document.getElementById('policyModalSubtitle').textContent = `#${policy.policyNo}`;

      // Wire up footer buttons
      document.getElementById('policyModalEditBtn').onclick = () => {
        closePolicyDetailModal();
        openEditPolicyModal(id);
      };
      document.getElementById('policyModalZeyilBtn').onclick = () => {
        closePolicyDetailModal();
        openZeyilModal(id);
      };

      const logoUrl = getInsuranceCompanyLogo(policy.sigortaSirketiId);
      const initials = getInsuranceCompanyInitials(policy.sigortaSirketiAdi);

      const modalBody = document.getElementById('policyDetailModalBody');
      modalBody.innerHTML = `
        <div class="policy-detail-content">
          <div class="policy-detail-header">
            <div class="policy-company-logo">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="${policy.sigortaSirketiAdi}" onerror="this.parentElement.innerHTML='${initials}'">`
                : initials}
            </div>
            <div class="policy-header-info">
              <div class="policy-header-title">${policy.sigortaSirketiAdi || 'Sigorta Şirketi'}</div>
              <div class="policy-header-type">
                <span class="policy-type-badge ${policy.typeClass}">${policy.type}</span>
              </div>
            </div>
          </div>

          <div class="policy-detail-grid">
            <div class="policy-detail-item">
              <div class="policy-detail-label">Poliçe No</div>
              <div class="policy-detail-value mono">${policy.policyNo}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Plaka</div>
              <div class="policy-detail-value mono">${policy.plaka || '-'}</div>
            </div>
            <div class="policy-detail-item full-width">
              <div class="policy-detail-label">Müşteri / Sigortalı</div>
              <div class="policy-detail-value">${policy.customer}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">TC Kimlik No</div>
              <div class="policy-detail-value mono">${policy.tcKimlikNo || '-'}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Vergi No</div>
              <div class="policy-detail-value mono">${policy.vergiNo || '-'}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Zeyil No</div>
              <div class="policy-detail-value mono">${policy.zeyilNo || '0'}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Prodüktör</div>
              <div class="policy-detail-value">${policy.producer}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Kesen Üye</div>
              <div class="policy-detail-value">${policy.kesenUyeName || '-'}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Tanzim Tarihi</div>
              <div class="policy-detail-value">${policy.tanzimFormatted}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Başlangıç</div>
              <div class="policy-detail-value">${policy.startDateFormatted}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Bitiş</div>
              <div class="policy-detail-value">${policy.endDateFormatted}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Acente</div>
              <div class="policy-detail-value">${policy.acenteAdi || '-'} ${policy.acenteNo ? `(${policy.acenteNo})` : ''}</div>
            </div>
          </div>

          <div class="policy-prim-summary">
            <div class="policy-prim-card">
              <div class="policy-prim-label">Brüt Prim</div>
              <div class="policy-prim-value">${formatNumber(policy.grossPremium)} TL</div>
            </div>
            <div class="policy-prim-card secondary">
              <div class="policy-prim-label">Net Prim</div>
              <div class="policy-prim-value">${formatNumber(policy.netPremium)} TL</div>
            </div>
            <div class="policy-prim-card tertiary">
              <div class="policy-prim-label">Komisyon</div>
              <div class="policy-prim-value">${formatNumber(policy.komisyon)} TL</div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('policyDetailModal').classList.add('active');
    }

    function closePolicyDetailModal() {
      document.getElementById('policyDetailModal').classList.remove('active');
    }

    // ═══════════════════════════════════════════════════════════════
    // EDIT POLICY MODAL
    // ═══════════════════════════════════════════════════════════════
    function openEditPolicyModal(policyId) {
      const policy = policies.find(p => p.id === policyId);
      if (!policy) {
        showToast('Poliçe bulunamadı', 'error');
        return;
      }

      currentEditingPolicyId = policyId;

      document.getElementById('editPolicyId').value = policyId;
      document.getElementById('editPolicyNo').value = policy.policyNo || '';
      document.getElementById('editPlaka').value = policy.plaka || '';

      // Dates - format for input[type=date]
      const raw = policy._raw;
      document.getElementById('editDate').value = raw.tanzimTarihi ? raw.tanzimTarihi.substring(0, 10) : '';
      document.getElementById('editStartDate').value = raw.baslangicTarihi ? raw.baslangicTarihi.substring(0, 10) : '';
      document.getElementById('editEndDate').value = raw.bitisTarihi ? raw.bitisTarihi.substring(0, 10) : '';
      document.getElementById('editNetPremium').value = policy.netPremium || 0;
      document.getElementById('editGrossPremium').value = policy.grossPremium || 0;

      // Policy type dropdown
      const typeSelect = document.getElementById('editType');
      typeSelect.innerHTML = policyTypes.map(t =>
        `<option value="${t.value}" ${t.value === policy.type ? 'selected' : ''}>${t.value}</option>`
      ).join('');

      // Producer dropdown
      const producerSelect = document.getElementById('editProducer');
      producerSelect.innerHTML = producersList.map(p =>
        `<option value="${p.id}" ${p.id === policy.producerId ? 'selected' : ''}>${p.name}</option>`
      ).join('');

      // Kesen Uye dropdown
      const kesenUyeSelect = document.getElementById('editKesenUye');
      kesenUyeSelect.innerHTML = `<option value="">Seçiniz</option>` + producersList.map(p =>
        `<option value="${p.id}" ${p.id === policy.kesenUyeId ? 'selected' : ''}>${p.name}</option>`
      ).join('');

      document.getElementById('editPolicyModal').classList.add('active');
    }

    function closeEditPolicyModal() {
      document.getElementById('editPolicyModal').classList.remove('active');
      currentEditingPolicyId = null;
    }

    async function saveEditedPolicy(event) {
      event.preventDefault();

      const policyId = currentEditingPolicyId;
      if (!policyId) return;

      const policy = policies.find(p => p.id === policyId);
      if (!policy) return;

      // PolicyUpdateDto: { id, musteriId, isOrtagiUyeId, isOrtagiSubeId, aciklama }
      const updateDto = { id: policyId };
      let hasChanges = false;

      const newKesenUyeId = document.getElementById('editKesenUye').value ? parseInt(document.getElementById('editKesenUye').value) : null;
      if (newKesenUyeId !== policy.kesenUyeId) {
        updateDto.isOrtagiUyeId = newKesenUyeId;
        hasChanges = true;
      }

      // Not: batch-update sadece musteriId, isOrtagiUyeId, isOrtagiSubeId, aciklama destekler
      // Diğer alanlar (poliçe no, plaka, prim vs.) farklı endpoint gerektirir

      if (!hasChanges) {
        showToast('Değişiklik yapılmadı', 'info');
        closeEditPolicyModal();
        return;
      }

      try {
        const result = await apiPut('policies/batch-update', {
          policies: [updateDto]
        });

        if (result.updatedCount > 0) {
          showToast('Poliçe başarıyla güncellendi', 'success');
          closeEditPolicyModal();
          await loadPolicies();
        } else {
          showToast('Güncelleme başarısız', 'error');
        }
      } catch (error) {
        console.error('Güncelleme hatası:', error);
        showToast('Güncelleme sırasında hata oluştu', 'error');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // ZEYIL HISTORY MODAL
    // ═══════════════════════════════════════════════════════════════
    async function openZeyilModal(policyId) {
      const policy = policies.find(p => p.id === policyId);
      if (!policy) return;

      const modal = document.getElementById('zeyilModal');
      const modalBody = document.getElementById('zeyilModalBody');

      modalBody.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <div class="loading-spinner" style="display: inline-block;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          </div>
          <p style="margin-top: 1rem; opacity: 0.7;">Zeyil geçmişi yükleniyor...</p>
        </div>
      `;
      modal.classList.add('active');

      try {
        const response = await apiGet(`policies?search=${encodeURIComponent(policy.policyNo)}&sigortaSirketiId=${policy.sigortaSirketiId}&pageSize=100`);
        const allItems = (response.items || []);

        // Client-side exact match on policeNumarasi + sigortaSirketiId
        const matching = allItems
          .filter(item => {
            const itemPolNo = item.policeNumarasi || item.policeNo || '';
            return itemPolNo === policy.policyNo && (item.sigortaSirketiId || 0) === policy.sigortaSirketiId;
          })
          .map(mapPolicyFromApi)
          .sort((a, b) => (a.zeyilNo || 0) - (b.zeyilNo || 0));

        if (matching.length === 0) {
          modalBody.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.6);">
              <p>Bu poliçe için zeyil kaydı bulunamadı.</p>
              <div class="modal-actions" style="justify-content:center;">
                <button class="btn btn-secondary" onclick="closeZeyilModal()">Kapat</button>
              </div>
            </div>
          `;
          return;
        }

        let tableHtml = `
          <div style="margin-bottom: 1rem;">
            <span style="font-size: 0.85rem; color: rgba(255,255,255,0.7);">
              <strong style="color:#fff;">${policy.policyNo}</strong> - ${policy.sigortaSirketiAdi} (${matching.length} kayıt)
            </span>
          </div>
          <div style="overflow-x: auto;">
          <table class="zeyil-table">
            <thead>
              <tr>
                <th>Zeyil No</th>
                <th>Başlangıç</th>
                <th>Bitiş</th>
                <th>Brüt Prim</th>
                <th>Net Prim</th>
                <th>Komisyon</th>
              </tr>
            </thead>
            <tbody>
        `;

        matching.forEach(item => {
          const isCurrent = item.id === policyId;
          tableHtml += `
            <tr class="${isCurrent ? 'current-row' : ''}">
              <td><span class="zeyil-no-badge">${item.zeyilNo || 0}</span></td>
              <td>${item.startDateFormatted}</td>
              <td>${item.endDateFormatted}</td>
              <td style="font-family:var(--font-mono,monospace);">${formatNumber(item.grossPremium)} TL</td>
              <td style="font-family:var(--font-mono,monospace);">${formatNumber(item.netPremium)} TL</td>
              <td style="font-family:var(--font-mono,monospace);">${formatNumber(item.komisyon)} TL</td>
            </tr>
          `;
        });

        tableHtml += `
            </tbody>
          </table>
          </div>
          <div class="modal-actions" style="justify-content:flex-end;">
            <button class="btn btn-secondary" onclick="closeZeyilModal()">Kapat</button>
          </div>
        `;

        modalBody.innerHTML = tableHtml;
      } catch (error) {
        console.error('Zeyil geçmişi alınamadı:', error);
        modalBody.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.6);">
            <p>Zeyil geçmişi yüklenirken hata oluştu.</p>
            <div class="modal-actions" style="justify-content:center;">
              <button class="btn btn-secondary" onclick="closeZeyilModal()">Kapat</button>
            </div>
          </div>
        `;
      }
    }

    function closeZeyilModal() {
      document.getElementById('zeyilModal').classList.remove('active');
    }

    // ═══════════════════════════════════════════════════════════════
    // CUSTOMER MODAL
    // ═══════════════════════════════════════════════════════════════
    let customerModalPolicyId = null;

    async function openCustomerModal(customerName, policyId, musteriId) {
      const modal = document.getElementById('customerModal');
      const modalBody = document.getElementById('customerModalBody');
      customerModalPolicyId = policyId;

      modalBody.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <div class="loading-spinner" style="display: inline-block;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          </div>
          <p style="margin-top: 1rem; opacity: 0.7;">Müşteri bilgisi yükleniyor...</p>
        </div>
      `;
      modal.classList.add('active');

      try {
        let customer = null;

        // musteriId varsa doğrudan ID ile detay getir
        if (musteriId) {
          try {
            const details = await apiGet(`customers/${musteriId}/details`);
            if (details) {
              // details endpoint nested response: { musteri, stats, policeler }
              customer = {
                ...(details.musteri || {}),
                id: details.musteri?.id || musteriId,
                policeSayisi: details.stats?.toplamPoliceSayisi || 0,
                toplamPrim: details.stats?.toplamPrim || 0
              };
            }
          } catch (e) {
            // details endpoint yoksa basit endpoint dene
            try {
              customer = await apiGet(`customers/${musteriId}`);
            } catch (e2) {
              console.warn('Müşteri ID ile bulunamadı, isimle aranıyor...', e2);
            }
          }
        }

        // ID ile bulunamadıysa isimle ara
        if (!customer) {
          const searchResults = await apiGet('customers/search', { name: customerName });
          let foundId = null;
          if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
            foundId = searchResults[0].id;
          } else if (searchResults && !Array.isArray(searchResults) && searchResults.id) {
            foundId = searchResults.id;
          }
          if (foundId) {
            try {
              const details = await apiGet(`customers/${foundId}/details`);
              if (details) {
                customer = {
                  ...(details.musteri || {}),
                  id: details.musteri?.id || foundId,
                  policeSayisi: details.stats?.toplamPoliceSayisi || 0,
                  toplamPrim: details.stats?.toplamPrim || 0
                };
              }
            } catch (e) {
              try {
                customer = await apiGet(`customers/${foundId}`);
              } catch (e2) {
                customer = searchResults[0] || searchResults;
              }
            }
          }
        }

        if (customer && customer.id) {
          renderCustomerFound(customer, customerName, policyId);
        } else {
          renderCustomerNotFound(customerName, policyId);
        }
      } catch (error) {
        console.error('Müşteri bilgisi alınamadı:', error);
        renderCustomerNotFound(customerName, policyId);
      }
    }

    function renderCustomerFound(customer, customerName, policyId) {
      const modalBody = document.getElementById('customerModalBody');
      const fullName = [customer.adi, customer.soyadi].filter(Boolean).join(' ') || customerName;
      const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();
      const tc = customer.tcKimlikNo || customer.vergiNo || '';
      const policyCount = customer.policeSayisi || 0;
      const totalPremium = customer.toplamPrim || 0;

      modalBody.innerHTML = `
        <div class="customer-card-found">
          <div class="customer-avatar-large">${initials}</div>
          <h4>${fullName}</h4>
          ${tc ? `<div class="customer-tc">${tc}</div>` : ''}
          <span class="badge badge-success">Müşteri Kartı Mevcut</span>

          <div class="customer-stats">
            <div class="customer-stat">
              <div class="customer-stat-value">${policyCount}</div>
              <div class="customer-stat-label">Poliçe</div>
            </div>
            <div class="customer-stat">
              <div class="customer-stat-value">${APP_CONFIG.CURRENCY.format(totalPremium)}</div>
              <div class="customer-stat-label">Toplam Prim</div>
            </div>
          </div>

          <div class="modal-actions" style="flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="closeCustomerModal()">Kapat</button>
            <button class="btn btn-secondary" onclick="showCustomerChangeUI(${policyId})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/>
                <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
              </svg>
              Müşteriyi Değiştir
            </button>
            <button class="btn btn-primary" onclick="window.location.href='../customers/detail.html?id=${customer.id}'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Müşteri Kartına Git
            </button>
          </div>
        </div>
      `;
    }

    function renderCustomerNotFound(customerName, policyId) {
      const modalBody = document.getElementById('customerModalBody');
      const policy = policies.find(p => p.id === policyId);
      const tc = policy?.tcKimlikNo || policy?.vergiNo || '';

      modalBody.innerHTML = `
        <div class="customer-not-found">
          <div class="empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
              <line x1="12" y1="11" x2="12" y2="17"/>
              <line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
          </div>
          <h4>Müşteri Kartı Bulunamadı</h4>
          <p><strong>${customerName}</strong> için sistemde kayıtlı müşteri kartı bulunmuyor.</p>

          ${tc ? `<div style="background: rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 14px; margin-bottom: 1rem; text-align: left; border: 1px solid rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;">Müşteri Adı:</span>
              <span style="font-weight: 600; color: #fff;">${customerName}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;">TC/VKN:</span>
              <span style="font-family: 'JetBrains Mono', monospace; color: #fff;">${tc}</span>
            </div>
          </div>` : ''}

          <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeCustomerModal()">Kapat</button>
            <button class="btn btn-primary" onclick="showCustomerChangeUI(${policyId})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              Müşteri Eşleştir
            </button>
          </div>
        </div>
      `;
    }

    // Mevcut poliçelerden unique müşteri listesi oluştur
    function getUniqueCustomersFromPolicies() {
      const map = new Map();
      policies.forEach(p => {
        if (p.musteriId && !map.has(p.musteriId)) {
          map.set(p.musteriId, { id: p.musteriId, name: p.customer, tc: p.tcKimlikNo || '', vkn: p.vergiNo || '' });
        }
      });
      return Array.from(map.values());
    }

    function showCustomerChangeUI(policyId) {
      const modalBody = document.getElementById('customerModalBody');
      const policy = policies.find(p => p.id === policyId);

      modalBody.innerHTML = `
        <div style="text-align: left;">
          <h4 style="margin-bottom: 0.5rem; color: #fff;">Müşteri Değiştir</h4>
          <p style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-bottom: 1rem;">
            Poliçe: <strong style="color:#fff;">${policy?.policyNo || ''}</strong> - ${policy?.customer || ''}
          </p>
          <input type="text" id="customerSearchInput" placeholder="Müşteri adı, TC veya VKN ile ara..."
            style="width: 100%; padding: 0.625rem 0.75rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; box-sizing: border-box;">
          <div id="customerCandidatesList" style="max-height: 250px; overflow-y: auto;"></div>
          <div class="modal-actions" style="margin-top: 1rem;">
            <button class="btn btn-secondary" onclick="closeCustomerModal()">İptal</button>
          </div>
        </div>
      `;

      const input = document.getElementById('customerSearchInput');
      input.focus();

      // Başlangıçta mevcut müşterileri göster
      renderLocalCustomerList('', policyId);

      let searchTimeout = null;
      let lastApiSearch = '';

      input.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const val = this.value.trim().toLowerCase();

        // Lokal filtreleme (anlık)
        renderLocalCustomerList(val, policyId);

        // 2+ karakter ve değişmişse API araması da yap (300ms debounce)
        if (val.length >= 2 && val !== lastApiSearch) {
          searchTimeout = setTimeout(async () => {
            lastApiSearch = val;
            await searchCustomerCandidatesApi(policyId, val);
          }, 400);
        }
      });
    }

    function renderLocalCustomerList(search, policyId) {
      const container = document.getElementById('customerCandidatesList');
      if (!container) return;

      const localCustomers = getUniqueCustomersFromPolicies();
      const filtered = search
        ? localCustomers.filter(c =>
            c.name.toLowerCase().includes(search) ||
            c.tc.includes(search) ||
            c.vkn.includes(search))
        : localCustomers;

      if (filtered.length === 0 && !search) {
        container.innerHTML = '<div style="text-align:center; padding:0.75rem; color:rgba(255,255,255,0.4); font-size:0.8rem;">Müşteri bulunamadı</div>';
        return;
      }

      if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:0.75rem; color:rgba(255,255,255,0.4); font-size:0.8rem;">Yazarak ara...</div>';
        return;
      }

      container.innerHTML = filtered.slice(0, 20).map(c => {
        const initials = c.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
        return `
          <div onclick="assignCustomerToPolicy(${policyId}, ${c.id})" style="display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0.5rem; border-radius:8px; cursor:pointer; transition: background 0.15s;"
            onmouseenter="this.style.background='rgba(255,255,255,0.1)'"
            onmouseleave="this.style.background='transparent'">
            <div style="width:28px; height:28px; border-radius:50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.55rem; font-weight:700; flex-shrink:0;">${initials}</div>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; font-size:0.82rem; color:#fff;">${c.name}</div>
              ${c.tc || c.vkn ? `<div style="font-size:0.7rem; color:rgba(255,255,255,0.5);">${c.tc ? 'TC: ' + c.tc : ''} ${c.vkn ? 'VKN: ' + c.vkn : ''}</div>` : ''}
            </div>
          </div>`;
      }).join('');
    }

    async function searchCustomerCandidatesApi(policyId, searchVal) {
      const container = document.getElementById('customerCandidatesList');
      if (!container) return;

      try {
        const policy = policies.find(p => p.id === policyId);
        const params = { name: searchVal };
        if (policy?.tcKimlikNo) params.tc = policy.tcKimlikNo;

        const res = await apiGet('customers/candidates', params);
        const candidates = res.candidates || [];

        if (candidates.length === 0) return; // Lokal sonuçlar zaten gösteriliyor

        // API sonuçlarını lokal sonuçların altına ekle (varsa)
        const existingIds = new Set(getUniqueCustomersFromPolicies().map(c => c.id));
        const newCandidates = candidates.filter(c => !existingIds.has(c.id));

        if (newCandidates.length === 0) return;

        // Mevcut listenin altına "Diğer Sonuçlar" başlığıyla ekle
        const extraHtml = `
          <div style="padding: 0.5rem 0.5rem 0.25rem; color: rgba(255,255,255,0.4); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 0.25rem;">Diğer Eşleşmeler</div>
          ${newCandidates.map(c => {
            const name = [c.adi, c.soyadi].filter(Boolean).join(' ');
            const initials = name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
            return `
              <div onclick="assignCustomerToPolicy(${policyId}, ${c.id})" style="display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0.5rem; border-radius:8px; cursor:pointer; transition: background 0.15s;"
                onmouseenter="this.style.background='rgba(255,255,255,0.1)'"
                onmouseleave="this.style.background='transparent'">
                <div style="width:28px; height:28px; border-radius:50%; background: linear-gradient(135deg, #10b981, #059669); display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.55rem; font-weight:700; flex-shrink:0;">${initials}</div>
                <div style="flex:1; min-width:0;">
                  <div style="font-weight:600; font-size:0.82rem; color:#fff;">${name}</div>
                  <div style="font-size:0.7rem; color:rgba(255,255,255,0.5);">
                    ${c.tcKimlikNo ? 'TC: ' + c.tcKimlikNo : ''} ${c.vergiNo ? 'VKN: ' + c.vergiNo : ''} ${c.policyCount ? '• ' + c.policyCount + ' poliçe' : ''}
                  </div>
                </div>
              </div>`;
          }).join('')}`;

        container.insertAdjacentHTML('beforeend', extraHtml);
      } catch (e) {
        // API hatası sessizce geç, lokal sonuçlar zaten gösteriliyor
      }
    }

    async function assignCustomerToPolicy(policyId, musteriId) {
      try {
        await apiPut('policies/batch-update', {
          policies: [{ id: policyId, musteriId: musteriId }]
        });
        showToast('Müşteri başarıyla değiştirildi', 'success');
        closeCustomerModal();
        await loadPolicies();
      } catch (e) {
        showToast('Müşteri değiştirme hatası', 'error');
      }
    }

    function closeCustomerModal() {
      document.getElementById('customerModal').classList.remove('active');
      customerModalPolicyId = null;
    }

    // ═══════════════════════════════════════════════════════════════
    // PRODUCER MODAL
    // ═══════════════════════════════════════════════════════════════
    let producerModalPolicyId = null;

    function openProducerModal(producerName, initials, color, policyId, producerId) {
      const modal = document.getElementById('producerModal');
      const modalBody = document.getElementById('producerModalBody');
      producerModalPolicyId = policyId;

      const producer = producersList.find(pr => pr.id === producerId) || producersList.find(pr => pr.name === producerName);
      const policy = policies.find(p => p.id === policyId);

      if (producer) {
        const pColor = producer.color || color;
        const pInitials = producer.initials || initials;
        const branchName = producer.branch || '';

        const producerPolicies = policies.filter(p => p.producerId === producer.id);
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthPolicies = producerPolicies.filter(p => p.tanzimTarihi && p.tanzimTarihi >= thisMonthStart);
        const totalPremium = thisMonthPolicies.reduce((sum, p) => sum + (p.grossPremium || 0), 0);
        const totalKomisyon = thisMonthPolicies.reduce((sum, p) => sum + (p.komisyon || 0), 0);

        // Kesen üye bilgisi
        const kesenUye = policy ? producersList.find(pr => pr.id === policy.kesenUyeId) : null;
        const kesenUyeName = kesenUye ? kesenUye.name : (policy?.kesenUyeName || '-');

        modalBody.innerHTML = `
          <div class="info-card">
            <div class="info-card-header">
              <div class="info-card-avatar" style="background: linear-gradient(135deg, ${getColorGradient(pColor)});">${pInitials}</div>
              <div class="info-card-details">
                <h4>${producer.name}</h4>
                <p>Prodüktör${branchName ? ` • ${branchName} Şubesi` : ''}</p>
              </div>
            </div>

            <div class="info-card-stats">
              <div class="info-stat-item">
                <div class="info-stat-value">${thisMonthPolicies.length}</div>
                <div class="info-stat-label">Poliçe (Bu Ay)</div>
              </div>
              <div class="info-stat-item">
                <div class="info-stat-value">${APP_CONFIG.CURRENCY.format(totalPremium)}</div>
                <div class="info-stat-label">Prim (Bu Ay)</div>
              </div>
              <div class="info-stat-item">
                <div class="info-stat-value">${producerPolicies.length}</div>
                <div class="info-stat-label">Toplam Poliçe</div>
              </div>
              <div class="info-stat-item">
                <div class="info-stat-value">${APP_CONFIG.CURRENCY.format(totalKomisyon)}</div>
                <div class="info-stat-label">Komisyon (Bu Ay)</div>
              </div>
            </div>

            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.12);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="font-size: 0.75rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;">Kesen Üye</span>
                <span style="font-weight: 600; color: #fff;">${kesenUyeName}</span>
              </div>
            </div>

            <div id="producerChangeArea"></div>

            <div class="modal-actions" style="flex-wrap: wrap; gap: 0.5rem;">
              <button class="btn btn-secondary" onclick="closeProducerModal()">Kapat</button>
              <button class="btn btn-secondary" onclick="showProducerChangeUI('producer')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                Prodüktör Değiştir
              </button>
              <button class="btn btn-secondary" onclick="showProducerChangeUI('kesenUye')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                Kesen Üye Değiştir
              </button>
            </div>
          </div>
        `;
      } else {
        modalBody.innerHTML = `
          <div style="text-align: center; padding: 2rem;">
            <div class="info-card-avatar" style="background: linear-gradient(135deg, ${getColorGradient(color)}); width: 48px; height: 48px; font-size: 1rem; margin: 0 auto 1rem;">${initials}</div>
            <h4>${producerName}</h4>
            <p style="opacity: 0.6; margin-top: 0.5rem;">Prodüktör detayı bulunamadı.</p>
            <div class="modal-actions" style="margin-top: 1.5rem;">
              <button class="btn btn-secondary" onclick="closeProducerModal()">Kapat</button>
            </div>
          </div>
        `;
      }

      modal.classList.add('active');
    }

    function showProducerChangeUI(changeType) {
      const area = document.getElementById('producerChangeArea');
      if (!area) return;

      const label = changeType === 'producer' ? 'Prodüktör' : 'Kesen Üye';

      area.innerHTML = `
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.08); border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(8px);">
          <h4 style="font-size: 0.85rem; margin-bottom: 0.75rem; color: #fff;">${label} Değiştir</h4>
          <input type="text" id="producerSearchInput" placeholder="İsim ile ara..."
            style="width: 100%; padding: 0.625rem 0.75rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; box-sizing: border-box;">
          <div id="producerCandidatesList" style="max-height: 200px; overflow-y: auto;"></div>
        </div>
      `;

      const input = document.getElementById('producerSearchInput');
      input.focus();

      // Başlangıçta tüm listeyi göster
      renderProducerCandidates('', changeType);

      // Yazarken filtrele
      input.addEventListener('input', function() {
        renderProducerCandidates(this.value.trim().toLowerCase(), changeType);
      });
    }

    function renderProducerCandidates(search, changeType) {
      const container = document.getElementById('producerCandidatesList');
      if (!container) return;

      const filtered = search
        ? producersList.filter(p => p.name.toLowerCase().includes(search))
        : producersList;

      if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:0.75rem; color:rgba(255,255,255,0.5); font-size:0.8rem;">Sonuç bulunamadı</div>';
        return;
      }

      container.innerHTML = filtered.map(p => `
        <div onclick="assignProducerToPolicy('${changeType}', ${p.id})" style="display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0.5rem; border-radius:8px; cursor:pointer; transition: background 0.15s;"
          onmouseenter="this.style.background='rgba(255,255,255,0.1)'"
          onmouseleave="this.style.background='transparent'">
          <div class="producer-avatar ${p.color || 'emerald'}" style="width:28px; height:28px; font-size:0.55rem; flex-shrink:0;">${p.initials || p.name.substring(0,2).toUpperCase()}</div>
          <div>
            <div style="font-weight:600; font-size:0.82rem; color:#fff;">${p.name}</div>
            ${p.branch ? `<div style="font-size:0.7rem; color:rgba(255,255,255,0.55);">${p.branch}</div>` : ''}
          </div>
        </div>
      `).join('');
    }

    async function assignProducerToPolicy(changeType, newId) {
      const policyId = producerModalPolicyId;
      if (!policyId) return;

      try {
        const updateDto = { id: policyId };

        if (changeType === 'kesenUye') {
          updateDto.isOrtagiUyeId = newId;
        } else {
          updateDto.produktorId = newId;
        }

        await apiPut('policies/batch-update', {
          policies: [updateDto]
        });

        const label = changeType === 'kesenUye' ? 'Kesen üye' : 'Prodüktör';
        showToast(`${label} başarıyla değiştirildi`, 'success');

        closeProducerModal();
        await loadPolicies();
      } catch (e) {
        console.error('Değiştirme hatası:', e);
        showToast('Değiştirme sırasında hata oluştu', 'error');
      }
    }

    function closeProducerModal() {
      document.getElementById('producerModal').classList.remove('active');
    }

    // ═══════════════════════════════════════════════════════════════
    // MODAL EVENT HANDLERS
    // ═══════════════════════════════════════════════════════════════
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', function(e) {
        if (e.target === this) {
          this.classList.remove('active');
        }
      });
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
          modal.classList.remove('active');
        });
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // EXCEL EXPORT
    // ═══════════════════════════════════════════════════════════════
    function exportToExcel() {
      try {
        const headers = ['Poliçe No', 'Plaka', 'Müşteri', 'Sigorta Şirketi', 'Tip', 'Brüt Prim', 'Net Prim', 'Komisyon', 'Prodüktör', 'Şube', 'Acente No', 'Acente', 'Başlangıç', 'Bitiş', 'Tanzim', 'Zeyil No'];

        const data = filteredPolicies.map(p => [
          p.policyNo || '',
          p.plaka || '',
          p.customer || '',
          p.sigortaSirketiAdi || '',
          p.type || '',
          p.grossPremium || 0,
          p.netPremium || 0,
          p.komisyon || 0,
          p.producer || '',
          p.branch || '',
          p.acenteNo || '',
          p.acenteAdi || '',
          p.startDateFormatted,
          p.endDateFormatted,
          p.tanzimFormatted,
          p.zeyilNo || 0
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

        ws['!cols'] = [
          { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 12 },
          { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
          { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Poliçelerim');

        let filename = 'policelerim';
        const startDate = currentDateRange.startDate;
        const endDate = currentDateRange.endDate;

        if (startDate || endDate) {
          filename += '_';
          if (startDate) filename += formatDate(startDate.toISOString()).replace(/\./g, '-');
          if (endDate) filename += '_' + formatDate(endDate.toISOString()).replace(/\./g, '-');
        } else {
          filename += '_' + new Date().toISOString().split('T')[0];
        }
        filename += '.xlsx';

        XLSX.writeFile(wb, filename);
        showToast(`${filteredPolicies.length} poliçe Excel dosyasına aktarıldı!`, 'success');
      } catch (error) {
        console.error('Excel export hatası:', error);
        showToast('Excel dosyası oluşturulurken hata oluştu: ' + error.message, 'error');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // FILTER DRAWER (scroll ile ekrandan çıkınca sağ kenardan drawer)
    // ═══════════════════════════════════════════════════════════════
    (function initFilterDrawer() {
      const filtersEl = document.getElementById('filtersCard');
      const sentinel = document.getElementById('filtersSentinel');
      const toggleBtn = document.getElementById('filterDrawerToggle');
      const backdrop = document.getElementById('filterDrawerBackdrop');
      if (!filtersEl || !sentinel || !toggleBtn || !backdrop) return;

      let drawerActive = false;
      let normalHeight = filtersEl.offsetHeight;
      let filtersBottom = filtersEl.getBoundingClientRect().bottom + window.scrollY;

      function recalcPosition() {
        if (!drawerActive) {
          normalHeight = filtersEl.offsetHeight;
          filtersBottom = filtersEl.getBoundingClientRect().bottom + window.scrollY;
        }
      }

      function openDrawer() {
        filtersEl.classList.add('drawer-open');
        toggleBtn.classList.add('active');
        backdrop.classList.add('visible');
      }

      function closeDrawer() {
        filtersEl.classList.remove('drawer-open');
        toggleBtn.classList.remove('active');
        backdrop.classList.remove('visible');
      }

      function enterDrawerMode() {
        if (drawerActive) return;
        drawerActive = true;
        sentinel.style.height = normalHeight + 'px';
        filtersEl.classList.add('drawer-mode');
        toggleBtn.classList.add('visible');
      }

      function exitDrawerMode() {
        if (!drawerActive) return;
        closeDrawer();
        drawerActive = false;
        filtersEl.classList.remove('drawer-mode');
        toggleBtn.classList.remove('visible');
        sentinel.style.height = '0';
        requestAnimationFrame(recalcPosition);
      }

      // Toggle button click
      toggleBtn.addEventListener('click', function() {
        if (filtersEl.classList.contains('drawer-open')) {
          closeDrawer();
        } else {
          openDrawer();
        }
      });

      // Click outside drawer closes it
      document.addEventListener('mousedown', function(e) {
        if (filtersEl.classList.contains('drawer-open') &&
            !filtersEl.contains(e.target) &&
            !toggleBtn.contains(e.target)) {
          closeDrawer();
        }
      });

      // Escape key closes drawer
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && drawerActive) closeDrawer();
      });

      let ticking = false;

      function checkDrawer() {
        const scrolledPast = window.scrollY > filtersBottom;
        if (scrolledPast && !drawerActive) {
          enterDrawerMode();
        } else if (!scrolledPast && drawerActive) {
          exitDrawerMode();
        }
      }

      window.addEventListener('resize', function() {
        recalcPosition();
        checkDrawer();
      });

      requestAnimationFrame(checkDrawer);

      window.addEventListener('scroll', function() {
        if (!ticking) {
          requestAnimationFrame(function() {
            checkDrawer();
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });

      // Recalc on content changes
      const pageContent = document.querySelector('.page-content') || document.querySelector('.main-content');
      if (pageContent) {
        const obs = new MutationObserver(function() { if (!drawerActive) recalcPosition(); });
        obs.observe(pageContent, { childList: true, subtree: true });
      }
    })();
