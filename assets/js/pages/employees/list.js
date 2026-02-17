    // Global değişkenler
    let yetkilerCache = null;
    let kullanicilarCache = [];
    let pendingPermissionChanges = {};
    // Sıralama durumu: null = sıralama yok (API sırası), değer varsa = aktif sıralama
    let currentSort = { field: null, direction: null };

    // Sayfa yüklendiğinde önce yetkileri sonra çalışanları getir
    document.addEventListener('DOMContentLoaded', async function() {
      requirePermission('produktorleriGorebilsin');
      await loadYetkiler(); // Önce yetkiler yüklensin
      await loadKullanicilar(); // Sonra çalışanlar

      // Dışarı tıklandığında dropdown'ları kapat
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-dropdown') && !e.target.closest('.dropdown-menu-floating')) {
          closeAllDropdowns();
        }
      });

      // Floating menu'daki tıklamaları dinle (event delegation)
      document.addEventListener('click', function(e) {
        const floatingMenu = e.target.closest('.dropdown-menu-floating');
        if (floatingMenu && e.target.classList.contains('dropdown-item')) {
          e.preventDefault();
          e.stopPropagation();

          const value = e.target.dataset.value || '';
          const text = e.target.textContent.trim();
          const dropdownId = floatingMenu.dataset.dropdownId;

          // Permission dropdown mu yoksa filtre dropdown mu?
          const sourceDropdown = dropdownId && document.getElementById(dropdownId);
          if (!sourceDropdown) {
            // ID yok — employee-id ile permission dropdown bul
            const empId = floatingMenu.dataset.employeeId;
            if (empId) {
              const permDropdown = document.querySelector(`.permission-dropdown[data-employee-id="${empId}"]`);
              if (permDropdown) {
                // Orijinal dropdown'daki ilgili item'ı bul ve selectPermission çağır
                const origItem = permDropdown.querySelector(`.dropdown-item[data-value="${value}"]`);
                if (origItem) selectPermission(origItem, value, text);
                else selectPermission(permDropdown.querySelector('.dropdown-item'), value, text);
              }
            }
          } else {
            selectDropdownItem(dropdownId, value, text);
          }
        }
      });

      // Scroll olduğunda dropdown'ları kapat
      window.addEventListener('scroll', function() {
        closeAllDropdowns();
      }, { passive: true });
    });

    // Custom Dropdown Fonksiyonları
    function toggleDropdown(dropdownId) {
      const dropdown = document.getElementById(dropdownId);
      const wasOpen = dropdown.classList.contains('open');

      // Diğer tüm dropdown'ları kapat
      closeAllDropdowns();

      // Bu dropdown'ı aç/kapat
      if (!wasOpen) {
        dropdown.classList.add('open');
        positionDropdownMenu(dropdown);
      }
    }

    function closeAllDropdowns() {
      document.querySelectorAll('.custom-dropdown.open').forEach(d => {
        d.classList.remove('open');
        // Orijinal menüyü tekrar göster
        const menu = d.querySelector('.dropdown-menu');
        if (menu) menu.style.display = '';
      });
      // Body'deki floating menu'ları kaldır
      document.querySelectorAll('.dropdown-menu-floating').forEach(m => m.remove());
    }

    function positionDropdownMenu(dropdown) {
      const toggle = dropdown.querySelector('.dropdown-toggle');
      const menu = dropdown.querySelector('.dropdown-menu');

      // Önceki floating menüleri temizle
      document.querySelectorAll('.dropdown-menu-floating').forEach(m => m.remove());

      // Menüyü klonla ve body'e ekle
      const floatingMenu = menu.cloneNode(true);
      floatingMenu.classList.add('dropdown-menu-floating');

      // Inline onclick handler'ları kaldır (event delegation ile çalışacak)
      floatingMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.removeAttribute('onclick');
      });

      // Orijinal menüyü gizle
      menu.style.display = 'none';

      // Toggle'ın pozisyonunu al
      const rect = toggle.getBoundingClientRect();

      // Dropdown ID'sini floating menu'ya ekle (hangi dropdown'a ait olduğunu bilmek için)
      floatingMenu.dataset.dropdownId = dropdown.id || '';
      // Permission dropdown ise employee ID'yi de ekle
      if (dropdown.dataset.employeeId) {
        floatingMenu.dataset.employeeId = dropdown.dataset.employeeId;
      }

      // Pozisyonlama
      floatingMenu.style.top = (rect.bottom + 4) + 'px';
      floatingMenu.style.left = rect.left + 'px';
      floatingMenu.style.width = Math.max(rect.width, 160) + 'px';

      document.body.appendChild(floatingMenu);

      // Ekranın dışına çıkıyorsa yukarı aç
      const menuRect = floatingMenu.getBoundingClientRect();
      if (menuRect.bottom > window.innerHeight - 10) {
        floatingMenu.style.top = (rect.top - menuRect.height - 4) + 'px';
      }
    }

    function selectDropdownItem(dropdownId, value, text) {
      const dropdown = document.getElementById(dropdownId);
      const hiddenInput = dropdown.querySelector('input[type="hidden"]');
      const toggleText = dropdown.querySelector('.dropdown-text');

      // Hidden input değerini güncelle
      hiddenInput.value = value;

      // Toggle text'i güncelle
      toggleText.textContent = text;

      // Selected class'ını güncelle
      dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.value === value);
      });

      // Dropdown'ı kapat
      closeAllDropdowns();

      // Filtreleri uygula
      applyFilters();
    }

    // Permission dropdown için toggle
    function togglePermissionDropdown(btn) {
      const dropdown = btn.closest('.custom-dropdown');
      const wasOpen = dropdown.classList.contains('open');

      // Diğer tüm dropdown'ları kapat
      closeAllDropdowns();

      // Bu dropdown'ı aç/kapat
      if (!wasOpen) {
        dropdown.classList.add('open');
        positionDropdownMenu(dropdown);
      }
    }

    // Permission seçildiğinde
    function selectPermission(item, value, text) {
      const dropdown = item.closest('.custom-dropdown');
      const employeeId = parseInt(dropdown.dataset.employeeId);
      const employeeName = dropdown.dataset.employeeName;
      const originalValue = dropdown.dataset.original;

      // Toggle text'i güncelle
      dropdown.querySelector('.dropdown-text').textContent = text;

      // Selected class'ını güncelle
      dropdown.querySelectorAll('.dropdown-item').forEach(i => {
        i.classList.toggle('selected', i.dataset.value == value);
      });

      // Dropdown'ı kapat
      dropdown.classList.remove('open');

      // Permission change işlemini yap
      const newValue = value ? parseInt(value) : null;
      onPermissionChange(employeeId, newValue, employeeName, dropdown);
    }

    // Kullanıcı bilgisinden FirmaId al
    function getCurrentFirmaId() {
      const user = APP_CONFIG.AUTH.getUser();
      return user?.firmaId || null;
    }

    // Yetkileri API'den yükle (filtre ve dropdown için)
    async function loadYetkiler() {
      const firmaId = getCurrentFirmaId();
      const dropdownMenu = document.getElementById('yetkiDropdownMenu');

      try {
        const yetkiler = await apiGet('permissions', firmaId ? { firmaId } : {});
        yetkilerCache = yetkiler; // Cache'e kaydet

        // Custom dropdown menu'ya yetkileri ekle
        yetkiler.forEach(y => {
          const item = document.createElement('div');
          item.className = 'dropdown-item';
          item.dataset.value = y.id;
          item.textContent = y.yetkiAdi;
          item.onclick = () => selectDropdownItem('yetkiDropdown', String(y.id), y.yetkiAdi);
          dropdownMenu.appendChild(item);
        });
      } catch (error) {
        console.error('Yetkiler yüklenirken hata:', error);
      }
    }

    // Kullanıcıları API'den yükle
    async function loadKullanicilar() {
      const tbody = document.getElementById('employeeTableBody');
      const firmaId = getCurrentFirmaId();

      if (!firmaId) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Firma bilgisi bulunamadı. Lütfen giriş yapın.</td></tr>';
        return;
      }

      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Yükleniyor...</td></tr>';

      try {
        const kullanicilar = await apiGet('kullanicilar', { firmaId: firmaId });
        kullanicilarCache = kullanicilar; // Cache'e kaydet (API sırasını korur)
        updateStats(kullanicilar);
        applyFilters();
      } catch (error) {
        console.error('Kullanıcılar yüklenirken hata:', error);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Veriler yüklenirken hata oluştu.</td></tr>';
      }
    }

    // Kullanıcıları tabloya render et
    function renderKullanicilar(kullanicilar) {
      const tbody = document.getElementById('employeeTableBody');
      const countEl = document.querySelector('.card-actions .text-muted');

      if (!kullanicilar || kullanicilar.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Henüz çalışan bulunmuyor.</td></tr>';
        if (countEl) countEl.textContent = '0 çalışan listeleniyor';
        return;
      }

      if (countEl) countEl.textContent = `${kullanicilar.length} çalışan listeleniyor`;

      // Yetki dropdown seçeneklerini oluştur
      const yetkiDropdownItems = yetkilerCache ? yetkilerCache.map(y =>
        `<div class="dropdown-item" data-value="${y.id}" onclick="selectPermission(this, ${y.id}, '${y.yetkiAdi.replace(/'/g, "\\'")}')">${y.yetkiAdi}</div>`
      ).join('') : '';

      tbody.innerHTML = kullanicilar.map(k => {
        const isActive = k.onay === 1;
        const initials = getInitials(k.adi, k.soyadi);
        const avatarColor = getAvatarColor(k.id);
        const durumBadge = isActive
          ? '<span class="badge badge-success">Aktif</span>'
          : '<span class="badge badge-secondary">Pasif</span>';
        const kayitTarihi = formatDate(k.kayitTarihi);
        const telefon = formatPhone(k.gsmNo);
        const rowClass = isActive ? '' : 'row-inactive';
        const avatarStyle = isActive
          ? `avatar avatar-md ${avatarColor}`
          : 'avatar avatar-md" style="background: var(--bg-elevated); color: var(--text-muted);';

        // Ana yönetici için dropdown gösterme
        const isAnaYonetici = k.anaYoneticimi === 0;
        const currentYetkiName = k.yetkiAdi || 'Yetki Seçiniz';
        const employeeName = `${(k.adi || '').replace(/'/g, "\\'")} ${(k.soyadi || '').replace(/'/g, "\\'")}`;

        const yetkiCell = isAnaYonetici
          ? '<span class="badge badge-danger">Ana Yönetici</span>'
          : (isActive
            ? `<div class="custom-dropdown permission-dropdown" data-employee-id="${k.id}" data-employee-name="${employeeName}" data-original="${k.muhasebeYetkiId || ''}">
                <button type="button" class="dropdown-toggle" onclick="togglePermissionDropdown(this)">
                  <span class="dropdown-text">${currentYetkiName}</span>
                </button>
                <div class="dropdown-menu">
                  <div class="dropdown-item ${!k.muhasebeYetkiId ? 'selected' : ''}" data-value="" onclick="selectPermission(this, '', 'Yetki Seçiniz')">Yetki Seçiniz</div>
                  ${yetkiDropdownItems.replace(new RegExp(`data-value="${k.muhasebeYetkiId}"`, 'g'), `data-value="${k.muhasebeYetkiId}" class="dropdown-item selected"`)}
                </div>
              </div>`
            : '<span class="badge badge-secondary">-</span>');

        return `
          <tr class="${rowClass}" data-employee-id="${k.id}">
            <td>
              <div class="flex items-center gap-3">
                <div class="${avatarStyle}">${initials}</div>
                <div>
                  <a href="details.html?id=${k.id}" class="font-semibold ${isActive ? '' : 'text-muted'}" style="text-decoration:none;color:inherit;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='inherit'">${k.adi || ''} ${k.soyadi || ''}</a>
                  <div class="text-muted text-sm">${getRolText(k.anaYoneticimi, k.yetkiAdi)}</div>
                </div>
              </div>
            </td>
            <td class="${isActive ? '' : 'text-muted'}">${k.email || '-'}</td>
            <td class="font-mono ${isActive ? '' : 'text-muted'}">${telefon}</td>
            <td>${yetkiCell}</td>
            <td>${durumBadge}</td>
            <td class="font-semibold font-mono ${isActive ? '' : 'text-muted'}">${k.policeSayisi || 0}</td>
            <td class="text-muted">${kayitTarihi}</td>
            <td>
              <div class="action-buttons">
                ${isActive ? `
                  <button class="btn-icon" title="Karta Git" onclick="goToEmployeeCard(${k.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </button>
                ` : `
                  <button class="btn-icon" title="Aktif Yap" onclick="activateKullanici(${k.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');

    }


    // İstatistikleri güncelle
    function updateStats(kullanicilar) {
      const total = kullanicilar.length;
      const active = kullanicilar.filter(k => k.onay === 1).length;
      const inactive = total - active;

      document.getElementById('statTotal').textContent = total;
      document.getElementById('statActive').textContent = active;
      document.getElementById('statInactive').textContent = inactive;
    }

    // Filtreleri uygula
    function applyFilters() {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
      const durumFilter = document.getElementById('durumFilter').value;
      const yetkiFilter = document.getElementById('yetkiFilter').value;

      // Filtreleme işlemi
      let filtered = kullanicilarCache.filter(k => {
        // Arama filtresi
        if (searchTerm) {
          const fullName = `${k.adi || ''} ${k.soyadi || ''}`.toLowerCase();
          const email = (k.email || '').toLowerCase();
          const phone = (k.gsmNo || '').toLowerCase();
          if (!fullName.includes(searchTerm) && !email.includes(searchTerm) && !phone.includes(searchTerm)) {
            return false;
          }
        }

        // Durum filtresi
        if (durumFilter) {
          const isActive = k.onay === 1 && !k.isEski;
          if (durumFilter === 'active' && !isActive) return false;
          if (durumFilter === 'inactive' && isActive) return false;
        }

        // Yetki filtresi
        if (yetkiFilter) {
          if (yetkiFilter === 'ana-yonetici') {
            if (k.anaYoneticimi !== 0) return false;
          } else {
            if (k.muhasebeYetkiId !== parseInt(yetkiFilter)) return false;
          }
        }

        return true;
      });

      // Sıralamayı uygula (sadece aktif sort varsa)
      if (currentSort.field && currentSort.direction) {
        filtered = sortData(filtered, currentSort.field, currentSort.direction);
      }
      // else: API sırasını koru (zaten kayıt tarihine göre desc)

      // Tabloyu güncelle
      renderKullanicilar(filtered);

      // Sayacı güncelle
      const countEl = document.querySelector('.card-actions .text-muted');
      if (countEl) {
        const totalCount = kullanicilarCache.length;
        if (filtered.length === totalCount) {
          countEl.textContent = `${totalCount} çalışan listeleniyor`;
        } else {
          countEl.textContent = `${filtered.length} / ${totalCount} çalışan gösteriliyor`;
        }
      }
    }

    // Sıralama değerini al
    function getSortValue(item, field) {
      switch (field) {
        case 'name':
          return `${item.adi || ''} ${item.soyadi || ''}`.toLocaleLowerCase('tr').trim();
        case 'email':
          return (item.email || '').toLocaleLowerCase('tr');
        case 'yetki':
          if (item.anaYoneticimi === 0) return '00-ana yönetici';
          if (!item.yetkiAdi) return '99-tanımsız';
          return `10-${item.yetkiAdi}`.toLocaleLowerCase('tr');
        case 'durum':
          return (item.onay === 1 && !item.isEski) ? 0 : 1;
        case 'police':
          return Number(item.policeSayisi) || 0;
        case 'tarih':
          console.log('[SORT DEBUG] kayitTarihi:', item.kayitTarihi, '| tipi:', typeof item.kayitTarihi);
          if (!item.kayitTarihi) {
            console.log('[SORT DEBUG] → null döndürülüyor (boş değer)');
            return null;
          }
          const timestamp = new Date(item.kayitTarihi).getTime();
          console.log('[SORT DEBUG] → timestamp:', timestamp, '| isNaN:', isNaN(timestamp));
          return isNaN(timestamp) ? null : timestamp;
        default:
          return '';
      }
    }

    // Veri sıralama fonksiyonu
    function sortData(data, field, direction) {
      console.log('[SORT DEBUG] ===== SIRALAMA BAŞLIYOR =====');
      console.log('[SORT DEBUG] field:', field, '| direction:', direction, '| kayıt sayısı:', data.length);

      if (!field || !direction) return data;

      const sorted = [...data].sort((a, b) => {
        const valueA = getSortValue(a, field);
        const valueB = getSortValue(b, field);

        // Tarih sıralamasında null değerleri her zaman sona at
        if (field === 'tarih') {
          const aIsNull = valueA === null;
          const bIsNull = valueB === null;

          // Null değerler her zaman sona gider
          if (aIsNull && bIsNull) return 0;
          if (aIsNull) return 1;
          if (bIsNull) return -1;

          // Her iki değer de geçerli tarih - doğrudan karşılaştır
          const comparison = valueA - valueB;
          return direction === 'desc' ? -comparison : comparison;
        }

        let comparison = 0;
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          comparison = valueA - valueB;
        } else {
          comparison = String(valueA).localeCompare(String(valueB), 'tr');
        }

        return direction === 'desc' ? -comparison : comparison;
      });

      // Debug: sıralanmış sonuçları göster
      console.log('[SORT DEBUG] ===== SIRALAMA SONUCU =====');
      sorted.slice(0, 10).forEach((item, idx) => {
        console.log(`[SORT DEBUG] ${idx + 1}. kayitTarihi: ${item.kayitTarihi || '(boş)'}`);
      });
      if (sorted.length > 10) console.log('[SORT DEBUG] ... ve ' + (sorted.length - 10) + ' kayıt daha');

      return sorted;
    }

    // Tablo sıralama fonksiyonu (3 aşamalı: asc → desc → kapalı)
    function sortTable(field) {
      // Tüm header'lardan class'ları kaldır
      document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
      });

      // Sıralama durumunu belirle
      if (currentSort.field === field) {
        // Aynı sütuna tıklandı - döngü: asc → desc → null
        if (currentSort.direction === 'asc') {
          currentSort.direction = 'desc';
        } else if (currentSort.direction === 'desc') {
          // 3. tık: sıralamayı kapat
          currentSort.field = null;
          currentSort.direction = null;
        } else {
          // null'dan asc'ye
          currentSort.direction = 'asc';
        }
      } else {
        // Farklı sütuna tıklandı - asc ile başla
        currentSort.field = field;
        currentSort.direction = 'asc';
      }

      // Aktif sort varsa header'ı işaretle
      if (currentSort.field && currentSort.direction) {
        const activeHeader = document.querySelector(`th.sortable[data-sort="${currentSort.field}"]`);
        if (activeHeader) {
          activeHeader.classList.add(currentSort.direction);
        }
      }

      // Tabloyu güncelle
      applyFilters();
    }

    // Yardımcı fonksiyonlar
    function getInitials(adi, soyadi) {
      const a = (adi || '').charAt(0).toUpperCase();
      const s = (soyadi || '').charAt(0).toUpperCase();
      return a + s || '??';
    }

    function getAvatarColor(id) {
      const colors = ['avatar-emerald', 'avatar-cyan', 'avatar-violet', 'avatar-amber', 'avatar-rose'];
      return colors[id % colors.length];
    }

    function getRolBadge(anaYoneticimi, yetkiAdi) {
      // AnaYoneticimi = 0 ise Ana Yönetici
      if (anaYoneticimi === 0) {
        return '<span class="badge badge-danger">Ana Yönetici</span>';
      }
      // Yetki adı varsa onu göster
      if (yetkiAdi) {
        return `<span class="badge badge-info">${yetkiAdi}</span>`;
      }
      return '<span class="badge badge-secondary">Tanımsız</span>';
    }

    function getRolText(anaYoneticimi, yetkiAdi) {
      if (anaYoneticimi === 0) return 'Ana Yönetici';
      return yetkiAdi || 'Çalışan';
    }

    function formatDate(dateStr) {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      return date.toLocaleDateString('tr-TR');
    }

    function formatPhone(phone) {
      if (!phone) return '-';
      return phone.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
    }

    // Yetki değişiklik takip sistemi

    // Yetki değişikliği olduğunda
    function onPermissionChange(employeeId, newPermissionId, employeeName, dropdown) {
      newPermissionId = newPermissionId ? parseInt(newPermissionId) : null;
      const employee = kullanicilarCache.find(k => k.id === employeeId);

      if (!employee) return;

      const originalPermissionId = employee.muhasebeYetkiId || null;

      // Eğer aynı yetkiye geri döndüyse, bekleyen değişikliği kaldır
      if (originalPermissionId === newPermissionId) {
        delete pendingPermissionChanges[employeeId];
      } else {
        // Yeni değişikliği kaydet
        const newPermission = yetkilerCache ? yetkilerCache.find(y => y.id === newPermissionId) : null;
        pendingPermissionChanges[employeeId] = {
          employeeId,
          employeeName,
          oldPermissionId: originalPermissionId,
          newPermissionId,
          newPermissionName: newPermission?.yetkiAdi || 'Yetki Seçilmedi'
        };
      }

      // Dropdown stilini güncelle
      if (dropdown) {
        dropdown.classList.toggle('changed', !!pendingPermissionChanges[employeeId]);
      }

      // Floating box'ı güncelle
      updateFloatingActionBox();
    }

    // Floating action box'ı güncelle
    function updateFloatingActionBox() {
      const floatingBox = document.getElementById('floatingActionBox');
      const changeCount = Object.keys(pendingPermissionChanges).length;

      if (changeCount > 0) {
        floatingBox.classList.add('active');
        document.getElementById('fabCount').textContent = changeCount;

        // Değişiklik listesini oluştur
        const changesList = Object.values(pendingPermissionChanges)
          .map(c => `${c.employeeName} → ${c.newPermissionName}`)
          .join('<br>');

        document.getElementById('fabChangesList').innerHTML = changesList;
      } else {
        floatingBox.classList.remove('active');
      }
    }

    // Tüm değişiklikleri uygula
    async function applyAllChanges() {
      const changes = Object.values(pendingPermissionChanges);

      if (changes.length === 0) return;

      if (!confirm(`${changes.length} çalışanın yetkisi değiştirilecek. Onaylıyor musunuz?`)) return;

      try {
        // Her değişiklik için API çağrısı yap
        for (const change of changes) {
          if (change.newPermissionId) {
            await apiPut(`kullanicilar/${change.employeeId}/permission`, {
              yetkiId: change.newPermissionId
            });
          }
        }

        // Başarılı mesajı göster
        showToast(`${changes.length} çalışanın yetkisi başarıyla güncellendi`, 'success');

        // Temizle ve yenile
        pendingPermissionChanges = {};
        updateFloatingActionBox();

        // Verileri yeniden yükle
        await loadKullanicilar();
      } catch (error) {
        console.error('Permission update error:', error);
        showToast('Yetkiler güncellenirken hata oluştu: ' + error.message, 'error');
      }
    }

    // Tüm değişiklikleri iptal et
    function cancelAllChanges() {
      if (Object.keys(pendingPermissionChanges).length === 0) return;

      // Dropdown'ları orijinal değerlerine döndür
      Object.keys(pendingPermissionChanges).forEach(employeeId => {
        const dropdown = document.querySelector(`.permission-dropdown[data-employee-id="${employeeId}"]`);
        if (dropdown) {
          const originalValue = dropdown.dataset.original || '';
          const employee = kullanicilarCache.find(k => k.id == employeeId);
          const originalYetkiAdi = employee?.yetkiAdi || 'Yetki Seçiniz';

          // Text'i güncelle
          dropdown.querySelector('.dropdown-text').textContent = originalYetkiAdi;

          // Selected class'ı güncelle
          dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.value == originalValue);
          });

          dropdown.classList.remove('changed');
        }
      });

      pendingPermissionChanges = {};
      updateFloatingActionBox();
      showToast('Değişiklikler iptal edildi', 'info');
    }

    // Çalışan kartına git
    function goToEmployeeCard(id) {
      window.location.href = `details.html?id=${id}`;
    }

    function activateKullanici(id) {
      console.log('Aktif yap:', id);
      // TODO: Kullanıcıyı aktif yap
    }

    function openAddEmployeeModal() {
      document.getElementById('addEmployeeModal').style.display = 'flex';
    }

    function closeAddEmployeeModal() {
      document.getElementById('addEmployeeModal').style.display = 'none';
    }