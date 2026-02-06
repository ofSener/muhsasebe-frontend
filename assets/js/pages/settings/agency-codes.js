    // Global state
    let allAgencyCodes = [];
    let insuranceCompanies = [];
    let companyCodeMap = {}; // id -> kod mapping
    let confirmResolve = null;

    // Logo path constants
    const LOGO_BASE_PATH = '../../assets/images/logos/insurance-companies/';
    const LOGO_EXTENSION = '.png';

    // Page initialization
    document.addEventListener('DOMContentLoaded', async function() {
      await loadInsuranceCompanies();
      await loadAgencyCodes();
    });

    // Load insurance companies for dropdown
    async function loadInsuranceCompanies() {
      try {
        insuranceCompanies = await apiGet('insurance-companies', { sadeceFaal: true });
        const select = document.getElementById('companySelect');
        select.innerHTML = '<option value="">Şirket seçin...</option>';
        insuranceCompanies.forEach(company => {
          select.innerHTML += `<option value="${company.id}">${company.ad}</option>`;
          // Store company code mapping
          companyCodeMap[company.id] = company.kod;
        });
      } catch (error) {
        console.error('Sigorta şirketleri yüklenemedi:', error);
        showToast('Sigorta şirketleri yüklenemedi', 'error');
      }
    }

    // Load agency codes from API
    async function loadAgencyCodes() {
      const tbody = document.getElementById('agencyTableBody');
      const loadingState = document.getElementById('loadingState');
      const emptyState = document.getElementById('emptyState');

      tbody.innerHTML = '';
      loadingState.style.display = 'flex';
      emptyState.style.display = 'none';

      try {
        const user = APP_CONFIG.AUTH.getUser();
        const params = user?.firmaId ? { firmaId: user.firmaId } : {};
        allAgencyCodes = await apiGet('agency-codes', params);

        loadingState.style.display = 'none';

        if (allAgencyCodes.length === 0) {
          emptyState.style.display = 'flex';
        } else {
          renderAgencyCodes(allAgencyCodes);
        }

        updateStats(allAgencyCodes);
      } catch (error) {
        loadingState.style.display = 'none';
        console.error('Acente kodları yüklenemedi:', error);
        showToast('Acente kodları yüklenemedi', 'error');
      }
    }

    // Render agency codes table
    function renderAgencyCodes(codes) {
      const tbody = document.getElementById('agencyTableBody');
      const emptyState = document.getElementById('emptyState');

      if (codes.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
      }

      emptyState.style.display = 'none';

      tbody.innerHTML = codes.map(code => {
        const companyCode = companyCodeMap[code.sigortaSirketiId] || '';
        const companyInitials = getCompanyInitials(code.sigortaSirketiAdi);
        const logoPath = companyCode ? `${LOGO_BASE_PATH}${companyCode.toLowerCase()}${LOGO_EXTENSION}` : '';
        const formattedDate = code.eklenmeTarihi ? formatDate(code.eklenmeTarihi) : '-';

        return `
          <tr>
            <td>
              <span class="agency-code">${escapeHtml(code.acenteKoduDeger)}</span>
            </td>
            <td>
              <div class="company-cell">
                <div class="company-logo" data-company-code="${escapeHtml(companyCode)}" data-initials="${companyInitials}">
                  ${logoPath ? `<img src="${logoPath}" alt="${escapeHtml(code.sigortaSirketiAdi)}" onerror="this.parentElement.innerHTML='${companyInitials}'">` : companyInitials}
                </div>
                <span class="company-name">${escapeHtml(code.sigortaSirketiAdi)}</span>
              </div>
            </td>
            <td><span class="text-muted">${escapeHtml(code.acenteAdi)}</span></td>
            <td>
              <span class="status-badge ${code.disAcente === 1 ? 'status-external' : 'status-internal'}">
                ${code.disAcente === 1 ? 'Evet' : 'Hayır'}
              </span>
            </td>
            <td><span class="text-muted">${formattedDate}</span></td>
            <td>
              <div class="table-actions">
                <button class="action-btn" title="Düzenle" onclick="editAgencyCode(${code.id})">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="action-btn action-danger" title="Sil" onclick="deleteAgencyCode(${code.id}, '${escapeHtml(code.acenteKoduDeger)}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Update stats
    function updateStats(codes) {
      const total = codes.length;
      const active = codes.filter(c => c.disAcente === 0).length;
      const external = codes.filter(c => c.disAcente === 1).length;

      document.getElementById('totalCodesCount').textContent = total;
      document.getElementById('activeCodesCount').textContent = active;
      document.getElementById('externalCodesCount').textContent = external;
    }

    // Filter agency codes
    function filterAgencyCodes() {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

      if (!searchTerm) {
        renderAgencyCodes(allAgencyCodes);
        return;
      }

      const filtered = allAgencyCodes.filter(code =>
        code.acenteKoduDeger.toLowerCase().includes(searchTerm) ||
        code.acenteAdi.toLowerCase().includes(searchTerm) ||
        code.sigortaSirketiAdi.toLowerCase().includes(searchTerm)
      );

      renderAgencyCodes(filtered);
    }

    // Open add modal
    function openAddModal() {
      document.getElementById('modalTitle').textContent = 'Yeni Acente Kodu Ekle';
      document.getElementById('editingId').value = '';
      document.getElementById('agencyCodeInput').value = '';
      document.getElementById('agencyNameInput').value = '';
      document.querySelector('input[name="disAcente"][value="0"]').checked = true;
      document.getElementById('saveBtn').textContent = 'Kaydet';

      // Dropdown'ı alfabetik sıraya geri döndür
      const select = document.getElementById('companySelect');
      select.innerHTML = '<option value="">Şirket seçin...</option>';
      insuranceCompanies.forEach(company => {
        select.innerHTML += `<option value="${company.id}">${company.ad}</option>`;
      });

      document.getElementById('agencyModal').classList.add('active');
    }

    // Edit agency code
    function editAgencyCode(id) {
      const code = allAgencyCodes.find(c => c.id === id);
      if (!code) return;

      document.getElementById('modalTitle').textContent = 'Acente Kodunu Düzenle';
      document.getElementById('editingId').value = id;
      document.getElementById('agencyCodeInput').value = code.acenteKoduDeger;
      document.getElementById('agencyNameInput').value = code.acenteAdi;
      document.querySelector(`input[name="disAcente"][value="${code.disAcente}"]`).checked = true;
      document.getElementById('saveBtn').textContent = 'Güncelle';

      // Dropdown'ı seçili değerle yeniden düzenle - seçili şirket en üstte
      const select = document.getElementById('companySelect');
      const selectedCompanyId = code.sigortaSirketiId;
      const selectedCompany = insuranceCompanies.find(c => c.id === selectedCompanyId);

      select.innerHTML = '<option value="">Şirket seçin...</option>';

      // Önce seçili şirketi ekle (varsa)
      if (selectedCompany) {
        select.innerHTML += `<option value="${selectedCompany.id}" selected>${selectedCompany.ad}</option>`;
      }

      // Diğer şirketleri ekle (seçili olanı atla)
      insuranceCompanies.forEach(company => {
        if (company.id !== selectedCompanyId) {
          select.innerHTML += `<option value="${company.id}">${company.ad}</option>`;
        }
      });

      document.getElementById('agencyModal').classList.add('active');
    }

    // Save agency code (create or update)
    async function saveAgencyCode() {
      const editingIdElement = document.getElementById('editingId');
      const editingIdValue = editingIdElement.value ? parseInt(editingIdElement.value) : null;
      const editingId = (editingIdValue && editingIdValue > 0) ? editingIdValue : null;

      // Debug log
      console.log('saveAgencyCode - editingId:', editingId, 'raw value:', editingIdElement.value);

      const acenteKoduDeger = document.getElementById('agencyCodeInput').value.trim();
      const sigortaSirketiId = document.getElementById('companySelect').value;
      const acenteAdi = document.getElementById('agencyNameInput').value.trim();
      const disAcente = parseInt(document.querySelector('input[name="disAcente"]:checked').value);

      // Validation
      if (!acenteKoduDeger) {
        showToast('Acente kodu zorunludur', 'error');
        return;
      }
      if (!sigortaSirketiId) {
        showToast('Sigorta şirketi seçmelisiniz', 'error');
        return;
      }
      if (!acenteAdi) {
        showToast('Acente adı zorunludur', 'error');
        return;
      }

      const user = APP_CONFIG.AUTH.getUser();

      try {
        if (editingId && editingId > 0) {
          // Update existing
          console.log('Updating agency code with ID:', editingId);
          await apiPut(`agency-codes/${editingId}`, {
            sigortaSirketiId: parseInt(sigortaSirketiId),
            acenteKoduDeger,
            acenteAdi,
            disAcente
          });
          showToast('Acente kodu güncellendi', 'success');
        } else {
          // Create new
          console.log('Creating new agency code');
          await apiPost('agency-codes', {
            sigortaSirketiId: parseInt(sigortaSirketiId),
            acenteKoduDeger,
            acenteAdi,
            firmaId: user?.firmaId || 1,
            disAcente
          });
          showToast('Acente kodu oluşturuldu', 'success');
        }

        closeModal();
        await loadAgencyCodes();
      } catch (error) {
        console.error('Kaydetme hatası:', error);
        showToast('Kaydetme sırasında hata oluştu', 'error');
      }
    }

    // Delete agency code
    async function deleteAgencyCode(id, kodDeger) {
      const confirmed = await showConfirmDialog({
        title: 'Acente Kodunu Sil',
        message: `"${kodDeger}" kodunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
        variant: 'danger'
      });

      if (!confirmed) return;

      try {
        await apiDelete(`agency-codes/${id}`);
        showToast('Acente kodu silindi', 'success');

        // Tam yenileme yap (lokal filtreleme yerine)
        await loadAgencyCodes();
      } catch (error) {
        console.error('Silme hatası:', error);
        showToast('Silme sırasında hata oluştu', 'error');
      }
    }

    // Close modal
    function closeModal() {
      document.getElementById('agencyModal').classList.remove('active');
    }

    // Custom confirmation dialog
    function showConfirmDialog({ title, message, variant = 'danger' }) {
      return new Promise((resolve) => {
        confirmResolve = resolve;

        const modal = document.getElementById('confirmModal');
        const icon = document.getElementById('confirmIcon');
        const okBtn = document.getElementById('confirmOk');

        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;

        // Set variant styles
        icon.className = 'confirm-modal-icon';
        okBtn.className = 'btn';

        if (variant === 'warning') {
          icon.classList.add('warning');
          okBtn.classList.add('btn-warning');
        } else {
          okBtn.classList.add('btn-danger');
        }

        modal.classList.add('active');
      });
    }

    // Confirmation modal handlers
    document.getElementById('confirmCancel').addEventListener('click', () => {
      document.getElementById('confirmModal').classList.remove('active');
      if (confirmResolve) {
        confirmResolve(false);
        confirmResolve = null;
      }
    });

    document.getElementById('confirmOk').addEventListener('click', () => {
      document.getElementById('confirmModal').classList.remove('active');
      if (confirmResolve) {
        confirmResolve(true);
        confirmResolve = null;
      }
    });

    // Helper functions
    function getCompanyInitials(name) {
      if (!name) return '?';
      return name.split(' ')
        .filter(word => word.length > 0)
        .map(word => word[0].toUpperCase())
        .slice(0, 3)
        .join('');
    }

    function formatDate(dateString) {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Close modal on overlay click
    document.getElementById('agencyModal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        closeModal();
      }
    });

    // Close modal on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.getElementById('confirmModal').classList.remove('active');
        if (confirmResolve) {
          confirmResolve(false);
          confirmResolve = null;
        }
      }
    });