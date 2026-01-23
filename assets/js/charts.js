/**
 * IHSAN AI - Charts Module
 * ApexCharts Integration for Dashboard & Reports
 */

// Chart color palette - matches CSS design system
const chartColors = {
  primary: '#00d4ff',
  secondary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',

  // Policy type colors
  kasko: '#00d4ff',
  trafik: '#10b981',
  dask: '#f59e0b',
  saglik: '#ec4899',
  konut: '#6366f1',
  isyeri: '#06b6d4',

  // Gradients
  primaryGradient: ['rgba(0, 212, 255, 0.4)', 'rgba(0, 212, 255, 0.0)'],
  successGradient: ['rgba(16, 185, 129, 0.4)', 'rgba(16, 185, 129, 0.0)'],

  // Text & Grid
  text: '#94a3b8',
  textMuted: '#64748b',
  grid: 'rgba(148, 163, 184, 0.1)',
  background: 'transparent'
};

// Default ApexCharts options for dark theme
const defaultChartOptions = {
  chart: {
    background: 'transparent',
    fontFamily: "'Manrope', sans-serif",
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 600,
      animateGradually: { enabled: true, delay: 150 },
      dynamicAnimation: { enabled: true, speed: 350 }
    }
  },
  theme: { mode: 'dark' },
  grid: {
    borderColor: chartColors.grid,
    strokeDashArray: 4,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
    padding: { top: 0, right: 0, bottom: 0, left: 10 }
  },
  stroke: { curve: 'smooth', width: 2 },
  dataLabels: { enabled: false },
  tooltip: {
    theme: 'dark',
    style: { fontSize: '12px', fontFamily: "'Manrope', sans-serif" },
    x: { show: true },
    marker: { show: true }
  },
  legend: {
    labels: { colors: chartColors.text },
    fontSize: '12px',
    fontFamily: "'Manrope', sans-serif",
    itemMargin: { horizontal: 12, vertical: 4 }
  },
  xaxis: {
    labels: {
      style: { colors: chartColors.textMuted, fontSize: '11px', fontFamily: "'Manrope', sans-serif" }
    },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: {
    labels: {
      style: { colors: chartColors.textMuted, fontSize: '11px', fontFamily: "'Manrope', sans-serif" },
      formatter: (value) => formatCompact(value)
    }
  }
};

/**
 * Create Area Chart
 */
function createAreaChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Chart container not found:', containerId);
    return null;
  }

  const chartOptions = {
    ...defaultChartOptions,
    chart: {
      ...defaultChartOptions.chart,
      type: 'area',
      height: options.height || 300
    },
    series: [{
      name: options.seriesName || 'Değer',
      data: data.values || data
    }],
    colors: [options.color || chartColors.primary],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 100]
      }
    },
    xaxis: {
      ...defaultChartOptions.xaxis,
      categories: data.labels || [],
      type: options.xaxisType || 'category'
    },
    yaxis: {
      ...defaultChartOptions.yaxis,
      labels: {
        ...defaultChartOptions.yaxis.labels,
        formatter: options.formatter || ((val) => formatCompact(val))
      }
    }
  };

  const chart = new ApexCharts(container, chartOptions);
  chart.render();
  return chart;
}

/**
 * Create Line Chart
 */
function createLineChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Chart container not found:', containerId);
    return null;
  }

  const series = data.datasets ? data.datasets.map((ds, i) => ({
    name: ds.name || `Seri ${i + 1}`,
    data: ds.values || ds.data
  })) : [{
    name: options.seriesName || 'Değer',
    data: data.values || data
  }];

  const chartOptions = {
    ...defaultChartOptions,
    chart: {
      ...defaultChartOptions.chart,
      type: 'line',
      height: options.height || 300
    },
    series: series,
    colors: options.colors || [chartColors.primary, chartColors.success, chartColors.warning],
    stroke: { curve: 'smooth', width: 2.5 },
    markers: {
      size: 0,
      hover: { size: 6 }
    },
    xaxis: {
      ...defaultChartOptions.xaxis,
      categories: data.labels || []
    }
  };

  const chart = new ApexCharts(container, chartOptions);
  chart.render();
  return chart;
}

/**
 * Create Bar Chart
 */
function createBarChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Chart container not found:', containerId);
    return null;
  }

  const series = data.datasets ? data.datasets.map((ds, i) => ({
    name: ds.name || `Seri ${i + 1}`,
    data: ds.values || ds.data
  })) : [{
    name: options.seriesName || 'Değer',
    data: data.values || data
  }];

  const chartOptions = {
    ...defaultChartOptions,
    chart: {
      ...defaultChartOptions.chart,
      type: 'bar',
      height: options.height || 300
    },
    series: series,
    colors: options.colors || [chartColors.primary, chartColors.success],
    plotOptions: {
      bar: {
        horizontal: options.horizontal || false,
        columnWidth: options.columnWidth || '55%',
        borderRadius: 4,
        dataLabels: { position: 'top' }
      }
    },
    xaxis: {
      ...defaultChartOptions.xaxis,
      categories: data.labels || []
    }
  };

  const chart = new ApexCharts(container, chartOptions);
  chart.render();
  return chart;
}

/**
 * Create Donut/Pie Chart
 */
function createDonutChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Chart container not found:', containerId);
    return null;
  }

  const chartOptions = {
    chart: {
      type: options.type || 'donut',
      height: options.height || 300,
      background: 'transparent',
      fontFamily: "'Manrope', sans-serif",
      animations: defaultChartOptions.chart.animations
    },
    series: data.values || data,
    labels: data.labels || [],
    colors: options.colors || [
      chartColors.kasko,
      chartColors.trafik,
      chartColors.dask,
      chartColors.saglik,
      chartColors.konut,
      chartColors.isyeri
    ],
    plotOptions: {
      pie: {
        donut: {
          size: options.donutSize || '70%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontFamily: "'Manrope', sans-serif",
              color: chartColors.text,
              offsetY: -5
            },
            value: {
              show: true,
              fontSize: '20px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: '#f1f5f9',
              offsetY: 5,
              formatter: (val) => formatCompact(val)
            },
            total: {
              show: true,
              label: 'Toplam',
              fontSize: '12px',
              fontFamily: "'Manrope', sans-serif",
              color: chartColors.textMuted,
              formatter: (w) => formatCompact(w.globals.seriesTotals.reduce((a, b) => a + b, 0))
            }
          }
        }
      }
    },
    stroke: { show: false },
    legend: {
      position: options.legendPosition || 'bottom',
      labels: { colors: chartColors.text },
      fontSize: '12px',
      fontFamily: "'Manrope', sans-serif",
      markers: { width: 10, height: 10, radius: 2 },
      itemMargin: { horizontal: 8, vertical: 4 },
      formatter: function(seriesName, opts) {
        // Truncate long names (max 20 characters)
        if (seriesName && seriesName.length > 20) {
          return seriesName.substring(0, 17) + '...';
        }
        return seriesName;
      }
    },
    tooltip: {
      enabled: true,
      theme: 'dark',
      y: {
        formatter: (val) => formatNumber(val)
      }
    },
    dataLabels: { enabled: false }
  };

  const chart = new ApexCharts(container, chartOptions);
  chart.render();
  return chart;
}

/**
 * Create Pie Chart (alias for donut with type: 'pie')
 */
function createPieChart(containerId, data, options = {}) {
  return createDonutChart(containerId, data, { ...options, type: 'pie', donutSize: '0%' });
}

/**
 * Create Radial Bar Chart (Progress)
 */
function createRadialChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Chart container not found:', containerId);
    return null;
  }

  const chartOptions = {
    chart: {
      type: 'radialBar',
      height: options.height || 280,
      background: 'transparent',
      fontFamily: "'Manrope', sans-serif"
    },
    series: data.values || data,
    labels: data.labels || ['İlerleme'],
    colors: options.colors || [chartColors.primary, chartColors.success, chartColors.warning],
    plotOptions: {
      radialBar: {
        hollow: { size: '50%' },
        track: {
          background: 'rgba(148, 163, 184, 0.1)',
          strokeWidth: '100%'
        },
        dataLabels: {
          name: {
            fontSize: '14px',
            color: chartColors.text,
            offsetY: -10
          },
          value: {
            fontSize: '24px',
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color: '#f1f5f9',
            formatter: (val) => val + '%'
          }
        }
      }
    },
    stroke: { lineCap: 'round' }
  };

  const chart = new ApexCharts(container, chartOptions);
  chart.render();
  return chart;
}

/**
 * Create Sparkline Chart (Mini chart)
 */
function createSparkline(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Chart container not found:', containerId);
    return null;
  }

  const chartOptions = {
    chart: {
      type: options.type || 'area',
      height: options.height || 60,
      sparkline: { enabled: true },
      animations: { enabled: true, speed: 400 }
    },
    series: [{
      data: data
    }],
    colors: [options.color || chartColors.primary],
    stroke: { curve: 'smooth', width: 2 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0,
        stops: [0, 100]
      }
    },
    tooltip: { enabled: false }
  };

  const chart = new ApexCharts(container, chartOptions);
  chart.render();
  return chart;
}

/**
 * Create Mixed Chart (Combination)
 */
function createMixedChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Chart container not found:', containerId);
    return null;
  }

  const chartOptions = {
    ...defaultChartOptions,
    chart: {
      ...defaultChartOptions.chart,
      type: 'line',
      height: options.height || 350,
      stacked: false
    },
    series: data.series || [],
    colors: options.colors || [chartColors.primary, chartColors.success, chartColors.warning],
    stroke: {
      width: data.series.map(s => s.type === 'column' ? 0 : 2),
      curve: 'smooth'
    },
    fill: {
      opacity: data.series.map(s => s.type === 'column' ? 1 : 0.1)
    },
    xaxis: {
      ...defaultChartOptions.xaxis,
      categories: data.labels || []
    },
    yaxis: options.yaxis || defaultChartOptions.yaxis
  };

  const chart = new ApexCharts(container, chartOptions);
  chart.render();
  return chart;
}

/**
 * Generate mock time series data
 */
function generateTimeSeriesData(days = 30, baseValue = 1000, variance = 200) {
  const labels = [];
  const values = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }));

    const change = (Math.random() - 0.5) * variance;
    baseValue = Math.max(baseValue * 0.7, baseValue + change);
    values.push(Math.round(baseValue));
  }

  return { labels, values };
}

/**
 * Generate monthly data
 */
function generateMonthlyData(months = 12) {
  const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const labels = [];
  const values = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(monthNames[date.getMonth()]);
    values.push(Math.floor(Math.random() * 200) + 80);
  }

  return { labels, values };
}

/**
 * Policy type distribution data
 */
function getPolicyDistributionData() {
  return {
    labels: ['Kasko', 'Trafik', 'DASK', 'Sağlık', 'Konut', 'İşyeri'],
    values: [320, 280, 150, 120, 90, 60]
  };
}

/**
 * Format number with K, M suffixes
 */
function formatCompact(num) {
  if (num === null || num === undefined) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return Math.round(num).toString();
}

/**
 * Format number with thousands separator
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('tr-TR').format(num);
}

/**
 * Format currency
 */
function formatCurrency(num) {
  if (num === null || num === undefined) return '₺0';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

// Export to global scope
window.createAreaChart = createAreaChart;
window.createLineChart = createLineChart;
window.createBarChart = createBarChart;
window.createDonutChart = createDonutChart;
window.createPieChart = createPieChart;
window.createRadialChart = createRadialChart;
window.createSparkline = createSparkline;
window.createMixedChart = createMixedChart;
window.generateTimeSeriesData = generateTimeSeriesData;
window.generateMonthlyData = generateMonthlyData;
window.getPolicyDistributionData = getPolicyDistributionData;
window.formatCompact = formatCompact;
window.formatNumber = formatNumber;
window.formatCurrency = formatCurrency;
window.chartColors = chartColors;

// Debug log
document.addEventListener('DOMContentLoaded', () => {
  console.log('IHSAN AI Charts Module loaded');
  console.log('ApexCharts available:', typeof ApexCharts !== 'undefined');
});
