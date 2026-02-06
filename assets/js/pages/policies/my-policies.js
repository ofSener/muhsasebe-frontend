    // State
    let policies = [];
    let filteredPolicies = [];
    let currentPage = 1;
    const pageSize = 20;
    let startDatePicker, endDatePicker;

    // Load policies on page load
    document.addEventListener('DOMContentLoaded', async () => {
      if (!hasViewPermission()) {
        showToast('Bu sayfaya erişim yetkiniz yok', 'error');
        setTimeout(() => window.location.href = '../../index.html', 1500);
        return;
      }
      initializeDatePickers();
      await loadPolicies();
    });

    // Initialize date pickers
    function initializeDatePickers() {
      const commonConfig = {
        locale: 'tr',
        dateFormat: 'd.m.Y',
        onChange: () => applyFilters()
      };

      startDatePicker = flatpickr('#filterStartDate', {
        ...commonConfig,
        placeholder: 'Başlangıç Tarihi'
      });

      endDatePicker = flatpickr('#filterEndDate', {
        ...commonConfig,
        placeholder: 'Bitiş Tarihi'
      });
    }

    // Load policies from API
    async function loadPolicies() {
      try {
        // Build query params
        let queryParams = 'pageSize=1000';

        // Add date filters if selected
        const startDate = startDatePicker?.selectedDates[0];
        const endDate = endDatePicker?.selectedDates[0];

        if (startDate) {
          queryParams += `&startDate=${startDate.toISOString()}`;
        }
        if (endDate) {
          queryParams += `&endDate=${endDate.toISOString()}`;
        }

        const response = await apiGet(`policies?${queryParams}`);
        // Backend artık PoliceListDto döndürüyor (camelCase)
        policies = response.items || [];
        filteredPolicies = [...policies];
        renderTable();
        updateStats();
      } catch (error) {
        console.error('Poliçeler yüklenirken hata:', error);
        document.getElementById('policyTableBody').innerHTML = `
          <tr>
            <td colspan="12" style="text-align: center; padding: 2rem; color: var(--danger);">
              Poliçeler yüklenirken hata oluştu: ${error.message}
            </td>
          </tr>
        `;
      }
    }

    // Apply filters
    async function applyFilters() {
      // Reload from API with date filters
      await loadPolicies();

      // Then apply client-side filters
      const policeTipi = document.getElementById('filterPoliceTipi').value.toLowerCase();
      const durum = document.getElementById('filterDurum').value;
      const search = document.getElementById('filterSearch').value.toLowerCase();

      filteredPolicies = policies.filter(p => {
        // Poliçe tipi filtresi (backend: policeTuruAdi)
        if (policeTipi && p.policeTuruAdi?.toLowerCase() !== policeTipi) return false;

        // Durum filtresi
        if (durum !== '' && p.onayDurumu?.toString() !== durum) return false;

        // Arama filtresi (backend: policeNumarasi)
        if (search) {
          const matchPoliceNo = p.policeNumarasi?.toLowerCase().includes(search);
          const matchPlaka = p.plaka?.toLowerCase().includes(search);
          if (!matchPoliceNo && !matchPlaka) return false;
        }

        return true;
      });

      currentPage = 1;
      renderTable();
      updateStats();
    }

    // Clear all filters
    function clearFilters() {
      document.getElementById('filterPoliceTipi').value = '';
      document.getElementById('filterDurum').value = '';
      document.getElementById('filterSearch').value = '';
      startDatePicker.clear();
      endDatePicker.clear();
      applyFilters();
    }

    // Handle search keyup
    function handleSearchKeyup(event) {
      if (event.key === 'Enter') {
        applyFilters();
      }
    }

    // Render table
    function renderTable() {
      const tbody = document.getElementById('policyTableBody');
      const totalPages = Math.ceil(filteredPolicies.length / pageSize);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, filteredPolicies.length);
      const pageData = filteredPolicies.slice(startIndex, endIndex);

      if (pageData.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="12" style="text-align: center; padding: 2rem; color: var(--text-muted);">
              Poliçe bulunamadı.
            </td>
          </tr>
        `;
        document.getElementById('tableInfo').textContent = '0 poliçe';
        document.getElementById('pagination').innerHTML = '';
        return;
      }

      tbody.innerHTML = pageData.map(p => `
        <tr>
          <td><span class="font-mono cell-main">${p.policeNumarasi || '-'}</span></td>
          <td><span class="font-mono">${p.plaka || '-'}</span></td>
          <td><span style="font-size: 0.875rem;">${p.sigortaSirketiAdi || '-'}</span></td>
          <td><span class="badge badge-primary">${p.policeTuruAdi || '-'}</span></td>
          <td><span style="font-size: 0.875rem;">${p.produktorAdi || '-'}</span></td>
          <td><span style="font-size: 0.875rem;">${p.subeAdi || '-'}</span></td>
          <td>${formatDate(p.baslangicTarihi)}</td>
          <td>${formatDate(p.bitisTarihi)}</td>
          <td class="font-mono font-semibold">${formatNumber(p.brutPrim)} TL</td>
          <td class="font-mono">${formatNumber(p.komisyon)} TL</td>
          <td>${getStatusBadge(p.onayDurumu)}</td>
          <td>
            <div class="table-actions">
              <button class="action-btn" title="Detayları Görüntüle" onclick='viewPolicy(${JSON.stringify(p).replace(/'/g, "&apos;")})'>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      // Update table info
      document.getElementById('tableInfo').textContent = `${startIndex + 1}-${endIndex} / ${filteredPolicies.length} poliçe`;

      // Render pagination
      renderPagination(totalPages);
    }

    // Render pagination
    function renderPagination(totalPages) {
      const pagination = document.getElementById('pagination');

      if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
      }

      let html = '';

      // Previous button
      html += `<button class="btn btn-sm btn-secondary" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">Önceki</button>`;

      // Page numbers
      const maxVisible = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);

      if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }

      if (startPage > 1) {
        html += `<button class="btn btn-sm btn-secondary" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span class="btn btn-sm btn-secondary" disabled>...</span>`;
      }

      for (let i = startPage; i <= endPage; i++) {
        html += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-secondary'}" onclick="goToPage(${i})">${i}</button>`;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="btn btn-sm btn-secondary" disabled>...</span>`;
        html += `<button class="btn btn-sm btn-secondary" onclick="goToPage(${totalPages})">${totalPages}</button>`;
      }

      // Next button
      html += `<button class="btn btn-sm btn-secondary" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">Sonraki</button>`;

      pagination.innerHTML = html;
    }

    // Go to page
    function goToPage(page) {
      currentPage = page;
      renderTable();
    }

    // Update stats
    function updateStats() {
      document.getElementById('totalCount').textContent = `${filteredPolicies.length} poliçe`;
    }

    // Format date
    function formatDate(dateStr) {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      return date.toLocaleDateString('tr-TR');
    }

    // Format number
    function formatNumber(num) {
      if (num === null || num === undefined) return '0';
      return Number(num).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Get status badge
    function getStatusBadge(status) {
      switch (status) {
        case 0:
          return '<span class="status-badge status-warning"><span class="badge-dot"></span> Beklemede</span>';
        case 1:
          return '<span class="status-badge status-success"><span class="badge-dot"></span> Onaylı</span>';
        case 2:
          return '<span class="status-badge status-danger"><span class="badge-dot"></span> Reddedildi</span>';
        default:
          return '<span class="status-badge"><span class="badge-dot"></span> Bilinmiyor</span>';
      }
    }

    // View policy detail
    function viewPolicy(policy) {
      const modal = document.getElementById('policyModal');
      const content = document.getElementById('modalContent');

      content.innerHTML = `
        <div class="detail-item">
          <div class="detail-label">Poliçe Numarası</div>
          <div class="detail-value large font-mono">${policy.policeNumarasi || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Plaka</div>
          <div class="detail-value font-mono">${policy.plaka || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Sigorta Şirketi</div>
          <div class="detail-value">${policy.sigortaSirketiAdi || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Poliçe Türü</div>
          <div class="detail-value">${policy.policeTuruAdi || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Prodüktör</div>
          <div class="detail-value">${policy.produktorAdi || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Prodüktör Şube</div>
          <div class="detail-value">${policy.produktorSubeAdi || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Şube</div>
          <div class="detail-value">${policy.subeAdi || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Acente</div>
          <div class="detail-value">${policy.acenteAdi || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Kullanıcı</div>
          <div class="detail-value">${policy.uyeAdi || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Tanzim Tarihi</div>
          <div class="detail-value">${formatDate(policy.tanzimTarihi)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Başlangıç Tarihi</div>
          <div class="detail-value">${formatDate(policy.baslangicTarihi)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Bitiş Tarihi</div>
          <div class="detail-value">${formatDate(policy.bitisTarihi)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Brüt Prim</div>
          <div class="detail-value large font-mono">${formatNumber(policy.brutPrim)} TL</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Net Prim</div>
          <div class="detail-value font-mono">${formatNumber(policy.netPrim)} TL</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Komisyon</div>
          <div class="detail-value large font-mono">${formatNumber(policy.komisyon)} TL</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Zeyil No</div>
          <div class="detail-value">${policy.zeyilNo || '0'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Yenilenme Durumu</div>
          <div class="detail-value">${policy.yenilemeDurumu === 1 ? 'Yenilendi' : 'Yenilenmedi'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Onay Durumu</div>
          <div class="detail-value">${getStatusBadge(policy.onayDurumu)}</div>
        </div>
      `;

      modal.classList.add('active');
    }

    // Close modal
    function closeModal() {
      document.getElementById('policyModal').classList.remove('active');
    }

    // Close modal on overlay click
    document.getElementById('policyModal').addEventListener('click', function(e) {
      if (e.target === this) {
        closeModal();
      }
    });

    // Export to Excel
    function exportToExcel() {
      try {
        // Prepare data for Excel
        const headers = ['Poliçe No', 'Plaka', 'Sigorta Şirketi', 'Tip', 'Prodüktör', 'Prodüktör Şube', 'Şube', 'Acente', 'Kullanıcı', 'Tanzim', 'Başlangıç', 'Bitiş', 'Brüt Prim', 'Net Prim', 'Komisyon', 'Zeyil No', 'Onay Durumu'];

        const data = filteredPolicies.map(p => [
          p.policeNumarasi || '',
          p.plaka || '',
          p.sigortaSirketiAdi || '',
          p.policeTuruAdi || '',
          p.produktorAdi || '',
          p.produktorSubeAdi || '',
          p.subeAdi || '',
          p.acenteAdi || '',
          p.uyeAdi || '',
          formatDate(p.tanzimTarihi),
          formatDate(p.baslangicTarihi),
          formatDate(p.bitisTarihi),
          p.brutPrim || 0,
          p.netPrim || 0,
          p.komisyon || 0,
          p.zeyilNo || 0,
          p.onayDurumu === 1 ? 'Onaylı' : (p.onayDurumu === 0 ? 'Beklemede' : 'Reddedildi')
        ]);

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

        // Set column widths
        ws['!cols'] = [
          { wch: 15 }, // Poliçe No
          { wch: 12 }, // Plaka
          { wch: 25 }, // Sigorta Şirketi
          { wch: 12 }, // Tip
          { wch: 20 }, // Prodüktör
          { wch: 25 }, // Prodüktör Şube
          { wch: 20 }, // Şube
          { wch: 20 }, // Acente
          { wch: 20 }, // Kullanıcı
          { wch: 12 }, // Tanzim
          { wch: 12 }, // Başlangıç
          { wch: 12 }, // Bitiş
          { wch: 15 }, // Brüt Prim
          { wch: 15 }, // Net Prim
          { wch: 15 }, // Komisyon
          { wch: 10 }, // Zeyil No
          { wch: 12 }  // Onay Durumu
        ];

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Poliçelerim');

        // Generate filename with date and filter info
        let filename = 'policelerim';
        const startDate = startDatePicker?.selectedDates[0];
        const endDate = endDatePicker?.selectedDates[0];

        if (startDate || endDate) {
          filename += '_';
          if (startDate) filename += formatDate(startDate.toISOString()).replace(/\./g, '-');
          if (endDate) filename += '_' + formatDate(endDate.toISOString()).replace(/\./g, '-');
        } else {
          filename += '_' + new Date().toISOString().split('T')[0];
        }
        filename += '.xlsx';

        // Write and download file
        XLSX.writeFile(wb, filename);

        // Show success message
        alert(`${filteredPolicies.length} poliçe Excel dosyasına aktarıldı!`);
      } catch (error) {
        console.error('Excel export hatası:', error);
        alert('Excel dosyası oluşturulurken hata oluştu: ' + error.message);
      }
    }
