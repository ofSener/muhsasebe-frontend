/**
 * Performance Page - IHSAN AI
 * Performans analizi sayfası için JavaScript
 */

// ===== STATE MANAGEMENT =====
let performanceState = {
  currentMode: 1,              // 1=Yakalanan, 0=Onaylanan
  dateRange: {
    start: new Date(),
    end: new Date()
  },
  companyPeriod: 'hour',       // 'hour', 'day', 'week', 'month'
  treeMapView: 'employee',     // 'employee', 'branch'
  treeMapMode: 'amount'        // 'amount', 'count'
};

// ===== CACHE SYSTEM =====
const performanceCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

function getCacheKey(mode, startDate, endDate) {
  return `${mode}_${startDate.toISOString()}_${endDate.toISOString()}`;
}

function getCachedData(key) {
  const cached = performanceCache[key];
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL) {
    delete performanceCache[key];
    return null;
  }

  return cached.data;
}

function setCachedData(key, data) {
  performanceCache[key] = {
    timestamp: Date.now(),
    data: data
  };
}

// ===== API SERVICE LAYER =====
const PerformanceAPI = {
  /**
   * Branş dağılımını getir
   */
  async getBransDagilim(mode, startDate, endDate) {
    const params = {
      mode: mode,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
    console.log('[API] Calling brans-dagilim with params:', params);
    const result = await apiGet('dashboard/brans-dagilim', params);
    console.log('[API] brans-dagilim response:', result);
    return result;
  },

  /**
   * Şube dağılımını getir
   */
  async getSubeDagilim(mode, startDate, endDate) {
    const params = {
      mode: mode,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
    console.log('[API] Calling sube-dagilim with params:', params);
    const result = await apiGet('dashboard/sube-dagilim', params);
    console.log('[API] sube-dagilim response:', result);
    return result;
  },

  /**
   * Top performansçıları getir
   */
  async getTopPerformers(mode, startDate, endDate, limit = 10) {
    const params = {
      mode: mode,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      limit: limit
    };
    console.log('[API] Calling top-performers with params:', params);
    const result = await apiGet('dashboard/top-performers', params);
    console.log('[API] top-performers response:', result);
    return result;
  },

  /**
   * Dashboard stats getir (tarih aralığına göre)
   */
  async getStats(mode, startDate, endDate) {
    const params = {
      mode: mode,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
    console.log('[API] Calling dashboard/stats with params:', params);
    const result = await apiGet('dashboard/stats', params);
    console.log('[API] dashboard/stats response:', result);
    return result;
  },

  /**
   * Aylık trend getir
   */
  async getAylikTrend(mode, months = 12) {
    const params = {
      mode: mode,
      months: months
    };
    console.log('[API] Calling aylik-trend with params:', params);
    const result = await apiGet('dashboard/aylik-trend', params);
    console.log('[API] aylik-trend response:', result);
    return result;
  }
};

// ===== DATA MAPPERS =====
const DataMappers = {
  /**
   * Branş dağılımı API response'unu chart formatına çevirir
   */
  mapBransDagilim(apiResponse) {
    if (!apiResponse || !apiResponse.dagilim || !Array.isArray(apiResponse.dagilim)) {
      console.warn('[DataMappers] Invalid branş dagilim response:', apiResponse);
      return { labels: [], values: [], tutarlar: [] };
    }

    return {
      labels: apiResponse.dagilim.map(item => item.bransAdi || 'Bilinmeyen'),
      values: apiResponse.dagilim.map(item => item.policeSayisi || 0),
      tutarlar: apiResponse.dagilim.map(item => item.toplamBrutPrim || 0)
    };
  },

  /**
   * Şube dağılımı API response'unu chart formatına çevirir
   */
  mapSubeDagilim(apiResponse) {
    if (!apiResponse || !apiResponse.dagilim || !Array.isArray(apiResponse.dagilim)) {
      console.warn('[DataMappers] Invalid şube dagilim response:', apiResponse);
      return { labels: [], values: [], tutarlar: [] };
    }

    return {
      labels: apiResponse.dagilim.map(item => item.subeAdi || 'Bilinmeyen'),
      values: apiResponse.dagilim.map(item => item.policeSayisi || 0),
      tutarlar: apiResponse.dagilim.map(item => item.toplamBrutPrim || 0)
    };
  },

  /**
   * Top performers API response'unu chart formatına çevirir
   */
  mapTopPerformers(apiResponse) {
    if (!apiResponse || !apiResponse.performers || !Array.isArray(apiResponse.performers)) {
      console.warn('[DataMappers] Invalid performers response:', apiResponse);
      return { labels: [], values: [], tutarlar: [] };
    }

    return {
      labels: apiResponse.performers.map(item => {
        // API adSoyad olarak dönüyor, adi ve soyadi ayrı değil
        if (item.adSoyad) {
          const parts = item.adSoyad.split(' ');
          if (parts.length > 1) {
            return parts[0] + ' ' + parts[parts.length - 1].charAt(0) + '.';
          }
          return item.adSoyad;
        }
        return 'Bilinmeyen';
      }),
      values: apiResponse.performers.map(item => item.policeSayisi || 0),
      tutarlar: apiResponse.performers.map(item => item.toplamBrutPrim || 0)
    };
  },

  /**
   * Aylık trend API response'unu chart formatına çevirir
   */
  mapAylikTrend(apiResponse) {
    if (!apiResponse || !apiResponse.trend || !Array.isArray(apiResponse.trend)) {
      console.warn('[DataMappers] Invalid aylik trend response:', apiResponse);
      return { labels: [], current: [], previous: [] };
    }

    if (apiResponse.trend.length === 0) {
      console.warn('[DataMappers] Empty aylik trend data');
      return { labels: [], current: [], previous: [] };
    }

    // API ay, yil, brutPrim olarak dönüyor (tarih ve toplamBrutPrim değil)
    const labels = apiResponse.trend.map(item => item.ay || 'N/A');
    const current = apiResponse.trend.map(item => item.brutPrim || 0);

    // Önceki dönem için mock data (backend'de henüz yok)
    const previous = current.map(val => val * 0.85);

    console.log('[DataMappers] Trend mapped:', { labels, currentSample: current.slice(0, 3) });

    return { labels, current, previous };
  },

  /**
   * TreeMap için hierarchy data oluşturur
   */
  mapTreeMapData(performersData, subeData, view, mode) {
    let data = [];

    try {
      if (view === 'employee' && performersData && performersData.performers && Array.isArray(performersData.performers)) {
        // Çalışanlara göre - API adSoyad olarak dönüyor
        data = performersData.performers
          .filter(item => item && item.adSoyad) // Null check
          .slice(0, 10)
          .map(item => ({
            x: item.adSoyad,
            y: mode === 'amount' ? (item.toplamBrutPrim || 0) : (item.policeSayisi || 0)
          }))
          .filter(item => item.y > 0); // Sıfır değerleri filtrele
      } else if (view === 'branch' && subeData && subeData.dagilim && Array.isArray(subeData.dagilim)) {
        // Şubelere göre
        data = subeData.dagilim
          .filter(item => item && item.subeAdi) // Null check
          .map(item => ({
            x: item.subeAdi,
            y: mode === 'amount' ? (item.toplamBrutPrim || 0) : (item.policeSayisi || 0)
          }))
          .filter(item => item.y > 0); // Sıfır değerleri filtrele
      }

      console.log('[DataMappers] TreeMap data:', { view, mode, dataLength: data.length, sample: data[0] });
    } catch (error) {
      console.error('[DataMappers] TreeMap mapping error:', error);
      return [];
    }

    return data;
  }
};

// ===== FLATPICKR INITIALIZATION =====
let flatpickrInstance = null;

function initializeFlatpickr() {
  flatpickrInstance = flatpickr('#dateRangeInput', {
    mode: 'range',
    locale: 'tr',
    dateFormat: 'd.m.Y',
    onChange: function(selectedDates) {
      if (selectedDates.length === 2) {
        performanceState.dateRange.start = selectedDates[0];
        performanceState.dateRange.end = selectedDates[1];

        // Clear preset active state
        document.querySelectorAll('.preset-btn').forEach(btn =>
          btn.classList.remove('active'));

        // Tarih aralığına göre otomatik period seçimi
        const diffDays = Math.ceil((selectedDates[1] - selectedDates[0]) / (1000 * 60 * 60 * 24));
        let autoPeriod;
        if (diffDays <= 1) {
          autoPeriod = 'hour';
        } else if (diffDays <= 7) {
          autoPeriod = 'day';
        } else if (diffDays <= 31) {
          autoPeriod = 'week';
        } else {
          autoPeriod = 'month';
        }
        performanceState.companyPeriod = autoPeriod;
        document.querySelectorAll('.period-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.period === autoPeriod);
        });

        console.log('[Performance] Date range changed:', performanceState.dateRange, '→ period:', autoPeriod);
        onFilterChange();
      }
    }
  });
}

// ===== DATE PRESET HANDLERS =====
function handlePreset(range, button) {
  const today = new Date();
  let start, end;

  switch(range) {
    case 'today':
      start = end = new Date(today);
      break;
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      start = end = yesterday;
      break;
    case 'thisWeek':
      start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      end = new Date();
      break;
    case 'thisMonth':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date();
      break;
    case 'thisYear':
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date();
      break;
  }

  performanceState.dateRange = { start, end };
  if (flatpickrInstance) {
    flatpickrInstance.setDate([start, end]);
  }

  // Update active state
  document.querySelectorAll('.preset-btn').forEach(btn =>
    btn.classList.remove('active'));
  button.classList.add('active');

  // Preset'e göre otomatik period seçimi
  const presetPeriodMap = {
    'today': 'hour',
    'yesterday': 'hour',
    'thisWeek': 'day',
    'thisMonth': 'week',
    'thisYear': 'month'
  };
  const autoPeriod = presetPeriodMap[range] || 'week';
  performanceState.companyPeriod = autoPeriod;

  // Period butonlarını güncelle
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === autoPeriod);
  });

  console.log('[Performance] Preset selected:', range, '→ period:', autoPeriod);
  onFilterChange();
}

// ===== MODE TOGGLE =====
function setMode(mode) {
  performanceState.currentMode = mode;

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.mode) === mode);
  });

  console.log('[Performance] Mode changed:', mode === 1 ? 'Yakalanan' : 'Onaylanan');
  onFilterChange();
}

// ===== COMPANY PERIOD TOGGLE =====
function setPeriod(period) {
  performanceState.companyPeriod = period;

  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });

  console.log('[Performance] Period changed:', period);

  // Cache'den data al ve chart'ı güncelle
  const cacheKey = getCacheKey(
    performanceState.currentMode,
    performanceState.dateRange.start,
    performanceState.dateRange.end
  );
  const cachedData = getCachedData(cacheKey);

  if (cachedData) {
    updateCompanyPerformanceChart(cachedData);
    updateMetrics(cachedData);
  } else {
    console.warn('[Performance] No cached data for period change');
  }
}

// ===== TREEMAP CONTROLS =====
function setTreeView(view) {
  performanceState.treeMapView = view;

  // Update buttons
  document.querySelectorAll('.control-section:first-of-type .option-btn').forEach(btn => {
    const isEmployee = btn.textContent.includes('Çalışanlara');
    btn.classList.toggle('active', (view === 'employee' && isEmployee) || (view === 'branch' && !isEmployee));
  });

  // Update breadcrumb
  document.getElementById('breadcrumbActive').textContent = view === 'employee' ? 'Çalışanlar' : 'Şubeler';

  console.log('[Performance] TreeMap view changed:', view);
  updateTreeMapChart();
}

function setTreeMode(mode) {
  performanceState.treeMapMode = mode;

  // Update buttons
  document.querySelectorAll('.control-section:last-of-type .option-btn').forEach(btn => {
    const isAmount = btn.textContent.includes('Tutar');
    btn.classList.toggle('active', (mode === 'amount' && isAmount) || (mode === 'count' && !isAmount));
  });

  console.log('[Performance] TreeMap mode changed:', mode);
  updateTreeMapChart();
}

// ===== CHART INSTANCES =====
let charts = {
  performance: null,
  bransAdet: null,
  subeAdet: null,
  calisanAdet: null,
  bransTutar: null,
  subeTutar: null,
  calisanTutar: null,
  treemap: null
};

// ===== FILTER CHANGE HANDLER =====
function onFilterChange() {
  const cacheKey = getCacheKey(
    performanceState.currentMode,
    performanceState.dateRange.start,
    performanceState.dateRange.end
  );

  // Check cache
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    console.log('[Performance] Using cached data');
    updateAllCharts(cachedData);
    return;
  }

  // Load data (with mock data for now)
  console.log('[Performance] Loading fresh data...');
  loadPerformanceData();
}

// ===== DATA LOADING =====
async function loadPerformanceData() {
  try {
    // Show loading overlay
    showLoading(true);

    const { currentMode, dateRange } = performanceState;
    const { start, end } = dateRange;

    console.log('[Performance] Loading data...', {
      mode: currentMode === 1 ? 'Yakalanan' : 'Onaylanan',
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    });

    // Paralel API çağrıları
    const [bransResponse, subeResponse, performersResponse, trendResponse, statsResponse] = await Promise.all([
      PerformanceAPI.getBransDagilim(currentMode, start, end),
      PerformanceAPI.getSubeDagilim(currentMode, start, end),
      PerformanceAPI.getTopPerformers(currentMode, start, end, 10),
      PerformanceAPI.getAylikTrend(currentMode, 8),
      PerformanceAPI.getStats(currentMode, start, end)
    ]);

    console.log('[Performance] API responses received:', {
      brans: bransResponse,
      sube: subeResponse,
      performers: performersResponse,
      trend: trendResponse,
      stats: statsResponse
    });

    // API'den toplam değerleri sakla (stats endpoint tarih filtreli, en doğru kaynak)
    const apiTotals = {
      toplamPolice: statsResponse?.toplamPoliceSayisi || bransResponse?.toplamPolice || subeResponse?.toplamPolice || 0,
      toplamPrim: statsResponse?.toplamBrutPrim || bransResponse?.toplamPrim || subeResponse?.toplamPrim || 0,
      oncekiDonemPrim: statsResponse?.oncekiDonemBrutPrim || 0,
      toplamKomisyon: statsResponse?.toplamKomisyon || 0,
      oncekiDonemKomisyon: statsResponse?.oncekiDonemKomisyon || 0,
      oncekiDonemPoliceSayisi: statsResponse?.oncekiDonemPoliceSayisi || 0,
      bekleyenPoliceSayisi: statsResponse?.bekleyenPoliceSayisi || 0,
      bekleyenPrim: statsResponse?.bekleyenPrim || 0
    };
    console.log('[Performance] API totals:', apiTotals);

    // Validate responses
    if (!bransResponse) console.error('[Performance] Branş response is null/undefined');
    if (!subeResponse) console.error('[Performance] Şube response is null/undefined');
    if (!performersResponse) console.error('[Performance] Performers response is null/undefined');
    if (!trendResponse) console.error('[Performance] Trend response is null/undefined');

    // API response'larını chart formatına çevir
    let chartData;
    try {
      const bransData = DataMappers.mapBransDagilim(bransResponse);
      const subeData = DataMappers.mapSubeDagilim(subeResponse);
      const performersData = DataMappers.mapTopPerformers(performersResponse);
      const trendData = DataMappers.mapAylikTrend(trendResponse);

      console.log('[Performance] Mapped data:', {
        bransData,
        subeData,
        performersData,
        trendData
      });

      chartData = {
        companyPerformance: trendData,
        bransAdet: bransData,
        subeAdet: subeData,
        calisanAdet: performersData,
        bransTutar: {
          labels: bransData.labels || [],
          values: bransData.tutarlar || []
        },
        subeTutar: {
          labels: subeData.labels || [],
          values: subeData.tutarlar || []
        },
        calisanTutar: {
          labels: performersData.labels || [],
          values: performersData.tutarlar || []
        },
        // API'den gelen toplam değerler
        _apiTotals: apiTotals,
        // TreeMap için raw data'yı sakla
        _rawPerformers: performersResponse,
        _rawSubeler: subeResponse
      };

      console.log('[Performance] Final chartData:', chartData);
    } catch (mappingError) {
      console.error('[Performance] Data mapping error:', mappingError);
      throw mappingError;
    }

    // Cache the data
    const cacheKey = getCacheKey(currentMode, start, end);
    setCachedData(cacheKey, chartData);

    // Hide loading
    showLoading(false);

    // Update all charts
    updateAllCharts(chartData);

    console.log('[Performance] Data loaded successfully from API');
  } catch (error) {
    console.error('[Performance] API error:', error);
    showLoading(false);
    showToast('Veriler yüklenirken bir hata oluştu: ' + error.message, 'error');
  }
}


// ===== METRICS UPDATE =====
function updateMetrics(data) {
  if (!data || !data._apiTotals) {
    console.warn('[Performance] No stats data for metrics');
    return;
  }

  const totals = data._apiTotals;

  // Mevcut dönem prim (stats endpoint'ten, tarih aralığına göre filtrelenmiş)
  const currentTotal = totals.toplamPrim || 0;
  const previousTotal = totals.oncekiDonemPrim || 0;
  const changePercent = previousTotal > 0
    ? ((currentTotal - previousTotal) / previousTotal * 100).toFixed(1)
    : 0;

  // Poliçe sayısı (stats endpoint'ten)
  const policyCount = totals.toplamPolice || 0;
  const prevPolicyCount = totals.oncekiDonemPoliceSayisi || 0;
  const policyChangePercent = prevPolicyCount > 0
    ? ((policyCount - prevPolicyCount) / prevPolicyCount * 100).toFixed(1)
    : 0;

  console.log('[Performance] Metrics from stats:', totals);

  // Değerleri güncelle
  const currentValueEl = document.getElementById('currentValue');
  const previousValueEl = document.getElementById('previousValue');
  const policyCountEl = document.getElementById('policyCount');
  const currentChangeEl = document.getElementById('currentChange');
  const previousChangeEl = document.getElementById('previousChange');
  const policyChangeEl = document.getElementById('policyChange');

  if (currentValueEl) {
    currentValueEl.textContent = Math.round(currentTotal).toLocaleString('tr-TR') + ' TL';
  }

  if (previousValueEl) {
    previousValueEl.textContent = Math.round(previousTotal).toLocaleString('tr-TR') + ' TL';
  }

  if (policyCountEl) {
    policyCountEl.textContent = policyCount.toLocaleString('tr-TR');
  }

  if (currentChangeEl) {
    if (previousTotal > 0) {
      const isPositive = changePercent >= 0;
      currentChangeEl.textContent = (isPositive ? '+' : '') + changePercent + '%';
      currentChangeEl.className = 'metric-change ' + (isPositive ? 'positive' : 'negative');
    } else {
      currentChangeEl.textContent = '--';
      currentChangeEl.className = 'metric-change';
    }
  }

  if (previousChangeEl) {
    previousChangeEl.textContent = 'Önceki dönem';
    previousChangeEl.className = 'metric-change';
  }

  if (policyChangeEl) {
    if (prevPolicyCount > 0) {
      const isPositive = policyChangePercent >= 0;
      policyChangeEl.textContent = (isPositive ? '+' : '') + policyChangePercent + '%';
      policyChangeEl.className = 'metric-change ' + (isPositive ? 'positive' : 'negative');
    } else {
      policyChangeEl.textContent = '--';
      policyChangeEl.className = 'metric-change';
    }
  }

  console.log('[Performance] Metrics updated:', {
    current: currentTotal,
    previous: previousTotal,
    change: changePercent,
    policies: policyCount,
    policyChange: policyChangePercent
  });
}

// ===== CHART UPDATES =====
function updateAllCharts(data) {
  updateMetrics(data);
  updateCompanyPerformanceChart(data);
  updateDonutCharts(data);
  updateTreeMapChart();
}

function updateCompanyPerformanceChart(data) {
  const container = document.querySelector('#performanceChart');

  // Subtitle'ı period'a göre güncelle
  const subtitleEl = document.querySelector('.performance-card .perf-card-subtitle');
  if (subtitleEl) {
    const periodLabels = {
      'hour': 'Saatlik Görünüm',
      'day': 'Günlük Görünüm',
      'week': 'Haftalık Görünüm',
      'month': 'Aylık Görünüm'
    };
    subtitleEl.textContent = periodLabels[performanceState.companyPeriod] || 'Dönem Karşılaştırması';
  }

  if (!data) {
    console.warn('[Performance] No data for company performance chart');
    if (container) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3v18h18"/>
            <path d="M18 17V9"/>
            <path d="M13 17V5"/>
            <path d="M8 17v-3"/>
          </svg>
          <p>Veri bulunamadı</p>
        </div>
      `;
    }
    return;
  }

  const period = performanceState.companyPeriod;
  const { start: rangeStart, end: rangeEnd } = performanceState.dateRange;
  const totals = data._apiTotals || {};
  let currentData = [];
  let previousData = [];
  let labels = [];

  if (period === 'month') {
    // Aylık: aylik-trend verisini kullan (doğru veri kaynağı)
    if (data.companyPerformance && data.companyPerformance.current && data.companyPerformance.current.length > 0) {
      currentData = data.companyPerformance.current;
      previousData = data.companyPerformance.previous || [];
      labels = data.companyPerformance.labels || [];
      if (labels.length === 0) {
        labels = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'].slice(0, currentData.length);
      }
    }
  } else if (period === 'week') {
    // Haftalık: Ay verilerini haftalık yaklaşık gösterim olarak kullan
    // Son 4-5 ayın verisini haftalara böl
    if (data.companyPerformance && data.companyPerformance.current && data.companyPerformance.current.length > 0) {
      const monthData = data.companyPerformance.current;
      const monthPrev = data.companyPerformance.previous || [];
      // Son 2 ayı al, her ayı ~4 haftaya böl
      const recentMonths = monthData.slice(-2);
      const recentPrev = monthPrev.slice(-2);
      recentMonths.forEach((monthVal, mi) => {
        for (let w = 0; w < 4; w++) {
          currentData.push(Math.round(monthVal / 4));
          previousData.push(Math.round((recentPrev[mi] || 0) / 4));
          labels.push(`${labels.length + 1}. Hafta`);
        }
      });
    }
    // Stats'tan veri varsa ama trend boşsa, basit gösterim
    if (currentData.length === 0 && totals.toplamPrim > 0) {
      const weekCount = 4;
      const weeklyAvg = totals.toplamPrim / weekCount;
      const prevWeeklyAvg = (totals.oncekiDonemPrim || 0) / weekCount;
      for (let w = 0; w < weekCount; w++) {
        currentData.push(Math.round(weeklyAvg));
        previousData.push(Math.round(prevWeeklyAvg));
        labels.push(`${w + 1}. Hafta`);
      }
    }
  } else if (period === 'day') {
    // Günlük: Seçilen tarih aralığındaki günleri göster
    // Backend'de günlük veri yok - stats toplamını gün sayısına böl
    const gunler = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    if (rangeStart && rangeEnd) {
      const diffMs = rangeEnd.getTime() - rangeStart.getTime();
      const dayCount = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
      const dailyAvg = (totals.toplamPrim || 0) / dayCount;
      const prevDailyAvg = (totals.oncekiDonemPrim || 0) / dayCount;
      for (let i = 0; i < dayCount; i++) {
        const d = new Date(rangeStart);
        d.setDate(d.getDate() + i);
        labels.push(`${gunler[d.getDay()]} ${d.getDate()}`);
        currentData.push(Math.round(dailyAvg));
        previousData.push(Math.round(prevDailyAvg));
      }
    }
  } else if (period === 'hour') {
    // Saatlik: Bugün/dün toplam verisi saatlere dağıtılır
    // Backend'de saatlik veri yok - stats toplamını saatlere böl
    const hourCount = 24;
    const now = new Date();
    const currentHour = (rangeStart && rangeStart.toDateString() === now.toDateString())
      ? now.getHours() + 1  // Bugünse şu anki saate kadar göster
      : hourCount;           // Dünse tam 24 saat göster
    const hourlyAvg = currentHour > 0 ? (totals.toplamPrim || 0) / currentHour : 0;
    const prevHourlyAvg = currentHour > 0 ? (totals.oncekiDonemPrim || 0) / currentHour : 0;
    for (let h = 0; h < currentHour; h++) {
      labels.push(`${String(h).padStart(2, '0')}:00`);
      currentData.push(Math.round(hourlyAvg));
      previousData.push(Math.round(prevHourlyAvg));
    }
  }

  // Hiç veri yoksa boş durum göster
  if (currentData.length === 0 && previousData.length === 0) {
    console.warn('[Performance] No chart data for period:', period);
    const totalStr = totals.toplamPrim
      ? Math.round(totals.toplamPrim).toLocaleString('tr-TR') + ' TL'
      : '';
    container.innerHTML = `
      <div class="chart-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v18h18"/>
          <path d="M18 17V9"/>
          <path d="M13 17V5"/>
          <path d="M8 17v-3"/>
        </svg>
        <p>Bu dönem için veri bulunamadı</p>
      </div>
    `;
    return;
  }

  console.log('[Performance] Company chart data:', {
    currentLength: currentData.length,
    previousLength: previousData.length,
    labels: labels,
    currentSample: currentData.slice(0, 3),
    previousSample: previousData.slice(0, 3)
  });

  const options = {
    series: [{
      name: 'Mevcut Dönem',
      data: currentData
    }, {
      name: 'Önceki Dönem',
      data: previousData
    }],
    chart: {
      type: 'area',
      height: 280,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      toolbar: { show: false },
      zoom: { enabled: false }
    },
    colors: ['#6366f1', '#94a3b8'],
    stroke: { curve: 'smooth', width: [3, 2] },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: [0.4, 0.2],
        opacityTo: [0.05, 0],
        stops: [0, 100]
      }
    },
    dataLabels: { enabled: false },
    grid: {
      borderColor: 'rgba(148, 163, 184, 0.15)',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { left: 10, right: 10 }
    },
    xaxis: {
      categories: labels,
      labels: {
        style: { colors: '#64748b', fontSize: '12px', fontWeight: 500 }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b', fontSize: '12px' },
        formatter: (val) => (val / 1000).toFixed(0) + 'K TL'
      }
    },
    tooltip: {
      theme: 'light',
      x: {
        show: true,
        formatter: (val, opts) => {
          const p = performanceState.companyPeriod;
          const idx = opts.dataPointIndex;
          const targetDate = performanceState.dateRange.start;

          if (p === 'hour') {
            const dateStr = targetDate ? targetDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : '';
            return `${dateStr} ${labels[idx] || ''}`;
          } else if (p === 'day') {
            const d = new Date(targetDate);
            d.setDate(d.getDate() + idx);
            return d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
          } else if (p === 'week') {
            return labels[idx] || `${idx + 1}. Hafta`;
          } else {
            return labels[idx] || '';
          }
        }
      },
      y: {
        formatter: (val) => val.toLocaleString('tr-TR') + ' TL'
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: { colors: '#64748b' },
      markers: { width: 10, height: 10, radius: 3 }
    }
  };

  if (charts.performance) {
    charts.performance.destroy();
    charts.performance = null;
  }
  container.innerHTML = '';

  try {
    charts.performance = new ApexCharts(container, options);
    charts.performance.render();
    console.log('[Performance] Company performance chart rendered successfully');
  } catch (error) {
    console.error('[Performance] Error rendering company performance chart:', error);
    if (container) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3v18h18"/>
            <path d="M18 17V9"/>
            <path d="M13 17V5"/>
            <path d="M8 17v-3"/>
          </svg>
          <p>Grafik render hatası</p>
        </div>
      `;
    }
  }
}

function updateDonutCharts(data) {
  if (!data) {
    console.warn('[Performance] No data for donut charts');

    // Show empty state for all donut charts
    const chartIds = ['chartBransAdet', 'chartSubeAdet', 'chartCalisanAdet', 'chartBransTutar', 'chartSubeTutar', 'chartCalisanTutar'];
    chartIds.forEach(id => {
      const container = document.querySelector('#' + id);
      if (container) {
        container.innerHTML = `
          <div class="chart-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <p>Veri bulunamadı</p>
          </div>
        `;
      }
    });

    // Toplam değerleri de sıfırla
    const totalIds = ['totalBransAdet', 'totalSubeAdet', 'totalCalisanAdet'];
    totalIds.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '-- adet'; });
    const totalTutarIds = ['totalBransTutar', 'totalSubeTutar', 'totalCalisanTutar'];
    totalTutarIds.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '-- TL'; });

    return;
  }

  const chartColors = {
    kasko: '#6366f1',
    trafik: '#10b981',
    dask: '#f59e0b',
    saglik: '#ec4899',
    konut: '#8b5cf6',
    isyeri: '#06b6d4'
  };

  const commonOptionsAdet = {
    chart: {
      type: 'donut',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      toolbar: { show: false },
      height: 280,
      animations: { enabled: true, easing: 'easeinout', speed: 600 }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { show: true, fontSize: '14px', color: '#64748b', offsetY: -5 },
            value: {
              show: true,
              fontSize: '20px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              color: '#0f172a',
              offsetY: 5,
              formatter: (val) => parseInt(val).toLocaleString('tr-TR')
            },
            total: {
              show: true,
              label: 'Toplam',
              fontSize: '12px',
              color: '#94a3b8',
              formatter: (w) => {
                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                return parseInt(total).toLocaleString('tr-TR');
              }
            }
          }
        }
      }
    },
    stroke: { show: false },
    legend: {
      position: 'bottom',
      fontSize: '12px',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      labels: { colors: '#64748b' },
      markers: { width: 10, height: 10, radius: 3 },
      itemMargin: { horizontal: 8, vertical: 4 }
    },
    tooltip: {
      theme: 'light',
      y: { formatter: (val) => parseInt(val).toLocaleString('tr-TR') + ' adet' }
    },
    dataLabels: { enabled: false }
  };

  const commonOptionsTutar = {
    ...commonOptionsAdet,
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { show: true, fontSize: '14px', color: '#64748b', offsetY: -5 },
            value: {
              show: true,
              fontSize: '18px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              color: '#0f172a',
              offsetY: 5,
              formatter: (val) => (parseInt(val) / 1000).toFixed(0) + 'K TL'
            },
            total: {
              show: true,
              label: 'Toplam',
              fontSize: '12px',
              color: '#94a3b8',
              formatter: (w) => {
                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                return (parseInt(total) / 1000).toFixed(0) + 'K TL';
              }
            }
          }
        }
      }
    },
    tooltip: {
      theme: 'light',
      y: { formatter: (val) => parseInt(val).toLocaleString('tr-TR') + ' TL' }
    }
  };

  // Helper function to render or show empty state
  const renderDonutChart = (chartKey, elementId, chartData, options, emptyMessage = 'Veri yok') => {
    if (charts[chartKey]) {
      charts[chartKey].destroy();
      charts[chartKey] = null;
    }

    const container = document.querySelector(elementId);
    if (!container) {
      console.warn(`[Performance] Container ${elementId} not found`);
      return;
    }

    // Her render öncesi container'ı temizle (üst üste binmeyi önler)
    container.innerHTML = '';

    if (chartData && chartData.values && chartData.values.length > 0 && chartData.labels && chartData.labels.length > 0) {
      try {
        charts[chartKey] = new ApexCharts(container, options);
        charts[chartKey].render();
      } catch (error) {
        console.error(`[Performance] Error rendering ${chartKey}:`, error);
        container.innerHTML = `<div class="chart-empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg><p>Grafik hatası</p></div>`;
      }
    } else {
      container.innerHTML = `<div class="chart-empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg><p>${emptyMessage}</p></div>`;
    }
  };

  // Branş Adet
  renderDonutChart('bransAdet', '#chartBransAdet', data.bransAdet, {
    ...commonOptionsAdet,
    series: data.bransAdet?.values || [],
    labels: data.bransAdet?.labels || [],
    colors: Object.values(chartColors)
  }, 'Branş verisi yok');

  // Şube Adet
  renderDonutChart('subeAdet', '#chartSubeAdet', data.subeAdet, {
    ...commonOptionsAdet,
    series: data.subeAdet?.values || [],
    labels: data.subeAdet?.labels || [],
    colors: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#eef2ff', '#f1f5f9']
  }, 'Şube verisi yok');

  // Çalışan Adet
  renderDonutChart('calisanAdet', '#chartCalisanAdet', data.calisanAdet, {
    ...commonOptionsAdet,
    series: data.calisanAdet?.values || [],
    labels: data.calisanAdet?.labels || [],
    colors: ['#6366f1', '#818cf8', '#a5b4fc', '#10b981', '#34d399', '#f59e0b', '#fbbf24', '#ec4899', '#f472b6', '#e2e8f0']
  }, 'Çalışan verisi yok');

  // Branş Tutar
  renderDonutChart('bransTutar', '#chartBransTutar', data.bransTutar, {
    ...commonOptionsTutar,
    series: data.bransTutar?.values || [],
    labels: data.bransTutar?.labels || [],
    colors: Object.values(chartColors)
  }, 'Branş tutar verisi yok');

  // Şube Tutar
  renderDonutChart('subeTutar', '#chartSubeTutar', data.subeTutar, {
    ...commonOptionsTutar,
    series: data.subeTutar?.values || [],
    labels: data.subeTutar?.labels || [],
    colors: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#eef2ff', '#f1f5f9']
  }, 'Şube tutar verisi yok');

  // Çalışan Tutar
  renderDonutChart('calisanTutar', '#chartCalisanTutar', data.calisanTutar, {
    ...commonOptionsTutar,
    series: data.calisanTutar?.values || [],
    labels: data.calisanTutar?.labels || [],
    colors: ['#6366f1', '#818cf8', '#a5b4fc', '#10b981', '#34d399', '#f59e0b', '#fbbf24', '#ec4899', '#f472b6', '#e2e8f0']
  }, 'Çalışan tutar verisi yok');

  // Chart total değerlerini API verisinden güncelle
  const sumValues = (arr) => (arr || []).reduce((a, b) => a + b, 0);
  const formatAdet = (val) => val > 0 ? parseInt(val).toLocaleString('tr-TR') + ' adet' : '-- adet';
  const formatTutar = (val) => val > 0 ? parseInt(val).toLocaleString('tr-TR') + ' TL' : '-- TL';

  const totalMap = {
    totalBransAdet: formatAdet(sumValues(data.bransAdet?.values)),
    totalSubeAdet: formatAdet(sumValues(data.subeAdet?.values)),
    totalCalisanAdet: formatAdet(sumValues(data.calisanAdet?.values)),
    totalBransTutar: formatTutar(sumValues(data.bransTutar?.values)),
    totalSubeTutar: formatTutar(sumValues(data.subeTutar?.values)),
    totalCalisanTutar: formatTutar(sumValues(data.calisanTutar?.values))
  };

  Object.entries(totalMap).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
}

function updateTreeMapChart() {
  const view = performanceState.treeMapView;
  const mode = performanceState.treeMapMode;

  // Cache'den data al
  const cacheKey = getCacheKey(
    performanceState.currentMode,
    performanceState.dateRange.start,
    performanceState.dateRange.end
  );
  const cachedData = getCachedData(cacheKey);

  let data = [];

  if (cachedData && cachedData._rawPerformers && cachedData._rawSubeler) {
    // Real API data kullan
    data = DataMappers.mapTreeMapData(
      cachedData._rawPerformers,
      cachedData._rawSubeler,
      view,
      mode
    );
  } else {
    console.warn('[Performance] No cached data for TreeMap');
    const container = document.querySelector('#treemapChart');
    if (container) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <p>Veri bulunamadı</p>
        </div>
      `;
    }
    return;
  }

  // Veri yoksa empty state göster
  if (!data || data.length === 0) {
    console.warn('[Performance] TreeMap data is empty');
    const container = document.querySelector('#treemapChart');
    if (container) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <p>Seçilen kriterlerde veri bulunamadı</p>
        </div>
      `;
    }
    return;
  }

  // Update badge
  const total = data.reduce((sum, item) => sum + (item.y || 0), 0);
  const badge = document.getElementById('totalBadge');
  if (badge) {
    if (mode === 'amount') {
      badge.textContent = (total / 1000).toFixed(0) + 'K TL';
    } else {
      badge.textContent = total.toLocaleString('tr-TR') + ' adet';
    }
  }

  // Final validation - data array içinde valid objeler var mı
  const validData = data.filter(item =>
    item &&
    typeof item.x === 'string' &&
    item.x.length > 0 &&
    typeof item.y === 'number' &&
    item.y > 0
  );

  if (validData.length === 0) {
    console.warn('[Performance] No valid TreeMap data after filtering');
    const container = document.querySelector('#treemapChart');
    if (container) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <p>Geçerli veri bulunamadı</p>
        </div>
      `;
    }
    return;
  }

  console.log('[Performance] Rendering TreeMap with', validData.length, 'items');

  const options = {
    series: [{ data: validData }],
    chart: {
      type: 'treemap',
      height: 420,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 500 }
    },
    colors: ['#6366f1', '#818cf8', '#a5b4fc', '#10b981', '#34d399', '#f59e0b', '#fbbf24', '#ec4899', '#f472b6', '#cbd5e1'],
    plotOptions: {
      treemap: {
        distributed: true,
        enableShades: false,
        borderRadius: 8
      }
    },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: '14px',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontWeight: 600,
        colors: ['#ffffff']
      },
      formatter: function(text, op) {
        const value = op.value;
        const formattedValue = mode === 'amount'
          ? (value / 1000).toFixed(0) + 'K TL'
          : value.toLocaleString('tr-TR');
        return [text, formattedValue];
      }
    },
    tooltip: {
      theme: 'light',
      y: {
        formatter: (val) => mode === 'amount'
          ? val.toLocaleString('tr-TR') + ' TL'
          : val.toLocaleString('tr-TR') + ' adet'
      }
    },
    legend: { show: false }
  };

  if (charts.treemap) {
    charts.treemap.destroy();
    charts.treemap = null;
  }

  const treemapContainer = document.querySelector('#treemapChart');
  if (treemapContainer) {
    treemapContainer.innerHTML = '';
    charts.treemap = new ApexCharts(treemapContainer, options);
    charts.treemap.render();
  }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Performance] Page loaded, initializing...');

  // Initialize Flatpickr
  initializeFlatpickr();

  // Set today as default
  handlePreset('today', document.querySelector('[data-range="today"]'));

  console.log('[Performance] Initialization complete');
});
