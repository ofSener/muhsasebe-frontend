/**
 * Finance Dashboard - API Integration
 * Finans dashboard sayfası için dinamik veri yükleme
 */

(function() {
  'use strict';

  // State
  let dashboardStats = null;
  let charts = {
    revenue: null,
    distribution: null,
    employeeCommission: null
  };

  let currentDateRange = {
    period: 'this_month',
    startDate: null,
    endDate: null
  };

  /**
   * Para formatı
   */
  function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '0 TL';
    return Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL';
  }

  /**
   * Kısa para formatı
   */
  function formatCurrencyShort(amount) {
    if (amount === null || amount === undefined) return '0';
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1) + 'M TL';
    }
    if (amount >= 1000) {
      return (amount / 1000).toFixed(0) + 'K TL';
    }
    return amount.toFixed(0) + ' TL';
  }

  /**
   * Yüzde değişim hesapla
   */
  function calculateChange(current, previous) {
    if (!previous || previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change >= 0
    };
  }

  /**
   * Dashboard istatistiklerini yükle
   */
  async function loadDashboardStats() {
    try {
      const params = new URLSearchParams();
      if (currentDateRange.startDate) params.append('startDate', currentDateRange.startDate);
      if (currentDateRange.endDate) params.append('endDate', currentDateRange.endDate);

      const response = await apiGet(`dashboard/stats?${params}`);
      dashboardStats = response;
      updateStatsUI(response);
    } catch (error) {
      console.error('Dashboard stats yüklenemedi:', error);
      // Hata durumunda placeholder göster
      showStatsError();
    }
  }

  /**
   * Aylık trend verilerini yükle
   */
  async function loadMonthlyTrend() {
    try {
      const response = await apiGet('dashboard/aylik-trend?months=12');
      updateRevenueChart(response);
    } catch (error) {
      console.error('Aylık trend yüklenemedi:', error);
    }
  }

  /**
   * Branş dağılımı verilerini yükle
   */
  async function loadBransDagilim() {
    try {
      const params = new URLSearchParams();
      if (currentDateRange.startDate) params.append('startDate', currentDateRange.startDate);
      if (currentDateRange.endDate) params.append('endDate', currentDateRange.endDate);

      const response = await apiGet(`dashboard/brans-dagilim?${params}`);
      updateDistributionChart(response);
    } catch (error) {
      console.error('Branş dağılımı yüklenemedi:', error);
    }
  }

  /**
   * Top performers verilerini yükle (çalışan bazlı komisyon)
   */
  async function loadTopPerformers() {
    try {
      const params = new URLSearchParams();
      if (currentDateRange.startDate) params.append('startDate', currentDateRange.startDate);
      if (currentDateRange.endDate) params.append('endDate', currentDateRange.endDate);
      params.append('limit', '5');

      const response = await apiGet(`dashboard/top-performers?${params}`);
      updateEmployeeCommissionChart(response);
    } catch (error) {
      console.error('Top performers yüklenemedi:', error);
    }
  }

  /**
   * Stats kartlarını güncelle
   */
  function updateStatsUI(data) {
    if (!data) return;

    // Toplam Prim
    const totalPremEl = document.querySelector('.stat-emerald .stat-value');
    if (totalPremEl) {
      totalPremEl.textContent = formatCurrency(data.toplamBrutPrim || 0);
    }

    // Toplam Komisyon
    const totalCommEl = document.querySelector('.stat-cyan .stat-value');
    if (totalCommEl) {
      totalCommEl.textContent = formatCurrency(data.toplamKomisyon || 0);
    }

    // Tahsil Edilen - backend'de tahsilEdilen alanı yok, onaylanmış prim tutarını göster
    const collectedEl = document.querySelector('.stat-violet .stat-value');
    if (collectedEl) {
      if (data.tahsilEdilen !== undefined && data.tahsilEdilen !== null) {
        collectedEl.textContent = formatCurrency(data.tahsilEdilen);
      } else {
        // Onaylı prim = toplam brüt prim - bekleyen prim
        const collected = (data.toplamBrutPrim || 0) - (data.bekleyenPrim || 0);
        collectedEl.textContent = formatCurrency(collected);
      }
    }

    // Bekleyen Tahsilat
    const pendingEl = document.querySelector('.stat-amber .stat-value');
    if (pendingEl) {
      pendingEl.textContent = formatCurrency(data.bekleyenPrim || 0);
    }

    // Değişim yüzdeleri
    updateChangeIndicators(data);

    // Tahsilat oranı
    const collectionRateEl = document.querySelector('.stat-violet .stat-info');
    if (collectionRateEl && data.toplamBrutPrim) {
      const collected = data.tahsilEdilen != null
        ? data.tahsilEdilen
        : ((data.toplamBrutPrim || 0) - (data.bekleyenPrim || 0));
      const rate = (collected / data.toplamBrutPrim * 100).toFixed(0);
      collectionRateEl.textContent = `%${rate} tahsilat orani`;
    }

    // Bekleyen poliçe sayısı
    const pendingCountEl = document.querySelector('.stat-amber .stat-info');
    if (pendingCountEl) {
      pendingCountEl.textContent = `${data.bekleyenPoliceSayisi || 0} police bekliyor`;
    }

    // Aylık karşılaştırma bölümü
    updateMonthlyComparison(data);

    // Dikkat edilmesi gerekenler bölümü
    updateAlerts(data);
  }

  /**
   * Değişim göstergelerini güncelle
   */
  function updateChangeIndicators(data) {
    // Prim değişimi
    const primChangeEl = document.querySelector('.stat-emerald .stat-change');
    if (primChangeEl && data.oncekiDonemBrutPrim) {
      const change = calculateChange(data.toplamBrutPrim, data.oncekiDonemBrutPrim);
      primChangeEl.className = `stat-change ${change.isPositive ? 'positive' : 'negative'}`;
      primChangeEl.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="${change.isPositive ? 'M18 15l-6-6-6 6' : 'M18 9l-6 6-6-6'}"/>
        </svg>
        ${change.isPositive ? '+' : '-'}${change.value}% gecen aya gore
      `;
    }

    // Komisyon değişimi
    const commChangeEl = document.querySelector('.stat-cyan .stat-change');
    if (commChangeEl && data.oncekiDonemKomisyon) {
      const change = calculateChange(data.toplamKomisyon, data.oncekiDonemKomisyon);
      commChangeEl.className = `stat-change ${change.isPositive ? 'positive' : 'negative'}`;
      commChangeEl.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="${change.isPositive ? 'M18 15l-6-6-6 6' : 'M18 9l-6 6-6-6'}"/>
        </svg>
        ${change.isPositive ? '+' : '-'}${change.value}% gecen aya gore
      `;
    }
  }

  /**
   * Türkçe ay isimleri
   */
  const ayIsimleri = ['Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
    'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'];

  /**
   * Aylık karşılaştırma bölümünü güncelle
   */
  function updateMonthlyComparison(data) {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const prevMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const container = document.querySelector('.comparison-stats');
    if (!container) return;

    // Bu ay - sublabel
    const thisMonthSublabel = container.querySelector('.comparison-item:first-child .comparison-sublabel');
    if (thisMonthSublabel) {
      thisMonthSublabel.textContent = `${ayIsimleri[thisMonth]} ${thisYear}`;
    }
    const thisMonthEl = container.querySelector('.comparison-item:first-child .comparison-amount');
    if (thisMonthEl) {
      thisMonthEl.textContent = formatCurrency(data.toplamBrutPrim || 0);
      thisMonthEl.className = 'comparison-amount success';
    }
    // Bu ay değişim yüzdesi
    const thisMonthChange = container.querySelector('.comparison-item:first-child .comparison-change');
    if (thisMonthChange && data.oncekiDonemBrutPrim) {
      const change = calculateChange(data.toplamBrutPrim || 0, data.oncekiDonemBrutPrim);
      thisMonthChange.className = `comparison-change ${change.isPositive ? 'success' : 'danger'}`;
      thisMonthChange.textContent = `${change.isPositive ? '+' : '-'}${change.value}%`;
    } else if (thisMonthChange) {
      thisMonthChange.textContent = '';
    }

    // Geçen ay - sublabel
    const lastMonthSublabel = container.querySelector('.comparison-item:nth-child(2) .comparison-sublabel');
    if (lastMonthSublabel) {
      lastMonthSublabel.textContent = `${ayIsimleri[prevMonth]} ${prevMonthYear}`;
    }
    const lastMonthEl = container.querySelector('.comparison-item:nth-child(2) .comparison-amount');
    if (lastMonthEl) {
      if (data.oncekiDonemBrutPrim) {
        lastMonthEl.textContent = formatCurrency(data.oncekiDonemBrutPrim);
      } else {
        lastMonthEl.textContent = 'Veri yok';
      }
    }

    // Geçen yıl aynı ay - sublabel
    const lastYearSublabel = container.querySelector('.comparison-item:nth-child(3) .comparison-sublabel');
    if (lastYearSublabel) {
      lastYearSublabel.textContent = `${ayIsimleri[thisMonth]} ${thisYear - 1}`;
    }
    const lastYearEl = container.querySelector('.comparison-item:nth-child(3) .comparison-amount');
    if (lastYearEl) {
      if (data.gecenYilAyniAy) {
        lastYearEl.textContent = formatCurrency(data.gecenYilAyniAy);
        const yoyChange = calculateChange(data.toplamBrutPrim, data.gecenYilAyniAy);
        const yoyChangeEl = container.querySelector('.comparison-item:nth-child(3) .comparison-change');
        if (yoyChangeEl) {
          yoyChangeEl.className = `comparison-change ${yoyChange.isPositive ? 'success' : 'danger'}`;
          yoyChangeEl.textContent = `${yoyChange.isPositive ? '+' : '-'}${yoyChange.value}% YoY`;
        }
      } else {
        lastYearEl.textContent = 'Veri yok';
        const yoyChangeEl = container.querySelector('.comparison-item:nth-child(3) .comparison-change');
        if (yoyChangeEl) {
          yoyChangeEl.textContent = '';
        }
      }
    }
  }

  /**
   * Revenue (Prim Gelişimi) chart'ını güncelle
   */
  function updateRevenueChart(data) {
    const chartEl = document.getElementById('revenueChart');
    if (!chartEl) return;

    if (!data || !data.trend || data.trend.length === 0) {
      console.warn('Aylık trend verisi boş');
      showNoData(chartEl, 'Prim gelişimi verisi bulunamadı');
      return;
    }

    const categories = data.trend.map(t => `${t.ay}`);
    const values = data.trend.map(t => t.brutPrim || 0);

    // Mevcut chart varsa güncelle
    if (charts.revenue) {
      charts.revenue.updateOptions({
        xaxis: { categories: categories }
      });
      charts.revenue.updateSeries([{
        name: 'Prim',
        data: values
      }]);
    } else if (typeof createAreaChart === 'function') {
      // Chart yoksa oluştur
      charts.revenue = createAreaChart('revenueChart', {
        labels: categories,
        values: values
      }, {
        seriesName: 'Prim',
        color: chartColors?.primary || '#00d4ff',
        height: 280,
        formatter: (val) => formatCurrency(val)
      });
    }
  }

  /**
   * Distribution (Poliçe Tipi Dağılımı) chart'ını güncelle
   */
  function updateDistributionChart(data) {
    const chartEl = document.getElementById('distributionChart');
    if (!chartEl) return;

    if (!data || !data.dagilim || data.dagilim.length === 0) {
      console.warn('Branş dağılım verisi boş');
      showNoData(chartEl, 'Branş dağılım verisi bulunamadı');
      return;
    }

    const labels = data.dagilim.map(d => d.bransAdi);
    const values = data.dagilim.map(d => d.toplamBrutPrim || d.yuzde || 0);

    // Mevcut chart varsa güncelle
    if (charts.distribution) {
      charts.distribution.updateOptions({ labels: labels });
      charts.distribution.updateSeries(values);
    } else if (typeof createDonutChart === 'function') {
      // Chart yoksa oluştur
      charts.distribution = createDonutChart('distributionChart', {
        labels: labels,
        values: values
      }, {
        height: 280
      });
    }
  }

  /**
   * Employee Commission chart'ını güncelle
   */
  function updateEmployeeCommissionChart(data) {
    const chartEl = document.getElementById('employeeCommissionChart');
    if (!chartEl) return;

    if (!data || !data.performers || data.performers.length === 0) {
      console.warn('Top performers verisi boş');
      showNoData(chartEl, 'Çalışan komisyon verisi bulunamadı');
      return;
    }

    const labels = data.performers.map(p => {
      // İsmi kısalt (Ad S.)
      const parts = (p.adSoyad || p.name || '').split(' ');
      if (parts.length >= 2) {
        return `${parts[0]} ${parts[1][0]}.`;
      }
      return parts[0] || 'Bilinmiyor';
    });
    const values = data.performers.map(p => p.toplamKomisyon || p.komisyon || 0);

    // Mevcut chart varsa güncelle
    if (charts.employeeCommission) {
      charts.employeeCommission.updateOptions({
        xaxis: { categories: labels }
      });
      charts.employeeCommission.updateSeries([{
        name: 'Komisyon',
        data: values
      }]);
    } else if (typeof createBarChart === 'function') {
      // Chart yoksa oluştur
      charts.employeeCommission = createBarChart('employeeCommissionChart', {
        labels: labels,
        values: values
      }, {
        seriesName: 'Komisyon',
        colors: [chartColors?.success || '#10b981'],
        height: 230
      });
    }
  }

  /**
   * Chart alanında "veri bulunamadı" mesajı göster
   */
  function showNoData(container, message) {
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:200px;flex-direction:column;gap:0.75rem;color:var(--text-muted,#64748b);">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5;">
          <path d="M21 21H4.6c-.56 0-.84 0-1.054-.109a1 1 0 01-.437-.437C3 20.24 3 19.96 3 19.4V3"/>
          <path d="M7 14l4-4 4 4 6-6"/>
        </svg>
        <span style="font-size:0.875rem;">${message || 'Veri bulunamadı'}</span>
      </div>
    `;
  }

  /**
   * Hata durumunda placeholder göster
   */
  function showStatsError() {
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(el => {
      el.textContent = 'Veri yok';
    });
  }

  /**
   * Tarih aralığını ayarla ve verileri yeniden yükle
   */
  function setDateRange(period) {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'this_week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        endDate = now;
        break;
      case 'last_7_days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        endDate = now;
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      case 'last_30_days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        endDate = now;
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
    }

    currentDateRange.period = period;
    currentDateRange.startDate = formatDateForApi(startDate);
    currentDateRange.endDate = formatDateForApi(endDate);

    // Verileri yeniden yükle
    loadAllData();
  }

  /**
   * Tarihi API formatına çevir
   */
  function formatDateForApi(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Son aktiviteleri yükle
   */
  async function loadSonAktiviteler() {
    try {
      const params = new URLSearchParams();
      if (currentDateRange.startDate) params.append('startDate', currentDateRange.startDate);
      if (currentDateRange.endDate) params.append('endDate', currentDateRange.endDate);
      params.append('limit', '10');

      const response = await apiGet(`dashboard/son-aktiviteler?${params}`);
      updateSonAktivitelerTable(response);
    } catch (error) {
      console.error('Son aktiviteler yüklenemedi:', error);
      updateSonAktivitelerTable(null);
    }
  }

  /**
   * Son finansal hareketler tablosunu güncelle
   */
  function updateSonAktivitelerTable(data) {
    const tbody = document.querySelector('.son-aktiviteler-table tbody');
    if (!tbody) return;

    if (!data || !data.aktiviteler || data.aktiviteler.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5;margin-bottom:0.5rem;display:block;margin-left:auto;margin-right:auto;">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>
            </svg>
            Henuz finansal hareket bulunamadi
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.aktiviteler.map(a => {
      const tarih = a.eklenmeTarihi ? new Date(a.eklenmeTarihi).toLocaleDateString('tr-TR') : '-';
      const tipClass = a.policeTipi === 'Yeni' ? 'text-cyan' : (a.policeTipi === 'Zeyil' ? 'text-violet' : 'text-success');
      const tipLabel = a.policeTipi || 'Police';
      const tutar = formatCurrency(a.brutPrim || 0);

      return `
        <tr>
          <td>${tarih}</td>
          <td><span class="${tipClass} font-semibold">${tipLabel}</span></td>
          <td>${a.musteriAdi || '-'}</td>
          <td><span class="font-mono">${a.policeNo || '-'}</span></td>
          <td class="font-mono font-semibold">${tutar}</td>
          <td><span class="status-badge status-${a.policeTipi === 'Yakalanan' ? 'warning' : 'success'}">${a.policeTipi === 'Yakalanan' ? 'Yakalandi' : 'Onayli'}</span></td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Dikkat edilmesi gerekenler bölümünü güncelle
   */
  function updateAlerts(data) {
    const alertList = document.querySelector('.alert-list');
    if (!alertList) return;

    const alerts = [];

    // Bekleyen poliçe uyarısı
    if (data && data.bekleyenPoliceSayisi > 0) {
      alerts.push({
        type: 'warning',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        title: `${data.bekleyenPoliceSayisi} Bekleyen Police`,
        subtitle: `Toplam: ${formatCurrency(data.bekleyenPrim || 0)}`
      });
    }

    // Prim değişim uyarısı
    if (data && data.oncekiDonemBrutPrim) {
      const change = calculateChange(data.toplamBrutPrim || 0, data.oncekiDonemBrutPrim);
      if (!change.isPositive && parseFloat(change.value) > 10) {
        alerts.push({
          type: 'danger',
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
          title: `Prim %${change.value} Dususte`,
          subtitle: 'Gecen aya gore azalma'
        });
      } else if (change.isPositive && parseFloat(change.value) > 5) {
        alerts.push({
          type: 'success',
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>',
          title: `Prim %${change.value} Artista`,
          subtitle: 'Gecen aya gore artis'
        });
      }
    }

    // Komisyon bilgisi
    if (data && data.toplamKomisyon > 0) {
      alerts.push({
        type: 'success',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
        title: `Toplam Komisyon: ${formatCurrency(data.toplamKomisyon)}`,
        subtitle: `${data.toplamPoliceSayisi || 0} policeden`
      });
    }

    if (alerts.length === 0) {
      alertList.innerHTML = `
        <div style="text-align:center;padding:1.5rem;color:var(--text-muted);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5;margin-bottom:0.5rem;display:block;margin-left:auto;margin-right:auto;">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/>
          </svg>
          <span style="font-size:0.875rem;">Simdilik bildirim yok</span>
        </div>
      `;
      return;
    }

    alertList.innerHTML = alerts.map(a => `
      <div class="alert-item ${a.type}">
        <div class="alert-icon">${a.icon}</div>
        <div class="alert-content">
          <p class="alert-title">${a.title}</p>
          <p class="alert-subtitle">${a.subtitle}</p>
        </div>
      </div>
    `).join('');
  }

  /**
   * Tüm verileri yükle
   */
  async function loadAllData() {
    console.log('[FinanceDashboard] Veriler yükleniyor...', currentDateRange);

    try {
      await Promise.all([
        loadDashboardStats(),
        loadMonthlyTrend(),
        loadBransDagilim(),
        loadTopPerformers(),
        loadSonAktiviteler()
      ]);
      console.log('[FinanceDashboard] Tüm veriler yüklendi');
    } catch (error) {
      console.error('[FinanceDashboard] Veri yüklenirken hata:', error);
    }
  }

  /**
   * Tarih seçici değişikliklerini dinle
   */
  function initDatePicker() {
    const dateSelect = document.querySelector('.date-range-picker select');
    if (dateSelect) {
      dateSelect.addEventListener('change', function(e) {
        const periodMap = {
          'Bu Ay': 'this_month',
          'Son 7 Gun': 'last_7_days',
          'Son 30 Gun': 'last_30_days',
          'Bu Yil': 'this_year'
        };
        const period = periodMap[e.target.value] || 'this_month';
        setDateRange(period);
      });
    }
  }

  /**
   * Sayfa yüklendiğinde başlat
   */
  function init() {
    // Tarih seçiciyi başlat
    initDatePicker();

    // Varsayılan tarih aralığını ayarla ve verileri yükle
    setDateRange('this_month');
  }

  // DOMContentLoaded'da başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM zaten hazır, charts.js'in de yüklenmesini bekle
    setTimeout(init, 100);
  }

  // Global'e expose et
  window.FinanceDashboard = {
    reload: loadAllData,
    setDateRange: setDateRange,
    getData: () => dashboardStats
  };

})();
