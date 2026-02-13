    // ═══════════════════════════════════════════════════════════════
    // CUSTOMER LIST PAGE - JAVASCRIPT
    // ═══════════════════════════════════════════════════════════════

    // State
    let allCustomers = [];
    let filteredCustomers = [];
    let currentPage = 1;
    let pageSize = 10;
    let editingCustomerId = null;
    let currentSort = { field: null, dir: null };
    let selectedType = '';

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    document.addEventListener('DOMContentLoaded', async function() {
      // Check authentication
      if (!APP_CONFIG.AUTH.getUser()) {
        APP_CONFIG.AUTH.redirectToLogin();
        return;
      }

      // Check permission
      requirePermission('musterileriGorebilsin');

      // Load data
      await Promise.all([
        loadCustomers(),
        loadStats()
      ]);

      // Setup event listeners
      setupEventListeners();
      setupDropdowns();
    });

    // ═══════════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════════

    async function loadCustomers() {
      try {
        const customers = await apiGet('customers', { limit: 1000 });
        allCustomers = customers;
        filteredCustomers = [...customers];
        renderCustomers();
      } catch (error) {
        console.error('Musteriler yuklenirken hata:', error);
        showToast('Musteriler yuklenirken hata olustu', 'error');
      }
    }

    async function loadStats() {
      try {
        const stats = await apiGet('customers/stats');
        updateStats(stats);
      } catch (error) {
        console.error('Istatistikler yuklenirken hata:', error);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDERING
    // ═══════════════════════════════════════════════════════════════

    function renderCustomers() {
      const tbody = document.querySelector('#customersTable tbody');
      if (!tbody) return;

      // Calculate pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pageCustomers = filteredCustomers.slice(startIndex, endIndex);

      if (pageCustomers.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7">
              <div class="empty-state">
                <div class="empty-state-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <line x1="17" y1="11" x2="23" y2="11"/>
                  </svg>
                </div>
                <div class="empty-state-title">Musteri bulunamadi</div>
                <div class="empty-state-text">Arama kriterlerinize uygun musteri yok</div>
              </div>
            </td>
          </tr>
        `;
        renderPagination();
        return;
      }

      tbody.innerHTML = pageCustomers.map(customer => {
        const isKurumsal = !!customer.vergiNo && !customer.tcKimlikNo;
        const displayName = isKurumsal
          ? customer.adi
          : `${customer.adi || ''} ${customer.soyadi || ''}`.trim();
        const initials = getInitials(displayName);
        const avatarColor = getAvatarColor(customer.id);
        const tcVkn = customer.tcKimlikNo || customer.vergiNo || '-';
        const registerDate = customer.eklenmeZamani
          ? new Date(customer.eklenmeZamani).toLocaleDateString('tr-TR')
          : '-';
        const toplamPrim = customer.toplamPrim || 0;
        const primFormatted = formatCurrency(toplamPrim);
        const policeSayisi = customer.policeSayisi || 0;

        return `
          <tr data-id="${customer.id}">
            <td>
              <div class="flex items-center gap-3">
                <div class="avatar avatar-sm ${avatarColor}">${initials}</div>
                <div>
                  <div class="cell-main">${escapeHtml(displayName || 'Isimsiz')}</div>
                  <div class="cell-sub">Kayit: ${registerDate}</div>
                </div>
              </div>
            </td>
            <td><span class="font-mono" style="font-size: 0.8125rem; letter-spacing: 0.02em;">${escapeHtml(tcVkn)}</span></td>
            <td>
              <div class="cell-main">${escapeHtml(customer.gsm || '-')}</div>
              <div class="cell-sub">${escapeHtml(customer.email || '-')}</div>
            </td>
            <td><span class="badge ${isKurumsal ? 'badge-neutral' : 'badge-info'}">${isKurumsal ? 'Kurumsal' : 'Bireysel'}</span></td>
            <td><span class="police-count-badge ${policeSayisi > 0 ? 'has-policy' : 'no-policy'}">${policeSayisi}</span></td>
            <td><span class="font-mono customer-prim ${toplamPrim === 0 ? 'zero' : ''}">${primFormatted}</span></td>
            <td>
              <div class="table-actions">
                <a href="detail.html?id=${customer.id}" class="btn btn-icon btn-ghost" title="Detay">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </a>
                <button class="btn btn-icon btn-ghost" title="Duzenle" onclick="editCustomer(${customer.id})">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn btn-icon btn-ghost btn-danger-hover" title="Sil" onclick="deleteCustomer(${customer.id})">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      renderPagination();
    }

    function renderPagination() {
      const paginationInfo = document.getElementById('paginationInfo');
      const paginationPages = document.getElementById('paginationPages');

      const totalCount = filteredCustomers.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIndex = (currentPage - 1) * pageSize + 1;
      const endIndex = Math.min(currentPage * pageSize, totalCount);

      if (paginationInfo) {
        paginationInfo.textContent = totalCount > 0
          ? `Toplam ${totalCount.toLocaleString('tr-TR')} kayittan ${startIndex}-${endIndex} arasi`
          : 'Kayit bulunamadi';
      }

      if (paginationPages) {
        let pagesHtml = `
          <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})" title="Onceki">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
          </button>
        `;

        const pages = getPageNumbers(currentPage, totalPages);
        pages.forEach(page => {
          if (page === '...') {
            pagesHtml += `<button class="pagination-btn" disabled>...</button>`;
          } else {
            pagesHtml += `<button class="pagination-btn ${page === currentPage ? 'active' : ''}" onclick="goToPage(${page})">${page}</button>`;
          }
        });

        pagesHtml += `
          <button class="pagination-btn" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})" title="Sonraki">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
          </button>
        `;

        paginationPages.innerHTML = pagesHtml;
      }
    }

    function getPageNumbers(current, total) {
      if (total <= 7) {
        return Array.from({length: total}, (_, i) => i + 1);
      }
      if (current <= 3) {
        return [1, 2, 3, 4, '...', total];
      }
      if (current >= total - 2) {
        return [1, '...', total - 3, total - 2, total - 1, total];
      }
      return [1, '...', current - 1, current, current + 1, '...', total];
    }

    function goToPage(page) {
      const totalPages = Math.ceil(filteredCustomers.length / pageSize);
      if (page < 1 || page > totalPages) return;
      currentPage = page;
      renderCustomers();
      // Scroll to table top
      document.getElementById('customersTable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function updateStats(stats) {
      const el = (id, val) => {
        const e = document.getElementById(id);
        if (e) e.textContent = (val || 0).toLocaleString('tr-TR');
      };
      el('statTotal', stats.toplamMusteriSayisi);
      el('statBireysel', stats.bireyselMusteriSayisi);
      el('statKurumsal', stats.kurumsalMusteriSayisi);
      el('statNewMonth', stats.buAyYeniMusteriSayisi);
    }

    // ═══════════════════════════════════════════════════════════════
    // SORTING
    // ═══════════════════════════════════════════════════════════════

    function handleSort(field) {
      // Toggle direction
      if (currentSort.field === field) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : (currentSort.dir === 'desc' ? null : 'asc');
        if (!currentSort.dir) currentSort.field = null;
      } else {
        currentSort.field = field;
        currentSort.dir = 'asc';
      }

      // Update header classes
      document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.sort === currentSort.field && currentSort.dir) {
          th.classList.add(currentSort.dir);
        }
      });

      // Sort
      if (currentSort.field && currentSort.dir) {
        const dir = currentSort.dir === 'asc' ? 1 : -1;
        filteredCustomers.sort((a, b) => {
          let va, vb;
          switch (currentSort.field) {
            case 'name':
              va = `${a.adi || ''} ${a.soyadi || ''}`.trim().toLowerCase();
              vb = `${b.adi || ''} ${b.soyadi || ''}`.trim().toLowerCase();
              return va.localeCompare(vb, 'tr') * dir;
            case 'police':
              return ((a.policeSayisi || 0) - (b.policeSayisi || 0)) * dir;
            case 'prim':
              return ((a.toplamPrim || 0) - (b.toplamPrim || 0)) * dir;
            default:
              return 0;
          }
        });
      } else {
        // Reset to original order (by eklenmeZamani desc)
        filteredCustomers.sort((a, b) => {
          const da = new Date(a.eklenmeZamani || 0);
          const db = new Date(b.eklenmeZamani || 0);
          return db - da;
        });
      }

      currentPage = 1;
      renderCustomers();
    }

    // ═══════════════════════════════════════════════════════════════
    // CUSTOM DROPDOWNS
    // ═══════════════════════════════════════════════════════════════

    function setupDropdowns() {
      // Type dropdown
      const typeDropdown = document.getElementById('typeDropdown');
      const typeToggle = document.getElementById('typeDropdownToggle');

      if (typeToggle) {
        typeToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          typeDropdown.classList.toggle('open');
        });
      }

      // Dropdown items
      typeDropdown?.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          const value = item.dataset.value;
          selectedType = value;

          // Update selected state
          typeDropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');

          // Update toggle text
          typeToggle.textContent = item.textContent;

          // Close dropdown
          typeDropdown.classList.remove('open');

          // Apply filters
          applyFilters();
        });
      });

      // Close dropdowns on outside click
      document.addEventListener('click', () => {
        document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // FILTERING & SEARCH
    // ═══════════════════════════════════════════════════════════════

    function setupEventListeners() {
      // Filter inputs with debounce
      const filterName = document.getElementById('filterName');
      const filterTcVkn = document.getElementById('filterTcVkn');

      if (filterName) filterName.addEventListener('input', debounce(applyFilters, 300));
      if (filterTcVkn) filterTcVkn.addEventListener('input', debounce(applyFilters, 300));

      // Clear filter button
      const clearBtn = document.getElementById('clearFiltersBtn');
      if (clearBtn) clearBtn.addEventListener('click', clearFilters);

      // Page size selector
      const pageSizeSelect = document.getElementById('pageSizeSelect');
      if (pageSizeSelect) {
        pageSizeSelect.value = pageSize;
        pageSizeSelect.addEventListener('change', (e) => {
          pageSize = parseInt(e.target.value);
          currentPage = 1;
          renderCustomers();
        });
      }
    }

    function trLower(s) {
      return (s || '').toLocaleLowerCase('tr-TR');
    }

    function applyFilters() {
      const name = trLower(document.getElementById('filterName')?.value).trim();
      const tcVkn = trLower(document.getElementById('filterTcVkn')?.value).trim();

      filteredCustomers = allCustomers.filter(customer => {
        // Type filter
        const customerIsKurumsal = !!customer.vergiNo && !customer.tcKimlikNo;
        if (selectedType === 'bireysel' && customerIsKurumsal) return false;
        if (selectedType === 'kurumsal' && !customerIsKurumsal) return false;

        // TC/VKN filter
        if (tcVkn) {
          const customerTcVkn = trLower(customer.tcKimlikNo || customer.vergiNo);
          if (!customerTcVkn.includes(tcVkn)) return false;
        }

        // Name filter
        if (name) {
          const displayName = trLower(`${customer.adi || ''} ${customer.soyadi || ''}`);
          if (!displayName.includes(name)) return false;
        }

        return true;
      });

      currentPage = 1;
      renderCustomers();
    }

    function clearFilters() {
      const filterName = document.getElementById('filterName');
      const filterTcVkn = document.getElementById('filterTcVkn');
      const typeDropdown = document.getElementById('typeDropdown');
      const typeToggle = document.getElementById('typeDropdownToggle');

      if (filterName) filterName.value = '';
      if (filterTcVkn) filterTcVkn.value = '';

      // Reset dropdown
      selectedType = '';
      if (typeToggle) typeToggle.textContent = 'Tum Tipler';
      typeDropdown?.querySelectorAll('.dropdown-item').forEach((item, i) => {
        item.classList.toggle('selected', i === 0);
      });

      filteredCustomers = [...allCustomers];
      currentPage = 1;
      renderCustomers();
    }

    function searchCustomers(event) {
      const searchTerm = trLower(event.target.value).trim();

      if (!searchTerm) {
        filteredCustomers = [...allCustomers];
      } else {
        filteredCustomers = allCustomers.filter(customer => {
          const displayName = trLower(`${customer.adi || ''} ${customer.soyadi || ''}`);
          const tcVkn = trLower(customer.tcKimlikNo || customer.vergiNo);
          const phone = trLower(customer.gsm);

          return displayName.includes(searchTerm) ||
                 tcVkn.includes(searchTerm) ||
                 phone.includes(searchTerm);
        });
      }

      currentPage = 1;
      renderCustomers();
    }

    // ═══════════════════════════════════════════════════════════════
    // CRUD OPERATIONS
    // ═══════════════════════════════════════════════════════════════

    function openAddModal() {
      editingCustomerId = null;
      document.getElementById('modalTitle').textContent = 'Yeni Musteri Ekle';
      document.getElementById('customerForm').reset();
      document.getElementById('customerId').value = '';
      toggleBireyselFields();
      document.getElementById('addCustomerModal').classList.add('active');
    }

    function closeCustomerModal() {
      document.getElementById('addCustomerModal').classList.remove('active');
      editingCustomerId = null;
    }

    function toggleBireyselFields() {
      const isBireysel = document.getElementById('customerType').value === '1';
      document.querySelectorAll('.bireysel-field').forEach(el => {
        el.style.display = isBireysel ? '' : 'none';
      });
    }

    async function editCustomer(id) {
      try {
        const customer = await apiGet(`customers/${id}`);
        if (!customer) {
          showToast('Musteri bulunamadi', 'error');
          return;
        }

        editingCustomerId = id;
        document.getElementById('modalTitle').textContent = 'Musteri Duzenle';
        document.getElementById('customerId').value = id;
        const editIsKurumsal = !!customer.vergiNo && !customer.tcKimlikNo;
        document.getElementById('customerType').value = editIsKurumsal ? 2 : 1;
        document.getElementById('tcVkn').value = customer.tcKimlikNo || customer.vergiNo || '';
        document.getElementById('customerName').value = editIsKurumsal
          ? customer.adi || ''
          : `${customer.adi || ''} ${customer.soyadi || ''}`.trim();
        document.getElementById('phone').value = customer.gsm || '';
        document.getElementById('email').value = customer.email || '';
        document.getElementById('gsm2').value = customer.gsm2 || '';
        document.getElementById('telefon').value = customer.telefon || '';
        document.getElementById('meslek').value = customer.meslek || '';
        document.getElementById('dogumTarihi').value = customer.dogumTarihi ? customer.dogumTarihi.substring(0, 10) : '';
        document.getElementById('cinsiyet').value = customer.cinsiyet || '';
        document.getElementById('babaAdi').value = customer.babaAdi || '';
        document.getElementById('yasadigiIl').value = customer.yasadigiIl || '';
        document.getElementById('yasadigiIlce').value = customer.yasadigiIlce || '';
        document.getElementById('address').value = customer.adres || '';
        document.getElementById('boy').value = customer.boy || '';
        document.getElementById('kilo').value = customer.kilo || '';

        toggleBireyselFields();
        document.getElementById('addCustomerModal').classList.add('active');
      } catch (error) {
        console.error('Musteri yuklenirken hata:', error);
        showToast('Musteri bilgileri yuklenirken hata olustu', 'error');
      }
    }

    async function saveCustomer() {
      const form = document.getElementById('customerForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const customerType = parseInt(document.getElementById('customerType').value);
      const tcVkn = document.getElementById('tcVkn').value.trim();
      const customerName = document.getElementById('customerName').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const email = document.getElementById('email').value.trim();

      // Parse name for bireysel customers
      let adi, soyadi;
      if (customerType === 1) {
        const nameParts = customerName.split(' ');
        soyadi = nameParts.pop() || '';
        adi = nameParts.join(' ') || '';
      } else {
        adi = customerName;
        soyadi = null;
      }

      const user = APP_CONFIG.AUTH.getUser();
      const data = {
        sahipTuru: customerType,
        tcKimlikNo: tcVkn.length === 11 ? tcVkn : null,
        vergiNo: tcVkn.length === 10 ? tcVkn : null,
        adi: adi,
        soyadi: soyadi,
        gsm: phone,
        email: email || null,
        gsm2: document.getElementById('gsm2').value.trim() || null,
        telefon: document.getElementById('telefon').value.trim() || null,
        meslek: document.getElementById('meslek').value.trim() || null,
        dogumTarihi: document.getElementById('dogumTarihi').value || null,
        cinsiyet: document.getElementById('cinsiyet').value || null,
        babaAdi: document.getElementById('babaAdi').value.trim() || null,
        yasadigiIl: document.getElementById('yasadigiIl').value.trim() || null,
        yasadigiIlce: document.getElementById('yasadigiIlce').value.trim() || null,
        adres: document.getElementById('address').value.trim() || null,
        boy: parseInt(document.getElementById('boy').value) || null,
        kilo: parseInt(document.getElementById('kilo').value) || null,
        ekleyenFirmaId: user?.firmaId,
        ekleyenUyeId: user?.id,
        ekleyenSubeId: user?.subeId
      };

      try {
        if (editingCustomerId) {
          await apiPut(`customers/${editingCustomerId}`, data);
          showToast('Musteri guncellendi', 'success');
        } else {
          await apiPost('customers', data);
          showToast('Musteri olusturuldu', 'success');
        }

        closeCustomerModal();
        await Promise.all([loadCustomers(), loadStats()]);
      } catch (error) {
        console.error('Musteri kaydedilirken hata:', error);
        showToast(error.message || 'Musteri kaydedilirken hata olustu', 'error');
      }
    }

    function deleteCustomer(id) {
      document.getElementById('deleteCustomerId').value = id;
      document.getElementById('deleteConfirmModal').classList.add('active');
    }

    function closeDeleteModal() {
      document.getElementById('deleteConfirmModal').classList.remove('active');
    }

    async function confirmDelete() {
      const id = document.getElementById('deleteCustomerId').value;

      try {
        const result = await apiDelete(`customers/${id}`);
        if (result.success) {
          showToast('Musteri silindi', 'success');
          closeDeleteModal();
          await Promise.all([loadCustomers(), loadStats()]);
        } else {
          showToast(result.errorMessage || 'Musteri silinemedi', 'error');
        }
      } catch (error) {
        console.error('Musteri silinirken hata:', error);
        showToast(error.message || 'Musteri silinirken hata olustu', 'error');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILITY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function getInitials(name) {
      if (!name) return '??';
      const parts = name.trim().split(' ').filter(p => p);
      if (parts.length === 0) return '??';
      if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function getAvatarColor(id) {
      const colors = ['avatar-cyan', 'avatar-emerald', 'avatar-violet', 'avatar-amber', 'avatar-rose'];
      return colors[id % colors.length];
    }

    function formatCurrency(amount) {
      return (amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL';
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
