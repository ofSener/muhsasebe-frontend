    // ═══════════════════════════════════════════════════════════════
    // PERMISSION SYSTEM
    // ═══════════════════════════════════════════════════════════════

    // Permission configuration for different roles
    const permissionConfig = {
      admin: {
        label: 'Yönetici',
        description: 'Tüm alanları düzenleyebilirsiniz',
        badgeClass: 'admin',
        canEdit: true,
        editableFields: ['policyNo', 'customer', 'type', 'netPremium', 'grossPremium', 'producer', 'branch', 'date']
      },
      editor: {
        label: 'Editör',
        description: 'Bazı alanları düzenleyebilirsiniz',
        badgeClass: 'editor',
        canEdit: true,
        editableFields: ['customer', 'netPremium', 'grossPremium', 'producer', 'branch'] // Cannot edit policyNo, type, date
      },
      viewer: {
        label: 'İzleyici',
        description: 'Sadece görüntüleme yetkisi',
        badgeClass: 'viewer',
        canEdit: false,
        editableFields: []
      }
    };

    // ═══════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════
    let currentUserRole = 'admin';

    // Data arrays - API'den doldurulacak
    let policyTypes = [];
    let producersList = [];
    let branchesList = [];
    let insuranceCompanies = [];
    let companyCodeMap = {}; // id -> kod mapping
    let policies = [];
    let filteredPolicies = [];
    let policyDriveLinks = {}; // { "POL-001": "https://drive...", ... }

    // Logo path constants
    const LOGO_BASE_PATH = '../../assets/images/logos/insurance-companies/';
    const LOGO_EXTENSION = '.png';

    // Selection & sorting state
    let selectedPolicies = new Set();
    let currentSort = { field: 'date', direction: 'desc' };

    // Pagination state
    let currentPage = 1;
    let pageSize = 20;
    let totalFilteredItems = 0;

    // ═══════════════════════════════════════════════════════════════
    // YENİ STATE YÖNETİMİ (Pipeline Architecture)
    // ═══════════════════════════════════════════════════════════════
    let rawData = [];

    const tableState = {
      sort: { field: 'date', direction: 'desc' },
      filters: { search: '', producer: '', branch: '' },
      pagination: { currentPage: 1, pageSize: 20 },
      selection: new Set()
    };

    // Date range state
    let currentDateRange = {
      startDate: new Date(),
      endDate: new Date()
    };

    // ═══════════════════════════════════════════════════════════════
    // API LOADING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    // Kullanıcı bilgisi yükle
    async function loadCurrentUser() {
      try {
        const data = await apiGet('auth/me');
        currentUserRole = data.role || 'viewer';
        APP_CONFIG.AUTH.setUser(data);
        return data;
      } catch (error) {
        console.error('Kullanıcı bilgisi alınamadı:', error);
        currentUserRole = 'viewer';
        return null;
      }
    }

    // Poliçe tipleri yükle
    async function loadPolicyTypes() {
      try {
        const data = await apiGet('policy-types');
        policyTypes = (data || []).map(pt => ({
          id: pt.id,
          value: pt.turu,
          class: pt.turu ? pt.turu.toLowerCase().replace(/ı/g, 'i') : 'kasko'
        }));
        populateInsuranceTypeFilter();
        return policyTypes;
      } catch (error) {
        console.error('Poliçe tipleri alınamadı:', error);
        // Fallback statik veri
        policyTypes = [
          { id: null, value: 'Kasko', class: 'kasko' },
          { id: null, value: 'Trafik', class: 'trafik' },
          { id: null, value: 'DASK', class: 'dask' },
          { id: null, value: 'Sağlık', class: 'saglik' },
          { id: null, value: 'Konut', class: 'konut' }
        ];
        populateInsuranceTypeFilter();
        return policyTypes;
      }
    }

    // Sigorta şirketleri yükle (logo için kod bilgisi gerekli)
    async function loadInsuranceCompanies() {
      try {
        const data = await apiGet('insurance-companies');
        insuranceCompanies = data || [];
        // ID -> Kod mapping oluştur
        companyCodeMap = {};
        insuranceCompanies.forEach(company => {
          companyCodeMap[company.id] = company.kod;
        });
        populateCompanyFilter();
        return insuranceCompanies;
      } catch (error) {
        console.error('Sigorta şirketleri alınamadı:', error);
        insuranceCompanies = [];
        return [];
      }
    }

    // Prodüktör listesi yükle (sadece aktif kullanıcılar - firmaId ile filtrelenmiş)
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
        return producersList;
      } catch (error) {
        console.error('Prodüktör listesi alınamadı:', error);
        producersList = [];
        return [];
      }
    }

    // Şube listesi yükle (firmaId ile filtrelenmiş)
    async function loadBranches() {
      try {
        const user = APP_CONFIG.AUTH.getUser();
        const firmaId = user?.firmaId;
        const endpoint = firmaId ? `branches?firmaId=${firmaId}` : 'branches';
        const data = await apiGet(endpoint);
        branchesList = (data || []).map(b => b.subeAdi || b.name);
        populateBranchFilter();
        return data;
      } catch (error) {
        console.error('Şube listesi alınamadı:', error);
        branchesList = [];
        return [];
      }
    }

    // Poliçe türü için CSS class belirle
    // Sigorta şirketi logo URL'si
    function getInsuranceCompanyLogo(sirketId) {
      // companyCodeMap'den şirket kodunu al
      const companyCode = companyCodeMap[sirketId];
      if (companyCode) {
        return `${LOGO_BASE_PATH}${companyCode.toLowerCase()}${LOGO_EXTENSION}`;
      }
      // Kod bulunamazsa boş döndür (fallback gösterilecek)
      return '';
    }

    // Sigorta şirketi baş harfleri (logo yüklenemezse fallback)
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

    // API response'u frontend formatına dönüştür
    function mapPolicyFromApi(p) {
      // Prodüktör adını bul
      const producer = producersList.find(pr => pr.id === p.produktorId);
      const producerName = producer ? producer.name : `Prodüktör #${p.produktorId}`;

      // Poliçe türü adı doğrudan API'den geliyor (policeTuruAdi)
      // Fallback olarak eski alan adlarını da kontrol et
      const typeName = p.policeTuruAdi || p.policeTuru || 'Bilinmiyor';
      const typeClass = getTypeClass(typeName);

      // Şube adını al (API'dan doğrudan geliyor)
      const branch = p.subeAdi || `Şube #${p.subeId}`;

      return {
        id: p.id,
        policyNo: p.policeNo || p.policeNumarasi || '',
        customer: p.sigortaliAdi || 'Bilinmiyor',
        type: typeName,
        typeClass: typeClass,
        netPremium: p.netPrim || 0,
        grossPremium: p.brutPrim || 0,
        producer: producerName,
        producerId: p.produktorId,
        producerInitials: producer?.initials || producerName.substring(0, 2).toUpperCase(),
        producerColor: producer?.color || 'emerald',
        branch: branch,
        branchId: p.subeId,
        sigortaSirketiId: p.sigortaSirketiId || p.sigortaSirketi || 0,
        sigortaSirketiAdi: p.sigortaSirketiAdi || '',
        date: p.tanzimTarihi ? new Date(p.tanzimTarihi) : new Date(),
        dateFormatted: p.tanzimTarihi ? new Date(p.tanzimTarihi).toLocaleDateString('tr-TR') : '-',
        plaka: p.plaka || '',
        acenteAdi: p.acenteAdi || '',
        acenteNo: p.acenteNo || ''
      };
    }

    // Yakalanan poliçeler yükle
    async function loadCapturedPolicies() {
      try {
        const params = {
          startDate: formatDateISO(currentDateRange.startDate),
          endDate: formatDateISO(currentDateRange.endDate)
          // Sort frontend'de yapılıyor (applyFilters içinde)
        };

        const result = await apiGet('policies/captured', params);

        let rawPolicies = [];
        if (result.data) {
          rawPolicies = result.data;
        } else if (Array.isArray(result)) {
          rawPolicies = result;
        }

        // API response'u frontend formatına dönüştür
        policies = rawPolicies.map(mapPolicyFromApi);
        filteredPolicies = [...policies];

        // Poliçelerin Drive PDF linklerini toplu al (PoliceId = veritabanı ID'si)
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

        // Filtreleri poliçeler yüklendikten sonra tekrar doldur
        // (policies verisiyle tam eşleşme için)
        populateCompanyFilter();
        populateInsuranceTypeFilter();

        // applyFilters kullan - sorting dahil tüm işlemler yapılsın
        applyFilters();
        return policies;
      } catch (error) {
        console.error('Poliçeler alınamadı:', error);
        showToast('Poliçeler yüklenirken hata oluştu', 'error');
        policies = [];
        filteredPolicies = [];
        applyFilters();
        return [];
      }
    }

    // KPI istatistikleri yükle
    async function loadKPIStats() {
      try {
        const params = {
          startDate: formatDateISO(currentDateRange.startDate),
          endDate: formatDateISO(currentDateRange.endDate)
        };

        const stats = await apiGet('policies/captured/stats', params);

        // KPI kartlarını güncelle
        if (stats.pendingCount !== undefined) {
          document.getElementById('statPending').textContent = stats.pendingCount;
        }
        if (stats.totalGrossPremium !== undefined) {
          document.getElementById('statPremium').textContent = APP_CONFIG.CURRENCY.format(stats.totalGrossPremium);
        }
        if (stats.activeProducerCount !== undefined) {
          document.getElementById('statProducers').textContent = stats.activeProducerCount;
        }
        if (stats.sentCount !== undefined) {
          const sentEl = document.getElementById('statSent');
          if (sentEl) sentEl.textContent = stats.sentCount;
        }

        return stats;
      } catch (error) {
        console.error('KPI istatistikleri alınamadı:', error);
        return null;
      }
    }

    // Prodüktör dropdown'unu doldur
    function populateProducerFilter() {
      const list = document.getElementById('producerList');
      if (!list) return;

      const avatarColors = [
        'linear-gradient(135deg, #10b981, #059669)',
        'linear-gradient(135deg, #06b6d4, #0891b2)',
        'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        'linear-gradient(135deg, #f59e0b, #d97706)',
        'linear-gradient(135deg, #f43f5e, #e11d48)',
        'linear-gradient(135deg, #3b82f6, #2563eb)',
        'linear-gradient(135deg, #ec4899, #db2777)',
        'linear-gradient(135deg, #14b8a6, #0d9488)'
      ];

      // "Tüm Prodüktörler" seçeneği
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

      // Prodüktörleri ekle
      producersList.forEach((p, index) => {
        const initials = p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
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

    // Dropdown aç/kapat
    function toggleProducerDropdown(event) {
      event.stopPropagation();
      const dropdown = document.getElementById('producerDropdown');
      const searchInput = document.getElementById('producerSearchInput');

      dropdown.classList.toggle('open');

      if (dropdown.classList.contains('open')) {
        searchInput.value = '';
        filterProducerList();
        searchInput.focus();
      }
    }

    // Prodüktör listesini filtrele
    function filterProducerList() {
      const searchInput = document.getElementById('producerSearchInput');
      const searchTerm = searchInput.value.toLowerCase();
      const items = document.querySelectorAll('#producerList .dropdown-item');

      items.forEach(item => {
        const name = item.getAttribute('data-value').toLowerCase();
        const text = item.textContent.toLowerCase();
        if (name.includes(searchTerm) || text.includes(searchTerm)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    }

    // Prodüktör seç
    function selectProducer(element, value, displayText) {
      // Hidden input güncelle
      document.getElementById('producerFilter').value = value;

      // Görünen text güncelle
      document.getElementById('producerFilterText').textContent = displayText;

      // Seçili durumu güncelle
      document.querySelectorAll('#producerList .dropdown-item').forEach(item => {
        item.classList.remove('selected');
      });
      element.classList.add('selected');

      // Dropdown kapat
      document.getElementById('producerDropdown').classList.remove('open');

      // Filtreleme uygula
      filterTable();
    }

    // Click outside to close dropdown
    document.addEventListener('click', function(event) {
      const producerDropdown = document.getElementById('producerDropdown');
      if (producerDropdown && !producerDropdown.contains(event.target)) {
        producerDropdown.classList.remove('open');
      }
      const branchDropdown = document.getElementById('branchDropdown');
      if (branchDropdown && !branchDropdown.contains(event.target)) {
        branchDropdown.classList.remove('open');
      }
      const companyDropdown = document.getElementById('companyDropdown');
      if (companyDropdown && !companyDropdown.contains(event.target)) {
        companyDropdown.classList.remove('open');
      }
      const insuranceTypeDropdown = document.getElementById('insuranceTypeDropdown');
      if (insuranceTypeDropdown && !insuranceTypeDropdown.contains(event.target)) {
        insuranceTypeDropdown.classList.remove('open');
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // ŞUBE DROPDOWN FONKSİYONLARI
    // ═══════════════════════════════════════════════════════════════

    // Şube dropdown'unu doldur
    function populateBranchFilter() {
      const list = document.getElementById('branchList');
      if (!list) return;

      const avatarColors = [
        'linear-gradient(135deg, #10b981, #059669)',
        'linear-gradient(135deg, #06b6d4, #0891b2)',
        'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        'linear-gradient(135deg, #f59e0b, #d97706)',
        'linear-gradient(135deg, #f43f5e, #e11d48)',
        'linear-gradient(135deg, #3b82f6, #2563eb)'
      ];

      // "Tüm Şubeler" seçeneği
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

      // Şubeleri ekle
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

    // Şube dropdown aç/kapat
    function toggleBranchDropdown(event) {
      event.stopPropagation();
      const dropdown = document.getElementById('branchDropdown');
      const searchInput = document.getElementById('branchSearchInput');

      dropdown.classList.toggle('open');

      if (dropdown.classList.contains('open')) {
        searchInput.value = '';
        filterBranchList();
        searchInput.focus();
      }
    }

    // Şube listesini filtrele
    function filterBranchList() {
      const searchInput = document.getElementById('branchSearchInput');
      const searchTerm = searchInput.value.toLowerCase();
      const items = document.querySelectorAll('#branchList .dropdown-item');

      items.forEach(item => {
        const name = item.getAttribute('data-value').toLowerCase();
        const text = item.textContent.toLowerCase();
        if (name.includes(searchTerm) || text.includes(searchTerm)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    }

    // Şube seç
    function selectBranch(element, value, displayText) {
      // Hidden input güncelle
      document.getElementById('branchFilter').value = value;

      // Görünen text güncelle
      document.getElementById('branchFilterText').textContent = displayText;

      // Seçili durumu güncelle
      document.querySelectorAll('#branchList .dropdown-item').forEach(item => {
        item.classList.remove('selected');
      });
      element.classList.add('selected');

      // Dropdown kapat
      document.getElementById('branchDropdown').classList.remove('open');

      // Filtreleme uygula
      filterTable();
    }

    // ═══════════════════════════════════════════════════════════════
    // ŞİRKET DROPDOWN FONKSİYONLARI
    // ═══════════════════════════════════════════════════════════════

    // Şirket dropdown'unu doldur
    function populateCompanyFilter() {
      const list = document.getElementById('companyList');
      if (!list) return;

      const avatarColors = [
        'linear-gradient(135deg, #10b981, #059669)',
        'linear-gradient(135deg, #06b6d4, #0891b2)',
        'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        'linear-gradient(135deg, #f59e0b, #d97706)',
        'linear-gradient(135deg, #f43f5e, #e11d48)',
        'linear-gradient(135deg, #3b82f6, #2563eb)'
      ];

      // "Tüm Şirketler" seçeneği
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

      // Şirket adlarını mevcut poliçelerden al (API'deki değerlerle tam eşleşme için)
      // Eğer policies boşsa insuranceCompanies'dan al
      let companyNames = [];
      if (policies.length > 0) {
        companyNames = [...new Set(policies.map(p => p.sigortaSirketiAdi))]
          .filter(n => n && typeof n === 'string' && n.trim() !== '');
      } else {
        companyNames = insuranceCompanies
          .map(c => c.adi || c.ad || '')
          .filter(n => n && typeof n === 'string' && n.trim() !== '');
      }

      // Alfabetik sırala (sadece string değerler)
      companyNames.sort((a, b) => String(a).localeCompare(String(b), 'tr'));

      // Şirketleri ekle
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

    // Şirket dropdown aç/kapat
    function toggleCompanyDropdown(event) {
      event.stopPropagation();
      const dropdown = document.getElementById('companyDropdown');
      const searchInput = document.getElementById('companySearchInput');

      dropdown.classList.toggle('open');

      if (dropdown.classList.contains('open')) {
        searchInput.value = '';
        filterCompanyList();
        searchInput.focus();
      }
    }

    // Şirket listesini filtrele
    function filterCompanyList() {
      const searchInput = document.getElementById('companySearchInput');
      const searchTerm = searchInput.value.toLowerCase();
      const items = document.querySelectorAll('#companyList .dropdown-item');

      items.forEach(item => {
        const name = item.getAttribute('data-value').toLowerCase();
        const text = item.textContent.toLowerCase();
        if (name.includes(searchTerm) || text.includes(searchTerm)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    }

    // Şirket seç
    function selectCompany(element, value, displayText) {
      // Hidden input güncelle
      document.getElementById('companyFilter').value = value;

      // Görünen text güncelle
      document.getElementById('companyFilterText').textContent = displayText;

      // Seçili durumu güncelle
      document.querySelectorAll('#companyList .dropdown-item').forEach(item => {
        item.classList.remove('selected');
      });
      element.classList.add('selected');

      // Dropdown kapat
      document.getElementById('companyDropdown').classList.remove('open');

      // Filtreleme uygula
      filterTable();
    }

    // ═══════════════════════════════════════════════════════════════
    // ÜRÜN TİPİ DROPDOWN FONKSİYONLARI
    // ═══════════════════════════════════════════════════════════════

    // Ürün tipi dropdown'unu doldur
    function populateInsuranceTypeFilter() {
      const list = document.getElementById('insuranceTypeList');
      if (!list) return;

      const typeColors = {
        'kasko': 'linear-gradient(135deg, #3b82f6, #2563eb)',
        'trafik': 'linear-gradient(135deg, #f59e0b, #d97706)',
        'dask': 'linear-gradient(135deg, #ef4444, #dc2626)',
        'konut': 'linear-gradient(135deg, #10b981, #059669)',
        'saglik': 'linear-gradient(135deg, #ec4899, #db2777)',
        'sağlık': 'linear-gradient(135deg, #ec4899, #db2777)',
        'default': 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
      };

      // "Tüm Ürünler" seçeneği
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

      // Ürün tiplerini mevcut poliçelerden al (API'deki değerlerle tam eşleşme için)
      // Eğer policies boşsa policyTypes'dan al
      let types = [];
      if (policies.length > 0) {
        types = [...new Set(policies.map(p => p.type))]
          .filter(t => t && typeof t === 'string' && t !== 'Bilinmiyor');
      } else if (policyTypes.length > 0) {
        types = policyTypes
          .map(t => t.value || t.adi || t.name || (typeof t === 'string' ? t : null))
          .filter(t => t && typeof t === 'string');
      }

      // Alfabetik sırala (sadece string değerler)
      types.sort((a, b) => String(a).localeCompare(String(b), 'tr'));

      types.forEach((type) => {
        const typeName = typeof type === 'string' ? type : (type.value || type.adi || type.name || 'Bilinmiyor');
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

    // Ürün tipi dropdown aç/kapat
    function toggleInsuranceTypeDropdown(event) {
      event.stopPropagation();
      const dropdown = document.getElementById('insuranceTypeDropdown');
      const searchInput = document.getElementById('insuranceTypeSearchInput');

      dropdown.classList.toggle('open');

      if (dropdown.classList.contains('open')) {
        searchInput.value = '';
        filterInsuranceTypeList();
        searchInput.focus();
      }
    }

    // Ürün tipi listesini filtrele
    function filterInsuranceTypeList() {
      const searchInput = document.getElementById('insuranceTypeSearchInput');
      const searchTerm = searchInput.value.toLowerCase();
      const items = document.querySelectorAll('#insuranceTypeList .dropdown-item');

      items.forEach(item => {
        const name = item.getAttribute('data-value').toLowerCase();
        const text = item.textContent.toLowerCase();
        if (name.includes(searchTerm) || text.includes(searchTerm)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    }

    // Ürün tipi seç
    function selectInsuranceType(element, value, displayText) {
      // Hidden input güncelle
      document.getElementById('insuranceTypeFilter').value = value;

      // Görünen text güncelle
      document.getElementById('insuranceTypeFilterText').textContent = displayText;

      // Seçili durumu güncelle
      document.querySelectorAll('#insuranceTypeList .dropdown-item').forEach(item => {
        item.classList.remove('selected');
      });
      element.classList.add('selected');

      // Dropdown kapat
      document.getElementById('insuranceTypeDropdown').classList.remove('open');

      // Filtreleme uygula
      filterTable();
    }

    // Tarih formatla (ISO)
    function formatDateISO(date) {
      if (!date) return '';
      const d = new Date(date);
      // UTC yerine yerel tarihi kullan (timezone sorununu önler)
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // ═══════════════════════════════════════════════════════════════
    // SAYFA BAŞLATMA - Initialize page
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', async function() {
      // Check permission before loading page
      if (!hasPoliceYakalamaPermission()) {
        showToast('Bu sayfaya erişim yetkiniz yok', 'error');
        setTimeout(() => window.location.href = '../../index.html', 1500);
        return;
      }

      showLoading(true);

      try {
        // 1. Kullanıcı bilgisi ve yetkisi
        await loadCurrentUser();

        // 2. Dropdown verileri (paralel)
        await Promise.all([
          loadProducers(),
          loadBranches(),
          loadPolicyTypes(),
          loadInsuranceCompanies()
        ]);

        // 3. Date picker başlat (ortak utils'ten)
        initDatePicker(filterByDateRange);

        // 4. Ana veri ve istatistikler
        await Promise.all([
          loadCapturedPolicies(),
          loadKPIStats()
        ]);

        // 5. UI bileşenlerini hazırla
        updatePermissionUI();

      } catch (error) {
        console.error('Sayfa yüklenirken hata:', error);
        showToast('Sayfa yüklenirken hata oluştu', 'error');
      } finally {
        showLoading(false);
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // PERMISSION & EDIT MODE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function changeUserRole(role) {
      currentUserRole = role;
      updatePermissionUI();

      // Re-render table to reflect permission changes
      applyFilters();
    }

    function updatePermissionUI() {
      const config = permissionConfig[currentUserRole];
      const badge = document.getElementById('permissionBadge');
      const label = document.getElementById('permissionLabel');
      const text = document.getElementById('permissionText');
      // Update badge class
      badge.className = 'permission-badge ' + config.badgeClass;
      label.textContent = config.label;
      text.textContent = config.description;
    }

    function canEditField(field) {
      const config = permissionConfig[currentUserRole];
      return config.canEdit && config.editableFields.includes(field);
    }

    // ═══════════════════════════════════════════════════════════════
    // INLINE EDITING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    let currentEditCell = null;

    function startEditing(cell, policyId, field, currentValue) {
      if (!canEditField(field)) return;
      if (currentEditCell) cancelEditing();

      currentEditCell = cell;
      const originalContent = cell.innerHTML;
      cell.dataset.originalContent = originalContent;
      cell.dataset.originalValue = currentValue;

      let inputHTML = '';

      switch (field) {
        case 'type':
          inputHTML = `<select class="inline-edit-select" onchange="finishEditing(${policyId}, '${field}', this.value)" onblur="setTimeout(() => cancelEditing(), 150)">
            ${policyTypes.map(t => `<option value="${t.value}" ${t.value === currentValue ? 'selected' : ''}>${t.value}</option>`).join('')}
          </select>`;
          break;
        case 'producer':
          inputHTML = `<select class="inline-edit-select" onchange="finishEditing(${policyId}, '${field}', this.value)" onblur="setTimeout(() => cancelEditing(), 150)">
            ${producersList.map(p => `<option value="${p.name}" ${p.name === currentValue ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>`;
          break;
        case 'branch':
          inputHTML = `<select class="inline-edit-select" onchange="finishEditing(${policyId}, '${field}', this.value)" onblur="setTimeout(() => cancelEditing(), 150)">
            ${branchesList.map(b => `<option value="${b}" ${b === currentValue ? 'selected' : ''}>${b}</option>`).join('')}
          </select>`;
          break;
        case 'netPremium':
        case 'grossPremium':
          inputHTML = `<input type="number" class="inline-edit-input mono" value="${currentValue}"
            onkeydown="handleEditKeydown(event, ${policyId}, '${field}')"
            onblur="finishEditing(${policyId}, '${field}', this.value)">`;
          break;
        case 'date':
          inputHTML = `<input type="date" class="inline-edit-input" value="${currentValue}"
            onkeydown="handleEditKeydown(event, ${policyId}, '${field}')"
            onblur="finishEditing(${policyId}, '${field}', this.value)">`;
          break;
        default:
          inputHTML = `<input type="text" class="inline-edit-input ${field === 'policyNo' ? 'mono' : ''}" value="${currentValue}"
            onkeydown="handleEditKeydown(event, ${policyId}, '${field}')"
            onblur="finishEditing(${policyId}, '${field}', this.value)">`;
      }

      cell.innerHTML = inputHTML;
      const input = cell.querySelector('input, select');
      if (input) {
        input.focus();
        if (input.select) input.select();
      }
    }

    function handleEditKeydown(event, policyId, field) {
      if (event.key === 'Enter') {
        event.preventDefault();
        finishEditing(policyId, field, event.target.value);
      } else if (event.key === 'Escape') {
        cancelEditing();
      }
    }

    function finishEditing(policyId, field, newValue) {
      if (!currentEditCell) return;

      const originalValue = currentEditCell.dataset.originalValue;

      // Check if value actually changed
      if (String(newValue) !== String(originalValue)) {
        // Store the change
        if (!pendingChanges.has(policyId)) {
          pendingChanges.set(policyId, {});
        }
        pendingChanges.get(policyId)[field] = newValue;

        // Update the policy data locally
        const policy = policies.find(p => p.id === policyId);
        if (policy) {
          if (field === 'netPremium' || field === 'grossPremium') {
            policy[field] = parseFloat(newValue) || 0;
          } else if (field === 'type') {
            const policyType = policyTypes.find(t => t.value === newValue);
            if (policyType) {
              policy[field] = newValue;
              policy.typeClass = policyType.class || 'kasko';
              // Store typeId for backend
              pendingChanges.get(policyId)['typeId'] = policyType.id;
            }
          } else if (field === 'producer') {
            const prod = producersList.find(p => p.name === newValue);
            if (prod) {
              policy.producer = prod.name;
              policy.producerInitials = prod.initials;
              policy.producerColor = prod.color;
              // Store producerId for backend
              pendingChanges.get(policyId)['producerId'] = prod.id;
              // Also record branchId change if producer has a branch
              if (prod.branchId) {
                pendingChanges.get(policyId)['branchId'] = prod.branchId;
              }
            }
          } else if (field === 'date') {
            policy.date = newValue;
            const d = new Date(newValue);
            policy.dateFormatted = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          } else {
            policy[field] = newValue;
          }
        }

        updateChangesBar();
      }

      currentEditCell = null;
      applyFilters();
    }

    function cancelEditing() {
      if (!currentEditCell) return;
      currentEditCell.innerHTML = currentEditCell.dataset.originalContent;
      currentEditCell = null;
    }

    function updateChangesBar() {
      const bar = document.getElementById('saveChangesBar');
      const count = document.getElementById('changesCount');

      let totalChanges = 0;
      pendingChanges.forEach(changes => {
        totalChanges += Object.keys(changes).length;
      });

      count.textContent = totalChanges;

      if (totalChanges > 0) {
        bar.classList.add('active');
      } else {
        bar.classList.remove('active');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // POLİÇE DEĞİŞİKLİKLERİNİ KAYDET
    // ═══════════════════════════════════════════════════════════════
    async function saveAllChanges() {
      const changesArray = [];
      pendingChanges.forEach((changes, policyId) => {
        // Map camelCase to PascalCase for backend
        const mappedChanges = {};
        if (changes.policyNo !== undefined) mappedChanges.PolicyNo = changes.policyNo;
        if (changes.customer !== undefined) mappedChanges.Customer = changes.customer;
        if (changes.typeId !== undefined) mappedChanges.TypeId = changes.typeId;
        if (changes.netPremium !== undefined) mappedChanges.NetPremium = changes.netPremium;
        if (changes.grossPremium !== undefined) mappedChanges.GrossPremium = changes.grossPremium;
        if (changes.producerId !== undefined) mappedChanges.ProducerId = changes.producerId;
        if (changes.branchId !== undefined) mappedChanges.BranchId = changes.branchId;
        if (changes.date !== undefined) mappedChanges.Date = changes.date;

        changesArray.push({ policyId, changes: mappedChanges });
      });

      if (changesArray.length === 0) {
        showToast('Kaydedilecek değişiklik yok', 'info');
        return;
      }

      showLoading(true);

      try {
        const result = await apiPut('policies/captured/batch-update', { updates: changesArray });

        if (result.success) {
          pendingChanges.clear();
          updateChangesBar();
          showToast(`${result.updatedCount || changesArray.length} poliçede değişiklikler kaydedildi`, 'success');

          // Verileri yenile
          await loadCapturedPolicies();
        } else {
          const errorMsg = result.errors ? result.errors.map(e => e.message).join(', ') : 'Bilinmeyen hata';
          showToast('Bazı değişiklikler kaydedilemedi: ' + errorMsg, 'error');
        }
      } catch (error) {
        console.error('Kaydetme hatası:', error);
        showToast('Değişiklikler kaydedilirken hata oluştu', 'error');
      } finally {
        showLoading(false);
      }
    }

    async function discardAllChanges() {
      if (!confirm('Tüm değişiklikler iptal edilecek. Emin misiniz?')) return;

      pendingChanges.clear();
      updateChangesBar();

      // Verileri backend'den tekrar çek
      showLoading(true);
      try {
        await loadCapturedPolicies();
        showToast('Değişiklikler iptal edildi', 'info');
      } finally {
        showLoading(false);
      }
    }

    // Filter by date range (sayfa-spesifik - API çağrıları)
    async function filterByDateRange(startDate, endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Update currentDateRange for API calls
      currentDateRange.startDate = start;
      currentDateRange.endDate = end;

      currentPage = 1; // Reset to first page when filtering

      // Load data from API with new date range
      showLoading(true);
      try {
        await Promise.all([
          loadCapturedPolicies(),
          loadKPIStats()
        ]);
      } catch (error) {
        console.error('Date filter error:', error);
        showToast('Tarih filtreleme hatası', 'error');
      } finally {
        showLoading(false);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // VERİ PIPELINE FONKSİYONLARI (Yeni Mimari)
    // ═══════════════════════════════════════════════════════════════

    function pipelineFilter(data) {
      const { search, producer, branch } = tableState.filters;

      return data.filter(item => {
        if (search) {
          const searchLower = search.toLowerCase().trim();
          const searchable = [
            item.policyNo, item.customer, item.type,
            item.producer, item.branch, item.dateFormatted,
            item.netPremium?.toString(), item.grossPremium?.toString()
          ].join(' ').toLowerCase();
          if (!searchable.includes(searchLower)) return false;
        }
        if (producer && item.producer !== producer) return false;
        if (branch && item.branch !== branch) return false;
        return true;
      });
    }

    function pipelineSort(data) {
      const { field, direction } = tableState.sort;
      if (!field || !direction) return [...data];

      return [...data].sort((a, b) => {
        const aVal = getSortValue(a, field);
        const bVal = getSortValue(b, field);

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        let cmp = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          cmp = aVal - bVal;
        } else {
          cmp = String(aVal).localeCompare(String(bVal), 'tr', {
            sensitivity: 'base', numeric: true
          });
        }

        return direction === 'asc' ? cmp : -cmp;
      });
    }

    function getSortValue(item, field) {
      if (field === 'date') {
        if (!item.date) return null;
        const ts = item.date instanceof Date ? item.date.getTime() : new Date(item.date).getTime();
        return isNaN(ts) ? null : ts;
      }
      if (field === 'netPremium' || field === 'grossPremium') {
        const n = Number(item[field]);
        return isNaN(n) ? null : n;
      }
      return (item[field] || '').toLocaleLowerCase('tr');
    }

    function pipelinePaginate(data) {
      const { currentPage, pageSize } = tableState.pagination;
      const total = data.length;
      const totalPages = Math.ceil(total / pageSize) || 1;
      const safePage = Math.max(1, Math.min(currentPage, totalPages));

      const start = (safePage - 1) * pageSize;
      const end = start + pageSize;

      return {
        items: data.slice(start, end),
        currentPage: safePage,
        totalPages,
        totalItems: total
      };
    }

    function refreshTable() {
      const filtered = pipelineFilter(rawData);
      const sorted = pipelineSort(filtered);
      const result = pipelinePaginate(sorted);

      // Mevcut render fonksiyonunu kullan
      renderTableWithData(result.items, result);
      updateStats(filtered);
    }

    // ═══════════════════════════════════════════════════════════════
    // ESKİ FİLTRE FONKSİYONLARI (Uyumluluk için)
    // ═══════════════════════════════════════════════════════════════

    // Apply all filters
    function applyFilters() {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase();
      const producerFilter = document.getElementById('producerFilter').value;
      const branchFilter = document.getElementById('branchFilter').value;
      const companyFilter = document.getElementById('companyFilter').value;
      const insuranceTypeFilter = document.getElementById('insuranceTypeFilter').value;

      // IMPORTANT: Her zaman orijinal policies'den başla, filteredPolicies'den değil!
      // Aksi halde filtreler kümülatif olur ve filtre kaldırıldığında veri geri gelmez
      let result = [...policies];

      if (searchTerm) {
        result = result.filter(p =>
          p.policyNo.toLowerCase().includes(searchTerm) ||
          p.customer.toLowerCase().includes(searchTerm) ||
          p.type.toLowerCase().includes(searchTerm) ||
          p.producer.toLowerCase().includes(searchTerm) ||
          p.branch.toLowerCase().includes(searchTerm) ||
          p.dateFormatted.toLowerCase().includes(searchTerm) ||
          p.netPremium.toString().includes(searchTerm) ||
          p.grossPremium.toString().includes(searchTerm) ||
          (p.sigortaSirketiAdi || '').toLowerCase().includes(searchTerm)
        );
      }

      if (producerFilter) {
        result = result.filter(p => p.producer === producerFilter);
      }

      if (branchFilter) {
        result = result.filter(p => p.branch === branchFilter);
      }

      if (companyFilter) {
        result = result.filter(p => p.sigortaSirketiAdi === companyFilter);
      }

      if (insuranceTypeFilter) {
        result = result.filter(p => p.type === insuranceTypeFilter);
      }

      // Sort
      if (currentSort.field && currentSort.direction) {
        result.sort((a, b) => {
          const aVal = a[currentSort.field];
          const bVal = b[currentSort.field];

          // NULL/UNDEFINED KONTROLÜ - null değerler sona
          const aIsNull = aVal == null;
          const bIsNull = bVal == null;
          if (aIsNull && bIsNull) return 0;
          if (aIsNull) return 1;
          if (bIsNull) return -1;

          let comparison = 0;

          // SAYISAL SÜTUNLAR (netPremium, grossPremium)
          if (currentSort.field === 'netPremium' || currentSort.field === 'grossPremium') {
            // Türkçe para formatını veya sayıyı parse et
            // 12.104,1 = 12104.1 (on iki bin yüz dört lira on kuruş)
            const parseNumber = (val) => {
              if (typeof val === 'number' && !isNaN(val)) return val;
              if (val == null || val === '') return 0;
              // String ise: binlik ayırıcıyı (.) kaldır, ondalık ayırıcıyı (,) noktaya çevir
              const str = String(val).replace(/\./g, '').replace(',', '.');
              return parseFloat(str) || 0;
            };

            const aNum = parseNumber(aVal);
            const bNum = parseNumber(bVal);

            comparison = aNum - bNum;
          }
          // TARİH SÜTUNU (date) - date ZATEN Date object!
          else if (currentSort.field === 'date') {
            // Date object ise direkt getTime(), değilse parse et
            const aTime = aVal instanceof Date ? aVal.getTime() : new Date(aVal).getTime();
            const bTime = bVal instanceof Date ? bVal.getTime() : new Date(bVal).getTime();

            // Invalid Date kontrolü
            if (isNaN(aTime) && isNaN(bTime)) return 0;
            if (isNaN(aTime)) return 1;
            if (isNaN(bTime)) return -1;

            comparison = aTime - bTime;
          }
          // STRING SÜTUNLAR (customer, producer, type, branch)
          else {
            const aStr = String(aVal || '').toLocaleLowerCase('tr');
            const bStr = String(bVal || '').toLocaleLowerCase('tr');
            // localeCompare ters sonuç veriyor, bStr ile aStr karşılaştır
            comparison = bStr.localeCompare(aStr, 'tr', { sensitivity: 'base', numeric: true });
          }

          return currentSort.direction === 'asc' ? comparison : -comparison;
        });
      }

      // Sıralanmış veriyi kaydet (pagination için)
      filteredPolicies = result;

      renderTableWithData(result);
      updateStats(result);
    }

    // Filter table
    function filterTable() {
      currentPage = 1; // Reset to first page when filtering
      applyFilters();
    }

    // Sort table
    function sortTable(field) {
      if (currentSort.field === field) {
        // Aynı sütuna tekrar tıklandı - yönü değiştir
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        // Yeni sütun - sayısal ve tarih sütunlarında desc ile başla (en büyük önce)
        currentSort.field = field;
        const numericOrDateFields = ['netPremium', 'grossPremium', 'date'];
        currentSort.direction = numericOrDateFields.includes(field) ? 'desc' : 'asc';
      }

      // ÖNEMLİ: tableState.sort'u da senkronize et (pipelineSort için)
      tableState.sort.field = currentSort.field;
      tableState.sort.direction = currentSort.direction;

      // Reset to first page when sorting
      currentPage = 1;
      tableState.pagination.currentPage = 1;

      // Update sort indicators
      document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
      });
      const currentTh = document.querySelector(`[data-sort="${field}"]`);
      if (currentTh) {
        currentTh.classList.add(currentSort.direction);
      }

      applyFilters();
    }

    // Render table
    function renderTable() {
      renderTableWithData(policies);
    }

    function renderTableWithData(data, paginationInfo = null) {
      const tbody = document.getElementById('policyTableBody');

      // Yeni pipeline'dan gelen paginationInfo varsa kullan
      // Yoksa eski uyumluluk modu için hesapla
      let paginatedData, totalItems, totalPages, activePage, startIndex, endIndex;

      if (paginationInfo) {
        // YENİ PIPELINE MODU - Sıralama ZATEN yapılmış
        paginatedData = data; // data zaten slice'lanmış
        totalItems = paginationInfo.totalItems;
        totalPages = paginationInfo.totalPages;
        activePage = paginationInfo.currentPage;
        startIndex = (activePage - 1) * tableState.pagination.pageSize;

        // Eski state'i de senkronize tut (uyumluluk)
        currentPage = activePage;
        totalFilteredItems = totalItems;
        endIndex = Math.min(startIndex + tableState.pagination.pageSize, totalItems);
      } else {
        // ESKİ UYUMLULUK MODU - Sıralama ve pagination burada
        totalItems = data.length;
        totalPages = Math.ceil(totalItems / pageSize) || 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        activePage = currentPage;
        startIndex = (activePage - 1) * pageSize;
        endIndex = Math.min(startIndex + pageSize, data.length);
        paginatedData = data.slice(startIndex, endIndex);
        totalFilteredItems = totalItems;
      }

      if (totalItems === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.5rem; opacity: 0.5;">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <br>Seçilen kriterlere uygun poliçe bulunamadı.
            </td>
          </tr>
        `;
        document.getElementById('tableInfo').textContent = '0 poliçe';
        updatePaginationControls(0, 0, 0);
        return;
      }

      // HTML içeriğini oluştur
      const rowsHtml = paginatedData.map(p => {
        return `
        <tr class="${selectedPolicies.has(p.id) ? 'selected' : ''}" data-id="${p.id}" onclick="handleRowClick(event, ${p.id})">
          <td>
            <input type="checkbox" ${selectedPolicies.has(p.id) ? 'checked' : ''}>
          </td>
          <td>
            <div class="company-logo" data-tooltip="${p.sigortaSirketiAdi}">
              ${getInsuranceCompanyLogo(p.sigortaSirketiId)
                ? `<img src="${getInsuranceCompanyLogo(p.sigortaSirketiId)}" alt="${p.sigortaSirketiAdi}" onerror="this.parentElement.innerHTML='${getInsuranceCompanyInitials(p.sigortaSirketiAdi)}'">`
                : getInsuranceCompanyInitials(p.sigortaSirketiAdi)}
            </div>
          </td>
          <td>
            ${policyDriveLinks[p.id]
              ? `<span class="clickable-link font-mono" style="font-weight: 600;" onclick="event.stopPropagation(); window.open('${policyDriveLinks[p.id]}', '_blank')" title="PDF'i görüntüle">
                  ${p.policyNo}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15,3 21,3 21,9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </span>`
              : `<span class="font-mono" style="font-weight: 600;">${p.policyNo}</span>`
            }
          </td>
          <td>
            <div class="cell-main clickable-customer" onclick="event.stopPropagation(); openCustomerModal('${p.customer}', ${p.id})">${p.customer}</div>
          </td>
          <td>
            <span class="policy-type-badge ${p.typeClass}">${p.type}</span>
          </td>
          <td>
            <span class="font-mono font-semibold">${p.netPremium.toLocaleString('tr-TR')} TL</span>
          </td>
          <td>
            <span class="font-mono font-semibold">${p.grossPremium.toLocaleString('tr-TR')} TL</span>
          </td>
          <td>
            <div class="producer-cell">
              <div class="producer-avatar ${p.producerColor}">${p.producerInitials}</div>
              <div class="producer-info">
                <span class="producer-name clickable-producer" onclick="event.stopPropagation(); openProducerModal('${p.producer}', '${p.producerInitials}', '${p.producerColor}')">${p.producer}</span>
                <span class="producer-branch clickable-branch" onclick="event.stopPropagation(); openBranchModal('${p.branch}')">${p.branch}</span>
              </div>
            </div>
          </td>
          <td>
            <span class="acente-no" data-tooltip="${p.acenteAdi || 'Acente bilgisi yok'}">${p.acenteNo || '-'}</span>
          </td>
          <td>
            <span class="cell-sub">${p.dateFormatted}</span>
          </td>
          <td onclick="event.stopPropagation()">
            <div class="table-actions">
              <button class="action-btn view-btn" onclick="viewPolicy(${p.id})" title="Görüntüle">
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
              <button class="action-btn send" onclick="sendToPool(${p.id})" title="Havuza Gönder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14"/>
                  <path d="M12 5l7 7-7 7"/>
                </svg>
              </button>
              <button class="action-btn delete-btn" onclick="deletePolicy(${p.id})" title="Poliçeyi Sil">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `}).join('');

      // HTML'i ata
      tbody.innerHTML = rowsHtml;

      // Browser layer cache'ini bypass et
      tbody.style.transform = 'translateZ(0)';
      requestAnimationFrame(() => {
        tbody.style.transform = '';
      });

      // Update table info text
      document.getElementById('tableInfo').textContent = `${startIndex + 1}-${endIndex} / ${data.length} poliçe`;

      // Update pagination controls
      updatePaginationControls(currentPage, totalPages, data.length);
    }

    // Update stats
    function updateStats(data = policies) {
      const totalGrossPremium = data.reduce((sum, p) => sum + p.grossPremium, 0);
      const producers = [...new Set(data.map(p => p.producer))];

      document.getElementById('statPending').textContent = data.length;
      document.getElementById('statPremium').textContent = totalGrossPremium.toLocaleString('tr-TR') + ' TL';
      document.getElementById('statProducers').textContent = producers.length;
    }

    // ═══════════════════════════════════════════════════════════════
    // PAGINATION FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function updatePaginationControls(current, total, itemCount) {
      const prevBtn = document.getElementById('prevPageBtn');
      const nextBtn = document.getElementById('nextPageBtn');
      const pageNumbersContainer = document.getElementById('pageNumbers');

      // Update prev/next button states
      prevBtn.disabled = current <= 1;
      nextBtn.disabled = current >= total;

      // Generate page numbers
      if (total <= 1) {
        pageNumbersContainer.innerHTML = '';
        return;
      }

      let pageNumbersHTML = '';

      // Always show first page
      pageNumbersHTML += generatePageNumber(1, current);

      // Show ellipsis if there's a gap after first page
      if (current > 3) {
        pageNumbersHTML += '<span class="page-ellipsis">...</span>';
      }

      // Show pages around current page
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pageNumbersHTML += generatePageNumber(i, current);
      }

      // Show ellipsis if there's a gap before last page
      if (current < total - 2) {
        pageNumbersHTML += '<span class="page-ellipsis">...</span>';
      }

      // Always show last page (if more than 1 page)
      if (total > 1) {
        pageNumbersHTML += generatePageNumber(total, current);
      }

      pageNumbersContainer.innerHTML = pageNumbersHTML;
    }

    function generatePageNumber(page, currentPage) {
      const isActive = page === currentPage;
      return `<button class="page-number ${isActive ? 'active' : ''}" onclick="goToPage(${page})">${page}</button>`;
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
      const totalPages = Math.ceil(totalFilteredItems / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        applyFilters();
      }
    }

    function changePageSize(newSize) {
      pageSize = parseInt(newSize);
      currentPage = 1; // Reset to first page when changing page size
      applyFilters();
    }

    // Selection functions
    function handleRowClick(event, id) {
      // Toggle selection when clicking anywhere on the row
      toggleSelect(id);
    }

    function toggleSelect(id) {
      if (selectedPolicies.has(id)) {
        selectedPolicies.delete(id);
      } else {
        selectedPolicies.add(id);
      }
      updateSelectionUI();
    }

    function toggleSelectAll() {
      const selectAllCheckbox = document.getElementById('selectAll');
      const visibleRows = document.querySelectorAll('#policyTableBody tr[data-id]');

      if (selectAllCheckbox.checked) {
        visibleRows.forEach(row => {
          const id = parseInt(row.dataset.id);
          selectedPolicies.add(id);
        });
      } else {
        visibleRows.forEach(row => {
          const id = parseInt(row.dataset.id);
          selectedPolicies.delete(id);
        });
      }
      updateSelectionUI();
    }

    function updateSelectionUI() {
      const count = selectedPolicies.size;
      const selectedCountBadge = document.getElementById('selectedCount');
      const sendSelectedBtn = document.getElementById('sendSelectedBtn');
      const floatingBox = document.getElementById('floatingActionBox');

      if (count > 0) {
        selectedCountBadge.textContent = count + ' seçili';
        selectedCountBadge.style.display = 'inline-flex';
        sendSelectedBtn.style.display = 'inline-flex';

        // Show floating action box
        floatingBox.classList.add('active');

        // Update floating box stats
        document.getElementById('fabCount').textContent = count;
        const totalPremium = [...selectedPolicies].reduce((sum, id) => {
          const policy = policies.find(p => p.id === id);
          return sum + (policy ? policy.grossPremium : 0);
        }, 0);
        document.getElementById('fabTotalPremium').textContent = totalPremium.toLocaleString('tr-TR') + ' TL';
      } else {
        selectedCountBadge.style.display = 'none';
        sendSelectedBtn.style.display = 'none';

        // Hide floating action box
        floatingBox.classList.remove('active');
      }

      // Update row styles
      document.querySelectorAll('#policyTableBody tr[data-id]').forEach(row => {
        const id = parseInt(row.dataset.id);
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (selectedPolicies.has(id)) {
          row.classList.add('selected');
          checkbox.checked = true;
        } else {
          row.classList.remove('selected');
          checkbox.checked = false;
        }
      });

      // Update select all checkbox
      const visibleRows = document.querySelectorAll('#policyTableBody tr[data-id]');
      const selectAllCheckbox = document.getElementById('selectAll');
      const allSelected = visibleRows.length > 0 && [...visibleRows].every(row => selectedPolicies.has(parseInt(row.dataset.id)));
      selectAllCheckbox.checked = allSelected;
    }

    function clearSelection() {
      selectedPolicies.clear();
      updateSelectionUI();
    }

    function viewSelectedPolicies() {
      const selectedList = [...selectedPolicies].map(id => {
        const policy = policies.find(p => p.id === id);
        return policy ? `${policy.policyNo} - ${policy.customer}` : '';
      }).join('\n');

      alert('Seçili Poliçeler:\n\n' + selectedList);
    }

    function exportSelectedPolicies() {
      const selectedData = [...selectedPolicies].map(id => policies.find(p => p.id === id)).filter(Boolean);

      if (selectedData.length === 0) return;

      // Create CSV content
      const headers = ['Poliçe No', 'Müşteri', 'Tip', 'Net Prim', 'Brüt Prim', 'Prodüktör', 'Şube', 'Tarih'];
      const rows = selectedData.map(p => [
        p.policyNo,
        p.customer,
        p.type,
        p.netPremium,
        p.grossPremium,
        p.producer,
        p.branch,
        p.dateFormatted
      ]);

      const csvContent = [headers, ...rows].map(row => row.join(';')).join('\n');

      // Download
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `secili_policeler_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      alert(`${selectedData.length} poliçe Excel'e aktarıldı.`);
    }

    // Actions
    function viewPolicy(id) {
      const policy = policies.find(p => p.id === id);
      if (!policy) return;

      // Modal subtitle güncelle
      document.getElementById('policyModalSubtitle').textContent = `#${policy.policyNo}`;

      // Havuza gönder butonu için id'yi ayarla
      document.getElementById('policyModalSendBtn').onclick = () => {
        closePolicyDetailModal();
        sendToPool(id);
      };

      // Modal içeriği oluştur
      const modalBody = document.getElementById('policyDetailModalBody');
      modalBody.innerHTML = `
        <div class="policy-detail-content">
          <div class="policy-detail-header">
            <div class="policy-company-logo">
              ${getInsuranceCompanyLogo(policy.sigortaSirketiId)
                ? `<img src="${getInsuranceCompanyLogo(policy.sigortaSirketiId)}" alt="${policy.sigortaSirketiAdi}" onerror="this.parentElement.innerHTML='${getInsuranceCompanyInitials(policy.sigortaSirketiAdi)}'">`
                : getInsuranceCompanyInitials(policy.sigortaSirketiAdi)}
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
              <div class="policy-detail-label">Prodüktör</div>
              <div class="policy-detail-value">${policy.producer}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Şube</div>
              <div class="policy-detail-value">${policy.branch}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Tanzim Tarihi</div>
              <div class="policy-detail-value">${policy.dateFormatted}</div>
            </div>
            <div class="policy-detail-item">
              <div class="policy-detail-label">Acente No</div>
              <div class="policy-detail-value mono">${policy.acenteNo || '-'}</div>
            </div>
          </div>

          <div class="policy-prim-summary">
            <div class="policy-prim-card">
              <div class="policy-prim-label">Brüt Prim</div>
              <div class="policy-prim-value">${policy.grossPremium.toLocaleString('tr-TR')} TL</div>
            </div>
            <div class="policy-prim-card secondary">
              <div class="policy-prim-label">Net Prim</div>
              <div class="policy-prim-value">${policy.netPremium.toLocaleString('tr-TR')} TL</div>
            </div>
          </div>
        </div>
      `;

      // Modal aç
      document.getElementById('policyDetailModal').classList.add('active');
    }

    function closePolicyDetailModal() {
      document.getElementById('policyDetailModal').classList.remove('active');
    }

    // ═══════════════════════════════════════════════════════════════
    // POLİÇEYİ HAVUZA GÖNDER
    // ═══════════════════════════════════════════════════════════════
    async function sendToPool(id) {
      const policy = policies.find(p => p.id === id);
      if (!policy) return;

      if (!confirm(`#${policy.policyNo} numaralı poliçe havuza gönderilecek. Onaylıyor musunuz?`)) return;

      showLoading(true);

      try {
        const result = await apiPost(`policies/${id}/send-to-pool`, {});

        if (result.success) {
          policies = policies.filter(p => p.id !== id);
          filteredPolicies = filteredPolicies.filter(p => p.id !== id);
          selectedPolicies.delete(id);
          applyFilters();
          updateStats();
          await loadKPIStats();
          showToast('Poliçe başarıyla havuza gönderildi', 'success');
        } else {
          showToast('Hata: ' + (result.message || 'Bilinmeyen hata'), 'error');
        }
      } catch (error) {
        console.error('Havuza gönderme hatası:', error);
        showToast('Poliçe havuza gönderilirken hata oluştu', 'error');
      } finally {
        showLoading(false);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // POLİÇEYİ SİL (SOFT DELETE)
    // ═══════════════════════════════════════════════════════════════
    async function deletePolicy(id) {
      const policy = policies.find(p => p.id === id);
      if (!policy) return;

      if (!confirm(`#${policy.policyNo} numaralı poliçe silinecek. Bu işlem geri alınamaz. Onaylıyor musunuz?`)) return;

      showLoading(true);

      try {
        const result = await apiDelete(`policies/captured/${id}`);

        if (result.success) {
          policies = policies.filter(p => p.id !== id);
          filteredPolicies = filteredPolicies.filter(p => p.id !== id);
          selectedPolicies.delete(id);
          applyFilters();
          updateStats();
          await loadKPIStats();
          showToast('Poliçe başarıyla silindi', 'success');
        } else {
          showToast('Hata: ' + (result.errorMessage || 'Bilinmeyen hata'), 'error');
        }
      } catch (error) {
        console.error('Silme hatası:', error);
        showToast('Poliçe silinirken hata oluştu', 'error');
      } finally {
        showLoading(false);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // SEÇİLİ POLİÇELERİ TOPLU HAVUZA GÖNDER
    // ═══════════════════════════════════════════════════════════════
    async function sendSelectedToPool() {
      if (selectedPolicies.size === 0) return;

      if (!confirm(`${selectedPolicies.size} poliçe havuza gönderilecek. Onaylıyor musunuz?`)) return;

      showLoading(true);

      try {
        const policyIds = Array.from(selectedPolicies);
        const result = await apiPost('policies/batch-send-to-pool', { policyIds });

        if (result.success) {
          policyIds.forEach(id => {
            policies = policies.filter(p => p.id !== id);
            filteredPolicies = filteredPolicies.filter(p => p.id !== id);
          });
          selectedPolicies.clear();
          applyFilters();
          updateStats();
          await loadKPIStats();
          showToast(`${result.sentCount || policyIds.length} poliçe başarıyla havuza gönderildi`, 'success');
        } else {
          const errorMsg = result.errors ? result.errors.map(e => e.message).join(', ') : 'Bilinmeyen hata';
          showToast('Bazı poliçeler gönderilemedi: ' + errorMsg, 'error');
        }
      } catch (error) {
        console.error('Toplu havuza gönderme hatası:', error);
        showToast('Poliçeler havuza gönderilirken hata oluştu', 'error');
      } finally {
        showLoading(false);
      }
    }

    async function sendAllToPool() {
      const visiblePolicies = document.querySelectorAll('#policyTableBody tr[data-id]');
      if (visiblePolicies.length === 0) {
        showToast('Gönderilecek poliçe bulunamadı', 'warning');
        return;
      }

      if (!confirm(`${visiblePolicies.length} poliçe havuza gönderilecek. Onaylıyor musunuz?`)) return;

      showLoading(true);

      try {
        const policyIds = Array.from(visiblePolicies).map(row => parseInt(row.dataset.id));
        const result = await apiPost('policies/batch-send-to-pool', { policyIds });

        if (result.success) {
          policyIds.forEach(id => {
            policies = policies.filter(p => p.id !== id);
            filteredPolicies = filteredPolicies.filter(p => p.id !== id);
          });
          selectedPolicies.clear();
          applyFilters();
          updateStats();
          await loadKPIStats();
          showToast(`${result.sentCount || policyIds.length} poliçe başarıyla havuza gönderildi`, 'success');
        } else {
          showToast('Poliçeler gönderilemedi', 'error');
        }
      } catch (error) {
        console.error('Tüm poliçeleri gönderme hatası:', error);
        showToast('Poliçeler havuza gönderilirken hata oluştu', 'error');
      } finally {
        showLoading(false);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // VERİLERİ YENİLE
    // ═══════════════════════════════════════════════════════════════
    async function refreshData() {
      showLoading(true);

      try {
        await Promise.all([
          loadCapturedPolicies(),
          loadKPIStats()
        ]);
        showToast('Veriler yenilendi', 'success');
      } catch (error) {
        console.error('Yenileme hatası:', error);
        showToast('Veriler yenilenirken hata oluştu', 'error');
      } finally {
        showLoading(false);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // POLICY DRIVE LINK
    // ═══════════════════════════════════════════════════════════════

    async function openPolicyDrive(policyNo) {
      try {
        // API'den drive linkini al
        const result = await apiGet(`drive/by-police/${encodeURIComponent(policyNo)}`);

        if (result && result.found && result.webViewLink) {
          // Direkt PDF linkine git
          window.open(result.webViewLink, '_blank');
        } else {
          // PDF bulunamadı
          showToast('Bu poliçe için PDF dosyası bulunamadı', 'warning');
        }
      } catch (error) {
        console.log('Drive link hatası:', error);
        showToast('PDF dosyası kontrol edilirken hata oluştu', 'error');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CUSTOMER MODAL
    // ═══════════════════════════════════════════════════════════════

    async function openCustomerModal(customerName, policyId) {
      const modal = document.getElementById('customerModal');
      const modalBody = document.getElementById('customerModalBody');

      // Loading state
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
        const customer = await apiGet('customers/search', { name: customerName });

        if (customer && customer.hasCard) {
          // Müşteri kartı mevcut
          const initials = customerName.split(' ').map(n => n[0]).join('');
          const collectionRate = customer.collectionRate || 0;
          modalBody.innerHTML = `
            <div class="customer-card-found">
              <div class="customer-avatar-large">${initials}</div>
              <h4>${customer.name || customerName}</h4>
              <div class="customer-tc">${customer.tc || ''}</div>
              <span class="badge badge-success">Müşteri Kartı Mevcut</span>

              <div class="customer-stats">
                <div class="customer-stat">
                  <div class="customer-stat-value">${customer.policies?.count || customer.policyCount || 0}</div>
                  <div class="customer-stat-label">Poliçe</div>
                </div>
                <div class="customer-stat">
                  <div class="customer-stat-value">${APP_CONFIG.CURRENCY.format(customer.policies?.totalPremium || customer.totalPremium || 0)}</div>
                  <div class="customer-stat-label">Toplam Prim</div>
                </div>
                <div class="customer-stat">
                  <div class="customer-stat-value">%${collectionRate}</div>
                  <div class="customer-stat-label">Tahsilat</div>
                </div>
              </div>

              <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeCustomerModal()">Kapat</button>
                <button class="btn btn-primary" onclick="goToCustomerCard(${customer.id || 0})">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Müşteri Kartına Git
                </button>
              </div>
            </div>
          `;
        } else {
          // Müşteri kartı yok
          const initials = customerName.split(' ').map(n => n[0]).join('');
          const tc = customer?.tc || '';
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

              <div style="background: rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 14px; margin-bottom: 1rem; text-align: left; border: 1px solid rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;">Müşteri Adı:</span>
                  <span style="font-weight: 600; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">${customerName}</span>
                </div>
                ${tc ? `<div style="display: flex; justify-content: space-between;">
                  <span style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;">TC/VKN:</span>
                  <span style="font-family: 'JetBrains Mono', monospace; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">${tc}</span>
                </div>` : ''}
              </div>

              <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeCustomerModal()">Kapat</button>
                <button class="btn btn-primary" onclick="createCustomerCard('${customerName}', '${tc}', ${policyId})">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                  Yeni Kart Oluştur
                </button>
              </div>
            </div>
          `;
        }
      } catch (error) {
        console.error('Müşteri bilgisi alınamadı:', error);
        // Müşteri bulunamadı - oluşturma seçeneği sun
        const initials = customerName.split(' ').map(n => n[0]).join('');
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

            <div class="modal-actions">
              <button class="btn btn-secondary" onclick="closeCustomerModal()">Kapat</button>
              <button class="btn btn-primary" onclick="createCustomerCard('${customerName}', '', ${policyId})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <line x1="20" y1="8" x2="20" y2="14"/>
                  <line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
                Yeni Kart Oluştur
              </button>
            </div>
          </div>
        `;
      }
    }

    function closeCustomerModal() {
      document.getElementById('customerModal').classList.remove('active');
    }

    function goToCustomerCard(customerId) {
      closeCustomerModal();
      // Müşteri kartı sayfasına yönlendir
      window.location.href = `../customers/list.html?id=${customerId}`;
    }

    // ═══════════════════════════════════════════════════════════════
    // YENİ MÜŞTERİ KARTI OLUŞTUR
    // ═══════════════════════════════════════════════════════════════
    async function createCustomerCard(customerName, tc, linkedPolicyId) {
      closeCustomerModal();

      // API ile müşteri oluşturmayı dene
      try {
        const result = await apiPost('customers', {
          name: customerName,
          tc: tc || '',
          linkedPolicyId: linkedPolicyId
        });

        if (result.success && result.customerId) {
          showToast('Müşteri kartı oluşturuldu', 'success');
          // Müşteri sayfasına yönlendir
          window.location.href = `../customers/list.html?id=${result.customerId}`;
        } else {
          // Manuel oluşturma için yönlendir
          window.location.href = `../customers/list.html?action=new&name=${encodeURIComponent(customerName)}&tc=${encodeURIComponent(tc || '')}`;
        }
      } catch (error) {
        console.error('Müşteri oluşturulamadı:', error);
        // Fallback: Müşteri sayfasına yönlendir
        window.location.href = `../customers/list.html?action=new&name=${encodeURIComponent(customerName)}&tc=${encodeURIComponent(tc || '')}`;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRODUCER MODAL
    // ═══════════════════════════════════════════════════════════════

    async function openProducerModal(producerName, initials, color) {
      const modal = document.getElementById('producerModal');
      const modalBody = document.getElementById('producerModalBody');

      // Loading state
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <div class="loading-spinner" style="display: inline-block;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          </div>
          <p style="margin-top: 1rem; opacity: 0.7;">Prodüktör bilgisi yükleniyor...</p>
        </div>
      `;
      modal.classList.add('active');

      try {
        const producer = await apiGet('producers/search', { name: producerName });

        if (producer) {
          const pColor = producer.color || color;
          const pInitials = producer.initials || initials;
          const stats = producer.stats || {};
          const policyCount = stats.policyCount || 0;
          const totalPremium = stats.totalPremium || 0;
          const performance = stats.performance || 0;

          modalBody.innerHTML = `
            <div class="info-card">
              <div class="info-card-header">
                <div class="info-card-avatar" style="background: linear-gradient(135deg, ${getColorGradient(pColor)});">${pInitials}</div>
                <div class="info-card-details">
                  <h4>${producer.name || producerName}</h4>
                  <p>${producer.role || 'Prodüktör'} • ${producer.branchName || ''} Şubesi</p>
                </div>
              </div>

              <div class="info-card-stats">
                <div class="info-stat-item">
                  <div class="info-stat-value">${policyCount}</div>
                  <div class="info-stat-label">Poliçe (Bu Ay)</div>
                </div>
                <div class="info-stat-item">
                  <div class="info-stat-value">${APP_CONFIG.CURRENCY.format(totalPremium)}</div>
                  <div class="info-stat-label">Prim (Bu Ay)</div>
                </div>
                <div class="info-stat-item">
                  <div class="info-stat-value">${performance}%</div>
                  <div class="info-stat-label">Hedef</div>
                </div>
                <div class="info-stat-item">
                  <div class="info-stat-value">${APP_CONFIG.CURRENCY.format(totalPremium * 0.076)}</div>
                  <div class="info-stat-label">Komisyon</div>
                </div>
              </div>

              <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeProducerModal()">Kapat</button>
                <button class="btn btn-primary" onclick="goToProducerPage(${producer.id || 0})">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                  </svg>
                  Prodüktör Sayfası
                </button>
              </div>
            </div>
          `;
        } else {
          modalBody.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
              <p>Prodüktör bilgisi bulunamadı.</p>
              <button class="btn btn-secondary" onclick="closeProducerModal()">Kapat</button>
            </div>
          `;
        }
      } catch (error) {
        console.error('Prodüktör bilgisi alınamadı:', error);
        modalBody.innerHTML = `
          <div style="text-align: center; padding: 2rem;">
            <p>Prodüktör bilgisi yüklenirken hata oluştu.</p>
            <button class="btn btn-secondary" onclick="closeProducerModal()">Kapat</button>
          </div>
        `;
      }
    }

    function closeProducerModal() {
      document.getElementById('producerModal').classList.remove('active');
    }

    function goToProducerPage(producerId) {
      closeProducerModal();
      window.location.href = `../employees/list.html?id=${producerId}`;
    }

    // ═══════════════════════════════════════════════════════════════
    // BRANCH MODAL
    // ═══════════════════════════════════════════════════════════════

    async function openBranchModal(branchName) {
      const modal = document.getElementById('branchModal');
      const modalBody = document.getElementById('branchModalBody');

      // Loading state
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <div class="loading-spinner" style="display: inline-block;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          </div>
          <p style="margin-top: 1rem; opacity: 0.7;">Şube bilgisi yükleniyor...</p>
        </div>
      `;
      modal.classList.add('active');

      try {
        const branch = await apiGet('branches/search', { name: branchName });

        if (branch) {
          const initials = (branch.name || branchName).substring(0, 2).toUpperCase();
          const stats = branch.stats || {};
          const employeeCount = stats.employeeCount || 0;
          const policyCount = stats.policyCount || 0;
          const totalPremium = stats.totalPremium || 0;
          const avgPremium = policyCount > 0 ? Math.round(totalPremium / policyCount) : 0;

          modalBody.innerHTML = `
            <div class="info-card">
              <div class="info-card-header">
                <div class="info-card-avatar" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);">${initials}</div>
                <div class="info-card-details">
                  <h4>${branch.name || branchName} Şubesi</h4>
                  <p>Şube Müdürü: ${branch.manager || 'Belirtilmemiş'}</p>
                </div>
              </div>

              ${branch.address ? `
              <div style="background: rgba(255, 255, 255, 0.1); padding: 0.75rem 1rem; border-radius: 12px; margin-bottom: 1rem; border: 1px solid rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px);">
                <div style="display: flex; align-items: center; gap: 0.5rem; color: rgba(255, 255, 255, 0.8); font-size: 0.85rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.7;">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  ${branch.address}
                </div>
              </div>
              ` : ''}

              <div class="info-card-stats">
                <div class="info-stat-item">
                  <div class="info-stat-value">${employeeCount}</div>
                  <div class="info-stat-label">Çalışan</div>
                </div>
                <div class="info-stat-item">
                  <div class="info-stat-value">${policyCount}</div>
                  <div class="info-stat-label">Poliçe (Bu Ay)</div>
                </div>
                <div class="info-stat-item">
                  <div class="info-stat-value">${APP_CONFIG.CURRENCY.format(totalPremium)}</div>
                  <div class="info-stat-label">Prim (Bu Ay)</div>
                </div>
                <div class="info-stat-item">
                  <div class="info-stat-value">${APP_CONFIG.CURRENCY.format(avgPremium)}</div>
                  <div class="info-stat-label">Ort. Prim</div>
                </div>
              </div>

              <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeBranchModal()">Kapat</button>
                <button class="btn btn-primary" onclick="goToBranchPage(${branch.id || 0})">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                  </svg>
                  Şube Sayfası
                </button>
              </div>
            </div>
          `;
        } else {
          modalBody.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
              <p>Şube bilgisi bulunamadı.</p>
              <button class="btn btn-secondary" onclick="closeBranchModal()">Kapat</button>
            </div>
          `;
        }
      } catch (error) {
        console.error('Şube bilgisi alınamadı:', error);
        modalBody.innerHTML = `
          <div style="text-align: center; padding: 2rem;">
            <p>Şube bilgisi yüklenirken hata oluştu.</p>
            <button class="btn btn-secondary" onclick="closeBranchModal()">Kapat</button>
          </div>
        `;
      }
    }

    function closeBranchModal() {
      document.getElementById('branchModal').classList.remove('active');
    }

    function goToBranchPage(branchId) {
      closeBranchModal();
      window.location.href = `../employees/list.html?branchId=${branchId}`;
    }

    // Helper function for color gradients
    function getColorGradient(color) {
      const gradients = {
        'emerald': '#10b981, #059669',
        'cyan': '#06b6d4, #0891b2',
        'violet': '#8b5cf6, #7c3aed',
        'amber': '#f59e0b, #d97706'
      };
      return gradients[color] || '#6366f1, #4f46e5';
    }

    // ═══════════════════════════════════════════════════════════════
    // EDIT POLICY MODAL
    // ═══════════════════════════════════════════════════════════════

    let currentEditingPolicyId = null;

    function openEditPolicyModal(policyId) {
      const policy = policies.find(p => p.id === policyId);
      if (!policy) {
        showToast('Poliçe bulunamadı', 'error');
        return;
      }

      currentEditingPolicyId = policyId;

      // Form alanlarını doldur
      document.getElementById('editPolicyId').value = policyId;
      document.getElementById('editPolicyNo').value = policy.policyNo || '';
      document.getElementById('editCustomer').value = policy.customer || '';
      document.getElementById('editDate').value = policy.date || '';
      document.getElementById('editNetPremium').value = policy.netPremium || 0;
      document.getElementById('editGrossPremium').value = policy.grossPremium || 0;

      // Poliçe tipi dropdown
      const typeSelect = document.getElementById('editType');
      typeSelect.innerHTML = policyTypes.map(t =>
        `<option value="${t.value}" ${t.value === policy.type ? 'selected' : ''}>${t.value}</option>`
      ).join('');

      // Prodüktör dropdown
      const producerSelect = document.getElementById('editProducer');
      producerSelect.innerHTML = producersList.map(p =>
        `<option value="${p.name}" ${p.name === policy.producer ? 'selected' : ''}>${p.name}</option>`
      ).join('');

      // Şube dropdown
      const branchSelect = document.getElementById('editBranch');
      branchSelect.innerHTML = branchesList.map(b =>
        `<option value="${b}" ${b === policy.branch ? 'selected' : ''}>${b}</option>`
      ).join('');

      // Modalı aç
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

      // Form değerlerini al
      const newPolicyNo = document.getElementById('editPolicyNo').value.trim();
      const newType = document.getElementById('editType').value;
      const newDate = document.getElementById('editDate').value;
      const newNetPremium = parseFloat(document.getElementById('editNetPremium').value) || 0;
      const newGrossPremium = parseFloat(document.getElementById('editGrossPremium').value) || 0;
      const newProducer = document.getElementById('editProducer').value;
      const newBranch = document.getElementById('editBranch').value;

      // Değişiklikleri topla
      const changes = {};

      if (newPolicyNo !== policy.policyNo) changes.policyNo = newPolicyNo;
      if (newType !== policy.type) changes.type = newType;
      if (newDate !== policy.date) changes.date = newDate;
      if (newNetPremium !== policy.netPremium) changes.netPremium = newNetPremium;
      if (newGrossPremium !== policy.grossPremium) changes.grossPremium = newGrossPremium;
      if (newProducer !== policy.producer) changes.producer = newProducer;
      if (newBranch !== policy.branch) changes.branch = newBranch;

      // Değişiklik yoksa
      if (Object.keys(changes).length === 0) {
        showToast('Değişiklik yapılmadı', 'info');
        closeEditPolicyModal();
        return;
      }

      // API'ye gönder
      showLoading(true);
      try {
        const result = await apiPut('policies/captured/batch-update', {
          updates: [{ policyId, changes }]
        });

        if (result.success) {
          // Yerel veriyi güncelle
          Object.assign(policy, {
            policyNo: newPolicyNo,
            type: newType,
            typeClass: policyTypes.find(t => t.value === newType)?.class || 'kasko',
            date: newDate,
            dateFormatted: new Date(newDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            netPremium: newNetPremium,
            grossPremium: newGrossPremium,
            producer: newProducer,
            branch: newBranch
          });

          // Prodüktör bilgilerini güncelle
          const prod = producersList.find(p => p.name === newProducer);
          if (prod) {
            policy.producerInitials = prod.initials;
            policy.producerColor = prod.color;
          }

          showToast('Poliçe başarıyla güncellendi', 'success');
          closeEditPolicyModal();
          applyFilters(); // Tabloyu yenile
        } else {
          showToast('Güncelleme başarısız: ' + (result.message || 'Bilinmeyen hata'), 'error');
        }
      } catch (error) {
        console.error('Güncelleme hatası:', error);
        showToast('Güncelleme sırasında hata oluştu', 'error');
      } finally {
        showLoading(false);
      }
    }

    // Close modals when clicking overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', function(e) {
        if (e.target === this) {
          this.classList.remove('active');
        }
      });
    });

    // Close modals with Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
          modal.classList.remove('active');
        });
      }
    });
