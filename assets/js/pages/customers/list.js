    // ═══════════════════════════════════════════════════════════════
    // CUSTOMER LIST PAGE - JAVASCRIPT
    // ═══════════════════════════════════════════════════════════════

    // State
    let allCustomers = [];
    let filteredCustomers = [];
    let currentPage = 1;
    const pageSize = 10;
    let editingCustomerId = null;

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
        console.error('Müşteriler yüklenirken hata:', error);
        showToast('Müşteriler yüklenirken hata oluştu', 'error');
      }
    }

    async function loadStats() {
      try {
        const stats = await apiGet('customers/stats');
        updateStats(stats);
      } catch (error) {
        console.error('İstatistikler yüklenirken hata:', error);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDERING
    // ═══════════════════════════════════════════════════════════════

    function renderCustomers() {
      const tbody = document.querySelector('.data-table tbody');
      if (!tbody) return;

      // Calculate pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pageCustomers = filteredCustomers.slice(startIndex, endIndex);

      if (pageCustomers.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 2rem;">
              <div style="color: var(--text-tertiary);">Müşteri bulunamadı</div>
            </td>
          </tr>
        `;
        renderPagination();
        return;
      }

      tbody.innerHTML = pageCustomers.map(customer => {
        const isKurumsal = customer.sahipTuru === 2;
        const displayName = isKurumsal
          ? customer.adi
          : `${customer.adi || ''} ${customer.soyadi || ''}`.trim();
        const initials = getInitials(displayName);
        const avatarColor = getAvatarColor(customer.id);
        const tcVkn = customer.tcKimlikNo || customer.vergiNo || '-';
        const registerDate = customer.eklenmeZamani
          ? new Date(customer.eklenmeZamani).toLocaleDateString('tr-TR')
          : '-';
        const toplamPrim = formatCurrency(customer.toplamPrim || 0);

        return `
          <tr data-id="${customer.id}">
            <td>
              <div class="flex items-center gap-3">
                <div class="avatar avatar-sm ${avatarColor}">${initials}</div>
                <div>
                  <div class="cell-main">${escapeHtml(displayName)}</div>
                  <div class="cell-sub">Kayıt: ${registerDate}</div>
                </div>
              </div>
            </td>
            <td><span class="font-mono">${escapeHtml(tcVkn)}</span></td>
            <td>
              <div class="cell-main">${escapeHtml(customer.gsm || '-')}</div>
              <div class="cell-sub">${escapeHtml(customer.email || '-')}</div>
            </td>
            <td><span class="badge ${isKurumsal ? 'badge-neutral' : 'badge-info'}">${isKurumsal ? 'Kurumsal' : 'Bireysel'}</span></td>
            <td><span class="font-semibold">${customer.policeSayisi || 0}</span></td>
            <td><span class="font-mono font-semibold">${toplamPrim}</span></td>
            <td>
              <div class="table-actions">
                <a href="detail.html?id=${customer.id}" class="btn btn-icon btn-ghost" title="Detay">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </a>
                <button class="btn btn-icon btn-ghost" title="Düzenle" onclick="editCustomer(${customer.id})">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn btn-icon btn-ghost" title="Sil" onclick="deleteCustomer(${customer.id})">
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
      const paginationInfo = document.querySelector('.pagination-info');
      const paginationPages = document.querySelector('.pagination-pages');

      const totalCount = filteredCustomers.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIndex = (currentPage - 1) * pageSize + 1;
      const endIndex = Math.min(currentPage * pageSize, totalCount);

      if (paginationInfo) {
        paginationInfo.textContent = totalCount > 0
          ? `Toplam ${totalCount.toLocaleString('tr-TR')} kayıttan ${startIndex}-${endIndex} arası gösteriliyor`
          : 'Kayıt bulunamadı';
      }

      if (paginationPages) {
        let pagesHtml = `
          <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
          </button>
        `;

        // Generate page buttons
        const pages = getPageNumbers(currentPage, totalPages);
        pages.forEach(page => {
          if (page === '...') {
            pagesHtml += `<button class="pagination-btn" disabled>...</button>`;
          } else {
            pagesHtml += `<button class="pagination-btn ${page === currentPage ? 'active' : ''}" onclick="goToPage(${page})">${page}</button>`;
          }
        });

        pagesHtml += `
          <button class="pagination-btn" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
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
    }

    function updateStats(stats) {
      const statCards = document.querySelectorAll('.stat-card .stat-value');
      if (statCards.length >= 4) {
        statCards[0].textContent = (stats.toplamMusteriSayisi || 0).toLocaleString('tr-TR');
        statCards[1].textContent = (stats.bireyselMusteriSayisi || 0).toLocaleString('tr-TR');
        statCards[2].textContent = (stats.kurumsalMusteriSayisi || 0).toLocaleString('tr-TR');
        statCards[3].textContent = (stats.buAyYeniMusteriSayisi || 0).toLocaleString('tr-TR');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // FILTERING & SEARCH
    // ═══════════════════════════════════════════════════════════════

    function setupEventListeners() {
      // Type filter
      const typeFilter = document.querySelector('.filter-row .form-select');
      if (typeFilter) {
        typeFilter.addEventListener('change', applyFilters);
      }

      // Filter inputs
      const filterInputs = document.querySelectorAll('.filter-row .form-input');
      filterInputs.forEach(input => {
        input.addEventListener('input', debounce(applyFilters, 300));
      });

      // Filter button
      const filterBtn = document.querySelector('.filter-row .btn-secondary');
      if (filterBtn) {
        filterBtn.addEventListener('click', applyFilters);
      }

      // Clear filter button
      const clearBtn = document.querySelector('.filter-row .btn-ghost');
      if (clearBtn) {
        clearBtn.addEventListener('click', clearFilters);
      }

      // Navbar search
      const navbarSearch = document.querySelector('.navbar-search input');
      if (navbarSearch) {
        navbarSearch.addEventListener('input', debounce(searchCustomers, 300));
      }
    }

    function applyFilters() {
      const typeFilter = document.querySelector('.filter-row .form-select');
      const filterInputs = document.querySelectorAll('.filter-row .form-input');

      const type = typeFilter?.value || '';
      const tcVkn = filterInputs[0]?.value?.toLowerCase() || '';
      const name = filterInputs[1]?.value?.toLowerCase() || '';

      filteredCustomers = allCustomers.filter(customer => {
        // Type filter
        if (type === 'bireysel' && customer.sahipTuru !== 1) return false;
        if (type === 'kurumsal' && customer.sahipTuru !== 2) return false;

        // TC/VKN filter
        if (tcVkn) {
          const customerTcVkn = (customer.tcKimlikNo || customer.vergiNo || '').toLowerCase();
          if (!customerTcVkn.includes(tcVkn)) return false;
        }

        // Name filter
        if (name) {
          const displayName = `${customer.adi || ''} ${customer.soyadi || ''}`.toLowerCase();
          if (!displayName.includes(name)) return false;
        }

        return true;
      });

      currentPage = 1;
      renderCustomers();
    }

    function clearFilters() {
      const typeFilter = document.querySelector('.filter-row .form-select');
      const filterInputs = document.querySelectorAll('.filter-row .form-input');

      if (typeFilter) typeFilter.value = '';
      filterInputs.forEach(input => input.value = '');

      filteredCustomers = [...allCustomers];
      currentPage = 1;
      renderCustomers();
    }

    function searchCustomers(event) {
      const searchTerm = event.target.value.toLowerCase();

      if (!searchTerm) {
        filteredCustomers = [...allCustomers];
      } else {
        filteredCustomers = allCustomers.filter(customer => {
          const displayName = `${customer.adi || ''} ${customer.soyadi || ''}`.toLowerCase();
          const tcVkn = (customer.tcKimlikNo || customer.vergiNo || '').toLowerCase();
          const phone = (customer.gsm || '').toLowerCase();

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
      document.getElementById('modalTitle').textContent = 'Yeni Müşteri Ekle';
      document.getElementById('customerForm').reset();
      document.getElementById('customerId').value = '';
      document.getElementById('addCustomerModal').classList.add('active');
    }

    function closeCustomerModal() {
      document.getElementById('addCustomerModal').classList.remove('active');
      editingCustomerId = null;
    }

    async function editCustomer(id) {
      try {
        const customer = await apiGet(`customers/${id}`);
        if (!customer) {
          showToast('Müşteri bulunamadı', 'error');
          return;
        }

        editingCustomerId = id;
        document.getElementById('modalTitle').textContent = 'Müşteri Düzenle';
        document.getElementById('customerId').value = id;
        document.getElementById('customerType').value = customer.sahipTuru || 1;
        document.getElementById('tcVkn').value = customer.tcKimlikNo || customer.vergiNo || '';
        document.getElementById('customerName').value = customer.sahipTuru === 2
          ? customer.adi || ''
          : `${customer.adi || ''} ${customer.soyadi || ''}`.trim();
        document.getElementById('phone').value = customer.gsm || '';
        document.getElementById('email').value = customer.email || '';
        // Address field not in current entity, but form has it

        document.getElementById('addCustomerModal').classList.add('active');
      } catch (error) {
        console.error('Müşteri yüklenirken hata:', error);
        showToast('Müşteri bilgileri yüklenirken hata oluştu', 'error');
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
        ekleyenFirmaId: user?.firmaId,
        ekleyenUyeId: user?.id,
        ekleyenSubeId: user?.subeId
      };

      try {
        if (editingCustomerId) {
          // Update
          await apiPut(`customers/${editingCustomerId}`, data);
          showToast('Müşteri güncellendi', 'success');
        } else {
          // Create
          await apiPost('customers', data);
          showToast('Müşteri oluşturuldu', 'success');
        }

        closeCustomerModal();
        await Promise.all([loadCustomers(), loadStats()]);
      } catch (error) {
        console.error('Müşteri kaydedilirken hata:', error);
        showToast(error.message || 'Müşteri kaydedilirken hata oluştu', 'error');
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
          showToast('Müşteri silindi', 'success');
          closeDeleteModal();
          await Promise.all([loadCustomers(), loadStats()]);
        } else {
          showToast(result.errorMessage || 'Müşteri silinemedi', 'error');
        }
      } catch (error) {
        console.error('Müşteri silinirken hata:', error);
        showToast(error.message || 'Müşteri silinirken hata oluştu', 'error');
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