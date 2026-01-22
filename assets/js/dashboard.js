/**
 * Dashboard API Integration
 * Gerçek API verilerini yükler ve dashboard'u günceller
 */

(function() {
  'use strict';

  // State
  let dashboardData = {
    stats: null,
    bransDagilim: null,
    aylikTrend: null,
    topPerformers: null,
    sonAktiviteler: null,
    sirketDagilim: null
  };

  let charts = {
    cashFlow: null,
    policyDist: null,
    monthly: null,
    sirketDagilim: null
  };

  let currentDateRange = {
    startDate: null,
    endDate: null
  };

  // Chart colors
  const colors = {
    primary: '#6366f1',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    secondary: '#06b6d4',
    gray: '#94a3b8'
  };

  // Branş renkleri
  const bransColors = {
    'Trafik': colors.success,
    'Kasko': colors.primary,
    'DASK': colors.warning,
    'Konut': colors.info,
    'Sağlık': colors.danger,
    'Ferdi Kaza': colors.secondary,
    'Seyahat': '#8b5cf6',
    'Nakliyat': '#ec4899',
    'İşyeri': '#f97316',
    'Diğer': colors.gray
  };

  // Para formatı
  function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '₺0';
    return '₺' + Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // Kısa para formatı (K, M)
  function formatCurrencyShort(amount) {
    if (amount === null || amount === undefined) return '₺0';
    if (amount >= 1000000) {
      return '₺' + (amount / 1000000).toFixed(1) + 'M';
    }
    if (amount >= 1000) {
      return '₺' + (amount / 1000).toFixed(0) + 'K';
    }
    return '₺' + amount.toFixed(0);
  }

  // Tarih formatı
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Yüzde değişim hesapla
  function calculateChange(current, previous) {
    if (!previous || previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change >= 0
    };
  }

  // Loading state göster
  function showLoading(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = '<div class="loading-spinner"></div>';
    }
  }

  // Error state göster
  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = `<div class="error-message">${message || 'Veri yüklenemedi'}</div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // API CALLS
  // ═══════════════════════════════════════════════════════════════

  async function fetchDashboardStats() {
    try {
      const params = new URLSearchParams();
      if (currentDateRange.startDate) params.append('startDate', currentDateRange.startDate);
      if (currentDateRange.endDate) params.append('endDate', currentDateRange.endDate);

      const response = await apiGet(`dashboard/stats?${params}`);
      dashboardData.stats = response;
      updateStatsUI(response);
    } catch (error) {
      console.error('Dashboard stats yüklenemedi:', error);
    }
  }

  async function fetchBransDagilim() {
    try {
      const params = new URLSearchParams();
      if (currentDateRange.startDate) params.append('startDate', currentDateRange.startDate);
      if (currentDateRange.endDate) params.append('endDate', currentDateRange.endDate);

      const response = await apiGet(`dashboard/brans-dagilim?${params}`);
      dashboardData.bransDagilim = response;
      updateBransDagilimChart(response);
    } catch (error) {
      console.error('Branş dağılımı yüklenemedi:', error);
    }
  }

  async function fetchAylikTrend() {
    try {
      const response = await apiGet('dashboard/aylik-trend?months=12');
      dashboardData.aylikTrend = response;
      updateAylikTrendChart(response);
    } catch (error) {
      console.error('Aylık trend yüklenemedi:', error);
    }
  }

  async function fetchTopPerformers() {
    try {
      const params = new URLSearchParams();
      if (currentDateRange.startDate) params.append('startDate', currentDateRange.startDate);
      if (currentDateRange.endDate) params.append('endDate', currentDateRange.endDate);
      params.append('limit', '10');

      const response = await apiGet(`dashboard/top-performers?${params}`);
      dashboardData.topPerformers = response;
      updateTopPerformersUI(response);
    } catch (error) {
      console.error('Top performers yüklenemedi:', error);
    }
  }

  async function fetchSonAktiviteler() {
    try {
      const params = new URLSearchParams();
      if (currentDateRange.startDate) params.append('startDate', currentDateRange.startDate);
      if (currentDateRange.endDate) params.append('endDate', currentDateRange.endDate);
      params.append('limit', '10');

      const response = await apiGet(`dashboard/son-aktiviteler?${params}`);
      dashboardData.sonAktiviteler = response;
      updateSonAktivitelerUI(response);
    } catch (error) {
      console.error('Son aktiviteler yüklenemedi:', error);
    }
  }

  async function fetchSirketDagilim() {
    try {
      const params = new URLSearchParams();
      if (currentDateRange.startDate) params.append('startDate', currentDateRange.startDate);
      if (currentDateRange.endDate) params.append('endDate', currentDateRange.endDate);
      params.append('limit', '10');

      const response = await apiGet(`dashboard/sirket-dagilim?${params}`);
      dashboardData.sirketDagilim = response;
      updateSirketDagilimChart(response);
    } catch (error) {
      console.error('Şirket dağılımı yüklenemedi:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UI UPDATES
  // ═══════════════════════════════════════════════════════════════

  function updateStatsUI(data) {
    if (!data) return;

    // KPI Kartları
    const updateElement = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    updateElement('totalCustomers', data.toplamMusteriSayisi?.toLocaleString('tr-TR') || '0');
    updateElement('totalPolicies', data.toplamPoliceSayisi?.toLocaleString('tr-TR') || '0');
    updateElement('totalPremium', formatCurrency(data.toplamBrutPrim));
    updateElement('totalKomisyon', formatCurrency(data.toplamKomisyon));
    updateElement('bekleyenPolice', data.bekleyenPoliceSayisi?.toLocaleString('tr-TR') || '0');
    updateElement('bekleyenPrim', formatCurrency(data.bekleyenPrim));
    updateElement('aktifCalisan', data.aktifCalisanSayisi?.toLocaleString('tr-TR') || '0');

    // Önceki dönem karşılaştırmaları
    const primChange = calculateChange(data.toplamBrutPrim, data.oncekiDonemBrutPrim);
    const komisyonChange = calculateChange(data.toplamKomisyon, data.oncekiDonemKomisyon);
    const policeChange = calculateChange(data.toplamPoliceSayisi, data.oncekiDonemPoliceSayisi);

    updateChangeIndicator('primChange', primChange);
    updateChangeIndicator('komisyonChange', komisyonChange);
    updateChangeIndicator('policeChange', policeChange);

    // Progress kartlarını güncelle
    updateElement('progressPrimTotal', formatCurrency(data.toplamBrutPrim));
    updateElement('progressKomisyonTotal', formatCurrency(data.toplamKomisyon));
    updateElement('progressBekleyen', formatCurrency(data.bekleyenPrim));
  }

  function updateChangeIndicator(elementId, change) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const icon = change.isPositive ? '↑' : '↓';
    const colorClass = change.isPositive ? 'text-success' : 'text-danger';
    el.innerHTML = `<span class="${colorClass}">${icon} ${change.value}%</span>`;
  }

  function updateBransDagilimChart(data) {
    const chartEl = document.getElementById('policyDistChart');
    if (!chartEl) return;

    // Empty state container'ı kontrol et veya oluştur
    let emptyStateEl = chartEl.parentElement.querySelector('.empty-chart-overlay');

    if (!data || !data.dagilim || data.dagilim.length === 0) {
      // Boş durum için overlay göster
      if (!emptyStateEl) {
        emptyStateEl = document.createElement('div');
        emptyStateEl.className = 'empty-chart-overlay';
        emptyStateEl.innerHTML = `
          <div class="empty-chart-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
              <path d="M22 12A10 10 0 0 0 12 2v10z"/>
            </svg>
            <p class="empty-chart-title">Veri Bulunamadı</p>
            <p class="empty-chart-text">Seçilen tarih aralığında poliçe verisi bulunmuyor</p>
          </div>
        `;
        chartEl.parentElement.style.position = 'relative';
        chartEl.parentElement.appendChild(emptyStateEl);
      }
      emptyStateEl.style.display = 'flex';

      // Chart'ı gizle
      if (charts.policyDist) {
        charts.policyDist.updateSeries([]);
      }
      return;
    }

    // Veri varsa empty state'i gizle
    if (emptyStateEl) {
      emptyStateEl.style.display = 'none';
    }

    const labels = data.dagilim.map(d => d.bransAdi);
    const series = data.dagilim.map(d => d.yuzde);
    const chartColors = data.dagilim.map(d => bransColors[d.bransAdi] || colors.gray);

    if (charts.policyDist) {
      charts.policyDist.updateOptions({
        labels: labels,
        colors: chartColors
      });
      charts.policyDist.updateSeries(series);
    }
  }

  function updateAylikTrendChart(data) {
    if (!data || !data.trend || data.trend.length === 0) return;

    const categories = data.trend.map(t => `${t.ay} ${t.yil}`);
    const brutPrimData = data.trend.map(t => t.brutPrim);
    const komisyonData = data.trend.map(t => t.komisyon);
    const policeSayisiData = data.trend.map(t => t.policeSayisi);

    // Cash Flow Chart güncelle
    if (charts.cashFlow) {
      charts.cashFlow.updateOptions({
        xaxis: { categories: categories }
      });
      charts.cashFlow.updateSeries([
        { name: 'Brüt Prim', data: brutPrimData },
        { name: 'Komisyon', data: komisyonData }
      ]);
    }

    // Monthly Chart güncelle
    if (charts.monthly) {
      charts.monthly.updateOptions({
        xaxis: { categories: data.trend.map(t => t.ay) }
      });
      charts.monthly.updateSeries([
        { name: 'Poliçe Sayısı', data: policeSayisiData }
      ]);
    }
  }

  function updateSirketDagilimChart(data) {
    if (!data || !data.dagilim || data.dagilim.length === 0) return;

    // Şirket dağılımı için bar chart oluştur/güncelle
    const sirketChartEl = document.getElementById('sirketDagilimChart');
    if (!sirketChartEl) return;

    const categories = data.dagilim.map(d => d.sirketAdi);
    const seriesData = data.dagilim.map(d => d.toplamBrutPrim);

    if (charts.sirketDagilim) {
      charts.sirketDagilim.updateOptions({
        xaxis: { categories: categories }
      });
      charts.sirketDagilim.updateSeries([{ data: seriesData }]);
    } else {
      // Chart yoksa oluştur
      charts.sirketDagilim = new ApexCharts(sirketChartEl, {
        series: [{ name: 'Prim', data: seriesData }],
        chart: {
          type: 'bar',
          height: 280,
          toolbar: { show: false },
          fontFamily: 'Plus Jakarta Sans, sans-serif'
        },
        plotOptions: {
          bar: {
            horizontal: true,
            borderRadius: 4
          }
        },
        colors: [colors.primary],
        dataLabels: {
          enabled: true,
          formatter: (val) => formatCurrencyShort(val),
          style: { fontSize: '11px' }
        },
        xaxis: {
          categories: categories,
          labels: {
            formatter: (val) => formatCurrencyShort(val),
            style: { colors: '#64748b', fontSize: '11px' }
          }
        },
        yaxis: {
          labels: {
            style: { colors: '#64748b', fontSize: '11px' }
          }
        },
        grid: {
          borderColor: 'rgba(148, 163, 184, 0.15)',
          strokeDashArray: 4
        },
        tooltip: {
          y: { formatter: (val) => formatCurrency(val) }
        }
      });
      charts.sirketDagilim.render();
    }
  }

  function updateTopPerformersUI(data) {
    const tbody = document.getElementById('performersBody');
    if (!tbody || !data || !data.performers) return;

    if (data.performers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Henüz veri yok</td></tr>';
      return;
    }

    const maxPrim = Math.max(...data.performers.map(p => p.toplamBrutPrim));

    tbody.innerHTML = data.performers.map((performer, index) => {
      const initials = performer.adSoyad.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const avatarColors = ['cyan', 'emerald', 'amber', 'violet', 'rose'];
      const avatarColor = avatarColors[index % avatarColors.length];
      const progress = maxPrim > 0 ? (performer.toplamBrutPrim / maxPrim * 100).toFixed(0) : 0;

      return `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <div class="avatar avatar-sm avatar-${avatarColor}">${initials}</div>
              <div>
                <div class="cell-main">${performer.adSoyad}</div>
                <div class="cell-sub">${performer.subeAdi || ''}</div>
              </div>
            </div>
          </td>
          <td class="font-semibold">${performer.policeSayisi}</td>
          <td class="font-mono">${formatCurrencyShort(performer.toplamBrutPrim)}</td>
          <td>
            <div class="flex items-center gap-2">
              <div class="progress" style="width: 80px;">
                <div class="progress-bar ${avatarColor}" style="width: ${progress}%"></div>
              </div>
              <span class="text-${avatarColor === 'cyan' ? 'primary' : avatarColor === 'emerald' ? 'success' : 'warning'} font-semibold">${progress}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function updateSonAktivitelerUI(data) {
    const container = document.getElementById('activityList');
    if (!container || !data || !data.aktiviteler) return;

    if (data.aktiviteler.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-4">Henüz aktivite yok</div>';
      return;
    }

    container.innerHTML = data.aktiviteler.map(aktivite => {
      const timeAgo = getTimeAgo(aktivite.eklenmeTarihi);
      const bransColor = bransColors[aktivite.bransAdi] || colors.gray;

      return `
        <div class="activity-item">
          <div class="activity-icon" style="background: ${bransColor}20; color: ${bransColor};">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
          </div>
          <div class="activity-content">
            <div class="activity-text">
              <strong>${aktivite.bransAdi}</strong> - ${aktivite.musteriAdi} için ${aktivite.sigortaSirketi} poliçesi
              <span class="font-mono" style="color: ${colors.success};">${formatCurrency(aktivite.brutPrim)}</span>
            </div>
            <div class="activity-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    return formatDate(dateStr);
  }

  // ═══════════════════════════════════════════════════════════════
  // CHART INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  function initCharts() {
    // Cash Flow / Aylık Trend Chart
    const cashFlowEl = document.getElementById('cashFlowChart');
    if (cashFlowEl) {
      charts.cashFlow = new ApexCharts(cashFlowEl, {
        series: [
          { name: 'Brüt Prim', data: [] },
          { name: 'Komisyon', data: [] }
        ],
        chart: {
          height: 280,
          type: 'area',
          toolbar: { show: false },
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          zoom: { enabled: false }
        },
        stroke: {
          width: 2,
          curve: 'smooth'
        },
        colors: [colors.primary, colors.success],
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.4,
            opacityTo: 0.1,
            stops: [0, 100]
          }
        },
        markers: {
          size: 4,
          strokeWidth: 0,
          hover: { size: 6 }
        },
        xaxis: {
          categories: [],
          labels: {
            style: { colors: '#64748b', fontSize: '10px' },
            rotate: 0
          },
          axisBorder: { show: false },
          axisTicks: { show: false }
        },
        yaxis: {
          labels: {
            style: { colors: '#64748b', fontSize: '11px' },
            formatter: (val) => formatCurrencyShort(val)
          }
        },
        legend: {
          show: true,
          position: 'top',
          horizontalAlign: 'left',
          labels: { colors: '#475569' },
          markers: { width: 8, height: 8, radius: 8 }
        },
        tooltip: {
          y: { formatter: (val) => formatCurrency(val) }
        },
        grid: {
          borderColor: 'rgba(148, 163, 184, 0.15)',
          strokeDashArray: 4
        }
      });
      charts.cashFlow.render();
    }

    // Policy Distribution (Donut)
    const policyDistEl = document.getElementById('policyDistChart');
    if (policyDistEl) {
      charts.policyDist = new ApexCharts(policyDistEl, {
        series: [],
        chart: {
          height: 280,
          type: 'donut',
          fontFamily: 'Plus Jakarta Sans, sans-serif'
        },
        labels: [],
        colors: Object.values(bransColors),
        plotOptions: {
          pie: {
            donut: {
              size: '70%',
              labels: {
                show: true,
                name: {
                  show: true,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0f172a'
                },
                value: {
                  show: true,
                  fontSize: '24px',
                  fontWeight: 800,
                  color: '#0f172a',
                  formatter: (val) => val + '%'
                },
                total: {
                  show: true,
                  label: 'Toplam',
                  fontSize: '12px',
                  color: '#64748b',
                  formatter: (w) => {
                    const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                    return total.toFixed(0) + '%';
                  }
                }
              }
            }
          }
        },
        stroke: { width: 0 },
        legend: {
          position: 'bottom',
          labels: { colors: '#475569' }
        },
        dataLabels: { enabled: false }
      });
      charts.policyDist.render();
    }

    // Monthly Performance (Bar)
    const monthlyEl = document.getElementById('monthlyChart');
    if (monthlyEl) {
      charts.monthly = new ApexCharts(monthlyEl, {
        series: [{ name: 'Poliçe Sayısı', data: [] }],
        chart: {
          type: 'bar',
          height: 280,
          toolbar: { show: false },
          fontFamily: 'Plus Jakarta Sans, sans-serif'
        },
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: '60%',
            borderRadius: 4,
            borderRadiusApplication: 'end'
          }
        },
        colors: [colors.primary],
        dataLabels: { enabled: false },
        stroke: {
          show: true,
          width: 2,
          colors: ['transparent']
        },
        xaxis: {
          categories: [],
          labels: {
            style: { colors: '#64748b', fontSize: '11px' }
          },
          axisBorder: { show: false },
          axisTicks: { show: false }
        },
        yaxis: {
          labels: {
            style: { colors: '#64748b', fontSize: '11px' }
          }
        },
        fill: { opacity: 1 },
        legend: {
          position: 'top',
          horizontalAlign: 'right',
          labels: { colors: '#475569' }
        },
        grid: {
          borderColor: 'rgba(148, 163, 184, 0.15)',
          strokeDashArray: 4
        },
        tooltip: {
          y: { formatter: (val) => val + ' poliçe' }
        }
      });
      charts.monthly.render();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DATE RANGE HANDLING
  // ═══════════════════════════════════════════════════════════════

  // Tarihi yerel formata çevir (YYYY-MM-DD)
  function formatDateForApi(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function setDateRange(startDate, endDate) {
    currentDateRange.startDate = formatDateForApi(startDate);
    currentDateRange.endDate = formatDateForApi(endDate);
    console.log('[Dashboard] Tarih aralığı güncellendi:', currentDateRange);
    loadAllData();
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN LOAD FUNCTION
  // ═══════════════════════════════════════════════════════════════

  async function loadAllData() {
    console.log('[Dashboard] Veriler yükleniyor...', currentDateRange);

    // Loading state göster
    const loadingElements = ['performersBody', 'activityList'];
    loadingElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Yükleniyor...</td></tr>';
    });

    // Tüm API çağrılarını paralel yap
    try {
      await Promise.all([
        fetchDashboardStats(),
        fetchBransDagilim(),
        fetchAylikTrend(),
        fetchTopPerformers(),
        fetchSonAktiviteler(),
        fetchSirketDagilim()
      ]);
      console.log('[Dashboard] Tüm veriler yüklendi');
    } catch (error) {
      console.error('[Dashboard] Veri yüklenirken hata:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  function init() {
    // Chart'ları başlat
    initCharts();

    // Varsayılan tarih aralığı: Bu yıl
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    setDateRange(startOfYear, now);
  }

  // Global'e expose et
  window.Dashboard = {
    init: init,
    loadAllData: loadAllData,
    setDateRange: setDateRange,
    getData: () => dashboardData
  };

  // DOM hazır olduğunda başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
