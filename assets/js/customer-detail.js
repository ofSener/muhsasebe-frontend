/**
 * Customer Detail Page - API Integration
 * Müşteri detay sayfası için dinamik veri yükleme
 */

(function() {
  'use strict';

  // State
  let customerId = null;
  let customerData = null;

  /**
   * URL'den müşteri ID'sini al
   */
  function getCustomerIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
  }

  /**
   * Para formatı
   */
  function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '₺0';
    return '₺' + Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  /**
   * Tarih formatı
   */
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /**
   * İsimden baş harfleri al
   */
  function getInitials(name) {
    if (!name) return 'XX';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  /**
   * Poliçe tipi badge class'ı
   */
  function getPolicyTypeClass(brans) {
    const typeMap = {
      'Kasko': 'kasko',
      'Trafik': 'trafik',
      'DASK': 'dask',
      'Sağlık': 'saglik',
      'Konut': 'konut',
      'İşyeri': 'isyeri',
      'Ferdi Kaza': 'ferdi-kaza',
      'Seyahat': 'seyahat'
    };
    return typeMap[brans] || 'diger';
  }

  /**
   * Durum badge'i oluştur
   */
  function getStatusBadge(status) {
    const statusMap = {
      'Aktif': { class: 'badge-success', text: 'Aktif' },
      'Süresi Dolmuş': { class: 'badge-secondary', text: 'Süresi Dolmuş' },
      'İptal Edilmiş': { class: 'badge-danger', text: 'İptal Edilmiş' },
      'Yenileme Bekliyor': { class: 'badge-warning', text: 'Yenileme Bekliyor' }
    };
    const badge = statusMap[status] || { class: 'badge-secondary', text: status || 'Bilinmiyor' };
    return `<span class="badge ${badge.class}">${badge.text}</span>`;
  }

  /**
   * Müşteri verilerini API'den yükle
   */
  async function loadCustomerData() {
    if (!customerId) {
      showError('Müşteri ID bulunamadı');
      return;
    }

    showLoading(true);

    try {
      // Müşteri bilgilerini al
      const customer = await apiGet(`customers/${customerId}`);
      customerData = customer;
      updateCustomerUI(customer);

      // Müşterinin poliçelerini al
      try {
        const policies = await apiGet(`customers/${customerId}/policies`);
        updatePoliciesTable(policies);
      } catch (policyError) {
        console.warn('Poliçe verileri yüklenemedi:', policyError);
        // Poliçe yüklenemezse alternatif endpoint dene
        try {
          const allPolicies = await apiGet(`policies`, { musteriId: customerId });
          updatePoliciesTable(allPolicies);
        } catch (e) {
          console.warn('Alternatif poliçe endpoint de başarısız:', e);
        }
      }

    } catch (error) {
      console.error('Müşteri verileri yüklenemedi:', error);
      showError('Müşteri verileri yüklenirken bir hata oluştu');
    } finally {
      showLoading(false);
    }
  }

  /**
   * Müşteri bilgilerini UI'a yansıt
   */
  function updateCustomerUI(customer) {
    if (!customer) return;

    const name = customer.adSoyad || customer.musteriAdi || customer.name || 'İsimsiz Müşteri';
    const initials = getInitials(name);
    const tcNo = customer.tcKimlikNo || customer.tcNo || '-';
    const phone = customer.telefon || customer.phone || '-';
    const email = customer.email || '-';
    const address = customer.adres || customer.address || '-';
    const birthDate = formatDate(customer.dogumTarihi || customer.birthDate);
    const registerDate = formatDate(customer.kayitTarihi || customer.createdAt);
    const customerType = customer.musteriTipi || customer.type || 'Bireysel';
    const totalPolicies = customer.policeSayisi || customer.totalPolicies || 0;
    const totalPremium = customer.toplamPrim || customer.totalPremium || 0;

    // Sayfa başlığı
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = name;

    const pageSubtitle = document.querySelector('.page-subtitle');
    if (pageSubtitle) pageSubtitle.textContent = `${customerType} Müşteri • Kayıt: ${registerDate}`;

    // Avatar ve isim
    const avatar = document.querySelector('.customer-profile-header .avatar');
    if (avatar) avatar.textContent = initials;

    const customerName = document.querySelector('.customer-name');
    if (customerName) customerName.textContent = name;

    // Badges
    const badgesContainer = document.querySelector('.customer-badges');
    if (badgesContainer) {
      badgesContainer.innerHTML = `
        <span class="badge badge-success">Aktif Müşteri</span>
        ${customer.vipMusteri ? '<span class="badge badge-violet">VIP</span>' : ''}
        <span class="badge badge-amber">${totalPolicies} Poliçe</span>
      `;
    }

    // Müşteri meta
    const customerMeta = document.querySelector('.customer-meta');
    if (customerMeta) {
      customerMeta.innerHTML = `
        Toplam Prim: <strong class="text-emerald">${formatCurrency(totalPremium)}</strong> •
        Son İşlem: ${customer.sonIslemTarihi ? formatDate(customer.sonIslemTarihi) : '-'}
      `;
    }

    // Info grid
    updateInfoField('tcKimlikNo', tcNo);
    updateInfoField('dogumTarihi', birthDate);
    updateInfoField('telefon', phone);
    updateInfoField('email', email);
    updateInfoField('adres', address);

    // Quick stats
    updateStatCard('aktivPoliçeler', totalPolicies);
    updateStatCard('toplamPrim', formatCurrency(totalPremium));

    // Yaklaşan yenileme
    if (customer.yaklasanYenileme) {
      updateStatCard('yaklasanYenileme', `${customer.yaklasanYenileme} Gün`);
    }

    // Müşteri skoru
    if (customer.musteriSkoru) {
      updateStatCard('musteriSkoru', `${customer.musteriSkoru}/100`);
    }
  }

  /**
   * Info field güncelle
   */
  function updateInfoField(fieldName, value) {
    // data-field attribute ile bul
    const field = document.querySelector(`[data-field="${fieldName}"]`);
    if (field) {
      field.textContent = value;
      return;
    }

    // Label text'i ile bul
    const labels = document.querySelectorAll('.info-label');
    labels.forEach(label => {
      const fieldNameLower = fieldName.toLowerCase();
      const labelText = label.textContent.toLowerCase();

      if (labelText.includes('tc') && fieldNameLower.includes('tc')) {
        const valueEl = label.nextElementSibling;
        if (valueEl) valueEl.textContent = value;
      } else if (labelText.includes('doğum') && fieldNameLower.includes('dogum')) {
        const valueEl = label.nextElementSibling;
        if (valueEl) valueEl.textContent = value;
      } else if (labelText.includes('telefon') && fieldNameLower === 'telefon') {
        const valueEl = label.nextElementSibling;
        if (valueEl) valueEl.textContent = value;
      } else if (labelText.includes('posta') && fieldNameLower === 'email') {
        const valueEl = label.nextElementSibling;
        if (valueEl) valueEl.textContent = value;
      } else if (labelText.includes('adres') && fieldNameLower === 'adres') {
        const valueEl = label.nextElementSibling;
        if (valueEl) valueEl.textContent = value;
      }
    });
  }

  /**
   * Stat card güncelle
   */
  function updateStatCard(type, value) {
    const statLabels = {
      'aktivPoliçeler': 'Aktif Poliçeler',
      'toplamPrim': 'Toplam Prim',
      'yaklasanYenileme': 'Yaklaşan Yenileme',
      'musteriSkoru': 'Müşteri Skoru'
    };

    const label = statLabels[type];
    if (!label) return;

    const statMinis = document.querySelectorAll('.stat-mini');
    statMinis.forEach(stat => {
      const labelEl = stat.querySelector('.stat-mini-label');
      if (labelEl && labelEl.textContent.includes(label.split(' ')[0])) {
        const valueEl = stat.querySelector('.stat-mini-value');
        if (valueEl) valueEl.textContent = value;
      }
    });
  }

  /**
   * Poliçe tablosunu güncelle
   */
  function updatePoliciesTable(policies) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // Eğer policies bir obje ise ve içinde array varsa
    const policyList = Array.isArray(policies) ? policies : (policies.policies || policies.data || []);

    if (policyList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted" style="padding: 2rem;">
            Bu müşteriye ait poliçe bulunamadı
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = policyList.map(policy => {
      const policeNo = policy.policeNo || policy.policeNumarasi || '-';
      const brans = policy.bransAdi || policy.brans || policy.tip || '-';
      const baslangic = formatDate(policy.baslangicTarihi || policy.startDate);
      const bitis = formatDate(policy.bitisTarihi || policy.endDate);
      const prim = formatCurrency(policy.brutPrim || policy.prim || policy.premium || 0);
      const durum = policy.durum || policy.status || 'Aktif';
      const typeClass = getPolicyTypeClass(brans);

      return `
        <tr data-policy-id="${policy.id || policy.policeId}">
          <td><span class="font-mono font-semibold">#${policeNo}</span></td>
          <td><span class="policy-type-badge ${typeClass}">${brans}</span></td>
          <td>${baslangic}</td>
          <td>${bitis}</td>
          <td><span class="font-mono font-semibold">${prim}</span></td>
          <td>${getStatusBadge(durum)}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-icon btn-ghost" title="Görüntüle" onclick="viewPolicy('${policy.id || policy.policeId}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button class="btn btn-icon btn-ghost" title="Yazdır" onclick="printPolicy('${policy.id || policy.policeId}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6,9 6,2 18,2 18,9"/>
                  <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Loading durumu göster/gizle
   */
  function showLoading(show) {
    if (typeof window.showLoading === 'function') {
      window.showLoading(show);
    }
  }

  /**
   * Hata mesajı göster
   */
  function showError(message) {
    if (typeof showToast === 'function') {
      showToast(message, 'error');
    } else {
      alert(message);
    }
  }

  /**
   * Poliçe görüntüle
   */
  window.viewPolicy = function(policyId) {
    if (policyId) {
      window.location.href = `../policies/detail.html?id=${policyId}`;
    }
  };

  /**
   * Poliçe yazdır
   */
  window.printPolicy = function(policyId) {
    showToast('Yazdırma özelliği yakında...', 'info');
  };

  /**
   * Sayfa yüklendiğinde başlat
   */
  function init() {
    customerId = getCustomerIdFromUrl();

    if (!customerId) {
      // ID yoksa liste sayfasına yönlendir
      showToast('Müşteri ID bulunamadı, listeye yönlendiriliyorsunuz...', 'warning');
      setTimeout(() => {
        window.location.href = 'list.html';
      }, 2000);
      return;
    }

    loadCustomerData();
  }

  // DOMContentLoaded'da başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Global'e expose et
  window.CustomerDetail = {
    reload: loadCustomerData,
    getData: () => customerData
  };

})();
