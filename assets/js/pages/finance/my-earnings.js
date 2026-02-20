    // API Base URL
    const API_BASE = 'https://muhasebeapi.sigorta.teklifi.al';

    // Format currency
    function formatCurrency(value) {
      return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value) + ' TL';
    }

    // Format date
    function formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('tr-TR');
    }

    // Get auth token
    function getToken() {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return user.token;
      }
      return null;
    }

    // Check auth
    function checkAuth() {
      const token = getToken();
      if (!token) {
        window.location.href = '../../login.html';
        return false;
      }

      // Update user info in navbar
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        document.getElementById('userName').textContent = user.user?.name || 'Kullanici';
        document.getElementById('userRole').textContent = user.user?.role || '--';
        const initials = (user.user?.name || 'KA').split(' ').map(n => n[0]).join('').substring(0, 2);
        document.getElementById('userAvatar').textContent = initials;
      }
      return true;
    }

    // Chart instances
    let trendChart = null;
    let distributionChart = null;

    // Load earnings data
    async function loadEarnings() {
      if (!checkAuth()) return;

      const token = getToken();
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      const bransId = document.getElementById('insuranceType').value;

      let url = `${API_BASE}/api/earnings/my?`;
      if (startDate) url += `startDate=${startDate}&`;
      if (endDate) url += `endDate=${endDate}&`;
      if (bransId) url += `bransId=${bransId}&`;

      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          localStorage.removeItem('user');
          window.location.href = '../../login.html';
          return;
        }

        if (response.status === 403) {
          document.getElementById('earningsTableBody').innerHTML = `
            <tr>
              <td colspan="10" class="text-center" style="padding: 3rem;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" style="margin-bottom: 1rem;">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <p style="color: var(--danger); font-weight: 600;">Erisim Yetkisi Yok</p>
                <p style="color: var(--text-muted); font-size: 0.875rem;">Bu sayfayi goruntuleme yetkiniz bulunmuyor.</p>
              </td>
            </tr>
          `;
          return;
        }

        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        updateUI(data);
      } catch (error) {
        console.error('Error loading earnings:', error);
        document.getElementById('earningsTableBody').innerHTML = `
          <tr>
            <td colspan="10" class="text-center" style="padding: 3rem;">
              <p style="color: var(--danger);">Veriler yuklenirken hata olustu.</p>
              <button class="btn btn-primary" onclick="loadEarnings()" style="margin-top: 1rem;">Tekrar Dene</button>
            </td>
          </tr>
        `;
      }
    }

    // Update UI with data
    function updateUI(data) {
      // Update stats
      document.getElementById('totalEarnings').textContent = formatCurrency(data.toplamKazanc || 0);
      document.getElementById('thisMonthEarnings').textContent = formatCurrency(data.buAyKazanc || 0);
      document.getElementById('paidAmount').textContent = formatCurrency(data.odenenTutar || 0);
      document.getElementById('pendingAmount').textContent = formatCurrency(data.bekleyenTutar || 0);

      // Update record count
      document.getElementById('recordCount').textContent = `${(data.detaylar || []).length} kayit`;

      // Update trend chart
      updateTrendChart(data.aylikTrend || []);

      // Update distribution chart
      updateDistributionChart(data.tureGoreDagilim || []);

      // Update table
      updateTable(data.detaylar || []);
    }

    // Update trend chart
    function updateTrendChart(trendData) {
      const options = {
        series: [{
          name: 'Kazanc',
          data: trendData.map(t => t.tutar)
        }],
        chart: {
          type: 'area',
          height: 280,
          toolbar: { show: false },
          fontFamily: 'inherit'
        },
        colors: ['#6366f1'],
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.4,
            opacityTo: 0.1
          }
        },
        stroke: { curve: 'smooth', width: 2 },
        xaxis: {
          categories: trendData.map(t => t.ay),
          labels: { style: { colors: '#64748b' } }
        },
        yaxis: {
          labels: {
            formatter: (val) => formatCurrency(val),
            style: { colors: '#64748b' }
          }
        },
        tooltip: {
          y: { formatter: (val) => formatCurrency(val) }
        },
        grid: { borderColor: '#e2e8f0' }
      };

      if (trendChart) trendChart.destroy();
      trendChart = new ApexCharts(document.getElementById('trendChart'), options);
      trendChart.render();
    }

    // Update distribution chart
    function updateDistributionChart(distData) {
      const options = {
        series: distData.map(d => d.tutar),
        chart: {
          type: 'donut',
          height: 280,
          fontFamily: 'inherit'
        },
        labels: distData.map(d => d.sigortaTuru),
        colors: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        legend: {
          position: 'bottom',
          labels: { colors: '#64748b' }
        },
        tooltip: {
          y: { formatter: (val) => formatCurrency(val) }
        },
        plotOptions: {
          pie: {
            donut: {
              size: '60%',
              labels: {
                show: true,
                total: {
                  show: true,
                  label: 'Toplam',
                  formatter: () => formatCurrency(distData.reduce((a, b) => a + b.tutar, 0))
                }
              }
            }
          }
        }
      };

      if (distributionChart) distributionChart.destroy();
      distributionChart = new ApexCharts(document.getElementById('distributionChart'), options);
      distributionChart.render();
    }

    // Update table
    function updateTable(details) {
      const tbody = document.getElementById('earningsTableBody');

      if (!details || details.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" class="text-center" style="padding: 3rem;">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom: 1rem;">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p style="color: var(--text-muted);">Henuz kazanc kaydı bulunmuyor.</p>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = details.map(d => `
        <tr>
          <td data-label="Tarih">${formatDate(d.tarih)}</td>
          <td data-label="Police No"><span class="font-mono" style="font-size: 0.8125rem;">${d.policeNo}</span></td>
          <td data-label="Musteri">${d.musteriAdi}</td>
          <td data-label="Sirket">${d.sigortaSirketi}</td>
          <td data-label="Tur"><span class="badge badge-primary">${d.sigortaTuru}</span></td>
          <td data-label="Net Prim" class="text-right font-mono">${formatCurrency(d.netPrim)}</td>
          <td data-label="Sirket Komis." class="text-right font-mono">${formatCurrency(d.sirketKomisyonu)}</td>
          <td data-label="Komis. Orani" class="text-right font-mono">%${d.komisyonOrani}</td>
          <td data-label="Kazanc" class="text-right font-mono" style="font-weight: 600; color: var(--success);">${formatCurrency(d.kazanc)}</td>
          <td data-label="Odeme"><span class="badge ${d.odemeDurumu === 'Odendi' ? 'badge-success' : 'badge-warning'}">${d.odemeDurumu}</span></td>
        </tr>
      `).join('');
    }

    // Clear filters
    function clearFilters() {
      document.getElementById('startDate').value = '';
      document.getElementById('endDate').value = '';
      document.getElementById('insuranceType').value = '';
      loadEarnings();
    }

    // Export to Excel (placeholder)
    function exportToExcel() {
      alert('Excel indirme ozelligi yakinda eklenecek.');
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      if (checkAuth()) {
        loadEarnings();
      }
    });

    // Period filter change
    document.getElementById('periodFilter')?.addEventListener('change', (e) => {
      const now = new Date();
      let startDate, endDate;

      switch (e.target.value) {
        case 'this-month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = now;
          break;
        case 'last-month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'last-3-months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          endDate = now;
          break;
        case 'this-year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = now;
          break;
        case 'all':
        default:
          startDate = null;
          endDate = null;
      }

      if (startDate) {
        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
      } else {
        document.getElementById('startDate').value = '';
      }

      if (endDate) {
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
      } else {
        document.getElementById('endDate').value = '';
      }

      loadEarnings();
    });
