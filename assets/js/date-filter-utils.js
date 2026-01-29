/**
 * Date Filter Utilities
 * Ortak tarih filtreleme fonksiyonları
 * captured.html ve pool.html tarafından kullanılır
 */

// Global state
let dateRanges = {};
let flatpickrInstance = null;
let isPresetSelection = false;
let onFilterChangeCallback = null;

/**
 * Tarih formatla - Türkçe
 */
function formatDateTR(date) {
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Tarih formatla - ISO
 */
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Preset buton tıklama handler
 */
function handlePresetClick(btn, rangeKey) {
  console.log('Preset clicked:', rangeKey);

  // Update active state
  document.querySelectorAll('.date-preset-btn').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');

  // Update KPI labels
  updateKpiPeriodLabel(rangeKey);

  // Get range and filter
  const range = dateRanges[rangeKey];
  if (range && flatpickrInstance) {
    isPresetSelection = true;
    flatpickrInstance.setDate(range, true);

    const dateRangeInput = document.getElementById('dateRangeInput');
    if (range[0].getTime() === range[1].getTime()) {
      dateRangeInput.value = formatDateTR(range[0]);
    } else {
      dateRangeInput.value = formatDateTR(range[0]) + ' - ' + formatDateTR(range[1]);
    }

    // Call the page-specific filter function
    if (onFilterChangeCallback) {
      onFilterChangeCallback(range[0], range[1]);
    }
    isPresetSelection = false;
  }
}

/**
 * KPI dönem etiketlerini güncelle
 */
function updateKpiPeriodLabel(rangeKey) {
  const pendingLabel = document.getElementById('kpiPeriodLabel');
  const sentLabel = document.getElementById('kpiSentPeriodLabel');

  const pendingLabels = {
    'today': 'Bugün yakalanan poliçeler',
    'yesterday': 'Dün yakalanan poliçeler',
    'thisWeek': 'Bu hafta yakalanan poliçeler',
    'thisMonth': 'Bu ay yakalanan poliçeler',
    'custom': 'Seçilen dönemde yakalanan'
  };

  const sentLabels = {
    'today': 'Bugün gönderilen',
    'yesterday': 'Dün gönderilen',
    'thisWeek': 'Bu hafta gönderilen',
    'thisMonth': 'Bu ay gönderilen',
    'custom': 'Seçilen dönemde gönderilen'
  };

  if (pendingLabel) {
    pendingLabel.textContent = pendingLabels[rangeKey] || pendingLabels['custom'];
  }
  if (sentLabel) {
    sentLabel.textContent = sentLabels[rangeKey] || sentLabels['custom'];
  }
}

/**
 * Tarih picker'ı başlat
 * @param {Function} onFilterChange - Filtre değiştiğinde çağrılacak callback (startDate, endDate)
 */
function initDatePicker(onFilterChange) {
  onFilterChangeCallback = onFilterChange;

  const dateRangeInput = document.getElementById('dateRangeInput');
  const dateRangePicker = document.getElementById('dateRangePicker');

  if (!dateRangeInput || !dateRangePicker) {
    console.error('Date picker elements not found');
    return;
  }

  const today = new Date();

  // Date ranges - set globally
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const thisWeekStart = new Date();
  thisWeekStart.setDate(today.getDate() - today.getDay() + 1);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  dateRanges = {
    today: [new Date(), new Date()],
    yesterday: [yesterday, yesterday],
    thisWeek: [thisWeekStart, new Date()],
    thisMonth: [thisMonthStart, new Date()]
  };

  let currentRange = dateRanges.today;

  // Initialize Flatpickr - store globally
  flatpickrInstance = flatpickr(dateRangeInput, {
    mode: 'range',
    dateFormat: 'd M Y',
    locale: 'tr',
    defaultDate: currentRange,
    allowInput: false,
    disableMobile: true,
    onOpen: function() {
      dateRangePicker.classList.add('active');
    },
    onClose: function() {
      dateRangePicker.classList.remove('active');
    },
    onChange: function(selectedDates, dateStr) {
      if (selectedDates.length === 2) {
        if (!isPresetSelection) {
          // Clear active state from preset buttons only for manual selection
          document.querySelectorAll('.date-preset-btn').forEach(btn => {
            btn.classList.remove('active');
          });
          updateKpiPeriodLabel('custom');
        }
        if (onFilterChangeCallback) {
          onFilterChangeCallback(selectedDates[0], selectedDates[1]);
        }
      }
    }
  });

  // Set initial display
  dateRangeInput.value = formatDateTR(currentRange[0]);

  // Başlangıçta "Bugün" seçili - label güncelle
  updateKpiPeriodLabel('today');

  console.log('Date picker initialized, ranges:', Object.keys(dateRanges));
}

/**
 * Tarih aralığını ayarla ve filtrele
 */
function setDateRange(startDate, endDate) {
  if (flatpickrInstance) {
    flatpickrInstance.setDate([startDate, endDate], true);
  }
}

/**
 * Mevcut tarih aralığını al
 */
function getCurrentDateRange() {
  return {
    today: dateRanges.today,
    yesterday: dateRanges.yesterday,
    thisWeek: dateRanges.thisWeek,
    thisMonth: dateRanges.thisMonth
  };
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initDatePicker,
    handlePresetClick,
    updateKpiPeriodLabel,
    formatDateTR,
    formatDateISO,
    setDateRange,
    getCurrentDateRange
  };
}
