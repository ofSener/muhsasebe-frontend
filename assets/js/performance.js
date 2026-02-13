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
  treeMapView: 'employee',     // 'employee', 'branch'
  treeMapMode: 'amount',       // 'amount', 'count'
  selectedBransIds: [],
  selectedSirketIds: [],
  bransOptions: [],
  sirketOptions: []
};

// ===== ZOOM STATE =====
let zoomState = {
  baseLevel: 'day',    // Tarih aralığına göre belirlenir: 'month', 'day'
  level: 'day',        // Mevcut zoom seviyesi
  context: null         // Zoom bağlamı: { year, month }
};
let zoomStack = [];     // Zoom geçmişi (geri almak için)

// ===== CACHE SYSTEM =====
const performanceCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

function getCacheKey(mode, startDate, endDate) {
  const brans = (performanceState.selectedBransIds || []).sort().join(',');
  const sirket = (performanceState.selectedSirketIds || []).sort().join(',');
  return `${mode}_${startDate.toISOString()}_${endDate.toISOString()}_b${brans}_s${sirket}`;
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
function _buildFilterParams(mode, startDate, endDate) {
  const params = {
    mode: mode,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
  if (performanceState.selectedBransIds.length > 0)
    params.bransIds = performanceState.selectedBransIds.join(',');
  if (performanceState.selectedSirketIds.length > 0)
    params.sirketIds = performanceState.selectedSirketIds.join(',');
  return params;
}

const PerformanceAPI = {
  async getBransDagilim(mode, startDate, endDate) {
    const params = _buildFilterParams(mode, startDate, endDate);
    const result = await apiGet('dashboard/brans-dagilim', params);
    return result;
  },

  async getSubeDagilim(mode, startDate, endDate) {
    const params = _buildFilterParams(mode, startDate, endDate);
    const result = await apiGet('dashboard/sube-dagilim', params);
    return result;
  },

  async getTopPerformers(mode, startDate, endDate, limit = 10) {
    const params = { ..._buildFilterParams(mode, startDate, endDate), limit };
    const result = await apiGet('dashboard/top-performers', params);
    return result;
  },

  async getStats(mode, startDate, endDate) {
    const params = _buildFilterParams(mode, startDate, endDate);
    const result = await apiGet('dashboard/stats', params);
    return result;
  },

  async getAylikTrend(mode, startDate, endDate) {
    const params = _buildFilterParams(mode, startDate, endDate);
    const result = await apiGet('dashboard/aylik-trend', params);
    return result;
  },

  async getGunlukTrend(mode, startDate, endDate) {
    const params = _buildFilterParams(mode, startDate, endDate);
    const result = await apiGet('dashboard/gunluk-trend', params);
    return result;
  },

  async getSirketDagilim(mode, startDate, endDate) {
    const params = _buildFilterParams(mode, startDate, endDate);
    const result = await apiGet('dashboard/sirket-dagilim', params);
    return result;
  },

  async getKarsilastirmaTrend(mode, startDate, endDate, groupBy, entityIds) {
    const params = {
      ..._buildFilterParams(mode, startDate, endDate),
      groupBy: groupBy,
      entityIds: entityIds.join(',')
    };
    const result = await apiGet('dashboard/karsilastirma-trend', params);
    return result;
  }
};

// ===== ZOOM HELPERS =====
function getAutoLevel(start, end) {
  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays <= 31) return 'day';
  return 'month';
}

function parseMonthNumber(ayStr) {
  const shorts = ['oca', 'şub', 'mar', 'nis', 'may', 'haz', 'tem', 'ağu', 'eyl', 'eki', 'kas', 'ara'];
  const lower = (ayStr || '').toLocaleLowerCase('tr-TR');
  for (let i = 0; i < shorts.length; i++) {
    if (lower.startsWith(shorts[i])) return i + 1;
  }
  return 1;
}

function resetZoom(start, end) {
  const base = getAutoLevel(start, end);
  zoomState = { baseLevel: base, level: base, context: null };
  zoomStack = [];
}

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
    const meta = apiResponse.trend.map(item => ({
      ay: item.ay,
      yil: item.yil || new Date().getFullYear(),
      monthNo: parseMonthNumber(item.ay),
      brutPrim: item.brutPrim || 0
    }));

    console.log('[DataMappers] Trend mapped:', { labels, currentSample: current.slice(0, 3) });

    return { labels, current, previous: [], meta };
  },

  /**
   * Günlük trend API response'unu chart formatına çevirir
   */
  mapGunlukTrend(apiResponse) {
    if (!apiResponse || !apiResponse.trend || !Array.isArray(apiResponse.trend)) {
      return { labels: [], current: [], meta: [] };
    }
    const labels = apiResponse.trend.map(item => item.gun || 'N/A');
    const current = apiResponse.trend.map(item => item.brutPrim || 0);
    const meta = apiResponse.trend.map(item => ({
      gun: item.gun,
      tarih: item.tarih,
      gunSirasi: item.gunSirasi,
      brutPrim: item.brutPrim || 0
    }));
    return { labels, current, previous: [], meta };
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

        console.log('[Performance] Date range changed:', performanceState.dateRange);
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
    case 'last7':
      start = new Date(today);
      start.setDate(today.getDate() - 6);
      end = new Date();
      break;
    case 'last30':
      start = new Date(today);
      start.setDate(today.getDate() - 29);
      end = new Date();
      break;
    case 'last365':
      start = new Date(today);
      start.setDate(today.getDate() - 364);
      end = new Date();
      break;
  }

  performanceState.dateRange = { start, end };
  if (flatpickrInstance) flatpickrInstance.setDate([start, end]);

  // Update active state
  document.querySelectorAll('.preset-btn').forEach(btn =>
    btn.classList.remove('active'));
  button.classList.add('active');

  console.log('[Performance] Preset selected:', range);
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

// ===== TREEMAP CONTROLS =====
function setTreeView(view) {
  performanceState.treeMapView = view;

  // Update buttons (.control-section:nth-of-type(2) = Grouping section)
  document.querySelectorAll('.control-section:nth-of-type(2) .option-btn').forEach(btn => {
    const isEmployee = btn.textContent.includes('Çalışanlara');
    btn.classList.toggle('active', (view === 'employee' && isEmployee) || (view === 'branch' && !isEmployee));
  });

  // Update breadcrumb
  document.getElementById('breadcrumbActive').textContent = view === 'employee' ? 'Çalışanlar' : 'Şubeler';

  console.log('[Performance] TreeMap view changed:', view);
  updateTreeMapChart();
  populateComparisonOptions();
}

function setTreeMode(mode) {
  performanceState.treeMapMode = mode;

  // Update buttons (.control-section:nth-of-type(3) = Metric Type section)
  document.querySelectorAll('.control-section:nth-of-type(3) .option-btn').forEach(btn => {
    const isAmount = btn.textContent.includes('Tutar');
    btn.classList.toggle('active', (mode === 'amount' && isAmount) || (mode === 'count' && !isAmount));
  });

  console.log('[Performance] TreeMap mode changed:', mode);
  updateTreeMapChart();
  updateComparisonChart();
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
  treemap: null,
  comparison: null
};

// ===== FILTER CHANGE HANDLER =====
function onFilterChange() {
  // Reset zoom on filter change
  resetZoom(performanceState.dateRange.start, performanceState.dateRange.end);

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

    // Tarih aralığına göre günlük/aylık trend seç
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const useDaily = diffDays <= 31;

    // Paralel API çağrıları
    const [bransResponse, subeResponse, performersResponse, trendResponse, statsResponse, sirketResponse] = await Promise.all([
      PerformanceAPI.getBransDagilim(currentMode, start, end),
      PerformanceAPI.getSubeDagilim(currentMode, start, end),
      PerformanceAPI.getTopPerformers(currentMode, start, end, 10),
      useDaily
        ? PerformanceAPI.getGunlukTrend(currentMode, start, end)
        : PerformanceAPI.getAylikTrend(currentMode, start, end),
      PerformanceAPI.getStats(currentMode, start, end),
      PerformanceAPI.getSirketDagilim(currentMode, start, end)
    ]);

    console.log('[Performance] API responses received:', {
      brans: bransResponse,
      sube: subeResponse,
      performers: performersResponse,
      trend: trendResponse,
      stats: statsResponse,
      sirket: sirketResponse
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
      const trendData = useDaily
        ? DataMappers.mapGunlukTrend(trendResponse)
        : DataMappers.mapAylikTrend(trendResponse);

      chartData = {
        companyPerformance: trendData,
        _trendGranularity: useDaily ? 'daily' : 'monthly',
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
        _apiTotals: apiTotals,
        _rawPerformers: performersResponse,
        _rawSubeler: subeResponse,
        _rawSirketler: sirketResponse
      };

      // İlk yüklemede filtre seçeneklerini doldur
      populateBransFilterOptions(bransResponse);
      populateSirketFilterOptions(sirketResponse);

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
  populateComparisonOptions();
}

function updateCompanyPerformanceChart(data) {
  const container = document.querySelector('#performanceChart');

  // Zoom UI güncelle
  updateZoomUI();

  const emptyHTML = `
    <div class="chart-empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
      </svg>
      <p>Veri bulunamadı</p>
    </div>`;

  if (!data) {
    if (container) container.innerHTML = emptyHTML;
    return;
  }

  const { start: rangeStart, end: rangeEnd } = performanceState.dateRange;
  const totals = data._apiTotals || {};
  let currentData = [];
  let previousData = [];
  let labels = [];
  const level = zoomState.level;

  if (level === 'month') {
    // Aylık: aylik-trend verisini kullan (gerçek veri)
    if (data.companyPerformance?.current?.length > 0) {
      currentData = [...data.companyPerformance.current];
      labels = [...(data.companyPerformance.labels || [])];
      if (labels.length === 0) {
        labels = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'].slice(0, currentData.length);
      }
    }
  } else if (level === 'day') {
    // Zoom'dan gelen günlük veri varsa onu kullan
    if (zoomState.context?.dailyData) {
      const daily = zoomState.context.dailyData;
      labels = [...(daily.labels || [])];
      currentData = [...(daily.current || [])];
    } else if (data._trendGranularity === 'daily' && data.companyPerformance?.current?.length > 0) {
      // Base level: API'den gelen gerçek günlük veri
      currentData = [...data.companyPerformance.current];
      labels = [...(data.companyPerformance.labels || [])];
    }
  }

  // Veri yoksa
  if (currentData.length === 0) {
    if (container) container.innerHTML = emptyHTML.replace('Veri bulunamadı', 'Bu dönem için veri bulunamadı');
    return;
  }

  const series = [{ name: 'Mevcut Dönem', data: currentData }];
  if (previousData.length > 0 && previousData.some(v => v > 0)) {
    series.push({ name: 'Önceki Dönem', data: previousData });
  }

  const canZoomIn = level === 'month';

  const options = {
    series: series,
    chart: {
      type: 'area',
      height: 280,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      toolbar: { show: false },
      zoom: { enabled: false }
    },
    colors: ['#6366f1', '#94a3b8'],
    stroke: { curve: 'smooth', width: series.length > 1 ? [3, 2] : [3] },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: series.length > 1 ? [0.4, 0.2] : [0.4],
        opacityTo: series.length > 1 ? [0.05, 0] : [0.05],
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
        style: { colors: '#64748b', fontSize: '12px', fontWeight: 500 },
        rotate: labels.length > 15 ? -45 : 0,
        rotateAlways: labels.length > 15
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b', fontSize: '12px' },
        formatter: (val) => {
          if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M TL';
          if (val >= 1000) return (val / 1000).toFixed(0) + 'K TL';
          return Math.round(val) + ' TL';
        }
      }
    },
    tooltip: {
      theme: 'light',
      x: { show: true },
      y: { formatter: (val) => val.toLocaleString('tr-TR') + ' TL' }
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
    // Cursor: zoom-in if can drill deeper
    container.style.cursor = canZoomIn ? 'zoom-in' : 'default';
  } catch (error) {
    console.error('[Performance] Error rendering chart:', error);
    if (container) container.innerHTML = emptyHTML.replace('Veri bulunamadı', 'Grafik render hatası');
  }
}

// ===== ZOOM FUNCTIONS =====
function getCurrentCachedData() {
  const cacheKey = getCacheKey(
    performanceState.currentMode,
    performanceState.dateRange.start,
    performanceState.dateRange.end
  );
  return getCachedData(cacheKey);
}

async function handleZoomIn(dataPointIndex) {
  const cachedData = getCurrentCachedData();
  if (!cachedData) return;

  if (zoomState.level === 'month') {
    // Month → Day: belirli aya zoom, API'den günlük veri çek
    const meta = cachedData.companyPerformance?.meta;
    if (!meta || !meta[dataPointIndex]) return;

    const m = meta[dataPointIndex];
    const year = m.yil;
    const month = m.monthNo;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0); // Ayın son günü

    // API'den gerçek günlük veri çek
    try {
      const { currentMode } = performanceState;
      const dailyResponse = await PerformanceAPI.getGunlukTrend(currentMode, monthStart, monthEnd);
      const dailyData = DataMappers.mapGunlukTrend(dailyResponse);

      zoomStack.push({ level: 'month', context: zoomState.context ? { ...zoomState.context } : null });
      zoomState.level = 'day';
      zoomState.context = { year, month, dailyData };
    } catch (err) {
      console.error('[Performance] Zoom günlük veri hatası:', err);
      return;
    }
  } else {
    return; // day'den ileriye gidemez
  }

  updateCompanyPerformanceChart(cachedData);
  updateMetrics(cachedData);
}

function handleZoomOut() {
  if (zoomStack.length === 0) return;

  const prev = zoomStack.pop();
  zoomState.level = prev.level;
  zoomState.context = prev.context;

  const cachedData = getCurrentCachedData();
  updateCompanyPerformanceChart(cachedData);
  updateMetrics(cachedData);
}

function updateZoomUI() {
  const breadcrumb = document.getElementById('zoomBreadcrumb');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomHint = document.getElementById('zoomHint');
  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  const canZoomOut = zoomStack.length > 0;
  const canZoomIn = zoomState.level === 'month';

  if (zoomOutBtn) zoomOutBtn.style.display = canZoomOut ? 'flex' : 'none';

  if (breadcrumb) {
    if (zoomState.level === 'month') {
      breadcrumb.textContent = 'Aylık Görünüm';
    } else if (zoomState.level === 'day') {
      if (zoomState.context?.month) {
        breadcrumb.textContent = `${monthNames[zoomState.context.month - 1]} ${zoomState.context.year} · Günlük`;
      } else {
        breadcrumb.textContent = 'Günlük Görünüm';
      }
    }
  }

  if (zoomHint) {
    zoomHint.style.display = canZoomIn ? '' : 'none';
  }
}

function getHoveredDataIndex(e, container) {
  const plotArea = container.querySelector('.apexcharts-plot-area');
  if (!plotArea) return 0;

  const rect = plotArea.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const plotWidth = rect.width;

  const chart = charts.performance;
  if (!chart || !chart.w) return 0;

  const dataLength = chart.w.globals.dataPoints;
  if (dataLength <= 1) return 0;

  const index = Math.round((mouseX / plotWidth) * (dataLength - 1));
  return Math.max(0, Math.min(dataLength - 1, index));
}

function initChartZoom() {
  const perfChart = document.querySelector('#performanceChart');
  if (!perfChart) return;

  const chartContainer = perfChart.closest('.chart-container');
  if (!chartContainer) return;

  let lastZoomTime = 0;
  const ZOOM_DEBOUNCE = 400;

  chartContainer.addEventListener('wheel', (e) => {
    const rect = perfChart.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom) return;

    e.preventDefault();

    const now = Date.now();
    if (now - lastZoomTime < ZOOM_DEBOUNCE) return;
    lastZoomTime = now;

    if (e.deltaY < 0) {
      // Scroll up = zoom in
      const index = getHoveredDataIndex(e, perfChart);
      handleZoomIn(index);
    } else if (e.deltaY > 0) {
      // Scroll down = zoom out
      handleZoomOut();
    }
  }, { passive: false });
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
      itemMargin: { horizontal: 8, vertical: 4 },
      height: 60,
      floating: false
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

  // Footer istatistiklerini güncelle
  const footerBrans = document.getElementById('footerBransAdet');
  if (footerBrans) footerBrans.textContent = (data.bransAdet?.labels?.length || 0) + ' farklı branş';
  const footerSube = document.getElementById('footerSubeAdet');
  if (footerSube) footerSube.textContent = (data.subeAdet?.labels?.length || 0) + ' şube';
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

// ===== FILTER DRAWER (scroll-activated, captured.html style) =====
let _drawerActive = false;

function initFilterDrawer() {
  const filtersEl = document.getElementById('filterCard');
  const sentinel = document.getElementById('filterCardSentinel');
  const toggleBtn = document.getElementById('filterDrawerToggle');
  const backdrop = document.getElementById('filterDrawerBackdrop');
  if (!filtersEl || !sentinel || !toggleBtn || !backdrop) return;

  let normalHeight = filtersEl.offsetHeight;
  let filtersBottom = filtersEl.getBoundingClientRect().bottom + window.scrollY;

  function recalcPosition() {
    if (!_drawerActive) {
      normalHeight = filtersEl.offsetHeight;
      filtersBottom = filtersEl.getBoundingClientRect().bottom + window.scrollY;
    }
  }

  function openDrawer() {
    filtersEl.classList.add('drawer-open');
    toggleBtn.classList.add('active');
    backdrop.classList.add('visible');
  }

  function closeDrawer() {
    filtersEl.classList.remove('drawer-open');
    toggleBtn.classList.remove('active');
    backdrop.classList.remove('visible');
  }

  function enterDrawerMode() {
    if (_drawerActive) return;
    _drawerActive = true;
    sentinel.style.height = normalHeight + 'px';
    filtersEl.classList.add('drawer-mode');
    toggleBtn.classList.add('visible');
  }

  function exitDrawerMode() {
    if (!_drawerActive) return;
    closeDrawer();
    _drawerActive = false;
    filtersEl.classList.remove('drawer-mode');
    toggleBtn.classList.remove('visible');
    sentinel.style.height = '0';
    requestAnimationFrame(recalcPosition);
  }

  // Toggle button click
  toggleBtn.addEventListener('click', function() {
    if (filtersEl.classList.contains('drawer-open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  // Click outside drawer closes it
  document.addEventListener('mousedown', function(e) {
    if (filtersEl.classList.contains('drawer-open') &&
        !filtersEl.contains(e.target) &&
        !toggleBtn.contains(e.target)) {
      closeDrawer();
    }
  });

  // Escape key closes drawer
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && _drawerActive) closeDrawer();
  });

  let ticking = false;

  function checkDrawer() {
    const scrolledPast = window.scrollY > filtersBottom;
    if (scrolledPast && !_drawerActive) {
      enterDrawerMode();
    } else if (!scrolledPast && _drawerActive) {
      exitDrawerMode();
    }
  }

  window.addEventListener('resize', function() {
    recalcPosition();
    checkDrawer();
  });

  requestAnimationFrame(checkDrawer);

  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(function() {
        checkDrawer();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // Recalc on content changes
  const pageContent = document.querySelector('.page-content') || document.querySelector('.main-content');
  if (pageContent) {
    const obs = new MutationObserver(function() { if (!_drawerActive) recalcPosition(); });
    obs.observe(pageContent, { childList: true, subtree: true });
  }
}

// ===== COMPARISON CHART =====
const comparisonColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#14b8a6'];

function toggleComparisonDropdown(e) {
  e?.stopPropagation();
  const dd = document.getElementById('comparisonDropdown');
  if (!dd) return;
  const wasOpen = dd.classList.contains('open');
  dd.classList.toggle('open');
  if (!wasOpen) {
    const searchInput = dd.querySelector('.multi-select-search input');
    if (searchInput) {
      searchInput.value = '';
      filterDropdownSearch('comparisonList', '');
    }
  }
}

function comparisonSelectAll() {
  document.querySelectorAll('#comparisonList input[type="checkbox"]').forEach(cb => {
    cb.checked = true;
    cb.closest('.multi-select-item')?.classList.add('checked');
  });
  onComparisonSelectionChange();
}

function comparisonClearAll() {
  document.querySelectorAll('#comparisonList input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
    cb.closest('.multi-select-item')?.classList.remove('checked');
  });
  onComparisonSelectionChange();
}

function populateComparisonOptions() {
  const list = document.getElementById('comparisonList');
  if (!list) return;

  const cachedData = getCurrentCachedData();
  if (!cachedData) return;

  const view = performanceState.treeMapView;
  let items = [];

  if (view === 'employee' && cachedData._rawPerformers?.performers) {
    items = cachedData._rawPerformers.performers
      .filter(p => p && p.adSoyad)
      .map(p => ({
        label: p.adSoyad,
        value: p.toplamBrutPrim || 0,
        count: p.policeSayisi || 0
      }));
  } else if (view === 'branch' && cachedData._rawSubeler?.dagilim) {
    items = cachedData._rawSubeler.dagilim
      .filter(s => s && s.subeAdi)
      .map(s => ({
        label: s.subeAdi,
        value: s.toplamBrutPrim || 0,
        count: s.policeSayisi || 0
      }));
  }

  list.innerHTML = items.map((item, i) => `
    <label class="multi-select-item">
      <input type="checkbox" value="${i}" data-label="${item.label}" data-value="${item.value}" data-count="${item.count}" onchange="onComparisonItemChange(this)">
      <span>${item.label}</span>
    </label>
  `).join('');

  // Update title
  const title = document.getElementById('comparisonTitle');
  if (title) title.textContent = `Karşılaştırma · ${view === 'employee' ? 'Çalışanlar' : 'Şubeler'}`;

  // Update label
  const label = document.getElementById('comparisonSelectLabel');
  if (label) label.textContent = view === 'employee' ? 'Çalışan seçin...' : 'Şube seçin...';

  // Reset count
  const count = document.getElementById('comparisonSelectCount');
  if (count) { count.style.display = 'none'; count.textContent = '0'; }

  // Reset chart to empty state
  updateComparisonChart();
}

function onComparisonItemChange(cb) {
  const item = cb.closest('.multi-select-item');
  if (item) item.classList.toggle('checked', cb.checked);
  onComparisonSelectionChange();
}

function onComparisonSelectionChange() {
  const checked = document.querySelectorAll('#comparisonList input[type="checkbox"]:checked');
  const count = document.getElementById('comparisonSelectCount');
  const label = document.getElementById('comparisonSelectLabel');

  if (count) {
    count.textContent = checked.length;
    count.style.display = checked.length > 0 ? '' : 'none';
  }
  if (label) {
    if (checked.length === 0) {
      label.textContent = performanceState.treeMapView === 'employee' ? 'Çalışan seçin...' : 'Şube seçin...';
    } else {
      label.textContent = `${checked.length} seçili`;
    }
  }

  updateComparisonChart();
}

async function updateComparisonChart() {
  const container = document.getElementById('comparisonChart');
  if (!container) return;

  const checked = document.querySelectorAll('#comparisonList input[type="checkbox"]:checked');

  if (checked.length < 2) {
    if (charts.comparison) {
      charts.comparison.destroy();
      charts.comparison = null;
    }
    container.innerHTML = `
      <div class="comparison-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <p>Karşılaştırma için en az 2 öğe seçin</p>
      </div>`;
    return;
  }

  // Entity ID'lerini çözümle
  const cachedData = getCurrentCachedData();
  const view = performanceState.treeMapView;
  const entityIds = [];

  checked.forEach(cb => {
    const idx = parseInt(cb.value);
    if (view === 'employee' && cachedData?._rawPerformers?.performers?.[idx]) {
      entityIds.push(cachedData._rawPerformers.performers[idx].uyeId);
    } else if (view === 'branch' && cachedData?._rawSubeler?.dagilim?.[idx]) {
      entityIds.push(cachedData._rawSubeler.dagilim[idx].subeId);
    }
  });

  if (entityIds.length < 2) {
    container.innerHTML = '<div class="comparison-empty"><p>Seçilen öğeler için ID bulunamadı</p></div>';
    return;
  }

  // Loading göster
  container.innerHTML = '<div class="comparison-empty"><p>Yükleniyor...</p></div>';

  try {
    const { currentMode, dateRange } = performanceState;
    const groupBy = view === 'employee' ? 'calisan' : 'sube';
    const trendResponse = await PerformanceAPI.getKarsilastirmaTrend(
      currentMode, dateRange.start, dateRange.end, groupBy, entityIds
    );

    if (!trendResponse || !trendResponse.series || trendResponse.series.length === 0) {
      container.innerHTML = '<div class="comparison-empty"><p>Karşılaştırma verisi bulunamadı</p></div>';
      return;
    }

    // Her entity için bir seri oluştur
    const mode = performanceState.treeMapMode;
    const allLabels = trendResponse.series[0]?.trend?.map(t => t.etiket) || [];
    const series = trendResponse.series.map((s, i) => ({
      name: s.entityAdi,
      data: s.trend.map(t => mode === 'amount' ? (t.brutPrim || 0) : (t.policeSayisi || 0))
    }));
    const colors = series.map((_, i) => comparisonColors[i % comparisonColors.length]);

    const options = {
      series: series,
      chart: {
        type: 'area',
        height: 320,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        toolbar: { show: false },
        zoom: { enabled: false }
      },
      colors: colors,
      stroke: { curve: 'smooth', width: 2.5 },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05, stops: [0, 100] }
      },
      dataLabels: { enabled: false },
      grid: {
        borderColor: 'rgba(148, 163, 184, 0.15)',
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } }
      },
      xaxis: {
        categories: allLabels,
        labels: {
          style: { colors: '#64748b', fontSize: '11px' },
          rotate: allLabels.length > 15 ? -45 : 0,
          rotateAlways: allLabels.length > 15
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: {
          style: { colors: '#64748b', fontSize: '12px' },
          formatter: (val) => {
            if (mode === 'amount') {
              if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return (val / 1000).toFixed(0) + 'K';
              return Math.round(val) + '';
            }
            return Math.round(val).toLocaleString('tr-TR');
          }
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
      legend: {
        position: 'top',
        horizontalAlign: 'left',
        labels: { colors: '#64748b' },
        markers: { width: 10, height: 10, radius: 3 }
      }
    };

    if (charts.comparison) {
      charts.comparison.destroy();
      charts.comparison = null;
    }
    container.innerHTML = '';

    charts.comparison = new ApexCharts(container, options);
    charts.comparison.render();
  } catch (error) {
    console.error('[Performance] Comparison chart error:', error);
    container.innerHTML = '<div class="comparison-empty"><p>Grafik yüklenirken hata oluştu</p></div>';
  }
}

// ===== FILTER DROPDOWNS (Branş / Şirket) =====
function toggleFilterDropdown(type, e) {
  e?.stopPropagation();
  const dd = document.getElementById(type + 'FilterDropdown');
  if (!dd) return;
  // Diğer dropdown'ları kapat
  ['brans', 'sirket'].forEach(t => {
    if (t !== type) {
      const other = document.getElementById(t + 'FilterDropdown');
      if (other) other.classList.remove('open');
    }
  });
  const wasOpen = dd.classList.contains('open');
  dd.classList.toggle('open');
  if (!wasOpen) {
    const searchInput = dd.querySelector('.multi-select-search input');
    if (searchInput) {
      searchInput.value = '';
      filterDropdownSearch(type + 'FilterList', '');
    }
  }
}

function filterSelectAll(type) {
  document.querySelectorAll(`#${type}FilterList input[type="checkbox"]`).forEach(cb => {
    cb.checked = true;
    cb.closest('.multi-select-item')?.classList.add('checked');
  });
  onFilterDropdownChange(type);
}

function filterClearAll(type) {
  document.querySelectorAll(`#${type}FilterList input[type="checkbox"]`).forEach(cb => {
    cb.checked = false;
    cb.closest('.multi-select-item')?.classList.remove('checked');
  });
  onFilterDropdownChange(type);
}

function filterDropdownSearch(listId, query) {
  const list = document.getElementById(listId);
  if (!list) return;
  const q = query.toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
  list.querySelectorAll('.multi-select-item').forEach(item => {
    const label = (item.querySelector('.item-label')?.textContent || item.textContent || '')
      .toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
    item.style.display = label.includes(q) ? '' : 'none';
  });
}

function onFilterItemChange(type, cb) {
  const item = cb.closest('.multi-select-item');
  if (item) item.classList.toggle('checked', cb.checked);
  onFilterDropdownChange(type);
}

function onFilterDropdownChange(type) {
  const checked = document.querySelectorAll(`#${type}FilterList input[type="checkbox"]:checked`);
  const ids = Array.from(checked).map(cb => parseInt(cb.value));

  if (type === 'brans') {
    performanceState.selectedBransIds = ids;
  } else {
    performanceState.selectedSirketIds = ids;
  }

  // Count badge güncelle
  const countEl = document.getElementById(type + 'FilterCount');
  if (countEl) {
    countEl.textContent = ids.length;
    countEl.style.display = ids.length > 0 ? '' : 'none';
  }

  // Cache temizle ve yeniden yükle
  Object.keys(performanceCache).forEach(k => delete performanceCache[k]);
  onFilterChange();
}

function populateBransFilterOptions(bransResponse) {
  const list = document.getElementById('bransFilterList');
  if (!list || !bransResponse?.dagilim) return;

  // Eğer zaten aynı seçenekler varsa tekrar oluşturma
  const newOptions = bransResponse.dagilim.filter(b => b && b.bransAdi).map(b => ({
    id: b.bransId,
    name: b.bransAdi
  }));

  if (JSON.stringify(performanceState.bransOptions) === JSON.stringify(newOptions)) return;
  performanceState.bransOptions = newOptions;

  list.innerHTML = newOptions.map(b => `
    <label class="multi-select-item">
      <input type="checkbox" value="${b.id}" onchange="onFilterItemChange('brans', this)">
      <span>${b.name}</span>
    </label>
  `).join('');
}

function populateSirketFilterOptions(sirketResponse) {
  const list = document.getElementById('sirketFilterList');
  if (!list || !sirketResponse?.dagilim) return;

  const newOptions = sirketResponse.dagilim.filter(s => s && s.sirketAdi).map(s => ({
    id: s.sirketId,
    name: s.sirketAdi
  }));

  if (JSON.stringify(performanceState.sirketOptions) === JSON.stringify(newOptions)) return;
  performanceState.sirketOptions = newOptions;

  list.innerHTML = newOptions.map(s => `
    <label class="multi-select-item">
      <input type="checkbox" value="${s.id}" onchange="onFilterItemChange('sirket', this)">
      <span>${s.name}</span>
    </label>
  `).join('');
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Performance] Page loaded, initializing...');

  // Initialize Flatpickr
  initializeFlatpickr();

  // Initialize chart zoom (scroll drill-down)
  initChartZoom();

  // Set today as default
  handlePreset('today', document.querySelector('[data-range="today"]'));

  // Initialize scroll-activated filter drawer
  initFilterDrawer();

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    // Comparison dropdown
    const dd = document.getElementById('comparisonDropdown');
    const ms = document.getElementById('comparisonMultiSelect');
    if (dd && dd.classList.contains('open') && ms && !ms.contains(e.target)) {
      dd.classList.remove('open');
    }
    // Filter dropdowns
    ['brans', 'sirket'].forEach(type => {
      const fdd = document.getElementById(type + 'FilterDropdown');
      const fms = document.getElementById(type + 'FilterSelect');
      if (fdd && fdd.classList.contains('open') && fms && !fms.contains(e.target)) {
        fdd.classList.remove('open');
      }
    });
  });

  // Escape key closes all dropdowns
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['comparisonDropdown', 'bransFilterDropdown', 'sirketFilterDropdown'].forEach(id => {
        const dd = document.getElementById(id);
        if (dd && dd.classList.contains('open')) dd.classList.remove('open');
      });
    }
  });

  console.log('[Performance] Initialization complete');
});
