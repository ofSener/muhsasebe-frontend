    // ═══════════════════════════════════════════════════════════════
    // GLOBAL STATE
    // ═══════════════════════════════════════════════════════════════

    // Dashboard Mode: 0 = Onaylı Poliçeler, 1 = Yakalanan Poliçeler
    let currentMode = 1;  // Default: Yakalanan Poliçeler

    let currentFilters = {
      startDate: null,
      endDate: null,
      bransIds: [],
      kullaniciIds: [],
      subeIds: [],
      sirketIds: []
    };

    // Multi-select state
    const multiSelectState = {
      brans: [],
      kullanici: [],
      sube: [],
      sirket: []
    };

    // Cached data for dropdowns
    let branslarCache = [];
    let kullanicilarCache = [];
    let subelerCache = [];
    let sirketlerCache = [];

    // Helper: format Date to local YYYY-MM-DD (avoids UTC shift from toISOString)
    function toLocalDateString(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // Cached data for tables (for sorting)
    let bransData = [];
    let sirketData = [];
    let subeData = [];
    let kullaniciData = [];
    let gunData = [];

    // Chart instances
    let bransDonutChart = null;
    let gunlukTrendChart = null;

    // Current sort state
    let sortState = {
      brans: { column: 'tutar', direction: 'desc' },
      sirket: { column: 'tutar', direction: 'desc' },
      sube: { column: 'tutar', direction: 'desc' },
      kullanici: { column: 'tutar', direction: 'desc' },
      gun: { column: 'tutar', direction: 'desc' }
    };

    // ═══════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function getCurrentFirmaId() {
      const user = APP_CONFIG.AUTH.getUser();
      return user?.firmaId || 1;
    }

    // ═══════════════════════════════════════════════════════════════
    // MULTI-SELECT FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function toggleMultiSelect(id) {
      const el = document.getElementById(id);
      const wasOpen = el.classList.contains('open');

      // Close all other dropdowns
      document.querySelectorAll('.multi-select.open').forEach(ms => {
        if (ms.id !== id) ms.classList.remove('open');
      });

      el.classList.toggle('open');

      if (!wasOpen) {
        const searchInput = el.querySelector('.multi-select-search input');
        if (searchInput) {
          searchInput.value = '';
          filterMultiSelectOptions(id, '');
          searchInput.focus();
        }
      }
    }

    function populateMultiSelect(id, items, valueKey, labelKey) {
      const container = document.getElementById(id.replace('MultiSelect', 'Options'));
      if (!container) return;

      container.innerHTML = items.map(item => {
        const value = item[valueKey];
        const label = typeof labelKey === 'function' ? labelKey(item) : item[labelKey];
        return `
          <label class="multi-select-option" data-value="${value}" data-label="${label}">
            <input type="checkbox" value="${value}" onchange="onMultiSelectChange('${id}')">
            <span>${label}</span>
          </label>
        `;
      }).join('');
    }

    function onMultiSelectChange(id) {
      const el = document.getElementById(id);
      const filterType = el.dataset.filter;
      const checkboxes = el.querySelectorAll('.multi-select-option input[type="checkbox"]:checked');
      const selectedValues = Array.from(checkboxes).map(cb => cb.value);

      multiSelectState[filterType] = selectedValues;
      updateMultiSelectDisplay(id);
    }

    function updateMultiSelectDisplay(id) {
      const el = document.getElementById(id);
      const filterType = el.dataset.filter;
      const selected = multiSelectState[filterType];
      const textEl = el.querySelector('.multi-select-text');

      if (selected.length === 0) {
        textEl.innerHTML = 'Seçiniz';
      } else if (selected.length === 1) {
        const option = el.querySelector(`.multi-select-option[data-value="${selected[0]}"]`);
        textEl.innerHTML = option ? option.dataset.label : '1 seçili';
      } else {
        textEl.innerHTML = `<span class="multi-select-count">${selected.length}</span> seçili`;
      }
    }

    function filterMultiSelectOptions(id, searchTerm) {
      const el = document.getElementById(id);
      const options = el.querySelectorAll('.multi-select-option');
      const term = searchTerm.toLowerCase();

      options.forEach(option => {
        const label = option.dataset.label.toLowerCase();
        option.style.display = label.includes(term) ? 'flex' : 'none';
      });
    }

    function selectAllMulti(id) {
      const el = document.getElementById(id);
      const filterType = el.dataset.filter;
      const checkboxes = el.querySelectorAll('.multi-select-option input[type="checkbox"]');

      checkboxes.forEach(cb => {
        if (cb.closest('.multi-select-option').style.display !== 'none') {
          cb.checked = true;
        }
      });

      multiSelectState[filterType] = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      updateMultiSelectDisplay(id);
    }

    function clearMultiSelect(id) {
      const el = document.getElementById(id);
      const filterType = el.dataset.filter;
      const checkboxes = el.querySelectorAll('.multi-select-option input[type="checkbox"]');

      checkboxes.forEach(cb => cb.checked = false);
      multiSelectState[filterType] = [];
      updateMultiSelectDisplay(id);
    }

    function getMultiSelectValues(id) {
      const el = document.getElementById(id);
      if (!el) return [];
      const filterType = el.dataset.filter;
      return multiSelectState[filterType] || [];
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.multi-select')) {
        document.querySelectorAll('.multi-select.open').forEach(ms => {
          ms.classList.remove('open');
        });
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // UTILITY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function formatCurrency(num) {
      if (num === null || num === undefined) return '0 TL';
      return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(num) + ' TL';
    }

    function formatNumber(num) {
      if (num === null || num === undefined) return '0';
      return new Intl.NumberFormat('tr-TR').format(num);
    }

    function showTableLoading(tbodyId, colspan = 4) {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;
      tbody.innerHTML = `
        <tr class="loading-row">
          <td colspan="${colspan}" style="text-align: center; padding: 1.5rem;">
            <div class="skeleton-line" style="width: 60%; margin: 0 auto;"></div>
          </td>
        </tr>
      `;
    }

    function showEmptyState(tbodyId, colspan = 4) {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 0.5rem;">
          <path d="M20 7h-9"/>
          <path d="M14 17H5"/>
          <circle cx="17" cy="17" r="3"/>
          <circle cx="7" cy="7" r="3"/>
        </svg>
        <div>Üretim Bulunamadı</div>
      </td></tr>`;
    }

    // ═══════════════════════════════════════════════════════════════
    // KPI STATS FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function updateKPIStats(bransRes, sirketRes, performersRes) {
      // Calculate totals
      const toplamPrim = (bransRes.dagilim || []).reduce((sum, item) => sum + (item.toplamBrutPrim || 0), 0);
      const toplamPolice = (bransRes.dagilim || []).reduce((sum, item) => sum + (item.policeSayisi || 0), 0);

      // Update Toplam Prim
      document.getElementById('statToplamPrim').textContent = formatCurrency(toplamPrim);

      // Update Poliçe Sayısı
      document.getElementById('statPoliceSayisi').textContent = formatNumber(toplamPolice);

      // Update Bu Ay Üretim (same as toplam for now, can be refined with API)
      document.getElementById('statBuAyUretim').textContent = formatCurrency(toplamPrim);

      // Update Top Performer
      const performers = performersRes.performers || [];
      if (performers.length > 0) {
        const topPerformer = performers[0];
        document.getElementById('statTopPerformer').textContent = topPerformer.adSoyad || '-';
        document.getElementById('statTopPerformerInfo').textContent = formatCurrency(topPerformer.toplamBrutPrim) + ' üretim';
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // QUICK DATE PRESETS
    // ═══════════════════════════════════════════════════════════════
    function setQuickDate(preset, btnEl) {
      const today = new Date();
      let startDate, endDate = today;

      switch (preset) {
        case 'today':
          startDate = today;
          break;
        case 'week':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - today.getDay() + 1); // Monday
          break;
        case 'month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(today.getFullYear(), 0, 1);
          break;
        case 'last7':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 6);
          break;
        case 'last30':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 29);
          break;
        case 'last365':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 364);
          break;
        default:
          return;
      }

      // Set filter dates
      currentFilters.startDate = toLocalDateString(startDate);
      currentFilters.endDate = toLocalDateString(endDate);

      // Update active pill & deactivate range pill
      document.querySelectorAll('.date-pill').forEach(btn => btn.classList.remove('active'));
      if (btnEl) btnEl.classList.add('active');
      document.getElementById('rangePill').classList.remove('active');

      // Clear flatpickr selection
      const dateInput = document.getElementById('dateRangeFilter');
      if (dateInput._flatpickr) dateInput._flatpickr.clear();

      // Apply filters
      applyFilters();
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTIVE FILTER CHIPS
    // ═══════════════════════════════════════════════════════════════
    function updateFilterChips() {
      const container = document.getElementById('activeFilters');
      if (!container) return;

      const chips = [];

      // Date range chip
      if (currentFilters.startDate && currentFilters.endDate) {
        const [sy, sm, sd] = currentFilters.startDate.split('-').map(Number);
        const [ey, em, ed] = currentFilters.endDate.split('-').map(Number);
        const startFormatted = new Date(sy, sm - 1, sd).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        const endFormatted = new Date(ey, em - 1, ed).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        chips.push({ label: `${startFormatted} - ${endFormatted}`, type: 'date' });
      }

      // Brans chips (multi)
      if (currentFilters.bransIds?.length > 0) {
        if (currentFilters.bransIds.length === 1) {
          const brans = branslarCache.find(b => b.id == currentFilters.bransIds[0]);
          if (brans) chips.push({ label: brans.bransAdi || brans.adi || brans.turu, type: 'brans' });
        } else {
          chips.push({ label: `${currentFilters.bransIds.length} Branş`, type: 'brans' });
        }
      }

      // Kullanıcı chips (multi)
      if (currentFilters.kullaniciIds?.length > 0) {
        if (currentFilters.kullaniciIds.length === 1) {
          const kullanici = kullanicilarCache.find(k => k.id == currentFilters.kullaniciIds[0]);
          if (kullanici) chips.push({ label: `${kullanici.adi} ${kullanici.soyadi}`, type: 'kullanici' });
        } else {
          chips.push({ label: `${currentFilters.kullaniciIds.length} Kullanıcı`, type: 'kullanici' });
        }
      }

      // Şube chips (multi)
      if (currentFilters.subeIds?.length > 0) {
        if (currentFilters.subeIds.length === 1) {
          const sube = subelerCache.find(s => s.id == currentFilters.subeIds[0]);
          if (sube) chips.push({ label: sube.subeAdi, type: 'sube' });
        } else {
          chips.push({ label: `${currentFilters.subeIds.length} Şube`, type: 'sube' });
        }
      }

      // Şirket chips (multi)
      if (currentFilters.sirketIds?.length > 0) {
        if (currentFilters.sirketIds.length === 1) {
          const sirket = sirketlerCache.find(s => s.id == currentFilters.sirketIds[0]);
          if (sirket) chips.push({ label: sirket.sirketAdi || sirket.adi, type: 'sirket' });
        } else {
          chips.push({ label: `${currentFilters.sirketIds.length} Şirket`, type: 'sirket' });
        }
      }

      container.innerHTML = chips.map(chip => `
        <span class="filter-chip">
          ${chip.label}
          <button onclick="removeFilter('${chip.type}')" title="Kaldır">×</button>
        </span>
      `).join('');
    }

    function removeFilter(type) {
      switch (type) {
        case 'date':
          currentFilters.startDate = null;
          currentFilters.endDate = null;
          const dateInput = document.getElementById('dateRangeFilter');
          if (dateInput._flatpickr) dateInput._flatpickr.clear();
          document.querySelectorAll('.quick-date-btn').forEach(btn => btn.classList.remove('active'));
          break;
        case 'brans':
          currentFilters.bransIds = [];
          clearMultiSelect('bransMultiSelect');
          break;
        case 'kullanici':
          currentFilters.kullaniciIds = [];
          clearMultiSelect('kullaniciMultiSelect');
          break;
        case 'sube':
          currentFilters.subeIds = [];
          clearMultiSelect('subeMultiSelect');
          break;
        case 'sirket':
          currentFilters.sirketIds = [];
          clearMultiSelect('sirketMultiSelect');
          break;
      }
      updateFilterChips();
      loadAllTables();
    }

    // ═══════════════════════════════════════════════════════════════
    // CHART FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function renderBransDonutChart(data) {
      const container = document.getElementById('bransDonutChart');

      // Destroy existing chart
      if (bransDonutChart) {
        bransDonutChart.destroy();
        bransDonutChart = null;
      }

      // Clear container
      container.innerHTML = '';

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state">Veri bulunamadı</div>';
        return;
      }

      const chartData = {
        labels: data.slice(0, 6).map(item => item.bransAdi || 'Diğer'),
        values: data.slice(0, 6).map(item => item.toplamBrutPrim || 0)
      };

      bransDonutChart = createDonutChart('bransDonutChart', chartData, {
        height: 320,
        legendPosition: 'bottom'
      });
    }

    function renderGunlukTrendChart(data) {
      const container = document.getElementById('gunlukTrendChart');

      // Destroy existing chart
      if (gunlukTrendChart) {
        gunlukTrendChart.destroy();
        gunlukTrendChart = null;
      }

      // Clear container
      container.innerHTML = '';

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state">Veri bulunamadı</div>';
        return;
      }

      // Sort by policeSayisi (count) and get top 6 branches
      const sortedByCount = [...data].sort((a, b) => (b.policeSayisi || 0) - (a.policeSayisi || 0));
      const top6Branches = sortedByCount.slice(0, 6);

      const chartData = {
        labels: top6Branches.map(item => item.bransAdi || 'Diğer'),
        values: top6Branches.map(item => item.policeSayisi || 0)
      };

      gunlukTrendChart = createDonutChart('gunlukTrendChart', chartData, {
        height: 320,
        legendPosition: 'bottom'
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // TABLE SORTING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function sortTableData(data, column, direction, tableType) {
      return [...data].sort((a, b) => {
        let valA, valB;

        switch (column) {
          case 'name':
            valA = (a.bransAdi || a.sirketAdi || a.subeAdi || a.adSoyad || '').toLowerCase();
            valB = (b.bransAdi || b.sirketAdi || b.subeAdi || b.adSoyad || '').toLowerCase();
            break;
          case 'sube':
            valA = (a.subeAdi || '').toLowerCase();
            valB = (b.subeAdi || '').toLowerCase();
            break;
          case 'tutar':
            valA = a.toplamBrutPrim || a.tutar || 0;
            valB = b.toplamBrutPrim || b.tutar || 0;
            break;
          case 'adet':
            valA = a.policeSayisi || a.adet || 0;
            valB = b.policeSayisi || b.adet || 0;
            break;
          case 'gun':
            valA = new Date(a.gun.split('.').reverse().join('-'));
            valB = new Date(b.gun.split('.').reverse().join('-'));
            break;
          default:
            return 0;
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    function handleSort(tableType, column) {
      // Toggle direction if same column
      if (sortState[tableType].column === column) {
        sortState[tableType].direction = sortState[tableType].direction === 'asc' ? 'desc' : 'asc';
      } else {
        sortState[tableType].column = column;
        sortState[tableType].direction = 'desc';
      }

      // Update header classes
      const table = document.getElementById(`${tableType}Table`);
      if (table) {
        table.querySelectorAll('th.sortable').forEach(th => {
          th.classList.remove('sorted-asc', 'sorted-desc');
          if (th.dataset.column === column) {
            th.classList.add(sortState[tableType].direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
          }
        });
      }

      // Re-render table with sorted data
      let data, renderFn;
      switch (tableType) {
        case 'brans':
          data = sortTableData(bransData, column, sortState[tableType].direction, tableType);
          renderBransTable(data);
          break;
        case 'sirket':
          data = sortTableData(sirketData, column, sortState[tableType].direction, tableType);
          renderSirketTable(data);
          break;
        case 'sube':
          data = sortTableData(subeData, column, sortState[tableType].direction, tableType);
          renderSubeTable(data);
          break;
        case 'kullanici':
          data = sortTableData(kullaniciData, column, sortState[tableType].direction, tableType);
          renderKullaniciTable(data);
          break;
        case 'gun':
          // Güne göre üretimler artık grafik, sort gereksiz
          break;
      }
    }

    function setupSortHandlers() {
      document.querySelectorAll('.production-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          handleSort(th.dataset.table, th.dataset.column);
        });
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    // Generate random trend data (in real app, this would come from API)
    function generateTrendData(seed) {
      const bars = [];
      let val = 40 + (seed % 30);
      for (let i = 0; i < 7; i++) {
        val = Math.max(20, Math.min(100, val + (Math.random() - 0.4) * 25));
        bars.push(Math.round(val));
      }
      return bars;
    }

    // Generate trend percentage
    function getTrendPercentage(seed) {
      const base = ((seed * 7) % 30) - 10;
      return base;
    }

    // Render sparkline bars HTML
    function renderSparkBars(bars, isUp) {
      return `
        <div class="spark-bars ${isUp ? 'up' : 'down'}">
          ${bars.map(h => `<span class="bar" style="height: ${h}%"></span>`).join('')}
        </div>
      `;
    }

    // Render trend badge HTML
    function renderTrendBadge(pct) {
      const isUp = pct >= 0;
      const formattedPct = Number(pct).toFixed(1);
      const icon = isUp
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>';
      return `
        <span class="trend-badge ${isUp ? 'up' : 'down'}">
          ${icon}
          ${isUp ? '+' : ''}${formattedPct}%
        </span>
      `;
    }

    // Toggle row expansion
    function toggleRow(row) {
      row.classList.toggle('open');
      // Initialize chart if opening
      const nextRow = row.nextElementSibling;
      if (row.classList.contains('open') && nextRow && nextRow.classList.contains('expanded-content')) {
        const chartContainer = nextRow.querySelector('.expanded-chart');
        if (chartContainer && !chartContainer.hasAttribute('data-rendered')) {
          createExpandedChart(chartContainer.id);
          chartContainer.setAttribute('data-rendered', 'true');
        }
      }
    }

    // Create expanded area chart
    function createExpandedChart(containerId) {
      const container = document.getElementById(containerId);
      if (!container || typeof ApexCharts === 'undefined') return;

      const data = [];
      let base = 50000 + Math.random() * 30000;
      for (let i = 0; i < 14; i++) {
        base = base + (Math.random() - 0.4) * 8000;
        data.push(Math.max(20000, Math.round(base)));
      }
      const isUp = data[data.length - 1] > data[0];

      const options = {
        chart: {
          type: 'area',
          height: 60,
          width: 180,
          sparkline: { enabled: true },
          animations: { enabled: true, speed: 400 }
        },
        series: [{ data: data }],
        colors: [isUp ? '#10b981' : '#ef4444'],
        stroke: { curve: 'smooth', width: 2 },
        fill: {
          type: 'gradient',
          gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] }
        },
        tooltip: { enabled: false }
      };

      new ApexCharts(container, options).render();
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function renderBransTable(data) {
      const tbody = document.getElementById('bransTableBody');
      if (!tbody) return;

      if (!data || data.length === 0) {
        showEmptyState('bransTableBody', 5);
        return;
      }

      const maxTutar = Math.max(...data.map(item => item.toplamBrutPrim || 0));

      tbody.innerHTML = data.map((item, i) => {
        const tutar = item.toplamBrutPrim || 0;
        const adet = item.policeSayisi || 0;
        const avgPrim = adet > 0 ? Math.round(tutar / adet) : 0;
        const trendPct = getTrendPercentage(i + tutar);
        const isUp = trendPct >= 0;
        const bars = generateTrendData(i + tutar);
        const hedefOran = Math.min(100, Math.round((tutar / (maxTutar * 1.2)) * 100));

        return `
          <tr class="data-row" onclick="toggleRow(this)">
            <td>${i + 1}</td>
            <td>
              <div class="name-cell">
                <span class="expand-icon">▶</span>
                <a href="#" class="table-link" onclick="filterByBrans(event, ${item.bransId}, '${item.bransAdi}')">
                  ${item.bransAdi || 'Belirsiz'}
                </a>
              </div>
            </td>
            <td>
              <div class="trend-cell">
                ${renderSparkBars(bars, isUp)}
                ${renderTrendBadge(trendPct)}
              </div>
            </td>
            <td class="tutar-col">${formatCurrency(tutar)}</td>
            <td>${formatNumber(adet)}</td>
          </tr>
          <tr class="expanded-content">
            <td colspan="5">
              <div class="expanded-inner">
                <div class="expanded-chart" id="chart-brans-${i}"></div>
                <div class="expanded-stats">
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Ort. Prim</div>
                    <div class="expanded-stat-value">${formatCurrency(avgPrim)}</div>
                  </div>
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Değişim</div>
                    <div class="expanded-stat-value ${isUp ? 'success' : 'danger'}">${isUp ? '+' : ''}${Number(trendPct).toFixed(1)}%</div>
                    <div class="expanded-stat-sub">Geçen aya göre</div>
                  </div>
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Hedef</div>
                    <div class="expanded-stat-value">${formatCurrency(Math.round(maxTutar * 1.2))}</div>
                    <div class="expanded-stat-sub">${hedefOran}% tamamlandı</div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function renderSirketTable(data) {
      const tbody = document.getElementById('sirketTableBody');
      if (!tbody) return;

      if (!data || data.length === 0) {
        showEmptyState('sirketTableBody', 5);
        return;
      }

      const totalTutar = data.reduce((sum, item) => sum + (item.toplamBrutPrim || 0), 0);

      tbody.innerHTML = data.map((item, i) => {
        const tutar = item.toplamBrutPrim || 0;
        const adet = item.policeSayisi || 0;
        const avgPrim = adet > 0 ? Math.round(tutar / adet) : 0;
        const komisyon = Math.round(tutar * 0.1);
        const pazarPayi = totalTutar > 0 ? ((tutar / totalTutar) * 100).toFixed(1) : 0;
        const trendPct = getTrendPercentage(i + tutar);
        const isUp = trendPct >= 0;
        const bars = generateTrendData(i + tutar);

        return `
          <tr class="data-row" onclick="toggleRow(this)">
            <td>${i + 1}</td>
            <td>
              <div class="name-cell">
                <span class="expand-icon">▶</span>
                <a href="#" class="table-link" onclick="filterBySirket(event, ${item.sirketId}, '${item.sirketAdi}')">
                  ${item.sirketAdi || 'Belirsiz'}
                </a>
              </div>
            </td>
            <td>
              <div class="trend-cell">
                ${renderSparkBars(bars, isUp)}
                ${renderTrendBadge(trendPct)}
              </div>
            </td>
            <td class="tutar-col">${formatCurrency(tutar)}</td>
            <td>${formatNumber(adet)}</td>
          </tr>
          <tr class="expanded-content">
            <td colspan="5">
              <div class="expanded-inner">
                <div class="expanded-chart" id="chart-sirket-${i}"></div>
                <div class="expanded-stats">
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Ort. Prim</div>
                    <div class="expanded-stat-value">${formatCurrency(avgPrim)}</div>
                  </div>
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Komisyon</div>
                    <div class="expanded-stat-value success">${formatCurrency(komisyon)}</div>
                    <div class="expanded-stat-sub">%10 oran</div>
                  </div>
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Pazar Payı</div>
                    <div class="expanded-stat-value">${pazarPayi}%</div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function renderSubeTable(data) {
      const tbody = document.getElementById('subeTableBody');
      if (!tbody) return;

      if (!data || data.length === 0) {
        showEmptyState('subeTableBody', 5);
        return;
      }

      const totalTutar = data.reduce((sum, item) => sum + (item.tutar || 0), 0);

      tbody.innerHTML = data.map((item, i) => {
        const tutar = item.tutar || 0;
        const adet = item.adet || 0;
        const avgPrim = adet > 0 ? Math.round(tutar / adet) : 0;
        const pazarPayi = totalTutar > 0 ? ((tutar / totalTutar) * 100).toFixed(1) : 0;
        const trendPct = getTrendPercentage(i + tutar);
        const isUp = trendPct >= 0;
        const bars = generateTrendData(i + tutar);

        return `
          <tr class="data-row" onclick="toggleRow(this)">
            <td>${i + 1}</td>
            <td>
              <div class="name-cell">
                <span class="expand-icon">▶</span>
                <a href="#" class="table-link" onclick="filterBySube(event, '${item.subeAdi}')">
                  ${item.subeAdi || 'Belirsiz'}
                </a>
              </div>
            </td>
            <td>
              <div class="trend-cell">
                ${renderSparkBars(bars, isUp)}
                ${renderTrendBadge(trendPct)}
              </div>
            </td>
            <td class="tutar-col">${formatCurrency(tutar)}</td>
            <td>${formatNumber(adet)}</td>
          </tr>
          <tr class="expanded-content">
            <td colspan="5">
              <div class="expanded-inner">
                <div class="expanded-chart" id="chart-sube-${i}"></div>
                <div class="expanded-stats">
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Ort. Prim</div>
                    <div class="expanded-stat-value">${formatCurrency(avgPrim)}</div>
                  </div>
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Değişim</div>
                    <div class="expanded-stat-value ${isUp ? 'success' : 'danger'}">${isUp ? '+' : ''}${Number(trendPct).toFixed(1)}%</div>
                    <div class="expanded-stat-sub">Geçen aya göre</div>
                  </div>
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Pazar Payı</div>
                    <div class="expanded-stat-value">${pazarPayi}%</div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function renderKullaniciTable(data) {
      const tbody = document.getElementById('kullaniciTableBody');
      if (!tbody) return;

      if (!data || data.length === 0) {
        showEmptyState('kullaniciTableBody', 5);
        return;
      }

      const maxTutar = Math.max(...data.map(item => item.toplamBrutPrim || 0));

      tbody.innerHTML = data.map((item, i) => {
        const tutar = item.toplamBrutPrim || 0;
        const adet = item.policeSayisi || 0;
        const avgPrim = adet > 0 ? Math.round(tutar / adet) : 0;
        const hedefOran = Math.min(100, Math.round((tutar / (maxTutar * 1.1)) * 100));
        const trendPct = getTrendPercentage(i + tutar);
        const isUp = trendPct >= 0;
        const bars = generateTrendData(i + tutar);

        return `
          <tr class="data-row" onclick="toggleRow(this)">
            <td>${i + 1}</td>
            <td>
              <div class="name-cell">
                <span class="expand-icon">▶</span>
                <a href="pages/employees/detail.html?id=${item.kullaniciId || ''}" class="table-link" onclick="event.stopPropagation()">
                  ${item.adSoyad || 'Belirsiz'}
                </a>
              </div>
            </td>
            <td>
              <div class="trend-cell">
                ${renderSparkBars(bars, isUp)}
                ${renderTrendBadge(trendPct)}
              </div>
            </td>
            <td class="tutar-col">${formatCurrency(tutar)}</td>
            <td>${formatNumber(adet)}</td>
          </tr>
          <tr class="expanded-content">
            <td colspan="5">
              <div class="expanded-inner">
                <div class="expanded-chart" id="chart-user-${i}"></div>
                <div class="expanded-stats">
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Şube</div>
                    <div class="expanded-stat-value">${item.subeAdi || '-'}</div>
                  </div>
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Ort. Prim</div>
                    <div class="expanded-stat-value">${formatCurrency(avgPrim)}</div>
                  </div>
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Hedef</div>
                    <div class="expanded-stat-value">${formatCurrency(Math.round(maxTutar * 1.1))}</div>
                    <div class="expanded-stat-sub">${hedefOran}% tamamlandı</div>
                  </div>
                  <div class="expanded-stat">
                    <div class="expanded-stat-label">Sıralama</div>
                    <div class="expanded-stat-value ${i < 3 ? 'success' : ''}">#${i + 1}</div>
                    <div class="expanded-stat-sub">Bu ay</div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Chart instance for daily production
    let gunlukBarChartInstance = null;

    function renderGunChart(data) {
      const container = document.getElementById('gunlukBarChart');
      if (!container) return;

      // Destroy existing chart
      if (gunlukBarChartInstance) {
        gunlukBarChartInstance.destroy();
        gunlukBarChartInstance = null;
      }

      container.innerHTML = '';

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state">Veri bulunamadı</div>';
        return;
      }

      // Sort by date ascending for chart display
      const sorted = [...data].sort((a, b) => {
        const dateA = new Date(a.gun.split('.').reverse().join('-'));
        const dateB = new Date(b.gun.split('.').reverse().join('-'));
        return dateA - dateB;
      });

      const labels = sorted.map(item => {
        const parts = (item.gun || '').split('.');
        return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : item.gun;
      });
      const values = sorted.map(item => item.tutar || 0);
      const adetValues = sorted.map(item => item.adet || 0);

      // Dynamically calculate chart height based on data count
      const chartHeight = sorted.length > 15 ? 420 : 350;

      const options = {
        chart: {
          type: 'bar',
          height: chartHeight,
          background: 'transparent',
          fontFamily: "'Manrope', sans-serif",
          toolbar: { show: false },
          zoom: { enabled: false },
          animations: { enabled: true, easing: 'easeinout', speed: 600 }
        },
        theme: { mode: 'dark' },
        series: [
          { name: 'Tutar (TL)', type: 'bar', data: values },
          { name: 'Adet', type: 'line', data: adetValues }
        ],
        colors: ['#10b981', '#00d4ff'],
        plotOptions: {
          bar: {
            columnWidth: sorted.length > 20 ? '90%' : '60%',
            borderRadius: 2
          }
        },
        stroke: { width: [0, 3], curve: 'smooth' },
        fill: { opacity: [1, 1] },
        xaxis: {
          categories: labels,
          labels: {
            rotate: -90,
            rotateAlways: true,
            hideOverlappingLabels: false,
            showDuplicates: false,
            style: {
              colors: '#334155',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', 'Manrope', sans-serif"
            },
            offsetY: 0
          },
          axisBorder: { show: false },
          axisTicks: { show: false }
        },
        yaxis: [
          {
            title: { text: 'Tutar', style: { color: '#64748b', fontSize: '11px' } },
            labels: {
              style: { colors: '#64748b', fontSize: '11px' },
              formatter: (val) => formatCompact(val)
            }
          },
          {
            opposite: true,
            title: { text: 'Adet', style: { color: '#64748b', fontSize: '11px' } },
            labels: {
              style: { colors: '#64748b', fontSize: '11px' },
              formatter: (val) => Math.round(val).toString()
            }
          }
        ],
        grid: {
          borderColor: 'rgba(148, 163, 184, 0.1)',
          strokeDashArray: 4,
          xaxis: { lines: { show: false } },
          yaxis: { lines: { show: true } },
          padding: { left: 10, right: 10, bottom: 5 }
        },
        tooltip: {
          theme: 'light',
          shared: true,
          intersect: false,
          y: {
            formatter: (val, { seriesIndex }) => {
              if (seriesIndex === 0) return formatCurrency(val);
              return Math.round(val) + ' poliçe';
            }
          }
        },
        dataLabels: { enabled: false },
        legend: {
          labels: { colors: '#475569' },
          fontSize: '12px',
          fontFamily: "'Manrope', sans-serif"
        }
      };

      gunlukBarChartInstance = new ApexCharts(container, options);
      gunlukBarChartInstance.render();
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA PROCESSING
    // ═══════════════════════════════════════════════════════════════
    function groupBySubeFromPerformers(performers) {
      if (!performers || performers.length === 0) return [];

      const subeMap = {};
      performers.forEach(p => {
        const sube = p.subeAdi || 'Belirsiz';
        if (!subeMap[sube]) {
          subeMap[sube] = { tutar: 0, adet: 0 };
        }
        subeMap[sube].tutar += p.toplamBrutPrim || 0;
        subeMap[sube].adet += p.policeSayisi || 0;
      });

      return Object.entries(subeMap)
        .map(([name, data]) => ({ subeAdi: name, ...data }))
        .sort((a, b) => b.tutar - a.tutar);
    }

    function groupByDayFromAktiviteler(aktiviteler) {
      if (!aktiviteler || aktiviteler.length === 0) return [];

      const gunMap = {};
      aktiviteler.forEach(a => {
        const gun = new Date(a.eklenmeTarihi).toLocaleDateString('tr-TR');
        if (!gunMap[gun]) {
          gunMap[gun] = { tutar: 0, adet: 0 };
        }
        gunMap[gun].tutar += a.brutPrim || 0;
        gunMap[gun].adet += 1;
      });

      return Object.entries(gunMap)
        .map(([gun, data]) => ({ gun, ...data }))
        .sort((a, b) => {
          const dateA = new Date(a.gun.split('.').reverse().join('-'));
          const dateB = new Date(b.gun.split('.').reverse().join('-'));
          return dateB - dateA;
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // API FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    async function loadFilterOptions() {
      const firmaId = getCurrentFirmaId();

      try {
        // Load branslar, kullanicilar, subeler in parallel
        const [bransRes, kullaniciRes, subelerRes] = await Promise.all([
          apiGet('insurance-types').catch(() => []),
          apiGet('kullanicilar/aktif', { firmaId }).catch(() => []),
          apiGet('branches', { firmaId }).catch(() => [])
        ]);

        // Branslar
        // Branslar - Multi-select
        branslarCache = bransRes || [];
        if (branslarCache.length > 0) {
          populateMultiSelect('bransMultiSelect', branslarCache, 'id', item => item.bransAdi || item.adi || item.turu);
        }

        // Kullanıcılar - Multi-select
        kullanicilarCache = kullaniciRes || [];
        if (kullanicilarCache.length > 0) {
          populateMultiSelect('kullaniciMultiSelect', kullanicilarCache, 'id', item => `${item.adi || ''} ${item.soyadi || ''}`.trim());
        }

        // Subeler - Multi-select
        subelerCache = subelerRes || [];
        if (subelerCache.length > 0) {
          populateMultiSelect('subeMultiSelect', subelerCache, 'id', item => item.subeAdi || item.name);
        }

        // Sigorta Şirketleri - Multi-select
        const sirketRes = await apiGet('insurance-companies').catch(() => []);
        sirketlerCache = sirketRes || [];
        if (sirketlerCache.length > 0) {
          populateMultiSelect('sirketMultiSelect', sirketlerCache, 'id', item => item.sirketAdi || item.adi || item.ad);
        }

      } catch (error) {
        console.error('Filter options load error:', error);
      }
    }

    async function loadAllTables() {
      const firmaId = getCurrentFirmaId();

      // Build query params with mode and filters
      const params = { firmaId, mode: currentMode };
      if (currentFilters.startDate) params.startDate = currentFilters.startDate;
      if (currentFilters.endDate) params.endDate = currentFilters.endDate;
      if (currentFilters.bransIds?.length > 0) params.bransIds = currentFilters.bransIds.join(',');
      if (currentFilters.kullaniciIds?.length > 0) params.kullaniciIds = currentFilters.kullaniciIds.join(',');
      if (currentFilters.subeIds?.length > 0) params.subeIds = currentFilters.subeIds.join(',');
      if (currentFilters.sirketIds?.length > 0) params.sirketIds = currentFilters.sirketIds.join(',');

      // Show loading states
      showTableLoading('bransTableBody');
      showTableLoading('sirketTableBody');
      showTableLoading('subeTableBody');
      showTableLoading('kullaniciTableBody', 5);

      try {
        const modeLabel = currentMode === 0 ? 'Onaylı' : 'Yakalama';
        console.log(`Loading dashboard data (${modeLabel} mode) with params:`, params);

        const [bransRes, sirketRes, performersRes, aktivitelerRes] = await Promise.all([
          apiGet('dashboard/brans-dagilim', params).catch(e => { console.error('Brans error:', e); return { dagilim: [] }; }),
          apiGet('dashboard/sirket-dagilim', params).catch(e => { console.error('Sirket error:', e); return { dagilim: [] }; }),
          apiGet('dashboard/top-performers', { ...params, limit: 50 }).catch(e => { console.error('Performers error:', e); return { performers: [] }; }),
          apiGet('dashboard/son-aktiviteler', { ...params, limit: 100 }).catch(e => { console.error('Aktiviteler error:', e); return { aktiviteler: [] }; })
        ]);

        console.log('API Responses:', { bransRes, sirketRes, performersRes, aktivitelerRes });

        // Cache data for sorting
        bransData = bransRes.dagilim || [];
        sirketData = sirketRes.dagilim || [];
        kullaniciData = performersRes.performers || [];
        subeData = groupBySubeFromPerformers(performersRes.performers || []);
        gunData = groupByDayFromAktiviteler(aktivitelerRes.aktiviteler || []);

        // Render tables
        renderBransTable(bransData);
        renderSirketTable(sirketData);
        renderKullaniciTable(kullaniciData);
        renderSubeTable(subeData);
        renderGunChart(gunData);

        // Update KPI stats
        updateKPIStats(bransRes, sirketRes, performersRes);

        // Render charts
        renderBransDonutChart(bransData);
        renderGunlukTrendChart(bransData);  // Branş dağılımı adet bazlı

        console.log(`Dashboard loaded successfully (${modeLabel} mode)`);

      } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('Veriler yüklenirken hata oluştu', 'error');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // MODE SWITCH FUNCTION
    // ═══════════════════════════════════════════════════════════════
    function switchMode(mode) {
      if (currentMode === mode) return;

      currentMode = mode;

      // Update button states
      const btnOnayli = document.getElementById('btnOnayliMode');
      const btnYakalama = document.getElementById('btnYakalamaMode');
      const modeIndicator = document.getElementById('modeIndicator');

      if (mode === 0) {
        btnOnayli.classList.add('active');
        btnYakalama.classList.remove('active');
        modeIndicator.className = 'mode-indicator onayli';
        modeIndicator.textContent = 'Onaylı Poliçeler';
      } else {
        btnOnayli.classList.remove('active');
        btnYakalama.classList.add('active');
        modeIndicator.className = 'mode-indicator yakalama';
        modeIndicator.textContent = 'Yakalanan Poliçeler';
      }

      // Reload all tables with new mode
      loadAllTables();
    }

    // ═══════════════════════════════════════════════════════════════
    // FILTER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function applyFilters() {
      // Date is already set by pill clicks (currentFilters.startDate/endDate)
      // Get other filter values
      currentFilters.bransIds = getMultiSelectValues('bransMultiSelect');
      currentFilters.kullaniciIds = getMultiSelectValues('kullaniciMultiSelect');
      currentFilters.subeIds = getMultiSelectValues('subeMultiSelect');
      currentFilters.sirketIds = getMultiSelectValues('sirketMultiSelect');

      console.log('Applying filters:', currentFilters);
      updateFilterChips();
      loadAllTables();
    }

    function clearFilters() {
      // Clear multi-selects
      clearMultiSelect('bransMultiSelect');
      clearMultiSelect('kullaniciMultiSelect');
      clearMultiSelect('subeMultiSelect');
      clearMultiSelect('sirketMultiSelect');

      // Reset filter state
      currentFilters = {
        startDate: null,
        endDate: null,
        bransIds: [],
        kullaniciIds: [],
        subeIds: [],
        sirketIds: []
      };

      // Clear date pills & range pill
      document.querySelectorAll('.date-pill').forEach(btn => btn.classList.remove('active'));
      document.getElementById('rangePill').classList.remove('active');
      const dateInput = document.getElementById('dateRangeFilter');
      if (dateInput._flatpickr) dateInput._flatpickr.clear();

      // Clear filter chips
      updateFilterChips();

      loadAllTables();
    }


    // ═══════════════════════════════════════════════════════════════
    // LINK FILTER HANDLERS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Multi-select dropdown'ı programatik olarak güncelle
     * @param {string} selectId - Select element ID
     * @param {number} valueToSelect - Value to select
     */
    function updateMultiSelect(selectId, valueToSelect) {
      const select = document.getElementById(selectId);
      if (!select) return;

      // Clear all selections
      const options = select.querySelectorAll('option');
      options.forEach(opt => opt.selected = false);

      // Select the target value
      const option = Array.from(options).find(opt => opt.value == valueToSelect);
      if (option) {
        option.selected = true;
      }
    }

    /**
     * Branş linkine tıklandığında dashboard'u filtrele
     * @param {Event} event - Click event
     * @param {number} bransId - Branch ID
     * @param {string} bransAdi - Branch name
     */
    function filterByBrans(event, bransId, bransAdi) {
      event.preventDefault();
      event.stopPropagation();

      // Set branch filter
      currentFilters.bransIds = [bransId];

      // Update multi-select dropdown to show selected branch
      updateMultiSelect('bransMultiSelect', bransId);

      // Apply filters and reload dashboard
      updateFilterChips();
      loadAllTables();

      // Show toast notification
      showToast(`Filtre uygulandı: ${bransAdi}`, 'success');
    }

    /**
     * Şirket linkine tıklandığında dashboard'u filtrele
     * @param {Event} event - Click event
     * @param {number} sirketId - Company ID
     * @param {string} sirketAdi - Company name
     */
    function filterBySirket(event, sirketId, sirketAdi) {
      event.preventDefault();
      event.stopPropagation();

      // Set company filter
      currentFilters.sirketIds = [sirketId];

      // Update multi-select dropdown to show selected company
      updateMultiSelect('sirketMultiSelect', sirketId);

      // Apply filters and reload dashboard
      updateFilterChips();
      loadAllTables();

      // Show toast notification
      showToast(`Filtre uygulandı: ${sirketAdi}`, 'success');
    }

    /**
     * Şube linkine tıklandığında dashboard'u filtrele
     * @param {Event} event - Click event
     * @param {string} subeAdi - Branch name
     */
    function filterBySube(event, subeAdi) {
      event.preventDefault();
      event.stopPropagation();

      // Find branch ID from cache by name
      const sube = subelerCache.find(s => s.subeAdi === subeAdi || s.name === subeAdi);

      if (!sube) {
        console.warn('Branch not found in cache:', subeAdi);
        showToast(`Şube bulunamadı: ${subeAdi}`, 'warning');
        return;
      }

      // Set branch filter
      currentFilters.subeIds = [sube.id];

      // Update multi-select dropdown to show selected branch
      updateMultiSelect('subeMultiSelect', sube.id);

      // Apply filters and reload dashboard
      updateFilterChips();
      loadAllTables();

      // Show toast notification
      showToast(`Filtre uygulandı: ${subeAdi}`, 'success');
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', function() {
      // Check dashboard permission (requires at least viewer permission)
      const permissions = APP_CONFIG.PERMISSIONS.getSync();
      const viewLevel = permissions?.gorebilecegiPolicelerveKartlar;
      if (!viewLevel || viewLevel === '4') {  // '4' = no access
        window.location.href = 'pages/login.html';
        return;
      }

      // Initialize date defaults
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Set default filters to current month (matching the "Bu Ay" pill active state)
      currentFilters.startDate = toLocalDateString(firstDayOfMonth);
      currentFilters.endDate = toLocalDateString(today);

      // Initialize Flatpickr on range pill input
      flatpickr('#dateRangeFilter', {
        mode: 'range',
        dateFormat: 'd.m.Y',
        locale: 'tr',
        allowInput: false,
        disableMobile: true,
        onChange: function(selectedDates) {
          const rangePill = document.getElementById('rangePill');
          if (selectedDates.length === 2) {
            // Deactivate all date pills
            document.querySelectorAll('.date-pill').forEach(btn => btn.classList.remove('active'));
            // Activate range pill
            rangePill.classList.add('active');
            // Set filter dates
            currentFilters.startDate = toLocalDateString(selectedDates[0]);
            currentFilters.endDate = toLocalDateString(selectedDates[1]);
            applyFilters();
          }
        }
      });

      // Load filter options
      loadFilterOptions();

      // Load all tables
      loadAllTables();

      // Setup sort handlers
      setupSortHandlers();

      // Update filter chips
      updateFilterChips();

      // Sticky filter shadow on scroll
      const filtersEl = document.querySelector('.dashboard-filters');
      if (filtersEl) {
        const navbarH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')) || 64;
        const observer = new IntersectionObserver(
          ([entry]) => {
            filtersEl.classList.toggle('is-stuck', entry.intersectionRatio < 1);
          },
          { threshold: [1], rootMargin: `-${navbarH + 1}px 0px 0px 0px` }
        );
        observer.observe(filtersEl);
      }
    });