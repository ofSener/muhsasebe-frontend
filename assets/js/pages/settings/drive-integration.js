    let isConnected = false;

    document.addEventListener('DOMContentLoaded', function() {
      if (!requireAuth()) return;
      if (!requirePermission('driveEntegrasyonuGorebilsin', '../../index.html')) return;

      // URL parametrelerini kontrol et
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('connected') === 'true') {
        showToast('Google Drive baglantisi basarili!', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      if (urlParams.get('error')) {
        showToast('Baglanti hatasi: ' + decodeURIComponent(urlParams.get('error')), 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      loadDriveStatus();
    });

    async function loadDriveStatus() {
      try {
        const status = await getDriveStatus();
        isConnected = status.isConnected;
        updateUI(status);
      } catch (error) {
        // Hata durumunda sessizce "bagli degil" goster
        console.log('Drive status:', error.message);
        updateUI({ isConnected: false });
      }
    }

    function updateUI(status) {
      const indicator = document.getElementById('statusIndicator');
      const label = document.getElementById('statusLabel');
      const email = document.getElementById('statusEmail');
      const btn = document.getElementById('connectBtn');
      const statsSection = document.getElementById('statsSection');
      const settingsSection = document.getElementById('settingsSection');
      const historySection = document.getElementById('historySection');

      if (status.isConnected) {
        indicator.className = 'status-indicator connected';
        label.textContent = 'Bagli';
        email.textContent = status.connectedEmail || '';

        btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Baglantiyi Kes
        `;
        btn.className = 'drive-btn drive-btn-danger';
        btn.onclick = disconnectFromDrive;

        // Istatistikleri guncelle
        document.getElementById('uploadedFiles').textContent = status.uploadedFiles || 0;
        document.getElementById('usedStorage').textContent = status.usedStorage || '0 B';
        document.getElementById('lastSync').textContent = status.lastSyncAt
          ? new Date(status.lastSyncAt).toLocaleDateString('tr-TR')
          : '-';

        // Sectionlari goster
        statsSection.style.display = 'grid';
        settingsSection.style.display = 'block';
        historySection.style.display = 'block';

        // Gecmisi yukle
        loadHistory();
      } else {
        indicator.className = 'status-indicator disconnected';
        label.textContent = 'Bagli Degil';
        email.textContent = '';

        btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
            <polyline points="10,17 15,12 10,7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          Drive'a Baglan
        `;
        btn.className = 'drive-btn drive-btn-primary';
        btn.onclick = connectGoogleDrive;

        // Sectionlari gizle
        statsSection.style.display = 'none';
        settingsSection.style.display = 'none';
        historySection.style.display = 'none';
      }
    }

    async function connectGoogleDrive() {
      try {
        showLoading(true);
        const result = await initiateDriveConnection();
        if (result.authorizationUrl) {
          window.location.href = result.authorizationUrl;
        }
      } catch (error) {
        showToast('Baglanti baslatilamadi: ' + error.message, 'error');
      } finally {
        showLoading(false);
      }
    }

    async function disconnectFromDrive() {
      if (!confirm('Google Drive baglantisini kesmek istediginizden emin misiniz?')) return;

      try {
        showLoading(true);
        await disconnectDrive();
        showToast('Baglanti kesildi', 'success');
        loadDriveStatus();
      } catch (error) {
        showToast('Baglanti kesilemedi: ' + error.message, 'error');
      } finally {
        showLoading(false);
      }
    }

    async function loadHistory() {
      try {
        const history = await getDriveHistory(1, 10);
        renderHistory(history.items);
      } catch (error) {
        console.log('History error:', error.message);
      }
    }

    function renderHistory(items) {
      const container = document.getElementById('historyList');

      if (!items || items.length === 0) {
        container.innerHTML = `
          <div class="history-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            <span>Henuz yukleme yapilmadi</span>
          </div>
        `;
        return;
      }

      container.innerHTML = items.map(item => `
        <div class="history-item ${item.driveWebViewLink ? 'clickable' : ''}" ${item.driveWebViewLink ? `onclick="window.open('${item.driveWebViewLink}', '_blank')"` : ''}>
          <div class="history-item-info">
            <div class="history-item-icon ${item.status === 'Success' ? 'success' : ''}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
            </div>
            <div class="history-item-details">
              <span class="history-item-name">${escapeHtml(item.fileName)}</span>
              <span class="history-item-meta">${item.fileSizeFormatted} • ${new Date(item.uploadedAt).toLocaleDateString('tr-TR')}</span>
            </div>
          </div>
          <div class="history-item-actions">
            ${item.driveWebViewLink ? `
              <a href="${item.driveWebViewLink}" target="_blank" class="drive-btn-icon" title="Drive'da Ac" onclick="event.stopPropagation()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15,3 21,3 21,9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ` : ''}
            <span class="history-item-status ${item.status === 'Success' ? 'success' : 'failed'}">
              ${item.status === 'Success' ? 'Basarili' : 'Basarisiz'}
            </span>
          </div>
        </div>
      `).join('');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function refreshHistory() {
      loadHistory();
    }
