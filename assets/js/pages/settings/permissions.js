    // ========================================
    // Custom Confirmation Dialog
    // ========================================
    function showConfirmDialog(options = {}) {
      return new Promise((resolve) => {
        const {
          title = 'Onay Gerekiyor',
          message = 'Bu işlemi gerçekleştirmek istediğinizden emin misiniz?',
          confirmText = 'Onayla',
          cancelText = 'Vazgeç',
          variant = 'default', // 'default', 'danger', 'warning', 'success'
          icon = null // custom SVG or null for default
        } = options;

        const overlay = document.getElementById('confirmModal');
        const modal = overlay.querySelector('.confirm-modal');
        const titleEl = document.getElementById('confirmModalTitle');
        const messageEl = document.getElementById('confirmModalMessage');
        const confirmBtn = document.getElementById('confirmModalConfirm');
        const cancelBtn = document.getElementById('confirmModalCancel');
        const iconEl = document.getElementById('confirmModalIcon');

        // Set content
        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.querySelector('span').textContent = confirmText;
        cancelBtn.querySelector('span').textContent = cancelText;

        // Set variant
        modal.className = 'confirm-modal';
        if (variant !== 'default') {
          modal.classList.add(`variant-${variant}`);
        }

        // Set icon based on variant
        const icons = {
          default: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>`,
          danger: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>`,
          warning: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>`,
          success: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>`
        };
        iconEl.innerHTML = icon || icons[variant] || icons.default;

        // Show modal
        overlay.classList.add('active');

        // Handle responses
        const cleanup = () => {
          overlay.classList.remove('active');
          confirmBtn.removeEventListener('click', handleConfirm);
          cancelBtn.removeEventListener('click', handleCancel);
          overlay.removeEventListener('click', handleOverlayClick);
          document.removeEventListener('keydown', handleKeydown);
        };

        const handleConfirm = () => {
          cleanup();
          resolve(true);
        };

        const handleCancel = () => {
          cleanup();
          resolve(false);
        };

        const handleOverlayClick = (e) => {
          if (e.target === overlay) {
            modal.classList.add('shake');
            setTimeout(() => modal.classList.remove('shake'), 500);
          }
        };

        const handleKeydown = (e) => {
          if (e.key === 'Escape') {
            handleCancel();
          } else if (e.key === 'Enter') {
            handleConfirm();
          }
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
        document.addEventListener('keydown', handleKeydown);

        // Focus confirm button
        setTimeout(() => confirmBtn.focus(), 100);
      });
    }

    // Sayfa yüklendiğinde yetki kontrolü yap
    document.addEventListener('DOMContentLoaded', function() {
      if (!requirePermission('yetkilerSayfasindaIslemYapabilsin')) return;
      loadPermissions();
      setupChangeListeners();
      setupParentChildCheckboxes();
    });

    // Yetki listesini yükle
    let allPermissions = [];
    let selectedPermissionId = null;
    let originalPermissionData = null; // Orijinal yetki verisi (degisiklikleri karsilastirmak icin)

    // Buton gorunurlugunu guncelle (yetki seciliyken)
    function updateButtonVisibility() {
      const deleteBtn = document.getElementById('deletePermission');
      const addEmployeeBtn = document.getElementById('addEmployeeBtn');

      if (deleteBtn) deleteBtn.style.display = selectedPermissionId ? 'inline-flex' : 'none';
      if (addEmployeeBtn) addEmployeeBtn.style.display = selectedPermissionId ? 'inline-flex' : 'none';
    }

    // Yetki ayarlari degisiklik takibi
    let hasPermissionSettingsChanged = false;
    let isNewPermission = false; // Yeni yetki oluşturma modu

    // Degisiklik dinleyicilerini kur
    function setupChangeListeners() {
      // TÜM Checkbox'lar icin (parent ve child dahil)
      document.querySelectorAll('.permission-item input[type="checkbox"]').forEach(checkbox => {
        // Mevcut listener'ları temizle (duplicate önleme)
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);

        newCheckbox.addEventListener('change', function() {
          // Parent checkbox ise child'ları kontrol et
          if (this.classList.contains('parent-permission')) {
            handleParentCheckboxChange(this);
          }
          onPermissionSettingsChange();
          updatePermissionPreview();
        });
      });

      // Yetki adi input'u icin
      const nameInput = document.getElementById('permissionName');
      if (nameInput) {
        // Mevcut listener'ı temizle
        const newInput = nameInput.cloneNode(true);
        nameInput.parentNode.replaceChild(newInput, nameInput);
        newInput.addEventListener('input', function() {
          onPermissionSettingsChange();
          // Yeni yetki chip'ini canlı güncelle
          updateNewPermissionChip(this.value);
        });
      }

      // Gorme seviyesi select'i icin
      const viewSelect = document.getElementById('viewLevelSelect');
      if (viewSelect) {
        // Mevcut listener'ı temizle
        const newSelect = viewSelect.cloneNode(true);
        viewSelect.parentNode.replaceChild(newSelect, viewSelect);
        newSelect.addEventListener('change', onPermissionSettingsChange);
      }

      // Police yakalama select'i icin
      const policeYakalamaSelect = document.getElementById('policeYakalamaSelect');
      if (policeYakalamaSelect) {
        // Mevcut listener'ı temizle
        const newSelect = policeYakalamaSelect.cloneNode(true);
        policeYakalamaSelect.parentNode.replaceChild(newSelect, policeYakalamaSelect);
        newSelect.addEventListener('change', onPermissionSettingsChange);
      }
    }

    // Parent checkbox değiştiğinde children'ları yönet
    function handleParentCheckboxChange(parentCheckbox) {
      const childrenNames = parentCheckbox.dataset.children?.split(',') || [];

      if (!parentCheckbox.checked) {
        // Parent kapatılırsa, tüm children'ları da kapat ve disable et
        childrenNames.forEach(childName => {
          const childCheckbox = document.querySelector(`input[name="${childName}"]`);
          if (childCheckbox) {
            childCheckbox.checked = false;
            childCheckbox.disabled = true;
          }
        });
      } else {
        // Parent açılırsa, children'ları etkinleştir
        childrenNames.forEach(childName => {
          const childCheckbox = document.querySelector(`input[name="${childName}"]`);
          if (childCheckbox) {
            childCheckbox.disabled = false;
          }
        });
      }
    }

    // Yetki ayarlari degistiginde
    function onPermissionSettingsChange() {
      // Yeni yetki modu için özel kontrol
      if (isNewPermission) {
        // Yeni yetki için form dolu mu kontrol et
        const currentData = collectFormData();
        const hasData = currentData.yetkiAdi && currentData.yetkiAdi.trim() !== '';
        hasPermissionSettingsChanged = hasData;
        updateFloatingActionBox();
        return;
      }

      if (!selectedPermissionId || !originalPermissionData) return;

      // Mevcut form degerlerini al
      const currentData = collectFormData();

      // Orijinal verilerle karsilastir
      const changed = hasAnyChange(originalPermissionData, currentData);
      hasPermissionSettingsChanged = changed;

      // Floating box'i guncelle
      updateFloatingActionBox();
    }

    // Degisiklik var mi kontrol et
    function hasAnyChange(original, current) {
      if (original.yetkiAdi !== current.yetkiAdi) return true;
      if (original.gorebilecegiPolicelerveKartlar !== current.gorebilecegiPolicelerveKartlar) return true;

      const checkboxFields = [
        'policeDuzenleyebilsin', 'policeHavuzunuGorebilsin', 'policeAktarabilsin',
        'policeDosyalarinaErisebilsin', 'policeYakalamaSecenekleri',
        'yetkilerSayfasindaIslemYapabilsin', 'acenteliklerSayfasindaIslemYapabilsin',
        'driveEntegrasyonuGorebilsin',
        'komisyonOranlariniDuzenleyebilsin', 'produktorleriGorebilsin',
        'acenteliklereGorePoliceYakalansin',
        // Ana menü yetkileri
        'musterileriGorebilsin', 'finansSayfasiniGorebilsin',
        // Müşterilerimiz alt yetkileri
        'musteriListesiGorebilsin', 'musteriDetayGorebilsin', 'yenilemeTakibiGorebilsin',
        // Finans alt yetkileri
        'finansDashboardGorebilsin', 'policeOdemeleriGorebilsin', 'tahsilatTakibiGorebilsin', 'finansRaporlariGorebilsin', 'kazanclarimGorebilsin'
      ];

      for (const field of checkboxFields) {
        const origVal = original[field] === '1' || original[field] === true;
        const currVal = current[field] === '1' || current[field] === true;
        if (origVal !== currVal) return true;
      }

      return false;
    }

    async function loadPermissions() {
      try {
        showLoading(true);
        const user = APP_CONFIG.AUTH.getUser();
        const firmaId = user?.firmaId;

        const params = firmaId ? { firmaId } : {};
        allPermissions = await apiGet('permissions', params);

        renderPermissionList();

        // İlk yetkiyi seç
        if (allPermissions.length > 0) {
          selectPermission(allPermissions[0].id);
        }
      } catch (error) {
        showToast('Yetkiler yüklenirken hata oluştu: ' + error.message, 'error');
      } finally {
        showLoading(false);
      }
    }

    // Yetki listesini render et
    function renderPermissionList() {
      const container = document.querySelector('.employee-selector');
      container.innerHTML = '';

      // Yeni Yetki Ekle butonu
      const addButton = document.createElement('div');
      addButton.className = 'employee-chip add-new-chip';
      addButton.innerHTML = `
        <div class="chip-avatar" style="background: linear-gradient(135deg, #10b981, #34d399);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
        <div class="chip-info">
          <span class="chip-name">Yeni Yetki</span>
          <span class="chip-role">Ekle</span>
        </div>
      `;
      addButton.onclick = () => showNewPermissionForm();
      container.appendChild(addButton);

      // Mevcut yetkiler
      const colors = [
        '#ec4899, #f472b6',
        '#f59e0b, #fbbf24',
        '#6366f1, #818cf8',
        '#10b981, #34d399',
        '#ef4444, #f87171',
        '#8b5cf6, #a78bfa'
      ];

      allPermissions.forEach((permission, index) => {
        const chip = document.createElement('div');
        chip.className = 'employee-chip' + (selectedPermissionId === permission.id ? ' active' : '');
        chip.dataset.permissionId = permission.id;

        const initials = (permission.yetkiAdi || 'YT').substring(0, 2).toUpperCase();
        const color = colors[index % colors.length];

        chip.innerHTML = `
          <div class="chip-avatar" style="background: linear-gradient(135deg, ${color});">${initials}</div>
          <div class="chip-info">
            <span class="chip-name">${permission.yetkiAdi || 'İsimsiz Yetki'}</span>
            <span class="chip-role">ID: ${permission.id}</span>
          </div>
        `;
        chip.onclick = () => selectPermission(permission.id);
        container.appendChild(chip);
      });
    }

    // Yetki seç ve detayları göster
    function selectPermission(id) {
      selectedPermissionId = id;
      isNewPermission = false; // Mevcut yetki seçildiğinde yeni yetki modunu kapat
      const permission = allPermissions.find(p => p.id === id);

      if (!permission) return;

      // Geçici yeni yetki chip'ini kaldır
      document.querySelector('.new-permission-chip')?.remove();

      // Aktif chip'i güncelle
      document.querySelectorAll('.employee-chip').forEach(c => c.classList.remove('active'));
      const activeChip = document.querySelector(`.employee-chip[data-permission-id="${id}"]`);
      if (activeChip) activeChip.classList.add('active');

      // Başlığı güncelle
      document.getElementById('permissionTitle').textContent = (permission.yetkiAdi || 'Yetki') + ' - Yetki Ayarları';

      // Form alanlarını doldur
      fillPermissionForm(permission);

      // Parent-child checkbox ilişkisini güncelle
      setupParentChildCheckboxes();

      // Orijinal veriyi sakla (degisiklik takibi icin)
      originalPermissionData = JSON.parse(JSON.stringify(permission));

      // Degisiklik durumunu sifirla
      hasPermissionSettingsChanged = false;
      updateFloatingActionBox();

      // Buton gorunurlugunu guncelle
      updateButtonVisibility();
    }

    // Form alanlarını doldur
    function fillPermissionForm(permission) {
      // Yetki adı
      const nameInput = document.getElementById('permissionName');
      if (nameInput) nameInput.value = permission.yetkiAdi || '';

      // Checkbox'ları doldur
      const checkboxMapping = {
        'gorebilecegiPolicelerveKartlar': permission.gorebilecegiPolicelerveKartlar,
        'policeDuzenleyebilsin': permission.policeDuzenleyebilsin,
        'policeHavuzunuGorebilsin': permission.policeHavuzunuGorebilsin,
        'policeAktarabilsin': permission.policeAktarabilsin,
        'policeDosyalarinaErisebilsin': permission.policeDosyalarinaErisebilsin,
        'policeYakalamaSecenekleri': permission.policeYakalamaSecenekleri,
        'yetkilerSayfasindaIslemYapabilsin': permission.yetkilerSayfasindaIslemYapabilsin,
        'acenteliklerSayfasindaIslemYapabilsin': permission.acenteliklerSayfasindaIslemYapabilsin,
        'driveEntegrasyonuGorebilsin': permission.driveEntegrasyonuGorebilsin,
        'komisyonOranlariniDuzenleyebilsin': permission.komisyonOranlariniDuzenleyebilsin,
        'produktorleriGorebilsin': permission.produktorleriGorebilsin,
        'acenteliklereGorePoliceYakalansin': permission.acenteliklereGorePoliceYakalansin,
        // Ana menü yetkileri
        'musterileriGorebilsin': permission.musterileriGorebilsin,
        'finansSayfasiniGorebilsin': permission.finansSayfasiniGorebilsin,
        // Müşterilerimiz alt yetkileri
        'musteriListesiGorebilsin': permission.musteriListesiGorebilsin,
        'musteriDetayGorebilsin': permission.musteriDetayGorebilsin,
        'yenilemeTakibiGorebilsin': permission.yenilemeTakibiGorebilsin,
        // Finans alt yetkileri
        'finansDashboardGorebilsin': permission.finansDashboardGorebilsin,
        'policeOdemeleriGorebilsin': permission.policeOdemeleriGorebilsin,
        'tahsilatTakibiGorebilsin': permission.tahsilatTakibiGorebilsin,
        'finansRaporlariGorebilsin': permission.finansRaporlariGorebilsin,
        'kazanclarimGorebilsin': permission.kazanclarimGorebilsin
      };

      Object.entries(checkboxMapping).forEach(([name, value]) => {
        // PoliceYakalamaSecenekleri için özel handling (select dropdown)
        if (name === 'policeYakalamaSecenekleri') {
          const select = document.getElementById('policeYakalamaSelect');
          if (select) select.value = value || '0';
        } else {
          // Diğer checkboxlar
          const checkbox = document.querySelector(`input[name="${name}"]`);
          if (checkbox) checkbox.checked = value === '1';
        }
      });

      // Görme seviyesi select
      const viewLevelSelect = document.getElementById('viewLevelSelect');
      if (viewLevelSelect) viewLevelSelect.value = permission.gorebilecegiPolicelerveKartlar || '3';

      // Önizlemeyi güncelle
      updatePermissionPreview();
    }

    // Form verilerini topla
    function collectFormData() {
      const checkboxNames = [
        'policeDuzenleyebilsin',
        'policeHavuzunuGorebilsin',
        'policeAktarabilsin',
        'policeDosyalarinaErisebilsin',
        'policeYakalamaSecenekleri',
        'yetkilerSayfasindaIslemYapabilsin',
        'acenteliklerSayfasindaIslemYapabilsin',
        'driveEntegrasyonuGorebilsin',
        'komisyonOranlariniDuzenleyebilsin',
        'produktorleriGorebilsin',
        'acenteliklereGorePoliceYakalansin',
        // Ana menü yetkileri
        'musterileriGorebilsin',
        'finansSayfasiniGorebilsin',
        // Müşterilerimiz alt yetkileri
        'musteriListesiGorebilsin',
        'musteriDetayGorebilsin',
        'yenilemeTakibiGorebilsin',
        // Finans alt yetkileri
        'finansDashboardGorebilsin',
        'policeOdemeleriGorebilsin',
        'tahsilatTakibiGorebilsin',
        'finansRaporlariGorebilsin',
        'kazanclarimGorebilsin'
      ];

      const data = {
        yetkiAdi: document.getElementById('permissionName')?.value || '',
        gorebilecegiPolicelerveKartlar: document.getElementById('viewLevelSelect')?.value || '3'
      };

      checkboxNames.forEach(name => {
        // PoliceYakalamaSecenekleri için özel handling (select dropdown)
        if (name === 'policeYakalamaSecenekleri') {
          const select = document.getElementById('policeYakalamaSelect');
          data[name] = select?.value || '0';
        } else {
          // Diğer checkboxlar
          const checkbox = document.querySelector(`input[name="${name}"]`);
          data[name] = checkbox?.checked ? '1' : '0';
        }
      });

      return data;
    }

    // Yetki kaydet
    async function savePermission() {
      if (!selectedPermissionId) {
        showToast('Lütfen bir yetki seçin', 'warning');
        return;
      }

      try {
        showLoading(true);
        const data = collectFormData();

        await apiPut(`permissions/${selectedPermissionId}`, data);

        showToast('Yetki başarıyla güncellendi', 'success');
        await loadPermissions();
        selectPermission(selectedPermissionId);
      } catch (error) {
        showToast('Yetki güncellenirken hata oluştu: ' + error.message, 'error');
      } finally {
        showLoading(false);
      }
    }

    // Yeni yetki formu göster
    function showNewPermissionForm() {
      selectedPermissionId = null;
      isNewPermission = true; // Yeni yetki modunu aktifleştir
      hasPermissionSettingsChanged = false; // Değişiklik takibini sıfırla

      // Tüm chip'lerin aktifliğini kaldır
      document.querySelectorAll('.employee-chip').forEach(c => c.classList.remove('active'));

      // Mevcut geçici chip'i kaldır
      document.querySelector('.new-permission-chip')?.remove();

      // Yeni geçici chip oluştur
      const container = document.getElementById('permissionChips');
      const addButton = document.querySelector('.add-new-chip');

      const tempChip = document.createElement('div');
      tempChip.className = 'employee-chip new-permission-chip active';
      tempChip.innerHTML = `
        <div class="chip-avatar" style="background: linear-gradient(135deg, #10b981, #34d399);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
        <div class="chip-info">
          <span class="chip-name" id="newPermissionChipName">Yeni Yetki</span>
          <span class="chip-role">Oluşturuluyor...</span>
        </div>
      `;

      // Add button'dan sonra ekle
      if (addButton && addButton.nextSibling) {
        container.insertBefore(tempChip, addButton.nextSibling);
      } else {
        container.appendChild(tempChip);
      }

      // Başlığı güncelle
      document.getElementById('permissionTitle').textContent = 'Yeni Yetki Olustur';

      // Formu temizle
      document.getElementById('permissionName').value = '';
      document.getElementById('viewLevelSelect').value = '3';
      document.querySelectorAll('.permission-item input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.disabled = false; // Tüm checkbox'ları etkinleştir
      });

      // Parent-child ilişkisini yeniden kur
      setupParentChildCheckboxes();

      // Kaydet butonunu "Oluştur" olarak değiştir, Sil butonunu gizle
      document.getElementById('deletePermission').style.display = 'none';

      // Önizlemeyi güncelle (tüm yetkiler kapalı)
      updatePermissionPreview();
      // Floating box'u gizle (henüz değişiklik yok)
      updateFloatingActionBox();

      // İsim input'una focus ve canlı güncelleme listener'ı ekle
      setTimeout(() => {
        const nameInput = document.getElementById('permissionName');
        if (nameInput) {
          nameInput.focus();
          // Canlı güncelleme için listener ekle
          nameInput.oninput = function() {
            updateNewPermissionChip(this.value);
            onPermissionSettingsChange();
          };
        }
      }, 100);
    }

    // Yeni yetki chip'ini canlı güncelle
    function updateNewPermissionChip(name) {
      const chipName = document.getElementById('newPermissionChipName');
      const chip = document.querySelector('.new-permission-chip');

      if (chipName && chip) {
        const displayName = name.trim() || 'Yeni Yetki';
        chipName.textContent = displayName;

        // Avatar'daki harfleri güncelle
        const avatar = chip.querySelector('.chip-avatar');
        if (avatar && name.trim()) {
          const initials = name.trim().substring(0, 2).toUpperCase();
          avatar.innerHTML = initials;
          avatar.style.fontSize = '0.875rem';
          avatar.style.fontWeight = '600';
        } else if (avatar && !name.trim()) {
          avatar.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          `;
        }
      }
    }

    // Yeni yetki oluştur
    async function createPermission() {
      const user = APP_CONFIG.AUTH.getUser();
      const data = collectFormData();

      if (!data.yetkiAdi) {
        showToast('Lütfen yetki adı girin', 'warning');
        return;
      }

      try {
        showLoading(true);

        const createData = {
          ...data,
          firmaId: user?.firmaId || 1,
          ekleyenUyeId: user?.id || 1
        };

        const result = await apiPost('permissions', createData);

        showToast('Yetki başarıyla oluşturuldu', 'success');
        await loadPermissions();
        selectPermission(result.id);
      } catch (error) {
        showToast('Yetki oluşturulurken hata oluştu: ' + error.message, 'error');
      } finally {
        showLoading(false);
      }
    }

    // Yetki sil
    async function deletePermission() {
      if (!selectedPermissionId) {
        showToast('Lütfen bir yetki seçin', 'warning');
        return;
      }

      const confirmed = await showConfirmDialog({
        title: 'Yetkiyi Sil',
        message: 'Bu yetkiyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
        confirmText: 'Evet, Sil',
        cancelText: 'Vazgeç',
        variant: 'danger'
      });
      if (!confirmed) return;

      const deletedId = selectedPermissionId;

      try {
        showLoading(true);

        await apiDelete(`permissions/${deletedId}`);

        showToast('Yetki başarıyla silindi', 'success');

        // Silinen yetkiyi listeden kaldır
        selectedPermissionId = null;
        allPermissions = allPermissions.filter(p => p.id !== deletedId);

        // Değişiklik durumunu sıfırla
        hasPermissionSettingsChanged = false;
        pendingPermissionChanges = {};
        isNewPermission = false;
        updateFloatingActionBox();

        // Chip listesini yeniden render et
        renderPermissionList();

        // Silme sonrası ilk yetkiyi seç veya boş form göster
        if (allPermissions.length > 0) {
          // Direkt originalSelectPermission kullan (async wrapper'ı atla)
          originalSelectPermission(allPermissions[0].id);
          loadEmployeesWithPermission();
        } else {
          showNewPermissionForm();
          // Çalışan listesini temizle
          const container = document.getElementById('employeePermissionTable');
          if (container) {
            container.innerHTML = `
              <tr>
                <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                  Henüz bir yetki seçilmedi
                </td>
              </tr>
            `;
          }
        }
      } catch (error) {
        showToast('Yetki silinirken hata oluştu: ' + error.message, 'error');
      } finally {
        showLoading(false);
      }
    }

    // Sil butonu click handler
    document.getElementById('deletePermission').addEventListener('click', deletePermission);

    function selectAllPermissions() {
      document.querySelectorAll('.permission-item input[type="checkbox"]').forEach(cb => cb.checked = true);
      updatePermissionPreview();
    }

    function deselectAllPermissions() {
      document.querySelectorAll('.permission-item input[type="checkbox"]').forEach(cb => cb.checked = false);
      updatePermissionPreview();
    }

    // ==================== YETKİ ÖNİZLEME ====================

    // Yetki -> Menü/Dashboard eşleştirmesi
    // permission: null = herkes görebilir, permission: 'xxx' = yetkiye bağlı
    const PERMISSION_MAP = {
      // Navbar menü öğeleri - TÜM MENÜLER
      navbar: [
        // Ana Menü
        { permission: null, label: 'Dashboard', group: 'Ana Menü' },
        // Poliçe İşlemleri
        { permission: null, label: 'Poliçelerim', group: 'Poliçe İşlemleri' },
        { permission: 'policeYakalamaSecenekleri', label: 'Yakalanan Poliçeler', group: 'Poliçe İşlemleri' },
        { permission: 'policeHavuzunuGorebilsin', label: 'Poliçe Havuzu', group: 'Poliçe İşlemleri' },
        { permission: null, label: 'Manuel Poliçe Ekle', group: 'Poliçe İşlemleri' },
        { permission: 'policeAktarabilsin', label: 'Toplu Aktar', group: 'Poliçe İşlemleri' },
        // Yönetim - Çalışanlarım
        { permission: 'produktorleriGorebilsin', label: 'Çalışan Listesi', group: 'Çalışanlarım' },
        { permission: 'produktorleriGorebilsin', label: 'Performans', group: 'Çalışanlarım' },
        { permission: 'produktorleriGorebilsin', label: 'Takip/Hakediş', group: 'Çalışanlarım' },
        { permission: 'komisyonOranlariniDuzenleyebilsin', label: 'Komisyon Ayarları', group: 'Çalışanlarım' },
        // Yönetim - Müşterilerimiz (Alt yetkilerle)
        { permission: 'musteriListesiGorebilsin', label: 'Müşteri Listesi', group: 'Müşterilerimiz', parent: 'musterileriGorebilsin' },
        { permission: 'musteriDetayGorebilsin', label: 'Müşteri Detay', group: 'Müşterilerimiz', parent: 'musterileriGorebilsin' },
        { permission: 'yenilemeTakibiGorebilsin', label: 'Yenileme Takibi', group: 'Müşterilerimiz', parent: 'musterileriGorebilsin' },
        // Finans (Alt yetkilerle)
        { permission: 'finansDashboardGorebilsin', label: 'Finans Dashboard', group: 'Finans', parent: 'finansSayfasiniGorebilsin' },
        { permission: 'policeOdemeleriGorebilsin', label: 'Poliçe Bazlı', group: 'Finans', parent: 'finansSayfasiniGorebilsin' },
        { permission: 'tahsilatTakibiGorebilsin', label: 'Tahsilat Takibi', group: 'Finans', parent: 'finansSayfasiniGorebilsin' },
        { permission: 'finansRaporlariGorebilsin', label: 'Raporlar', group: 'Finans', parent: 'finansSayfasiniGorebilsin' },
        { permission: 'kazanclarimGorebilsin', label: 'Kazançlarım', group: 'Finans', parent: 'finansSayfasiniGorebilsin' },
        // Sistem - Ayarlar
        { permission: 'yetkilerSayfasindaIslemYapabilsin', label: 'Yetki Yönetimi', group: 'Ayarlar' },
        { permission: 'acenteliklerSayfasindaIslemYapabilsin', label: 'Acente Kodları', group: 'Ayarlar' },
        { permission: 'driveEntegrasyonuGorebilsin', label: 'Drive Entegrasyonu', group: 'Ayarlar' },
        { permission: null, label: 'Rapor Ayarları', group: 'Ayarlar' },
      ],
      // Dashboard kartları
      dashboard: [
        { permission: null, label: 'Toplam Poliçe', icon: '📋' },
        { permission: null, label: 'Toplam Prim', icon: '💵' },
        { permission: 'policeHavuzunuGorebilsin', label: 'Havuzdaki Poliçeler', icon: '📥' },
        { permission: 'policeYakalamaSecenekleri', label: 'Yakalanan Poliçeler', icon: '🎯' },
        { permission: 'produktorleriGorebilsin', label: 'Çalışan Performansı', icon: '👥' },
        { permission: 'komisyonOranlariniDuzenleyebilsin', label: 'Komisyon Özeti', icon: '💰' },
        { permission: 'yenilemeTakibiGorebilsin', label: 'Yenileme Bekleyen', icon: '🔄' },
        { permission: 'tahsilatTakibiGorebilsin', label: 'Tahsilat Durumu', icon: '💳' },
      ],
      // Sayfa erişimleri / İşlemler
      pages: [
        { permission: 'policeDuzenleyebilsin', label: 'Poliçe düzenleme/silme' },
        { permission: 'policeHavuzunuGorebilsin', label: 'Poliçe Havuzu sayfası' },
        { permission: 'policeYakalamaSecenekleri', label: 'Yakalanan Poliçeler sayfası' },
        { permission: 'policeAktarabilsin', label: 'Toplu poliçe aktarma' },
        { permission: 'policeDosyalarinaErisebilsin', label: 'Poliçe dosyalarını indirme' },
        { permission: 'produktorleriGorebilsin', label: 'Çalışanlarım menüsü' },
        // Müşterilerimiz alt yetkileri
        { permission: 'musteriListesiGorebilsin', label: 'Müşteri Listesi sayfası' },
        { permission: 'musteriDetayGorebilsin', label: 'Müşteri Detay sayfası' },
        { permission: 'yenilemeTakibiGorebilsin', label: 'Yenileme Takibi sayfası' },
        // Finans alt yetkileri
        { permission: 'finansDashboardGorebilsin', label: 'Finans Dashboard sayfası' },
        { permission: 'policeOdemeleriGorebilsin', label: 'Poliçe Bazlı Ödemeler sayfası' },
        { permission: 'tahsilatTakibiGorebilsin', label: 'Tahsilat Takibi sayfası' },
        { permission: 'finansRaporlariGorebilsin', label: 'Finans Raporları sayfası' },
        { permission: 'kazanclarimGorebilsin', label: 'Kazançlarım sayfası' },
        { permission: 'komisyonOranlariniDuzenleyebilsin', label: 'Komisyon oranları düzenleme' },
        { permission: 'yetkilerSayfasindaIslemYapabilsin', label: 'Yetki profilleri yönetimi' },
        { permission: 'acenteliklerSayfasindaIslemYapabilsin', label: 'Acente kodları yönetimi' },
        { permission: 'driveEntegrasyonuGorebilsin', label: 'Drive Entegrasyonu sayfası' },
        { permission: 'acenteliklereGorePoliceYakalansin', label: 'Otomatik poliçe atama' },
      ]
    };

    // Mevcut checkbox durumuna göre yetkiyi kontrol et
    // permission: null ise her zaman true döner (herkes görebilir)
    // parent varsa, parent de açık olmalı
    function isPermissionChecked(permissionName, parentPermission = null) {
      if (permissionName === null) return true; // Herkes görebilir
      const checkbox = document.querySelector(`input[name="${permissionName}"]`);
      const isChecked = checkbox ? checkbox.checked : false;

      // Parent varsa, parent de checked olmalı
      if (parentPermission) {
        const parentChecked = isPermissionChecked(parentPermission);
        return isChecked && parentChecked;
      }

      return isChecked;
    }

    // Parent-child checkbox ilişkisini yönet
    // Parent-child checkbox başlangıç durumlarını ayarla
    function setupParentChildCheckboxes() {
      // Child checkboxlar için parent kontrolü
      document.querySelectorAll('input[data-parent]').forEach(childCheckbox => {
        const parentName = childCheckbox.dataset.parent;
        const parentCheckbox = document.querySelector(`input[name="${parentName}"]`);

        // Parent kapalıysa child'ı disable et
        if (parentCheckbox && !parentCheckbox.checked) {
          childCheckbox.disabled = true;
          childCheckbox.checked = false;
        } else if (parentCheckbox && parentCheckbox.checked) {
          childCheckbox.disabled = false;
        }
      });
    }

    // Önizlemeyi güncelle - Modern Layout
    function updatePermissionPreview() {
      // Navbar Icon Map
      const navIcons = {
        'Dashboard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
        'Poliçelerim': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>',
        'Yakalanan Poliçeler': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
        'Poliçe Havuzu': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
        'Manuel Poliçe Ekle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
        'Toplu Aktar': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
        'Çalışan Listesi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
        'Performans': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
        'Takip/Hakediş': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        'Komisyon Ayarları': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
        'Müşteri Listesi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        'Müşteri Detay': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        'Yenileme Takibi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>',
        'Finans Dashboard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
        'Poliçe Bazlı': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
        'Tahsilat Takibi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
        'Raporlar': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        'Yetki Yönetimi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        'Acente Kodları': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>',
        'Drive Entegrasyonu': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
        'Rapor Ayarları': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4"/></svg>'
      };

      // Mini Sidebar Önizlemesi
      const navbarContainer = document.getElementById('previewNavbar');
      if (navbarContainer) {
        const groups = {};
        PERMISSION_MAP.navbar.forEach(item => {
          if (!groups[item.group]) groups[item.group] = [];
          groups[item.group].push(item);
        });

        let navbarHtml = '';
        Object.entries(groups).forEach(([groupName, items]) => {
          const allHidden = items.every(item => !isPermissionChecked(item.permission, item.parent));
          const groupClass = allHidden ? 'mini-nav-group hidden-group' : 'mini-nav-group';

          navbarHtml += `<div class="${groupClass}">
            <div class="mini-nav-group-title">${groupName}</div>`;
          items.forEach((item, idx) => {
            const isVisible = isPermissionChecked(item.permission, item.parent);
            const isActive = groupName === 'Ana Menü' && idx === 0;
            const lockedClass = isVisible ? '' : 'locked';
            const activeClass = isActive ? 'active' : '';
            const icon = navIcons[item.label] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
            navbarHtml += `<div class="mini-nav-item ${activeClass} ${lockedClass}">${icon} ${item.label}</div>`;
          });
          navbarHtml += '</div>';
        });
        navbarContainer.innerHTML = navbarHtml;
      }

      // Mini Dashboard Cards
      const dashboardContainer = document.getElementById('previewDashboard');
      if (dashboardContainer) {
        const prevStates = {};
        dashboardContainer.querySelectorAll('.mini-card').forEach(card => {
          const label = card.dataset.label;
          if (label) prevStates[label] = card.classList.contains('locked');
        });

        let dashboardHtml = '';
        const sampleValues = ['47', '186K TL', '12', '8', '24', '3.9K TL', '15', '42K TL'];
        PERMISSION_MAP.dashboard.forEach((item, idx) => {
          const isVisible = isPermissionChecked(item.permission);
          const wasLocked = prevStates[item.label];
          const isLocked = !isVisible;

          let animClass = '';
          if (wasLocked !== undefined) {
            if (wasLocked && !isLocked) animClass = 'unlocking';
            else if (!wasLocked && isLocked) animClass = 'locking';
          }

          const lockedClass = isLocked ? 'locked' : '';
          dashboardHtml += `<div class="mini-card ${lockedClass} ${animClass}" data-label="${item.label}">
            <div class="mini-card-icon">${item.icon}</div>
            <div class="mini-card-value">${sampleValues[idx] || '0'}</div>
            <div class="mini-card-label">${item.label}</div>
          </div>`;
        });
        dashboardContainer.innerHTML = dashboardHtml;

        // Animation cleanup
        setTimeout(() => {
          dashboardContainer.querySelectorAll('.unlocking, .locking').forEach(el => {
            el.classList.remove('unlocking', 'locking');
          });
        }, 400);
      }

      // Access Summary
      let accessibleCount = 0;
      const totalPages = PERMISSION_MAP.pages.length;
      PERMISSION_MAP.pages.forEach(item => {
        if (isPermissionChecked(item.permission)) accessibleCount++;
      });

      const accessCountEl = document.getElementById('accessCount');
      const accessBarEl = document.getElementById('accessBarFill');
      if (accessCountEl) accessCountEl.textContent = accessibleCount;
      if (accessBarEl) accessBarEl.style.width = `${(accessibleCount / totalPages) * 100}%`;

      // Page Access List
      const pagesContainer = document.getElementById('previewPages');
      if (pagesContainer) {
        let pagesHtml = '';
        PERMISSION_MAP.pages.forEach(item => {
          const isVisible = isPermissionChecked(item.permission);
          const statusClass = isVisible ? 'visible' : 'hidden';
          const statusText = isVisible ? 'ERİŞEBİLİR' : 'ERİŞEMEZ';
          pagesHtml += `<div class="preview-page ${statusClass}">
            <span>${item.label}</span>
            <span class="preview-page-status">${statusText}</span>
          </div>`;
        });
        pagesContainer.innerHTML = pagesHtml;
      }
    }

    // ==================== CALISAN YONETIMI ====================

    let allEmployees = [];

    // Calisanlari yukle
    async function loadEmployees() {
      try {
        const user = APP_CONFIG.AUTH.getUser();
        const firmaId = user?.firmaId;
        const params = firmaId ? { firmaId, limit: 500 } : { limit: 500 };
        allEmployees = await apiGet('kullanicilar', params);
      } catch (error) {
        console.error('Calisanlar yuklenirken hata:', error);
      }
    }

    // Bekleyen yetki degisiklikleri
    let pendingPermissionChanges = {};

    // Secili yetkiye sahip calisanlari goster (tablo formatinda)
    async function loadEmployeesWithPermission() {
      const tbody = document.getElementById('employeesTableBody');

      if (!selectedPermissionId) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Yetki seciniz...</td></tr>';
        return;
      }

      // Eger calisanlar yuklenmemisse yukle
      if (allEmployees.length === 0) {
        await loadEmployees();
      }

      // Bu yetkiye sahip calisanlari filtrele
      const employeesWithThisPermission = allEmployees.filter(emp => emp.muhasebeYetkiId === selectedPermissionId);

      if (employeesWithThisPermission.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Bu yetkiye sahip calisan bulunmuyor.</td></tr>';
        return;
      }

      // Yetki secenekleri HTML
      const permissionOptions = allPermissions.map(p =>
        `<option value="${p.id}">${p.yetkiAdi || 'Isimsiz Yetki'}</option>`
      ).join('');

      tbody.innerHTML = employeesWithThisPermission.map(emp => {
        const hasPendingChange = pendingPermissionChanges[emp.id];
        const selectClass = hasPendingChange ? 'permission-select changed' : 'permission-select';

        return `
        <tr data-employee-id="${emp.id}">
          <td>
            <div class="user-cell">
              <span class="user-name">${emp.adi || ''} ${emp.soyadi || ''}</span>
            </div>
          </td>
          <td>${emp.email || '-'}</td>
          <td>${emp.gsmNo || '-'}</td>
          <td>
            <select class="${selectClass}" onchange="onPermissionChange(${emp.id}, this.value, '${emp.adi || ''} ${emp.soyadi || ''}')">
              ${permissionOptions}
            </select>
          </td>
          <td>
            <button class="btn btn-sm btn-ghost btn-danger-text" onclick="removeEmployeePermission(${emp.id})" title="Yetkiyi kaldir">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Kaldir
            </button>
          </td>
        </tr>
      `}).join('');

      // Secili yetkileri ayarla
      employeesWithThisPermission.forEach(emp => {
        const select = document.querySelector(`tr[data-employee-id="${emp.id}"] .permission-select`);
        if (select) {
          // Eger bekleyen degisiklik varsa onu goster, yoksa mevcut yetkiyi
          select.value = pendingPermissionChanges[emp.id]?.newPermissionId || emp.muhasebeYetkiId;
        }
      });
    }

    // Yetki degisikligi olunca
    function onPermissionChange(employeeId, newPermissionId, employeeName) {
      newPermissionId = parseInt(newPermissionId);
      const employee = allEmployees.find(e => e.id === employeeId);

      if (!employee) return;

      // Eger ayni yetkiye geri donduyse, bekleyen degisikligi kaldir
      if (employee.muhasebeYetkiId === newPermissionId) {
        delete pendingPermissionChanges[employeeId];
      } else {
        // Yeni degisikligi kaydet
        const newPermission = allPermissions.find(p => p.id === newPermissionId);
        pendingPermissionChanges[employeeId] = {
          employeeId,
          employeeName,
          oldPermissionId: employee.muhasebeYetkiId,
          newPermissionId,
          newPermissionName: newPermission?.yetkiAdi || 'Isimsiz Yetki'
        };
      }

      // Select stilini guncelle
      const select = document.querySelector(`tr[data-employee-id="${employeeId}"] .permission-select`);
      if (select) {
        select.classList.toggle('changed', !!pendingPermissionChanges[employeeId]);
      }

      // Floating box'i guncelle
      updateFloatingActionBox();
    }

    // Floating action box'i guncelle
    function updateFloatingActionBox() {
      const floatingBox = document.getElementById('floatingActionBox');
      const employeeChangeCount = Object.keys(pendingPermissionChanges).length;
      const totalChanges = employeeChangeCount + (hasPermissionSettingsChanged ? 1 : 0);

      if (totalChanges > 0) {
        floatingBox.classList.add('active');
        document.getElementById('fabCount').textContent = totalChanges;

        // Degisiklik listesini olustur
        let changesList = '';

        // Yetki ayarlari degismisse
        if (hasPermissionSettingsChanged) {
          if (isNewPermission) {
            const newName = document.getElementById('permissionName')?.value || 'Yeni Yetki';
            changesList += `<strong>${newName}</strong> olusturulacak<br>`;
          } else {
            const permName = originalPermissionData?.yetkiAdi || 'Yetki';
            changesList += `<strong>${permName}</strong> ayarlari degisti<br>`;
          }
        }

        // Calisan yetki degisiklikleri
        if (employeeChangeCount > 0) {
          changesList += Object.values(pendingPermissionChanges)
            .map(c => `${c.employeeName} → ${c.newPermissionName}`)
            .join('<br>');
        }

        document.getElementById('fabChangesList').innerHTML = changesList;
      } else {
        floatingBox.classList.remove('active');
      }
    }

    // Tum degisiklikleri uygula
    async function applyAllChanges() {
      const employeeChanges = Object.values(pendingPermissionChanges);
      const hasEmployeeChanges = employeeChanges.length > 0;

      if (!hasPermissionSettingsChanged && !hasEmployeeChanges) return;

      // Onay mesaji olustur
      let confirmTitle = 'Değişiklikleri Kaydet';
      let confirmMsg = '';
      let variant = 'success';

      if (isNewPermission && hasPermissionSettingsChanged) {
        confirmTitle = 'Yeni Yetki Oluştur';
        confirmMsg = 'Yeni yetki profili oluşturulacak.';
      } else if (hasPermissionSettingsChanged && hasEmployeeChanges) {
        confirmMsg = `Yetki ayarları ve ${employeeChanges.length} çalışanın yetkisi değiştirilecek.`;
      } else if (hasPermissionSettingsChanged) {
        confirmMsg = 'Yetki ayarları kaydedilecek.';
      } else {
        confirmMsg = `${employeeChanges.length} çalışanın yetkisi değiştirilecek.`;
      }

      const confirmed = await showConfirmDialog({
        title: confirmTitle,
        message: confirmMsg,
        confirmText: 'Kaydet',
        cancelText: 'Vazgeç',
        variant: variant
      });
      if (!confirmed) return;

      try {
        showLoading(true);

        // Yeni yetki oluştur veya mevcut yetkiyi güncelle
        if (hasPermissionSettingsChanged) {
          if (isNewPermission) {
            // Yeni yetki oluştur
            await createPermission();
            isNewPermission = false;
          } else if (selectedPermissionId) {
            // Mevcut yetkiyi güncelle
            const data = collectFormData();
            await apiPut(`permissions/${selectedPermissionId}`, data);
          }
        }

        // Calisan yetki degisikliklerini kaydet
        for (const change of employeeChanges) {
          await apiPut(`kullanicilar/${change.employeeId}/permission`, { yetkiId: change.newPermissionId });
        }

        showToast('Degisiklikler basariyla kaydedildi', 'success');

        // Yetki cache'ini temizle - tum kullanicilar icin
        APP_CONFIG.PERMISSIONS.invalidate();

        // Kendi yetkimiz degisti mi kontrol et
        const currentUser = APP_CONFIG.AUTH.getUser();
        const myPermissionChanged = employeeChanges.some(c => c.employeeId === currentUser?.id);
        const myPermissionSettingsChanged = hasPermissionSettingsChanged &&
          currentUser?.permissions?.gorebilecegiPoliceler &&
          selectedPermissionId === (await apiGet('kullanicilar/' + currentUser.id))?.muhasebeYetkiId;

        // Temizle ve yenile
        pendingPermissionChanges = {};
        hasPermissionSettingsChanged = false;
        isNewPermission = false;
        updateFloatingActionBox();

        await loadPermissions();
        if (selectedPermissionId) {
          selectPermission(selectedPermissionId);
        }
        await loadEmployees();
        await loadEmployeesWithPermission();

        // Tüm async işlemler tamamlandıktan sonra floating box'ı kesinlikle kapat
        pendingPermissionChanges = {};
        hasPermissionSettingsChanged = false;
        isNewPermission = false;
        updateFloatingActionBox();

        // Kendi yetkimiz degistiyse sayfayi yenile
        if (myPermissionChanged || myPermissionSettingsChanged) {
          showToast('Yetkiniz degisti, sayfa yenileniyor...', 'info');
          setTimeout(() => location.reload(), 1500);
        }
      } catch (error) {
        showToast('Degisiklikler kaydedilirken hata olustu: ' + error.message, 'error');
      } finally {
        showLoading(false);
      }
    }

    // Tum degisiklikleri iptal et
    function cancelAllChanges() {
      if (Object.keys(pendingPermissionChanges).length === 0 && !hasPermissionSettingsChanged) return;

      // Yetki ayarlarini geri al
      if (isNewPermission) {
        // Yeni yetki modunda formu temizle
        document.getElementById('permissionName').value = '';
        document.querySelectorAll('.permission-item input[type="checkbox"]').forEach(cb => cb.checked = false);
      } else if (hasPermissionSettingsChanged && originalPermissionData) {
        fillPermissionForm(originalPermissionData);
      }

      // Calisan degisikliklerini temizle
      pendingPermissionChanges = {};
      hasPermissionSettingsChanged = false;
      isNewPermission = false;

      updateFloatingActionBox();
      loadEmployeesWithPermission();
      showToast('Degisiklikler iptal edildi', 'info');
    }

    // selectPermission fonksiyonunu guncelle - calisan listesini de yukle
    const originalSelectPermission = selectPermission;
    selectPermission = async function(id) {
      // Kaydedilmemis degisiklik varsa uyar
      const hasUnsavedChanges = Object.keys(pendingPermissionChanges).length > 0 || hasPermissionSettingsChanged;
      if (hasUnsavedChanges && id !== selectedPermissionId) {
        const confirmed = await showConfirmDialog({
          title: 'Kaydedilmemiş Değişiklikler',
          message: 'Kaydedilmemiş değişiklikler var. Değişiklikleri kaybetmek istediğinizden emin misiniz?',
          confirmText: 'Devam Et',
          cancelText: 'Geri Dön',
          variant: 'warning'
        });
        if (!confirmed) return;

        // Degisiklikleri temizle
        pendingPermissionChanges = {};
        hasPermissionSettingsChanged = false;
        isNewPermission = false;
        updateFloatingActionBox();
      }

      originalSelectPermission(id);
      loadEmployeesWithPermission();
    };

    // Calisan atama modalini goster
    async function showAssignEmployeeModal() {
      if (!selectedPermissionId) {
        showToast('Lutfen once bir yetki secin', 'warning');
        return;
      }
      document.getElementById('assignEmployeeModal').style.display = 'flex';
      await loadEmployeeDropdown();
    }

    // Calisan atama modalini kapat
    function closeAssignEmployeeModal() {
      document.getElementById('assignEmployeeModal').style.display = 'none';
    }

    // Calisan dropdown'u yukle
    async function loadEmployeeDropdown() {
      const select = document.getElementById('employeeSelect');
      select.innerHTML = '<option value="">Yukleniyor...</option>';

      try {
        // Eger calisanlar yuklenmemisse yukle
        if (allEmployees.length === 0) {
          await loadEmployees();
        }

        // Bu yetkiye sahip olmayan calisanlari filtrele
        const availableEmployees = allEmployees.filter(emp => emp.muhasebeYetkiId !== selectedPermissionId);

        select.innerHTML = '<option value="">-- Calisan Secin --</option>';

        availableEmployees.forEach(emp => {
          const option = document.createElement('option');
          option.value = emp.id;
          option.textContent = `${emp.adi || ''} ${emp.soyadi || ''} - ${emp.email || 'E-posta yok'}`;
          select.appendChild(option);
        });

        if (availableEmployees.length === 0) {
          select.innerHTML = '<option value="">Atanacak calisan bulunamadi</option>';
        }
      } catch (error) {
        select.innerHTML = '<option value="">Hata olustu</option>';
      }
    }

    // Secili calisana yetki ata
    async function assignSelectedEmployee() {
      const select = document.getElementById('employeeSelect');
      const employeeId = select.value;

      if (!employeeId) {
        showToast('Lutfen bir calisan secin', 'warning');
        return;
      }

      if (!selectedPermissionId) {
        showToast('Lutfen once bir yetki secin', 'warning');
        return;
      }

      try {
        showLoading(true);
        await apiPut(`kullanicilar/${employeeId}/permission`, { yetkiId: selectedPermissionId });

        showToast('Calisana yetki atandi', 'success');
        closeAssignEmployeeModal();

        // Calisan listesini yenile
        await loadEmployees();
        await loadEmployeesWithPermission();
      } catch (error) {
        showToast('Yetki atanirken hata olustu: ' + error.message, 'error');
      } finally {
        showLoading(false);
      }
    }

    // Calisanin yetkisini kaldir
    async function removeEmployeePermission(employeeId) {
      const confirmed = await showConfirmDialog({
        title: 'Yetkiyi Kaldır',
        message: 'Bu çalışanın yetkisini kaldırmak istediğinizden emin misiniz?',
        confirmText: 'Kaldır',
        cancelText: 'Vazgeç',
        variant: 'danger'
      });
      if (!confirmed) return;

      try {
        showLoading(true);
        await apiDelete(`kullanicilar/${employeeId}/permission`);

        showToast('Calisan yetkisi basariyla kaldirildi', 'success');

        // Calisan listesini yenile
        await loadEmployees();
        await loadEmployeesWithPermission();
      } catch (error) {
        showToast('Yetki kaldirilirken hata olustu: ' + error.message, 'error');
      } finally {
        showLoading(false);
      }
    }

    // Sayfa yuklendiginde calisanlari da yukle
    document.addEventListener('DOMContentLoaded', function() {
      loadEmployees();

      // Toplu Atama butonu
      const bulkBtn = document.getElementById('bulkAssignBtn');
      if (bulkBtn) {
        bulkBtn.addEventListener('click', openBulkAssignModal);
      }
    });

    // ==================== TOPLU ATAMA ====================

    let bulkSelectedEmployees = new Set();
    let bulkFilteredEmployees = [];

    function openBulkAssignModal() {
      bulkSelectedEmployees.clear();
      document.getElementById('bulkPermissionId').value = '';
      document.getElementById('bulkPermissionLabel').textContent = '-- Yetki Seçin --';
      document.getElementById('bulkEmployeeSearch').value = '';
      document.getElementById('bulkSelectAllCheckbox').checked = false;
      document.getElementById('bulkPermissionPanel').classList.remove('open');

      // Yetki dropdown listesini doldur
      renderBulkPermissionList();

      // Şube filtresini doldur
      populateBulkBranchFilter();

      // Çalışan listesini render et
      filterBulkEmployees();

      // Modalı göster (.active class ile - components.css opacity/visibility kullanıyor)
      document.getElementById('bulkAssignModal').classList.add('active');
    }

    function closeBulkAssignModal() {
      document.getElementById('bulkAssignModal').classList.remove('active');
      document.getElementById('bulkPermissionPanel')?.classList.remove('open');
      bulkSelectedEmployees.clear();
    }

    // Yetki dropdown
    function toggleBulkPermissionDropdown() {
      const panel = document.getElementById('bulkPermissionPanel');
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        document.getElementById('bulkPermissionSearch').value = '';
        renderBulkPermissionList();
        setTimeout(() => document.getElementById('bulkPermissionSearch').focus(), 50);
      }
    }

    function renderBulkPermissionList() {
      const container = document.getElementById('bulkPermissionList');
      const search = (document.getElementById('bulkPermissionSearch')?.value || '').toLowerCase();
      const selectedId = document.getElementById('bulkPermissionId').value;

      let filtered = allPermissions;
      if (search) {
        filtered = filtered.filter(p => (p.yetkiAdi || '').toLowerCase().includes(search));
      }

      if (filtered.length === 0) {
        container.innerHTML = '<div style="padding: 0.75rem; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">Yetki bulunamadı</div>';
        return;
      }

      container.innerHTML = filtered.map(p => `
        <div class="bulk-dropdown-item ${p.id == selectedId ? 'selected' : ''}" onclick="selectBulkPermission(${p.id}, '${(p.yetkiAdi || '').replace(/'/g, "\\'")}')">
          ${p.yetkiAdi || 'İsimsiz Yetki'}
        </div>
      `).join('');
    }

    function filterBulkPermissions() {
      renderBulkPermissionList();
    }

    function selectBulkPermission(id, name) {
      document.getElementById('bulkPermissionId').value = id;
      document.getElementById('bulkPermissionLabel').textContent = name;
      document.getElementById('bulkPermissionPanel').classList.remove('open');
    }

    // Dropdown dışına tıklayınca kapat
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#bulkPermissionDropdown')) {
        document.getElementById('bulkPermissionPanel')?.classList.remove('open');
      }
    });

    // Şube filtresi
    function populateBulkBranchFilter() {
      const select = document.getElementById('bulkBranchFilter');
      select.innerHTML = '<option value="">Tüm Şubeler</option>';

      // Çalışanlardan unique şube isimlerini çıkar
      const branchMap = new Map();
      allEmployees.forEach(emp => {
        if (emp.subeId && emp.subeAdi) {
          branchMap.set(emp.subeId, emp.subeAdi);
        }
      });

      branchMap.forEach((name, id) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = name;
        select.appendChild(opt);
      });
    }

    // Çalışan listesi filtrele ve render et
    function filterBulkEmployees() {
      const search = (document.getElementById('bulkEmployeeSearch')?.value || '').toLowerCase();
      const branchId = document.getElementById('bulkBranchFilter')?.value;

      bulkFilteredEmployees = allEmployees.filter(emp => {
        // Aktif olmayan çalışanları atla
        if (emp.aktif !== true && emp.aktif !== 1) return false;

        // Şube filtresi
        if (branchId && emp.subeId != branchId) return false;

        // Arama filtresi
        if (search) {
          const fullName = `${emp.adi || ''} ${emp.soyadi || ''}`.toLowerCase();
          const email = (emp.email || '').toLowerCase();
          return fullName.includes(search) || email.includes(search);
        }
        return true;
      });

      renderBulkEmployeeList();
      updateBulkSelectAllState();
    }

    function renderBulkEmployeeList() {
      const container = document.getElementById('bulkEmployeeList');

      if (bulkFilteredEmployees.length === 0) {
        container.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">Çalışan bulunamadı</div>';
        return;
      }

      const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

      container.innerHTML = bulkFilteredEmployees.map((emp, idx) => {
        const name = `${emp.adi || ''} ${emp.soyadi || ''}`.trim() || 'İsimsiz';
        const initials = ((emp.adi || '')[0] || '') + ((emp.soyadi || '')[0] || '');
        const isSelected = bulkSelectedEmployees.has(emp.id);
        const currentPerm = allPermissions.find(p => p.id === emp.muhasebeYetkiId);
        const currentPermName = currentPerm?.yetkiAdi || '-';
        const color = colors[idx % colors.length];
        const detail = [emp.email, emp.subeAdi].filter(Boolean).join(' · ');

        return `
          <div class="bulk-employee-item ${isSelected ? 'selected' : ''}" onclick="toggleBulkEmployee(${emp.id})">
            <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleBulkEmployee(${emp.id})">
            <div class="bulk-emp-avatar" style="background: ${color};">${initials.toUpperCase()}</div>
            <div class="bulk-emp-info">
              <div class="bulk-emp-name">${name}</div>
              <div class="bulk-emp-detail">${detail || '-'}</div>
            </div>
            <div class="bulk-emp-current-perm">${currentPermName}</div>
          </div>
        `;
      }).join('');
    }

    function toggleBulkEmployee(empId) {
      if (bulkSelectedEmployees.has(empId)) {
        bulkSelectedEmployees.delete(empId);
      } else {
        bulkSelectedEmployees.add(empId);
      }
      renderBulkEmployeeList();
      updateBulkSelectAllState();
    }

    function toggleBulkSelectAll() {
      const allIds = bulkFilteredEmployees.map(e => e.id);
      const allSelected = allIds.length > 0 && allIds.every(id => bulkSelectedEmployees.has(id));

      if (allSelected) {
        allIds.forEach(id => bulkSelectedEmployees.delete(id));
      } else {
        allIds.forEach(id => bulkSelectedEmployees.add(id));
      }

      renderBulkEmployeeList();
      updateBulkSelectAllState();
    }

    function updateBulkSelectAllState() {
      const checkbox = document.getElementById('bulkSelectAllCheckbox');
      const countEl = document.getElementById('bulkSelectCount');
      const allIds = bulkFilteredEmployees.map(e => e.id);
      const selectedInView = allIds.filter(id => bulkSelectedEmployees.has(id)).length;
      const allSelected = allIds.length > 0 && selectedInView === allIds.length;

      if (checkbox) checkbox.checked = allSelected;
      if (countEl) countEl.textContent = `${bulkSelectedEmployees.size} / ${bulkFilteredEmployees.length}`;
    }

    async function submitBulkAssign() {
      const permissionId = document.getElementById('bulkPermissionId').value;

      if (!permissionId) {
        showToast('Lütfen bir yetki seçin', 'warning');
        return;
      }

      if (bulkSelectedEmployees.size === 0) {
        showToast('Lütfen en az bir çalışan seçin', 'warning');
        return;
      }

      const permName = allPermissions.find(p => p.id == permissionId)?.yetkiAdi || 'Seçili Yetki';

      const confirmed = await showConfirmDialog({
        title: 'Toplu Yetki Atama',
        message: `${bulkSelectedEmployees.size} çalışana "${permName}" yetkisi atanacak. Devam etmek istiyor musunuz?`,
        confirmText: 'Ata',
        cancelText: 'Vazgeç',
        variant: 'success'
      });
      if (!confirmed) return;

      const btn = document.getElementById('bulkAssignSubmitBtn');
      btn.disabled = true;
      btn.innerHTML = '<span>Atanıyor...</span>';

      try {
        let successCount = 0;
        let failCount = 0;

        for (const empId of bulkSelectedEmployees) {
          try {
            await apiPut(`kullanicilar/${empId}/permission`, { yetkiId: parseInt(permissionId) });
            successCount++;
          } catch (e) {
            failCount++;
            console.error(`Çalışan ${empId} yetkisi atanamadı:`, e);
          }
        }

        if (failCount > 0) {
          showToast(`${successCount} çalışana yetki atandı, ${failCount} başarısız`, 'warning');
        } else {
          showToast(`${successCount} çalışana yetki başarıyla atandı`, 'success');
        }

        closeBulkAssignModal();

        // Yetki cache'ini temizle
        APP_CONFIG.PERMISSIONS.invalidate();

        // Verileri yenile
        await loadEmployees();
        if (selectedPermissionId) {
          await loadEmployeesWithPermission();
        }
      } catch (error) {
        showToast('Toplu atama sırasında hata oluştu: ' + error.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Yetkiyi Ata`;
      }
    }
