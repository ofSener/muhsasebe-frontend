    // Global state
    let allPolicies = [];
    let filteredPolicies = [];
    let currentPage = 1;
    const pageSize = 10;
    let insuranceCompanies = [];
    let policyTypes = [];

    // Initialize
    document.addEventListener('DOMContentLoaded', async function() {
      await loadData();
      setupEventListeners();
    });

    // Load data from API
    async function loadData() {
      try {
        // Fetch policies nearing expiration
        const response = await apiGet('policies/renewals', {
          daysAhead: 60, // Get policies expiring in next 60 days
          pageSize: 1000 // Get all for client-side filtering
        });

        if (response && response.items) {
          // Map API response (PascalCase) to JavaScript (camelCase)
          allPolicies = response.items.map(item => ({
            id: item.id,
            sigortaSirketi: item.sigortaSirketiAdi || 'N/A',
            sigortaSirketiId: item.sigortaSirketiId,
            policeTuru: item.policeTuruAdi || 'N/A',
            policeTuruId: item.policeTuruId,
            policeNumarasi: item.policeNumarasi,
            plaka: item.plaka,
            tanzimTarihi: item.tanzimTarihi,
            baslangicTarihi: item.baslangicTarihi,
            bitisTarihi: item.bitisTarihi,
            brutPrim: item.brutPrim,
            netPrim: item.netPrim,
            sigortaliAdi: item.sigortaliAdi,
            cepTelefonu: item.cepTelefonu,
            yenilemeDurumu: item.yenilemeDurumu
          }));

          filteredPolicies = [...allPolicies];

          // Extract unique companies and types
          const companiesSet = new Set();
          const typesSet = new Set();

          allPolicies.forEach(policy => {
            if (policy.sigortaSirketi) companiesSet.add(policy.sigortaSirketi);
            if (policy.policeTuru) typesSet.add(policy.policeTuru);
          });

          insuranceCompanies = Array.from(companiesSet).sort();
          policyTypes = Array.from(typesSet).sort();

          populateFilters();
          updateStats();
          renderPolicies();
        }
      } catch (error) {
        console.error('Error loading policies:', error);
        showError();
      }
    }

    // Populate filter dropdowns
    function populateFilters() {
      const companySelect = document.getElementById('filterCompany');
      const typeSelect = document.getElementById('filterType');

      // Populate companies
      insuranceCompanies.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companySelect.appendChild(option);
      });

      // Populate types
      policyTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
      });
    }

    // Update urgency stats
    function updateStats() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let count7 = 0, count15 = 0, count30 = 0, totalRevenue = 0;

      filteredPolicies.forEach(policy => {
        const expiryDate = new Date(policy.bitisTarihi);
        const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 7) count7++;
        if (daysRemaining <= 15) count15++;
        if (daysRemaining <= 30) count30++;

        totalRevenue += policy.brutPrim || 0;
      });

      document.getElementById('count-7').textContent = count7;
      document.getElementById('count-15').textContent = count15;
      document.getElementById('count-30').textContent = count30;
      document.getElementById('count-revenue').textContent = formatCurrency(totalRevenue);
    }

    // Render policies
    function renderPolicies() {
      const grid = document.getElementById('policiesGrid');
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize;
      const paginatedPolicies = filteredPolicies.slice(start, end);

      if (paginatedPolicies.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <p>Filtreye uygun poliçe bulunamadı</p>
          </div>
        `;
        document.getElementById('paginationContainer').style.display = 'none';
        return;
      }

      grid.innerHTML = paginatedPolicies.map(policy => createPolicyCard(policy)).join('');
      updatePagination();
      document.getElementById('tableResultCount').textContent = filteredPolicies.length;
    }

    // Create policy card HTML
    function createPolicyCard(policy) {
      const daysRemaining = getDaysRemaining(policy.bitisTarihi);
      const urgencyClass = daysRemaining <= 7 ? 'critical' : daysRemaining <= 15 ? 'warning' : 'normal';
      const initials = getInitials(policy.sigortaliAdi || 'N/A');

      return `
        <div class="policy-card ${urgencyClass}">
          <div class="policy-header">
            <div class="policy-customer">
              <div class="customer-avatar">${initials}</div>
              <div class="customer-info">
                <div class="customer-name">${policy.sigortaliAdi || 'İsimsiz'}</div>
                <div class="customer-phone">${formatPhone(policy.cepTelefonu)}</div>
              </div>
            </div>
            <div class="countdown-badge ${urgencyClass}">
              ${daysRemaining} Gün
            </div>
          </div>

          <div class="policy-details">
            <div class="detail-item">
              <div class="detail-label">Poliçe No</div>
              <div class="detail-value mono">${policy.policeNumarasi || '-'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Tür</div>
              <div class="detail-value">
                <span class="policy-type-pill" style="background: ${getPolicyTypeColor(policy.policeTuru)}20; color: ${getPolicyTypeColor(policy.policeTuru)}">
                  ${policy.policeTuru || '-'}
                </span>
              </div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Plaka</div>
              <div class="detail-value mono">${policy.plaka || '-'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Sigorta Şirketi</div>
              <div class="detail-value">${policy.sigortaSirketi || '-'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Başlangıç</div>
              <div class="detail-value">${formatDate(policy.baslangicTarihi)}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Bitiş</div>
              <div class="detail-value">${formatDate(policy.bitisTarihi)}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Brüt Prim</div>
              <div class="detail-value mono">${formatCurrency(policy.brutPrim)}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Net Prim</div>
              <div class="detail-value mono">${formatCurrency(policy.netPrim)}</div>
            </div>
          </div>

          <div class="policy-actions">
            <button class="btn-policy btn-quote" onclick="createQuote(${policy.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              Teklif Çalış
            </button>
            <button class="btn-policy btn-whatsapp" onclick="sendWhatsApp(${policy.id})">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp Gönder
            </button>
          </div>
        </div>
      `;
    }

    // Update pagination
    function updatePagination() {
      const totalPages = Math.ceil(filteredPolicies.length / pageSize);
      const container = document.getElementById('paginationContainer');
      const controls = document.getElementById('paginationControls');
      const info = document.getElementById('paginationInfo');

      if (totalPages <= 1) {
        container.style.display = 'none';
        return;
      }

      container.style.display = 'flex';

      const start = (currentPage - 1) * pageSize + 1;
      const end = Math.min(currentPage * pageSize, filteredPolicies.length);
      info.textContent = `${start}-${end} / ${filteredPolicies.length} poliçe`;

      let html = '';
      html += `<button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Önceki</button>`;

      for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
      }

      html += `<button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Sonraki</button>`;

      controls.innerHTML = html;
    }

    // Change page
    function changePage(page) {
      const totalPages = Math.ceil(filteredPolicies.length / pageSize);
      if (page < 1 || page > totalPages) return;
      currentPage = page;
      renderPolicies();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Apply filters
    function applyFilters() {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase();
      const companyFilter = document.getElementById('filterCompany').value;
      const typeFilter = document.getElementById('filterType').value;
      const daysFilter = document.getElementById('filterDays').value;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filteredPolicies = allPolicies.filter(policy => {
        // Search filter
        if (searchTerm) {
          const searchFields = [
            policy.sigortaliAdi,
            policy.policeNumarasi,
            policy.plaka
          ].join(' ').toLowerCase();

          if (!searchFields.includes(searchTerm)) return false;
        }

        // Company filter
        if (companyFilter && policy.sigortaSirketi !== companyFilter) return false;

        // Type filter
        if (typeFilter && policy.policeTuru !== typeFilter) return false;

        // Days filter
        if (daysFilter) {
          const expiryDate = new Date(policy.bitisTarihi);
          const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
          if (daysRemaining > parseInt(daysFilter)) return false;
        }

        return true;
      });

      currentPage = 1;
      updateStats();
      renderPolicies();
    }

    // Setup event listeners
    function setupEventListeners() {
      // Search input
      document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));

      // Filter selects
      document.getElementById('filterCompany').addEventListener('change', applyFilters);
      document.getElementById('filterType').addEventListener('change', applyFilters);
      document.getElementById('filterDays').addEventListener('change', applyFilters);

      // Sort
      document.getElementById('sortBy').addEventListener('change', function() {
        const [field, order] = this.value.split('_');
        sortPolicies(field, order);
      });

      // Reset filters
      document.getElementById('btnResetFilters').addEventListener('click', resetFilters);

      // Urgency cards
      document.querySelectorAll('.urgency-card').forEach(card => {
        card.addEventListener('click', function() {
          const filter = this.getAttribute('data-filter');
          filterByUrgency(filter);
        });
      });

      // Bulk auto quote
      document.getElementById('btnBulkAutoQuote').addEventListener('click', openBulkAutoQuoteModal);
    }

    // Sort policies
    function sortPolicies(field, order) {
      filteredPolicies.sort((a, b) => {
        let aVal = a[field.charAt(0).toLowerCase() + field.slice(1)];
        let bVal = b[field.charAt(0).toLowerCase() + field.slice(1)];

        if (field === 'BitisTarihi' || field === 'BaslangicTarihi') {
          aVal = new Date(aVal);
          bVal = new Date(bVal);
        }

        if (order === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      renderPolicies();
    }

    // Reset filters
    function resetFilters() {
      document.getElementById('searchInput').value = '';
      document.getElementById('filterCompany').value = '';
      document.getElementById('filterType').value = '';
      document.getElementById('filterDays').value = '';

      document.querySelectorAll('.urgency-card').forEach(card => {
        card.classList.remove('active');
      });

      filteredPolicies = [...allPolicies];
      currentPage = 1;
      updateStats();
      renderPolicies();
    }

    // Filter by urgency
    function filterByUrgency(days) {
      document.querySelectorAll('.urgency-card').forEach(card => {
        card.classList.remove('active');
      });

      event.currentTarget.classList.add('active');

      if (days === 'all') {
        resetFilters();
        return;
      }

      document.getElementById('filterDays').value = days;
      applyFilters();
    }

    // Utility functions
    function getDaysRemaining(expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(expiryDate);
      return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    }

    function getInitials(name) {
      if (!name || name === 'N/A') return '?';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    function formatDate(dateStr) {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatCurrency(amount) {
      if (!amount && amount !== 0) return '-';
      return amount.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL';
    }

    function formatPhone(phone) {
      if (!phone) return '-';
      const phoneStr = String(phone);
      if (phoneStr.length === 10) {
        return `0${phoneStr.slice(0, 3)} ${phoneStr.slice(3, 6)} ${phoneStr.slice(6, 8)} ${phoneStr.slice(8)}`;
      }
      return phoneStr;
    }

    function getPolicyTypeColor(type) {
      const colors = {
        'Kasko': '#00d4ff',
        'Trafik': '#10b981',
        'DASK': '#f59e0b',
        'Sağlık': '#ec4899',
        'Konut': '#6366f1',
        'İşyeri': '#06b6d4'
      };
      return colors[type] || '#3b82f6';
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

    function showError() {
      document.getElementById('policiesGrid').innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Veriler yüklenirken bir hata oluştu</p>
        </div>
      `;
    }

    // Action functions (placeholders for backend integration)
    function createQuote(policyId) {
      showToast('Teklif çalışma özelliği yakında eklenecek', 'info');
    }

    function sendWhatsApp(policyId) {
      showToast('WhatsApp gönderme özelliği yakında eklenecek', 'info');
    }

    // Bulk Auto Quote Modal
    function openBulkAutoQuoteModal() {
      const modal = document.getElementById('bulkAutoQuoteModal');
      modal.classList.add('show');

      // Populate branches checkboxes
      const checkboxes = document.getElementById('bulkBranchesCheckboxes');
      checkboxes.innerHTML = policyTypes.map(type => `
        <div class="checkbox-item">
          <input type="checkbox" id="branch-${type}" value="${type}" checked>
          <label for="branch-${type}">${type}</label>
        </div>
      `).join('');

      updateBulkQuoteStats();

      // Add event listeners
      document.getElementById('bulkDaysFilter').addEventListener('change', updateBulkQuoteStats);
      checkboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', updateBulkQuoteStats);
      });
    }

    function closeBulkAutoQuoteModal() {
      document.getElementById('bulkAutoQuoteModal').classList.remove('show');
    }

    function updateBulkQuoteStats() {
      const days = parseInt(document.getElementById('bulkDaysFilter').value);
      const selectedBranches = Array.from(document.querySelectorAll('#bulkBranchesCheckboxes input:checked')).map(cb => cb.value);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const matchingPolicies = allPolicies.filter(policy => {
        const expiryDate = new Date(policy.bitisTarihi);
        const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        return daysRemaining <= days && selectedBranches.includes(policy.policeTuru);
      });

      const totalRevenue = matchingPolicies.reduce((sum, p) => sum + (p.brutPrim || 0), 0);

      document.getElementById('bulkQuoteCount').textContent = matchingPolicies.length;
      document.getElementById('bulkQuoteRevenue').textContent = formatCurrency(totalRevenue);
    }

    function executeBulkAutoQuote() {
      showToast('Toplu teklif çalışma özelliği yakında eklenecek', 'info');
      closeBulkAutoQuoteModal();
    }

    // Close modal on overlay click
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('modal-overlay')) {
        closeBulkAutoQuoteModal();
      }
    });