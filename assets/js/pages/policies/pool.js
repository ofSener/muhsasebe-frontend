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
    let policies = [];
    let filteredPolicies = [];

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

    // ═══════════════════════════════════════════════════════════════
    // POOL (AKTARIM HAVUZU) STATE YÖNETİMİ
    // ═══════════════════════════════════════════════════════════════
    const poolState = {
      data: null,
      filters: {
        status: 'all', // all, matched, unmatched, difference
        search: '',
        bransId: '',
        sigortaSirketiId: ''
      },
      pagination: {
        currentPage: 1,
        pageSize: 20
      },
      selection: new Set(),
      loading: false,
      lookups: {
        branslar: [],
        sigortaSirketleri: [],
        loaded: false
      }
    };

    // Müşterisi Bulunmayanlar (MusteriId=NULL onaylı poliçeler) state
    const noCustomerState = {
      data: null,
      loading: false,
      pagination: { currentPage: 1, pageSize: 20 },
      filters: { search: '', sigortaSirketiId: null },
      selectedIds: new Set(),
      currentAssignPolicyId: null
    };

    // Eşleşmeyenler (Yakalanan ama havuzda olmayan) state
    const unmatchedCapturedState = {
      data: null,
      loading: false,
      pagination: {
        currentPage: 1,
        pageSize: 20
      },
      filters: {
        search: '',
        bransId: null,
        sigortaSirketiId: null
      }
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
        policyTypes = data || [];
        return data;
      } catch (error) {
        console.error('Poliçe tipleri alınamadı:', error);
        // Fallback statik veri
        policyTypes = [
          { value: 'Kasko', class: 'kasko' },
          { value: 'Trafik', class: 'trafik' },
          { value: 'DASK', class: 'dask' },
          { value: 'Sağlık', class: 'saglik' },
          { value: 'Konut', class: 'konut' }
        ];
        return policyTypes;
      }
    }

    // Prodüktör listesi yükle (sadece aktif kullanıcılar - firmaId ile filtrelenmiş)
    async function loadProducers() {
      try {
        const user = APP_CONFIG.AUTH.getUser();
        const firmaId = user?.firmaId;
        const endpoint = firmaId ? `kullanicilar/aktif?firmaId=${firmaId}` : 'kullanicilar/aktif';
        const data = await apiGet(endpoint);
        producersList = (data || []).map(u => ({
          id: u.id,
          name: `${u.adi || ''} ${u.soyadi || ''}`.trim() || `Kullanıcı #${u.id}`,
          subeId: u.subeId,
          branch: u.subeAdi || ''
        }));
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
        branch: branch,
        branchId: p.subeId,
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
          endDate: formatDateISO(currentDateRange.endDate),
          sortBy: currentSort.field,
          sortDir: currentSort.direction
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

    // Tarih formatla (ISO) - Yerel tarih kullanılır (UTC dönüşümü yapılmaz)
    function formatDateISO(date) {
      if (!date) return '';
      const d = new Date(date);
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
      requirePermission('policeHavuzunuGorebilsin');

      showLoading(true);

      try {
        // 1. Kullanıcı bilgisi ve yetkisi
        await loadCurrentUser();

        // 2. Pool lookup verilerini yükle
        await loadPoolLookups();

        // 3. İlk tab: Bekleyen İşlemler
        poolState.filters.status = 'unmatched,difference';
        await loadPoolData();

        // 4. Tab sayılarını yükle
        loadTabCounts();

      } catch (error) {
        console.error('Sayfa yüklenirken hata:', error);
        showToast('Sayfa yüklenirken hata oluştu', 'error');
      } finally {
        showLoading(false);
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // MAIN TAB SWITCHING - Ana Sekme Değiştirme
    // ═══════════════════════════════════════════════════════════════

    let currentMainTab = 'pending'; // 'pending' veya 'matched'

    function switchMainTab(tab, btn) {
      // Tab butonlarını güncelle
      document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      currentMainTab = tab;

      // Status'e göre pool verilerini filtrele
      if (tab === 'pending') {
        // Bekleyen İşlemler: AKTARIMDA + FARK_VAR
        poolState.filters.status = 'unmatched,difference';
        document.getElementById('pageTitle').textContent = 'Bekleyen İşlemler';
        document.getElementById('pageSubtitle').textContent = 'Eşleşme bekleyen ve fark olan poliçeler';
        loadPoolData(true);
      } else if (tab === 'matched') {
        // Eşleşen Poliçeler: ESLESTI
        poolState.filters.status = 'matched';
        document.getElementById('pageTitle').textContent = 'Eşleşen Poliçeler';
        document.getElementById('pageSubtitle').textContent = 'Tam eşleşen ve onay bekleyen poliçeler';
        loadPoolData(true);
      } else if (tab === 'unmatched-captured') {
        // Eşleşmeyenler: Yakalanan ama havuzda olmayan
        document.getElementById('pageTitle').textContent = 'Eşleşmeyenler';
        document.getElementById('pageSubtitle').textContent = 'Yakalanan ama havuzda olmayan poliçeler';
        loadUnmatchedCaptured(true);
      } else if (tab === 'no-customer') {
        // Müşterisi Bulunmayanlar: Onaylı poliçe, MusteriId = null
        document.getElementById('pageTitle').textContent = 'Müşterisi Bulunmayan Poliçeler';
        document.getElementById('pageSubtitle').textContent = 'Onaylanmış ancak müşteri kaydı eşleşmemiş poliçeler';
        loadNoCustomerPolicies(true);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // POOL (AKTARIM HAVUZU) FONKSİYONLARI
    // ═══════════════════════════════════════════════════════════════

    // Pool için branş ve sigorta şirketleri yükle
    async function loadPoolLookups() {
      if (poolState.lookups.loaded) return;

      try {
        const [branslar, sigortaSirketleri] = await Promise.all([
          apiGet('policy-types').catch(() => []),  // sigortapoliceturleri tablosundan
          apiGet('insurance-companies').catch(() => [])
        ]);

        poolState.lookups.branslar = branslar || [];
        poolState.lookups.sigortaSirketleri = sigortaSirketleri || [];
        poolState.lookups.loaded = true;

        // Global değişkenlere de ata (eski kod uyumluluğu için)
        window.sigortaSirketleri = sigortaSirketleri || [];
      } catch (error) {
        console.error('Pool lookup verileri yüklenemedi:', error);
      }
    }

    // Pool verilerini yükle
    async function loadPoolData(resetPage = false) {
      const poolContent = document.getElementById('poolContent');
      if (!poolContent) return;

      if (resetPage) {
        poolState.pagination.currentPage = 1;
      }

      // Loading state
      if (!poolState.data) {
        poolContent.innerHTML = `
          <div class="text-center py-5">
            <div class="loading-spinner mb-3">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
            </div>
            <p class="text-muted">Aktarım havuzu yükleniyor...</p>
          </div>
        `;
      }

      poolState.loading = true;

      // Lookup verilerini yükle (ilk sefer)
      await loadPoolLookups();

      try {
        // API parametrelerini hazırla
        const params = {
          page: poolState.pagination.currentPage,
          pageSize: poolState.pagination.pageSize
        };

        if (poolState.filters.status && poolState.filters.status !== 'all') {
          params.status = poolState.filters.status;
        }
        if (poolState.filters.search) {
          params.search = poolState.filters.search;
        }
        if (poolState.filters.bransId) {
          params.bransId = poolState.filters.bransId;
        }
        if (poolState.filters.sigortaSirketiId) {
          params.sigortaSirketiId = poolState.filters.sigortaSirketiId;
        }

        const data = await apiGet('policies/pool', params);
        poolState.data = data;
        poolState.loading = false;

        if (!data || !data.items || data.items.length === 0) {
          renderPoolEmpty();
          return;
        }

        // Pool içeriğini render et
        renderPoolContent(data);
      } catch (error) {
        console.error('Pool verileri yüklenemedi:', error);
        poolState.loading = false;
        poolContent.innerHTML = `
          <div class="card">
            <div class="card-body text-center py-5">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--danger); margin-bottom: 1rem;">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">Yüklenemedi</h3>
              <p class="text-muted">${error.message || 'Aktarım havuzu yüklenirken bir hata oluştu.'}</p>
              <button class="btn btn-primary btn-sm mt-3" onclick="loadPoolData()">Tekrar Dene</button>
            </div>
          </div>
        `;
      }
    }

    // Boş pool durumu
    function renderPoolEmpty() {
      const poolContent = document.getElementById('poolContent');
      const data = poolState.data;

      // Filtre aktif mi kontrol et
      const hasFilters = poolState.filters.status !== 'all' ||
                         poolState.filters.search ||
                         poolState.filters.bransId ||
                         poolState.filters.sigortaSirketiId;

      // KPI kartlarını göster (boş olsa bile)
      poolContent.innerHTML = `
        ${renderPoolKPIs(data)}
        ${renderPoolStatusTabs()}
        ${renderPoolFilters()}
        <div class="card mt-4">
          <div class="card-body text-center py-5">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-muted); margin-bottom: 1rem;">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17,8 12,3 7,8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">
              ${hasFilters ? 'Sonuç Bulunamadı' : 'Aktarım Havuzu Boş'}
            </h3>
            <p class="text-muted">
              ${hasFilters
                ? 'Seçilen filtrelerle eşleşen kayıt bulunamadı.'
                : 'Henüz havuza aktarılmış poliçe bulunmuyor.'}
            </p>
            ${hasFilters ? `
              <button class="btn btn-primary mt-3" onclick="clearPoolFilters()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
                Filtreleri Temizle ve Tümünü Göster
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    // KPI kartlarını render et
    function renderPoolKPIs(data) {
      const matched = data?.matchedCount || 0;
      const difference = data?.differenceCount || 0;
      const unmatched = data?.unmatchedCount || 0;
      const totalPrim = data?.totalBrutPrim || 0;
      const total = data?.totalCount || 0;

      return `
        <div class="kpi-grid mb-4">
          <!-- Eşleşen -->
          <div class="kpi-card kpi-emerald" style="cursor: pointer;" onclick="switchPoolStatus('matched')">
            <div class="kpi-card-bg"></div>
            <div class="kpi-header">
              <div class="kpi-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
              </div>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">${matched}</div>
              <div class="kpi-label">Eşleşen</div>
              <div class="kpi-subtitle">Yakalanan ile eşleşen</div>
            </div>
          </div>

          <!-- Fark Var -->
          <div class="kpi-card kpi-amber" style="cursor: pointer;" onclick="switchPoolStatus('difference')">
            <div class="kpi-card-bg"></div>
            <div class="kpi-header">
              <div class="kpi-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">${difference}</div>
              <div class="kpi-label">Fark Var</div>
              <div class="kpi-subtitle">Prim farkı olanlar</div>
            </div>
          </div>

          <!-- Bekleyen (Sadece Havuzda) -->
          <div class="kpi-card kpi-blue" style="cursor: pointer;" onclick="switchPoolStatus('unmatched')">
            <div class="kpi-card-bg"></div>
            <div class="kpi-header">
              <div class="kpi-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17,8 12,3 7,8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">${unmatched}</div>
              <div class="kpi-label">Bekleyen</div>
              <div class="kpi-subtitle">Sadece havuzda</div>
            </div>
          </div>

          <!-- Toplam Prim -->
          <div class="kpi-card kpi-purple" style="cursor: pointer;" onclick="switchPoolStatus('all')">
            <div class="kpi-card-bg"></div>
            <div class="kpi-header">
              <div class="kpi-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              </div>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">${totalPrim.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} TL</div>
              <div class="kpi-label">Toplam Prim</div>
              <div class="kpi-subtitle">${total} poliçe</div>
            </div>
          </div>
        </div>
      `;
    }

    // Durum sekmelerini render et
    function renderPoolStatusTabs() {
      const currentStatus = poolState.filters.status || 'all';
      const data = poolState.data;

      return `
        <div class="pool-status-tabs mb-4">
          <button class="pool-status-tab ${currentStatus === 'all' ? 'active' : ''}" onclick="switchPoolStatus('all')">
            Tümü
            <span class="tab-count">${data?.totalCount || 0}</span>
          </button>
          <button class="pool-status-tab ${currentStatus === 'matched' ? 'active' : ''}" onclick="switchPoolStatus('matched')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            Eşleşen
            <span class="tab-count">${data?.matchedCount || 0}</span>
          </button>
          <button class="pool-status-tab ${currentStatus === 'difference' ? 'active' : ''}" onclick="switchPoolStatus('difference')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            Fark Var
            <span class="tab-count">${data?.differenceCount || 0}</span>
          </button>
          <button class="pool-status-tab ${currentStatus === 'unmatched' ? 'active' : ''}" onclick="switchPoolStatus('unmatched')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17,8 12,3 7,8"/>
            </svg>
            Sadece Havuzda
            <span class="tab-count">${data?.unmatchedCount || 0}</span>
          </button>
        </div>
      `;
    }

    // Filtre alanını render et
    function renderPoolFilters() {
      const branslar = poolState.lookups.branslar || [];
      const sirketler = poolState.lookups.sigortaSirketleri || [];

      return `
        <div class="pool-filters mb-4">
          <div class="pool-filter-row">
            <div class="pool-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input type="text"
                     id="poolSearchInput"
                     placeholder="Poliçe no, plaka ara..."
                     value="${poolState.filters.search || ''}"
                     onkeyup="handlePoolSearchKeyup(event)"
                     oninput="debouncePoolSearch(this.value)">
              ${poolState.filters.search ? `
                <button class="pool-search-clear" onclick="clearPoolSearch()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              ` : ''}
            </div>

            <select class="pool-filter-select" id="poolBransFilter" onchange="handlePoolBransFilter(this.value)">
              <option value="">Tüm Branşlar</option>
              ${branslar.map(b => {
                const bId = b.id || b.bransId || '';
                const bName = b.turu || b.ad || b.name || b.bransAdi || (typeof b === 'string' ? b : 'Branş');
                return `<option value="${bId}" ${poolState.filters.bransId == bId ? 'selected' : ''}>${bName}</option>`;
              }).join('')}
            </select>

            <select class="pool-filter-select" id="poolSirketFilter" onchange="handlePoolSirketFilter(this.value)">
              <option value="">Tüm Şirketler</option>
              ${sirketler.map(s => {
                const sId = s.id || s.sigortaSirketiId || '';
                const sName = s.ad || s.name || s.sirketAdi || 'Şirket';
                return `<option value="${sId}" ${poolState.filters.sigortaSirketiId == sId ? 'selected' : ''}>${sName}</option>`;
              }).join('')}
            </select>

            <div class="pool-filter-actions">
              <button class="btn btn-outline btn-sm" onclick="clearPoolFilters()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
                Filtreleri Temizle
              </button>
              <button class="btn btn-primary btn-sm" onclick="loadPoolData(true)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23,4 23,10 17,10"/>
                  <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                </svg>
                Yenile
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Pool içeriğini render et
    function renderPoolContent(data) {
      const poolContent = document.getElementById('poolContent');

      const html = `
        ${renderPoolKPIs(data)}
        ${renderPoolStatusTabs()}
        ${renderPoolFilters()}
        ${renderPoolTable(data)}
        ${renderPoolPagination(data)}
        ${renderPoolFloatingActions()}
      `;

      poolContent.innerHTML = html;
    }

    // Pool tablosunu render et
    function renderPoolTable(data) {
      const items = data.items || [];
      const hasSelection = poolState.selection.size > 0;
      const allSelected = items.length > 0 && items.every(item => poolState.selection.has(item.id));

      return `
        <div class="card">
          <div class="card-header">
            <div class="card-header-left">
              <h3 class="card-title">Aktarım Havuzu</h3>
              <span class="badge badge-info">${data.totalCount || 0} kayıt</span>
              ${hasSelection ? `<span class="badge badge-primary ml-2">${poolState.selection.size} seçili</span>` : ''}
            </div>
            <div class="card-header-right">
              ${data.totalCount > 0 ? `
                <button class="btn btn-success btn-sm" onclick="approveAllPool()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Tümünü Poliçelerime Kaydet
                </button>
              ` : ''}
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th style="width: 40px;">
                      <label class="checkbox-wrapper">
                        <input type="checkbox"
                               ${allSelected ? 'checked' : ''}
                               onchange="togglePoolSelectAll(this.checked)">
                        <span class="checkbox-custom"></span>
                      </label>
                    </th>
                    <th>Poliçe No</th>
                    <th>Tanzim Tarihi</th>
                    <th>Sigortalı Adı</th>
                    <th>Branş</th>
                    <th>Sigorta Şirketi</th>
                    <th class="text-right">Havuz Prim</th>
                    <th class="text-right">Yakalanan Prim</th>
                    <th class="text-right">Fark</th>
                    <th class="text-right">Komisyon</th>
                    <th>Durum</th>
                    <th style="width: 100px;">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(item => renderPoolTableRow(item)).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    // Tek bir tablo satırını render et
    function renderPoolTableRow(item) {
      const isSelected = poolState.selection.has(item.id);
      const statusClass = item.eslesmeDurumu === 'ESLESTI' ? 'badge-success' :
                          item.eslesmeDurumu === 'FARK_VAR' ? 'badge-warning' : 'badge-danger';
      const statusText = item.eslesmeDurumu === 'ESLESTI' ? 'Eşleşti' :
                         item.eslesmeDurumu === 'FARK_VAR' ? 'Fark Var' : 'Aktarımda';

      const primFarki = item.primFarki || 0;
      const farkClass = primFarki > 0 ? 'text-success' : primFarki < 0 ? 'text-danger' : '';

      // Tanzim Tarihi formatla
      const tanzimTarihiFormatted = item.tanzimTarihi
        ? new Date(item.tanzimTarihi).toLocaleDateString('tr-TR')
        : '-';

      return `
        <tr class="${isSelected ? 'selected' : ''}" data-id="${item.id}">
          <td>
            <label class="checkbox-wrapper">
              <input type="checkbox"
                     ${isSelected ? 'checked' : ''}
                     onchange="togglePoolSelection(${item.id}, this.checked)">
              <span class="checkbox-custom"></span>
            </label>
          </td>
          <td>
            <span class="font-mono">${item.policeNo || '-'}</span>
            ${item.plaka ? `<div class="text-muted text-xs">${item.plaka}</div>` : ''}
            ${item.zeyilNo > 0 ? `<div class="text-muted text-xs">Zeyil: ${item.zeyilNo}</div>` : ''}
          </td>
          <td>
            <span class="text-sm">${tanzimTarihiFormatted}</span>
          </td>
          <td>
            <span class="text-sm">${item.sigortaliAdi || '-'}</span>
          </td>
          <td><span class="badge badge-outline">${item.brans || '-'}</span></td>
          <td><span class="text-sm">${item.sigortaSirketi || '-'}</span></td>
          <td class="font-mono text-right">${(item.brutPrim || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL</td>
          <td class="font-mono text-right">
            ${item.yakalananPrim != null ? `${item.yakalananPrim.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL` : '<span class="text-muted">-</span>'}
          </td>
          <td class="font-mono text-right ${farkClass}">
            ${primFarki !== 0 && primFarki !== null ? `${primFarki > 0 ? '+' : ''}${primFarki.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL` : '<span class="text-muted">-</span>'}
          </td>
          <td class="font-mono text-right">
            <span class="font-mono">${(item.komisyon || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL</span>
          </td>
          <td>
            <span class="badge ${statusClass}">${statusText}</span>
          </td>
          <td>
            <div class="action-buttons">
              ${item.eslesmeDurumu === 'FARK_VAR' ? `
                <button class="btn btn-sm btn-success" onclick="acceptPoolValue(${item.id})" title="Aktarımdan geleni kabul et">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  Kabul Et
                </button>
              ` : ''}
              <button class="action-btn" title="Detay" onclick="showPoolPolicyDetail(${item.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button class="action-btn action-btn-success" title="Kaydet" onclick="approvePoolPolicy(${item.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }

    // Sayfalama render et
    function renderPoolPagination(data) {
      const currentPage = data.currentPage || 1;
      const totalPages = data.totalPages || 1;
      const pageSize = poolState.pagination.pageSize;

      if (totalPages <= 1) return '';

      let pages = [];
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
          pages.push(i);
        } else if (pages[pages.length - 1] !== '...') {
          pages.push('...');
        }
      }

      return `
        <div class="pool-pagination mt-4">
          <div class="pagination-info">
            Sayfa ${currentPage} / ${totalPages}
          </div>
          <div class="pagination-controls">
            <select class="pagination-size" onchange="changePoolPageSize(this.value)">
              <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
              <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
              <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
              <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
            </select>
            <div class="pagination-buttons">
              <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPoolPage(${currentPage - 1})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15,18 9,12 15,6"/>
                </svg>
              </button>
              ${pages.map(p => p === '...' ?
                `<span class="pagination-ellipsis">...</span>` :
                `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="goToPoolPage(${p})">${p}</button>`
              ).join('')}
              <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPoolPage(${currentPage + 1})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9,18 15,12 9,6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Floating action box (seçim yapılınca)
    function renderPoolFloatingActions() {
      const count = poolState.selection.size;
      if (count === 0) return '';

      return `
        <div class="pool-floating-actions" id="poolFloatingActions">
          <div class="floating-count">
            <span class="count-number">${count}</span>
            <span class="count-text">poliçe seçildi</span>
          </div>
          <div class="floating-buttons">
            <button class="btn btn-success" onclick="approveSelectedPool()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
              </svg>
              Seçilenleri Kaydet
            </button>
            <button class="btn btn-outline" onclick="clearPoolSelection()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Seçimi Temizle
            </button>
          </div>
        </div>
      `;
    }

    // ═══════════════════════════════════════════════════════════════
    // POOL EVENT HANDLERS
    // ═══════════════════════════════════════════════════════════════

    // Durum sekmesi değiştir
    function switchPoolStatus(status) {
      poolState.filters.status = status;
      poolState.pagination.currentPage = 1;
      poolState.selection.clear();
      loadPoolData();
    }

    // Arama debounce
    let poolSearchTimeout = null;
    function debouncePoolSearch(value) {
      if (poolSearchTimeout) clearTimeout(poolSearchTimeout);
      poolSearchTimeout = setTimeout(() => {
        poolState.filters.search = value;
        loadPoolData(true);
      }, 300);
    }

    function handlePoolSearchKeyup(event) {
      if (event.key === 'Enter') {
        if (poolSearchTimeout) clearTimeout(poolSearchTimeout);
        poolState.filters.search = event.target.value;
        loadPoolData(true);
      }
    }

    function clearPoolSearch() {
      poolState.filters.search = '';
      const input = document.getElementById('poolSearchInput');
      if (input) input.value = '';
      loadPoolData(true);
    }

    // Branş filtresi
    function handlePoolBransFilter(value) {
      poolState.filters.bransId = value;
      loadPoolData(true);
    }

    // Şirket filtresi
    function handlePoolSirketFilter(value) {
      poolState.filters.sigortaSirketiId = value;
      loadPoolData(true);
    }

    // Filtreleri temizle
    function clearPoolFilters() {
      poolState.filters = {
        status: 'all',
        search: '',
        bransId: '',
        sigortaSirketiId: ''
      };
      loadPoolData(true);
    }

    // Seçim işlemleri
    function togglePoolSelection(id, checked) {
      if (checked) {
        poolState.selection.add(id);
      } else {
        poolState.selection.delete(id);
      }
      updatePoolSelectionUI();
    }

    function togglePoolSelectAll(checked) {
      const items = poolState.data?.items || [];
      if (checked) {
        items.forEach(item => poolState.selection.add(item.id));
      } else {
        items.forEach(item => poolState.selection.delete(item.id));
      }
      updatePoolSelectionUI();
    }

    function clearPoolSelection() {
      poolState.selection.clear();
      updatePoolSelectionUI();
    }

    function updatePoolSelectionUI() {
      // Tablo satırlarını güncelle
      const rows = document.querySelectorAll('#poolContent table tbody tr');
      rows.forEach(row => {
        const id = parseInt(row.dataset.id);
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (poolState.selection.has(id)) {
          row.classList.add('selected');
          if (checkbox) checkbox.checked = true;
        } else {
          row.classList.remove('selected');
          if (checkbox) checkbox.checked = false;
        }
      });

      // Header checkbox'ı güncelle
      const headerCheckbox = document.querySelector('#poolContent table thead input[type="checkbox"]');
      const items = poolState.data?.items || [];
      const allSelected = items.length > 0 && items.every(item => poolState.selection.has(item.id));
      if (headerCheckbox) headerCheckbox.checked = allSelected;

      // Floating actions güncelle
      const floatingEl = document.getElementById('poolFloatingActions');
      if (floatingEl) {
        floatingEl.remove();
      }

      const poolContent = document.getElementById('poolContent');
      if (poolState.selection.size > 0 && poolContent) {
        poolContent.insertAdjacentHTML('beforeend', renderPoolFloatingActions());
      }

      // Seçili sayısı badge'ini güncelle
      const selectionBadge = document.querySelector('#poolContent .card-header .badge-primary');
      if (selectionBadge) {
        if (poolState.selection.size > 0) {
          selectionBadge.textContent = `${poolState.selection.size} seçili`;
          selectionBadge.style.display = '';
        } else {
          selectionBadge.style.display = 'none';
        }
      }
    }

    // Sayfalama
    function goToPoolPage(page) {
      poolState.pagination.currentPage = page;
      loadPoolData();
    }

    function changePoolPageSize(size) {
      poolState.pagination.pageSize = parseInt(size);
      poolState.pagination.currentPage = 1;
      loadPoolData();
    }

    // ═══════════════════════════════════════════════════════════════
    // POOL ACTIONS (KAYDETME İŞLEMLERİ)
    // ═══════════════════════════════════════════════════════════════

    // Tek poliçe kaydet
    async function approvePoolPolicy(id) {
      if (!confirm('Bu poliçeyi Poliçelerime kaydetmek istediğinize emin misiniz?')) return;

      try {
        const result = await apiPost(`policies/pool/${id}/approve`);
        if (result.success) {
          showToast('Poliçe Poliçelerime kaydedildi', 'success');
          poolState.selection.delete(id);
          loadPoolData();
        } else {
          showToast(result.errorMessage || 'Kaydetme başarısız', 'error');
        }
      } catch (error) {
        console.error('Kaydetme hatası:', error);
        showToast('Kaydetme sırasında hata oluştu', 'error');
      }
    }

    // Aktarımdan geleni kabul et (FARK_VAR durumu için)
    async function acceptPoolValue(poolPolicyId) {
      if (!confirm('Aktarımdan gelen değerler ile bu poliçeyi poliçelerinize kaydetmek istediğinizden emin misiniz?')) {
        return;
      }

      try {
        // Mevcut approval endpoint'i kullan
        const result = await apiPost(`policies/pool/${poolPolicyId}/approve`);

        if (result.success) {
          showToast('Poliçe başarıyla kaydedildi', 'success');
          // Pool'dan kaldırıldı, listeyi yenile
          poolState.selection.delete(poolPolicyId);
          await loadPoolData(true);
          await loadTabCounts();
        } else {
          showToast(result.errorMessage || 'Kayıt işlemi başarısız', 'error');
        }
      } catch (error) {
        console.error('acceptPoolValue error:', error);
        showToast('Bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'), 'error');
      }
    }

    // Seçilenleri kaydet
    async function approveSelectedPool() {
      const ids = Array.from(poolState.selection);
      if (ids.length === 0) {
        showToast('Lütfen en az bir poliçe seçin', 'warning');
        return;
      }

      if (!confirm(`${ids.length} poliçeyi Poliçelerime kaydetmek istediğinize emin misiniz?`)) return;

      try {
        const result = await apiPost('policies/pool/batch-approve', { poolPolicyIds: ids });

        if (result.successCount > 0) {
          showToast(`${result.successCount} poliçe Poliçelerime kaydedildi`, 'success');
        }
        if (result.failedCount > 0) {
          showToast(`${result.failedCount} poliçe kaydedilemedi`, 'warning');
          console.warn('Kaydetme hataları:', result.errors);
        }

        poolState.selection.clear();
        loadPoolData();
      } catch (error) {
        console.error('Toplu kaydetme hatası:', error);
        showToast('Toplu kaydetme sırasında hata oluştu', 'error');
      }
    }

    // Tüm havuzdaki poliçeleri kaydet
    async function approveAllPool() {
      const data = poolState.data;
      if (!data || data.totalCount === 0) {
        showToast('Havuzda poliçe bulunamadı', 'info');
        return;
      }

      if (!confirm(`Havuzdaki tüm ${data.totalCount} poliçeyi Poliçelerime kaydetmek istediğinize emin misiniz?`)) return;

      try {
        // Tüm havuzdaki poliçeleri çek
        const allData = await apiGet('policies/pool', {
          pageSize: 1000
        });

        if (!allData?.items?.length) {
          showToast('Havuzda poliçe bulunamadı', 'info');
          return;
        }

        const ids = allData.items.map(item => item.id);
        const result = await apiPost('policies/pool/batch-approve', { poolPolicyIds: ids });

        if (result.successCount > 0) {
          showToast(`${result.successCount} poliçe Poliçelerime kaydedildi`, 'success');
        }
        if (result.failedCount > 0) {
          showToast(`${result.failedCount} poliçe kaydedilemedi`, 'warning');
          console.warn('Kaydetme hataları:', result.errors);
        }

        poolState.selection.clear();
        loadPoolData();
      } catch (error) {
        console.error('Tüm poliçeleri kaydetme hatası:', error);
        showToast('Kaydetme sırasında hata oluştu', 'error');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // EŞLEŞMEYENLERde (YAKALANAN AMA HAVUZDA OLMAYAN) FONKSİYONLARI
    // ═══════════════════════════════════════════════════════════════

    // Eşleşmeyenleri yükle
    async function loadUnmatchedCaptured(resetPage = false) {
      const poolContent = document.getElementById('poolContent');
      if (!poolContent) return;

      if (resetPage) {
        unmatchedCapturedState.pagination.currentPage = 1;
      }

      try {
        unmatchedCapturedState.loading = true;
        const params = {
          page: unmatchedCapturedState.pagination.currentPage,
          pageSize: unmatchedCapturedState.pagination.pageSize
        };

        if (unmatchedCapturedState.filters.search) {
          params.search = unmatchedCapturedState.filters.search;
        }
        if (unmatchedCapturedState.filters.bransId) {
          params.bransId = unmatchedCapturedState.filters.bransId;
        }
        if (unmatchedCapturedState.filters.sigortaSirketiId) {
          params.sigortaSirketiId = unmatchedCapturedState.filters.sigortaSirketiId;
        }

        const data = await apiGet('policies/captured/not-in-pool', params);
        unmatchedCapturedState.data = data;
        unmatchedCapturedState.loading = false;

        if (!data || !data.items || data.items.length === 0) {
          renderUnmatchedCapturedEmpty();
          return;
        }

        renderUnmatchedCapturedContent(data);
      } catch (error) {
        console.error('Eşleşmeyenler yüklenemedi:', error);
        unmatchedCapturedState.loading = false;
        poolContent.innerHTML = `
          <div class="card">
            <div class="card-body text-center py-5">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--danger); margin-bottom: 1rem;">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">Yüklenemedi</h3>
              <p class="text-muted">${error.message || 'Bir hata oluştu'}</p>
              <button class="btn btn-primary btn-sm mt-3" onclick="loadUnmatchedCaptured()">Tekrar Dene</button>
            </div>
          </div>
        `;
      }
    }

    // Eşleşmeyenler boş durumu
    function renderUnmatchedCapturedEmpty() {
      const poolContent = document.getElementById('poolContent');
      poolContent.innerHTML = `
        <div class="card">
          <div class="card-body text-center py-5">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--success); margin-bottom: 1rem;">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">Tüm Poliçeler Eşleşti</h3>
            <p class="text-muted">Yakalanan tüm poliçeler havuzda bulunuyor.</p>
          </div>
        </div>
      `;
    }

    // Eşleşmeyenler içeriğini render et
    function renderUnmatchedCapturedContent(data) {
      const poolContent = document.getElementById('poolContent');

      const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';
      const fmtPrim = (v) => (v || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2});

      const html = `
        <div class="card">
          <div class="card-header">
            <div class="card-header-left">
              <h3 class="card-title">Eşleşmeyenler</h3>
              <span class="badge badge-warning">${data.totalCount || 0} kayıt</span>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th style="min-width: 140px;">Poliçe No</th>
                    <th style="min-width: 150px;">Tarih</th>
                    <th style="min-width: 150px;">Sigortalı Adı</th>
                    <th style="min-width: 100px;">Branş</th>
                    <th style="min-width: 120px;">Sigorta Şirketi</th>
                    <th style="min-width: 140px;">Prodüktör / Şube</th>
                    <th class="text-right" style="min-width: 120px;">Prim</th>
                    <th style="min-width: 80px;">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.items.map(item => `
                    <tr data-id="${item.id}">
                      <td>
                        <span class="font-mono" style="font-weight: 600;">${item.policeNo || '-'}</span>
                        ${item.plaka ? `<div class="text-muted text-xs">${item.plaka}</div>` : ''}
                        <div class="text-muted text-xs">${fmtDate(item.eklenmeTarihi)}</div>
                      </td>
                      <td>
                        <span class="text-sm">${fmtDate(item.baslangicTarihi)} – ${fmtDate(item.bitisTarihi)}</span>
                        <div class="text-muted text-xs">Tanzim: ${fmtDate(item.tanzimTarihi)}</div>
                      </td>
                      <td>
                        <span class="text-sm">${item.sigortaliAdi || '-'}</span>
                      </td>
                      <td>
                        <span class="badge badge-outline">${item.brans || '-'}</span>
                      </td>
                      <td>
                        <span class="text-sm">${item.sigortaSirketi || '-'}</span>
                      </td>
                      <td>
                        <span class="text-sm" style="font-weight: 500; color: var(--primary);">${item.produktorAdi || '<span style="color: var(--danger);">Atanmamış</span>'}</span>
                        <div class="text-muted text-xs">${item.subeAdi || '-'}</div>
                      </td>
                      <td class="text-right">
                        <span class="font-mono" style="font-weight: 600;">${fmtPrim(item.brutPrim)} TL</span>
                        <div class="text-muted text-xs font-mono">Net: ${fmtPrim(item.netPrim)} TL</div>
                      </td>
                      <td>
                        <div style="display: flex; gap: 0.25rem;">
                          <button class="btn btn-sm btn-secondary" onclick="openEditUnmatchedModal(${item.id})" title="Düzenle">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button class="btn btn-sm btn-success" onclick="sendCapturedToPool(${item.id})" title="Poliçeyi Kaydet">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                              <polyline points="17,21 17,13 7,13 7,21"/>
                              <polyline points="7,3 7,8 15,8"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      poolContent.innerHTML = html;
    }

    // ═══════════════════════════════════════════════════════════════
    // MÜŞTERİSİ BULUNMAYANLAR (MusteriId=NULL ONAYLI POLİÇELER)
    // ═══════════════════════════════════════════════════════════════

    async function loadNoCustomerPolicies(resetPage = false) {
      const poolContent = document.getElementById('poolContent');
      if (!poolContent) return;

      if (resetPage) {
        noCustomerState.pagination.currentPage = 1;
        noCustomerState.selectedIds.clear();
      }

      try {
        noCustomerState.loading = true;
        const params = {
          page: noCustomerState.pagination.currentPage,
          pageSize: noCustomerState.pagination.pageSize
        };

        if (noCustomerState.filters.search) params.search = noCustomerState.filters.search;
        if (noCustomerState.filters.sigortaSirketiId) params.sigortaSirketiId = noCustomerState.filters.sigortaSirketiId;

        const data = await apiGet('policies/unmatched', params);
        noCustomerState.data = data;
        noCustomerState.loading = false;

        renderNoCustomerContent(data);
      } catch (error) {
        console.error('Müşterisi bulunmayanlar yüklenemedi:', error);
        noCustomerState.loading = false;
        poolContent.innerHTML = `
          <div class="card">
            <div class="card-body text-center py-5">
              <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">Yüklenemedi</h3>
              <p class="text-muted">${error.message || 'Bir hata oluştu'}</p>
              <button class="btn btn-primary btn-sm mt-3" onclick="loadNoCustomerPolicies()">Tekrar Dene</button>
            </div>
          </div>`;
      }
    }

    function renderNoCustomerContent(data) {
      const poolContent = document.getElementById('poolContent');
      if (!poolContent) return;

      const items = data.items || [];
      const totalPages = Math.ceil((data.totalCount || 0) / noCustomerState.pagination.pageSize);

      poolContent.innerHTML = `
        <!-- İstatistikler -->
        <div class="no-customer-stats">
          <div class="no-customer-stat-card">
            <div class="no-customer-stat-value">${data.totalUnmatched || 0}</div>
            <div class="no-customer-stat-label">Toplam Müşterisiz</div>
          </div>
          <div class="no-customer-stat-card">
            <div class="no-customer-stat-value">${data.thisMonthUnmatched || 0}</div>
            <div class="no-customer-stat-label">Bu Ay Eklenen</div>
          </div>
          <div class="no-customer-stat-card">
            <div class="no-customer-stat-value">%${data.matchPercentage || 0}</div>
            <div class="no-customer-stat-label">Eşleşme Oranı</div>
          </div>
        </div>

        <!-- Toplu İşlem Barı -->
        <div class="no-customer-batch-bar" id="noCustomerBatchBar">
          <span><strong id="noCustomerSelectedCount">0</strong> poliçe seçildi</span>
          <button class="btn btn-sm btn-primary" onclick="batchAssignTcFromPool()">Toplu TC Ata</button>
          <button class="btn btn-sm btn-secondary" onclick="clearNoCustomerSelection()">Seçimi Temizle</button>
        </div>

        <!-- Arama -->
        <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem; align-items: center;">
          <input type="text" class="form-control" id="noCustomerSearch" placeholder="Poliçe no, sigortalı adı veya plaka ara..."
            value="${noCustomerState.filters.search || ''}"
            style="max-width: 350px; font-size: 0.85rem;"
            onkeydown="if(event.key==='Enter') applyNoCustomerSearch()">
          <button class="btn btn-sm btn-secondary" onclick="applyNoCustomerSearch()">Ara</button>
          ${noCustomerState.filters.search ? '<button class="btn btn-sm btn-ghost" onclick="clearNoCustomerSearch()">Temizle</button>' : ''}
        </div>

        <!-- Tablo -->
        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div class="table-container" style="overflow-x: auto;">
              <table class="data-table" style="min-width: 1200px;">
                <thead>
                  <tr>
                    <th style="width: 40px;"><input type="checkbox" id="noCustomerSelectAll" onchange="toggleNoCustomerSelectAll(this.checked)"></th>
                    <th style="min-width: 130px;">Poliçe No</th>
                    <th style="min-width: 150px;">Sigortalı Adı</th>
                    <th style="min-width: 120px;">TC / VKN</th>
                    <th style="min-width: 90px;">Plaka</th>
                    <th class="text-right" style="min-width: 100px;">Brüt Prim</th>
                    <th style="min-width: 90px;">Başlangıç</th>
                    <th style="min-width: 90px;">Bitiş</th>
                    <th style="min-width: 120px;">Sigorta Şirketi</th>
                    <th style="min-width: 90px;">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.length === 0 ? `
                    <tr>
                      <td colspan="10" class="text-center text-muted" style="padding: 3rem;">
                        Müşterisi bulunmayan poliçe bulunamadı
                      </td>
                    </tr>
                  ` : items.map(p => `
                    <tr>
                      <td><input type="checkbox" class="nc-row-cb" data-id="${p.id}" ${noCustomerState.selectedIds.has(p.id) ? 'checked' : ''} onchange="toggleNoCustomerSelect(${p.id}, this.checked)"></td>
                      <td><span class="font-mono" style="font-weight: 600;">${escHtml(p.policeNumarasi)}</span></td>
                      <td>${escHtml(p.sigortaliAdi || '-')}</td>
                      <td>
                        ${p.tcKimlikNo ? `<span class="badge badge-success" style="font-size:0.72rem;">TC: ${escHtml(p.tcKimlikNo)}</span>` : ''}
                        ${p.vergiNo ? `<span class="badge badge-info" style="font-size:0.72rem;">VKN: ${escHtml(p.vergiNo)}</span>` : ''}
                        ${!p.tcKimlikNo && !p.vergiNo ? '<span class="text-muted">-</span>' : ''}
                      </td>
                      <td>${escHtml(p.plaka || '-')}</td>
                      <td class="text-right"><span class="font-mono">${(p.brutPrim || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL</span></td>
                      <td><span class="text-sm">${p.baslangicTarihi ? new Date(p.baslangicTarihi).toLocaleDateString('tr-TR') : '-'}</span></td>
                      <td><span class="text-sm">${p.bitisTarihi ? new Date(p.bitisTarihi).toLocaleDateString('tr-TR') : '-'}</span></td>
                      <td>${escHtml(p.sigortaSirketiAdi || '-')}</td>
                      <td>
                        <button class="btn btn-sm btn-primary" onclick="openTcAssignModal(${p.id})" title="Müşteri Eşleştir">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                            <circle cx="8.5" cy="7" r="4"/>
                            <line x1="20" y1="8" x2="20" y2="14"/>
                            <line x1="17" y1="11" x2="23" y2="11"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Sayfalama -->
        ${totalPages > 1 ? `
          <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1rem;">
            <button class="btn btn-sm btn-ghost" ${noCustomerState.pagination.currentPage <= 1 ? 'disabled' : ''} onclick="goToNoCustomerPage(${noCustomerState.pagination.currentPage - 1})">Önceki</button>
            <span class="text-sm text-muted">Sayfa ${noCustomerState.pagination.currentPage} / ${totalPages} (${data.totalCount} kayıt)</span>
            <button class="btn btn-sm btn-ghost" ${noCustomerState.pagination.currentPage >= totalPages ? 'disabled' : ''} onclick="goToNoCustomerPage(${noCustomerState.pagination.currentPage + 1})">Sonraki</button>
          </div>
        ` : ''}
      `;
    }

    // Sayfalama
    function goToNoCustomerPage(page) {
      noCustomerState.pagination.currentPage = page;
      loadNoCustomerPolicies();
    }

    // Arama
    function applyNoCustomerSearch() {
      const search = document.getElementById('noCustomerSearch')?.value?.trim() || '';
      noCustomerState.filters.search = search;
      loadNoCustomerPolicies(true);
    }

    function clearNoCustomerSearch() {
      noCustomerState.filters.search = '';
      loadNoCustomerPolicies(true);
    }

    // Seçim yönetimi
    function toggleNoCustomerSelect(id, checked) {
      if (checked) noCustomerState.selectedIds.add(id);
      else noCustomerState.selectedIds.delete(id);
      updateNoCustomerBatchBar();
    }

    function toggleNoCustomerSelectAll(checked) {
      const items = noCustomerState.data?.items || [];
      items.forEach(p => {
        if (checked) noCustomerState.selectedIds.add(p.id);
        else noCustomerState.selectedIds.delete(p.id);
      });
      // Checkbox'ları güncelle
      document.querySelectorAll('.nc-row-cb').forEach(cb => { cb.checked = checked; });
      updateNoCustomerBatchBar();
    }

    function clearNoCustomerSelection() {
      noCustomerState.selectedIds.clear();
      document.querySelectorAll('.nc-row-cb').forEach(cb => { cb.checked = false; });
      const selectAll = document.getElementById('noCustomerSelectAll');
      if (selectAll) selectAll.checked = false;
      updateNoCustomerBatchBar();
    }

    function updateNoCustomerBatchBar() {
      const bar = document.getElementById('noCustomerBatchBar');
      const countEl = document.getElementById('noCustomerSelectedCount');
      if (!bar) return;
      if (noCustomerState.selectedIds.size > 0) {
        bar.classList.add('active');
        if (countEl) countEl.textContent = noCustomerState.selectedIds.size;
      } else {
        bar.classList.remove('active');
      }
    }

    // TC Atama Modal
    function openTcAssignModal(policyId) {
      noCustomerState.currentAssignPolicyId = policyId;
      const policy = (noCustomerState.data?.items || []).find(p => p.id === policyId);

      const modal = document.getElementById('tcAssignModal');
      if (!modal) return;

      document.getElementById('tcAssignInput').value = policy?.tcKimlikNo || '';
      document.getElementById('vknAssignInput').value = policy?.vergiNo || '';
      document.getElementById('tcCandidatesList').innerHTML = '';
      document.getElementById('tcModalPolicyInfo').textContent =
        `${policy?.policeNumarasi || ''} - ${policy?.sigortaliAdi || 'Bilinmiyor'}`;

      modal.classList.add('active');
    }

    function closeTcAssignModal() {
      const modal = document.getElementById('tcAssignModal');
      if (modal) modal.classList.remove('active');
      noCustomerState.currentAssignPolicyId = null;
    }

    // Aday müşteri arama
    async function searchTcCandidates() {
      const tc = document.getElementById('tcAssignInput')?.value?.trim();
      const vkn = document.getElementById('vknAssignInput')?.value?.trim();
      const policy = (noCustomerState.data?.items || []).find(p => p.id === noCustomerState.currentAssignPolicyId);

      const params = {};
      if (tc) params.tc = tc;
      if (vkn) params.vkn = vkn;
      if (policy?.sigortaliAdi) params.name = policy.sigortaliAdi;
      if (policy?.plaka) params.plaka = policy.plaka;

      try {
        const res = await apiGet('customers/candidates', params);
        renderTcCandidates(res.candidates || []);
      } catch (e) {
        showToast('Aday arama hatası', 'error');
      }
    }

    function renderTcCandidates(candidates) {
      const container = document.getElementById('tcCandidatesList');
      if (!container) return;

      if (candidates.length === 0) {
        container.innerHTML = '<div class="text-muted" style="padding: 1rem; text-align: center;">Aday müşteri bulunamadı</div>';
        return;
      }

      const signalLabels = { TcKimlikNo: 'TC', VergiNo: 'VKN', Plaka: 'Plaka', Name: 'İsim' };
      container.innerHTML = candidates.map(c => {
        const confClass = c.confidence === 'Exact' ? 'success' : c.confidence === 'Medium' ? 'warning' : 'default';
        return `
          <div class="tc-candidate-card" onclick="assignToCustomerFromPool(${c.id})">
            <div>
              <div class="tc-candidate-name">${escHtml(c.adi || '')} ${escHtml(c.soyadi || '')}</div>
              <div class="tc-candidate-details">
                ${c.tcKimlikNo ? `<span>TC: ${escHtml(c.tcKimlikNo)}</span>` : ''}
                ${c.vergiNo ? `<span>VKN: ${escHtml(c.vergiNo)}</span>` : ''}
                ${c.gsm ? `<span>GSM: ${escHtml(c.gsm)}</span>` : ''}
                <span>${c.policyCount || 0} poliçe</span>
              </div>
            </div>
            <div class="tc-candidate-badges">
              <span class="badge badge-${confClass}">${signalLabels[c.matchSignal] || c.matchSignal}</span>
              <span class="badge badge-${confClass}">${c.confidence}</span>
            </div>
          </div>`;
      }).join('');
    }

    // TC/VKN ata
    async function submitTcAssign() {
      const policyId = noCustomerState.currentAssignPolicyId;
      if (!policyId) return;

      const tc = document.getElementById('tcAssignInput')?.value?.trim();
      const vkn = document.getElementById('vknAssignInput')?.value?.trim();

      if (!tc && !vkn) {
        showToast('TC Kimlik No veya Vergi No giriniz', 'warning');
        return;
      }

      try {
        const res = await apiPost(`policies/${policyId}/assign-tc`, {
          tcKimlikNo: tc || null,
          vergiNo: vkn || null
        });

        if (res.success) {
          let msg = 'TC/VKN başarıyla atandı';
          if (res.autoCreated) msg += ' (yeni müşteri oluşturuldu)';
          if (res.cascadeUpdated > 0) msg += `, ${res.cascadeUpdated} ek poliçe güncellendi`;
          showToast(msg, 'success');
          closeTcAssignModal();
          await loadNoCustomerPolicies();
          await loadTabCounts();
        } else {
          showToast(res.errorMessage || 'Atama hatası', 'error');
        }
      } catch (e) {
        showToast('Atama sırasında hata oluştu', 'error');
      }
    }

    // Mevcut müşteriye ata (aday kartına tıklama)
    async function assignToCustomerFromPool(musteriId) {
      const policyId = noCustomerState.currentAssignPolicyId;
      if (!policyId) return;

      try {
        await apiPut('policies/batch-update', {
          updates: [{ id: policyId, musteriId: musteriId }]
        });
        showToast('Müşteri başarıyla eşleşti', 'success');
        closeTcAssignModal();
        await loadNoCustomerPolicies();
        await loadTabCounts();
      } catch (e) {
        showToast('Eşleştirme hatası', 'error');
      }
    }

    // Toplu TC atama
    async function batchAssignTcFromPool() {
      if (noCustomerState.selectedIds.size === 0) return;

      const tc = prompt('Toplu atanacak TC Kimlik No (11 hane):');
      if (!tc || tc.trim().length !== 11) {
        if (tc !== null) showToast('Geçerli bir TC Kimlik No giriniz (11 hane)', 'warning');
        return;
      }

      try {
        const items = Array.from(noCustomerState.selectedIds).map(id => ({
          policyId: id,
          tcKimlikNo: tc.trim()
        }));

        const res = await apiPost('policies/batch-assign-tc', { items });
        showToast(
          `${res.successCount} başarılı, ${res.failedCount} başarısız${res.totalCascadeUpdated > 0 ? `, ${res.totalCascadeUpdated} kaskad güncelleme` : ''}`,
          res.failedCount === 0 ? 'success' : 'warning'
        );

        noCustomerState.selectedIds.clear();
        await loadNoCustomerPolicies(true);
        await loadTabCounts();
      } catch (e) {
        showToast('Toplu atama hatası', 'error');
      }
    }

    // HTML escape helper
    function escHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // Yakalanan poliçeyi direkt kaydet (havuzu bypass et)
    async function sendCapturedToPool(capturedId) {
      if (!confirm('Bu poliçeyi Poliçelerime kaydetmek istediğinize emin misiniz?')) {
        return;
      }

      try {
        // Direkt approval endpoint'ini çağır (havuzu bypass et)
        const result = await apiPost(`policies/captured/${capturedId}/approve`);

        if (result.success) {
          showToast('Poliçe başarıyla kaydedildi', 'success');
          await loadUnmatchedCaptured(true);
          await loadTabCounts();
        } else {
          showToast(result.errorMessage || 'Kaydetme başarısız', 'error');
        }
      } catch (error) {
        console.error('sendCapturedToPool error:', error);
        showToast('Bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'), 'error');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // EŞLEŞMEYENLERİ DÜZENLEME MODAL FONKSİYONLARI
    // ═══════════════════════════════════════════════════════════════

    let currentEditingUnmatchedId = null;
    let unmatchedProduktorler = [];
    let unmatchedSubeler = [];

    // Modal'ı aç ve verileri doldur
    async function openEditUnmatchedModal(id) {
      currentEditingUnmatchedId = id;

      // Eşleşmeyen poliçeyi bul
      const item = unmatchedCapturedState.data?.items?.find(p => p.id === id);
      if (!item) {
        showToast('Poliçe bulunamadı', 'error');
        return;
      }

      // Form alanlarını doldur
      document.getElementById('editUnmatchedId').value = item.id;
      document.getElementById('editUnmatchedPoliceNo').value = item.policeNo || '';
      document.getElementById('editUnmatchedSigortali').value = item.sigortaliAdi || '';
      document.getElementById('editUnmatchedBrans').value = item.brans || '';
      document.getElementById('editUnmatchedSirket').value = item.sigortaSirketi || '';
      document.getElementById('editUnmatchedNetPrim').value = `${(item.netPrim || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`;
      document.getElementById('editUnmatchedBrutPrim').value = `${(item.brutPrim || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`;
      document.getElementById('editUnmatchedTanzim').value = new Date(item.tanzimTarihi).toLocaleDateString('tr-TR');
      document.getElementById('editUnmatchedBaslangic').value = new Date(item.baslangicTarihi).toLocaleDateString('tr-TR');
      document.getElementById('editUnmatchedBitis').value = new Date(item.bitisTarihi).toLocaleDateString('tr-TR');
      document.getElementById('editUnmatchedEklenme').value = new Date(item.eklenmeTarihi).toLocaleDateString('tr-TR');

      // Prodüktör ve Şube dropdown'larını doldur
      await loadUnmatchedProduktorSube();

      // Mevcut değerleri seç
      document.getElementById('editUnmatchedProduktor').value = item.produktorId || '';
      document.getElementById('editUnmatchedSube').value = item.subeId || '';

      // Modal'ı aç
      document.getElementById('editUnmatchedModal').classList.add('active');
    }

    // Prodüktör ve Şube listelerini yükle
    async function loadUnmatchedProduktorSube() {
      try {
        // Prodüktör listesi
        const produktorData = await apiGet('users', { role: 'produktor' });
        unmatchedProduktorler = produktorData.items || produktorData || [];

        const produktorSelect = document.getElementById('editUnmatchedProduktor');
        produktorSelect.innerHTML = '<option value="">Prodüktör Seçin</option>' +
          unmatchedProduktorler.map(p =>
            `<option value="${p.id}">${p.adSoyad || p.name}</option>`
          ).join('');

        // Şube listesi
        const subeData = await apiGet('branches');
        unmatchedSubeler = subeData.items || subeData || [];

        const subeSelect = document.getElementById('editUnmatchedSube');
        subeSelect.innerHTML = '<option value="">Şube Seçin</option>' +
          unmatchedSubeler.map(s =>
            `<option value="${s.id}">${s.subeAdi || s.name}</option>`
          ).join('');
      } catch (error) {
        console.error('Prodüktör/Şube yüklenemedi:', error);
        showToast('Prodüktör ve Şube listesi yüklenemedi', 'error');
      }
    }

    // Modal'ı kapat
    function closeEditUnmatchedModal() {
      document.getElementById('editUnmatchedModal').classList.remove('active');
      currentEditingUnmatchedId = null;
    }

    // Düzenlenen poliçeyi kaydet
    async function saveEditedUnmatched(event) {
      event.preventDefault();

      const id = currentEditingUnmatchedId;
      if (!id) return;

      const produktorId = parseInt(document.getElementById('editUnmatchedProduktor').value);
      const subeId = parseInt(document.getElementById('editUnmatchedSube').value);

      if (!produktorId || !subeId) {
        showToast('Lütfen Prodüktör ve Şube seçin', 'warning');
        return;
      }

      showLoading(true);

      try {
        // Backend'e güncelleme isteği gönder
        const result = await apiPut(`policies/captured/${id}`, {
          produktorId: produktorId,
          subeId: subeId
        });

        if (result.success) {
          showToast('Poliçe başarıyla güncellendi', 'success');
          closeEditUnmatchedModal();
          await loadUnmatchedCaptured(true);
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

    // Poliçe detayı göster
    function showPoolPolicyDetail(id) {
      // Modal veya side panel gösterebiliriz
      showToast('Detay sayfası yakında...', 'info');
    }

    // Tab sayılarını yükle
    async function loadTabCounts() {
      try {
        // Bekleyen İşlemler sayısı (AKTARIMDA + FARK_VAR)
        const pendingData = await apiGet('policies/pool', { status: 'unmatched,difference', pageSize: 1 });
        const pendingCount = (pendingData?.unmatchedCount || 0) + (pendingData?.differenceCount || 0);
        document.getElementById('pendingTabCount').textContent = pendingCount;

        // Eşleşen Poliçeler sayısı (ESLESTI)
        const matchedData = await apiGet('policies/pool', { status: 'matched', pageSize: 1 });
        document.getElementById('matchedTabCount').textContent = matchedData?.matchedCount || 0;

        // Eşleşmeyenler sayısı (Yakalanan ama havuzda olmayan)
        const unmatchedCapturedData = await apiGet('policies/captured/not-in-pool', { pageSize: 1 });
        document.getElementById('unmatchedCapturedTabCount').textContent = unmatchedCapturedData?.totalCount || 0;

        // Müşterisi Bulunmayanlar sayısı (MusteriId=NULL onaylı poliçeler)
        const noCustomerData = await apiGet('policies/unmatched', { page: 1, pageSize: 1 });
        document.getElementById('noCustomerTabCount').textContent = noCustomerData?.totalUnmatched || 0;
      } catch (error) {
        console.error('Tab sayıları yüklenemedi:', error);
      }
    }

    // Pool verilerini yenile
    async function refreshPoolData() {
      showLoading(true);
      try {
        // Mevcut sekmeye göre doğru veriyi yükle
        if (currentMainTab === 'no-customer') {
          await Promise.all([
            loadNoCustomerPolicies(true),
            loadTabCounts()
          ]);
        } else if (currentMainTab === 'unmatched-captured') {
          await Promise.all([
            loadUnmatchedCaptured(true),
            loadTabCounts()
          ]);
        } else {
          await Promise.all([
            loadPoolData(true),
            loadTabCounts()
          ]);
        }
        showToast('Veriler yenilendi', 'success');
      } catch (error) {
        console.error('Yenileme hatası:', error);
        showToast('Veriler yenilenirken hata oluştu', 'error');
      } finally {
        showLoading(false);
      }
    }

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

      let result = [...filteredPolicies];

      if (searchTerm) {
        result = result.filter(p =>
          p.policyNo.toLowerCase().includes(searchTerm) ||
          p.customer.toLowerCase().includes(searchTerm) ||
          p.type.toLowerCase().includes(searchTerm) ||
          p.producer.toLowerCase().includes(searchTerm) ||
          p.branch.toLowerCase().includes(searchTerm) ||
          p.dateFormatted.toLowerCase().includes(searchTerm) ||
          p.netPremium.toString().includes(searchTerm) ||
          p.grossPremium.toString().includes(searchTerm)
        );
      }

      if (producerFilter) {
        result = result.filter(p => p.producer === producerFilter);
      }

      if (branchFilter) {
        result = result.filter(p => p.branch === branchFilter);
      }

      // Sort
      if (currentSort.field && currentSort.direction) {
        console.log('Sorting by:', currentSort.field, currentSort.direction);
        console.log('Before sort (first 3):', result.slice(0, 3).map(p => ({ [currentSort.field]: p[currentSort.field] })));

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
            const aNum = Number(aVal);
            const bNum = Number(bVal);

            // NaN kontrolü
            if (isNaN(aNum) && isNaN(bNum)) return 0;
            if (isNaN(aNum)) return 1;
            if (isNaN(bNum)) return -1;

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
          // STRING SÜTUNLAR (policyNo, customer, producer, type, branch)
          else {
            const aStr = String(aVal || '').toLocaleLowerCase('tr');
            const bStr = String(bVal || '').toLocaleLowerCase('tr');
            comparison = aStr.localeCompare(bStr, 'tr', { sensitivity: 'base', numeric: true });
          }

          return currentSort.direction === 'asc' ? comparison : -comparison;
        });

        console.log('After sort (first 3):', result.slice(0, 3).map(p => ({ [currentSort.field]: p[currentSort.field] })));
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
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
      }

      // Reset to first page when sorting
      currentPage = 1;

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

      // Önce tbody'yi temizle
      tbody.innerHTML = '';

      // HTML içeriğini oluştur
      const rowsHtml = paginatedData.map(p => {
        return `
        <tr class="${selectedPolicies.has(p.id) ? 'selected' : ''}" data-id="${p.id}" onclick="handleRowClick(event, ${p.id})">
          <td>
            <input type="checkbox" ${selectedPolicies.has(p.id) ? 'checked' : ''}>
          </td>
          <td>
            <span class="clickable-link font-mono" style="font-weight: 600;" onclick="event.stopPropagation(); openPolicyDrive('${p.policyNo}')" title="Google Drive'da aç">
              ${p.policyNo}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15,3 21,3 21,9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </span>
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
            </div>
          </td>
        </tr>
      `}).join('');

      // HTML'i ata ve doğrula
      tbody.innerHTML = rowsHtml;

      // DOM doğrulama - ilk satırın ID'sini kontrol et
      const firstRow = tbody.querySelector('tr[data-id]');
      const lastRow = tbody.querySelector('tr:last-child');
      console.log('🟢 DOM FIRST ROW data-id:', firstRow?.dataset.id);
      console.log('🟢 DOM LAST ROW data-id:', lastRow?.dataset.id);
      console.log('🟢 Expected first id:', paginatedData[0]?.id, 'Expected last id:', paginatedData[paginatedData.length - 1]?.id);

      // Update table info text
      document.getElementById('tableInfo').textContent = `${startIndex + 1}-${endIndex} / ${data.length} poliçe`;

      // Update pagination controls
      updatePaginationControls(currentPage, totalPages, data.length);
    }

    // Update stats - KPI cards removed, function kept for compatibility
    function updateStats(data = policies) {
      // No-op: KPI stat elements (statPending, statPremium, statProducers) were removed during refactor
      // Tab counts are now managed by loadTabCounts() function
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
      if (policy) {
        // TODO: Modal açarak poliçe detaylarını göster veya detay sayfasına yönlendir
        // window.location.href = `/policies/${id}`;
        alert(`Poliçe Detayı:\n\nPoliçe No: ${policy.policyNo}\nMüşteri: ${policy.customer}\nTip: ${policy.type}\nNet Prim: ${policy.netPremium.toLocaleString('tr-TR')} TL\nBrüt Prim: ${policy.grossPremium.toLocaleString('tr-TR')} TL\nProdüktör: ${policy.producer}\nŞube: ${policy.branch}\nTarih: ${policy.dateFormatted}`);
      }
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

    function openPolicyDrive(policyNo) {
      // Google Drive link formatı - gerçek uygulamada API'den gelecek
      // Örnek: https://drive.google.com/drive/folders/FOLDER_ID
      const driveBaseUrl = 'https://drive.google.com/drive/search?q=';
      const searchQuery = encodeURIComponent(policyNo);
      const driveUrl = driveBaseUrl + searchQuery;

      // Yeni sekmede aç
      window.open(driveUrl, '_blank');
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
