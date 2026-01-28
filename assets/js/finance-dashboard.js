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

    // Tahsil Edilen
    const collectedEl = document.querySelector('.stat-violet .stat-value');
    if (collectedEl) {
      const collected = data.tahsilEdilen || (data.toplamBrutPrim * 0.9); // Varsayılan %90
      collectedEl.textContent = formatCurrency(collected);
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
      const rate = ((data.tahsilEdilen || data.toplamBrutPrim * 0.9) / data.toplamBrutPrim * 100).toFixed(0);
      collectionRateEl.textContent = `%${rate} tahsilat orani`;
    }

    // Bekleyen poliçe sayısı
    const pendingCountEl = document.querySelector('.stat-amber .stat-info');
    if (pendingCountEl) {
      pendingCountEl.textContent = `${data.bekleyenPoliceSayisi || 0} police bekliyor`;
    }

    // Aylık karşılaştırma bölümü
    updateMonthlyComparison(data);
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
   * Aylık karşılaştırma bölümünü güncelle
   */
  function updateMonthlyComparison(data) {
    // Bu ay
    const thisMonthEl = document.querySelector('.comparison-item:first-child .comparison-amount');
    if (thisMonthEl) {
      thisMonthEl.textContent = formatCurrency(data.toplamBrutPrim || 0);
    }

    // Geçen ay
    const lastMonthEl = document.querySelector('.comparison-item:nth-child(2) .comparison-amount');
    if (lastMonthEl && data.oncekiDonemBrutPrim) {
      lastMonthEl.textContent = formatCurrency(data.oncekiDonemBrutPrim);
    }

    // Geçen yıl aynı ay
    const lastYearEl = document.querySelector('.comparison-item:nth-child(3) .comparison-amount');
    if (lastYearEl && data.gecenYilAyniAy) {
      lastYearEl.textContent = formatCurrency(data.gecenYilAyniAy);
      const yoyChange = calculateChange(data.toplamBrutPrim, data.gecenYilAyniAy);
      const yoyChangeEl = lastYearEl.parentElement.querySelector('.comparison-change');
      if (yoyChangeEl) {
        yoyChangeEl.className = `comparison-change ${yoyChange.isPositive ? 'success' : 'danger'}`;
        yoyChangeEl.textContent = `${yoyChange.isPositive ? '+' : '-'}${yoyChange.value}% YoY`;
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
      return;
    }

    const labels = data.dagilim.map(d => d.bransAdi);
    const values = data.dagilim.map(d => d.toplamPrim || d.yuzde || 0);

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
   * Tüm verileri yükle
   */
  async function loadAllData() {
    console.log('[FinanceDashboard] Veriler yükleniyor...', currentDateRange);

    try {
      await Promise.all([
        loadDashboardStats(),
        loadMonthlyTrend(),
        loadBransDagilim(),
        loadTopPerformers()
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
