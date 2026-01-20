/**
 * Global Configuration - Muhasebe Uygulaması
 * Bu dosya tüm sayfalarda kullanılan global ayarları içerir.
 */

// Ortam tespiti: localhost ise local backend, değilse production
const isLocalhost = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.protocol === 'file:';

const APP_CONFIG = {
  // ═══════════════════════════════════════════════════════════════
  // API AYARLARI
  // ═══════════════════════════════════════════════════════════════
  API: {
    // Local: https://localhost:36100 (veya http://localhost:36101)
    // Production: https://muhasebeapi.sigorta.teklifi.al
    BASE_URL: isLocalhost ? 'https://localhost:36100' : 'https://muhasebeapi.sigorta.teklifi.al',
    VERSION: 'v1',
    TIMEOUT: 30000, // 30 saniye

    // Tam API URL'i oluşturur
    getUrl: function(endpoint) {
      return `${this.BASE_URL}/api/${endpoint}`;
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════
  AUTH: {
    TOKEN_KEY: 'auth_token',
    REFRESH_TOKEN_KEY: 'refresh_token',
    USER_KEY: 'current_user',
    LOGIN_PAGE: '/pages/login.html',

    // Token'ı localStorage'dan al
    getToken: function() {
      return localStorage.getItem(this.TOKEN_KEY);
    },

    // Token'ı kaydet
    setToken: function(token) {
      localStorage.setItem(this.TOKEN_KEY, token);
    },

    // Token'ı sil (logout)
    clearToken: function() {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    },

    // Kullanıcı bilgisini al
    getUser: function() {
      const user = localStorage.getItem(this.USER_KEY);
      return user ? JSON.parse(user) : null;
    },

    // Kullanıcı bilgisini kaydet
    setUser: function(user) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    },

    // Giriş yapılmış mı kontrol et
    isLoggedIn: function() {
      return !!this.getToken();
    },

    // Login sayfasına yönlendir
    redirectToLogin: function() {
      const currentPath = window.location.pathname;
      // Login sayfasındaysak yönlendirme yapma
      if (currentPath.includes('login.html')) return;
      window.location.href = this.LOGIN_PAGE;
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // SAYFALAMA AYARLARI
  // ═══════════════════════════════════════════════════════════════
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
  },

  // ═══════════════════════════════════════════════════════════════
  // TARİH FORMAT AYARLARI
  // ═══════════════════════════════════════════════════════════════
  DATE: {
    FORMAT: 'DD.MM.YYYY',
    API_FORMAT: 'YYYY-MM-DD',
    LOCALE: 'tr-TR'
  },

  // ═══════════════════════════════════════════════════════════════
  // PARA BİRİMİ AYARLARI
  // ═══════════════════════════════════════════════════════════════
  CURRENCY: {
    CODE: 'TRY',
    SYMBOL: '₺',
    LOCALE: 'tr-TR',

    // Para formatla
    format: function(amount) {
      return this.SYMBOL + amount.toLocaleString(this.LOCALE);
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// API HELPER FONKSİYONLARI
// ═══════════════════════════════════════════════════════════════

/**
 * API isteği yapar (fetch wrapper)
 * @param {string} endpoint - API endpoint (örn: 'policies/captured')
 * @param {object} options - Fetch options
 * @returns {Promise<object>} - API yanıtı
 */
async function apiRequest(endpoint, options = {}) {
  const url = APP_CONFIG.API.getUrl(endpoint);
  const token = APP_CONFIG.AUTH.getToken();

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.API.TIMEOUT);

    const response = await fetch(url, {
      ...mergedOptions,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // 401 Unauthorized - Token geçersiz
    if (response.status === 401) {
      APP_CONFIG.AUTH.clearToken();
      APP_CONFIG.AUTH.redirectToLogin();
      throw new Error('Oturum süresi doldu');
    }

    // 403 Forbidden - Yetki yok
    if (response.status === 403) {
      throw new Error('Bu işlem için yetkiniz yok');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Bir hata oluştu');
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('İstek zaman aşımına uğradı');
    }
    throw error;
  }
}

/**
 * GET isteği
 */
async function apiGet(endpoint, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
  return apiRequest(fullEndpoint, { method: 'GET' });
}

/**
 * POST isteği
 */
async function apiPost(endpoint, data = {}) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * PUT isteği
 */
async function apiPut(endpoint, data = {}) {
  return apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * DELETE isteği
 */
async function apiDelete(endpoint) {
  return apiRequest(endpoint, { method: 'DELETE' });
}

// ═══════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLARI
// ═══════════════════════════════════════════════════════════════

/**
 * Toast/Notification göster
 */
function showToast(message, type = 'info') {
  // Mevcut toast varsa kaldır
  const existingToast = document.querySelector('.toast-notification');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${getToastIcon(type)}</span>
      <span class="toast-message">${message}</span>
    </div>
  `;

  document.body.appendChild(toast);

  // Animasyon için timeout
  setTimeout(() => toast.classList.add('show'), 10);

  // 3 saniye sonra kaldır
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function getToastIcon(type) {
  const icons = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  return icons[type] || icons.info;
}

/**
 * Loading overlay göster/gizle
 */
function showLoading(show = true) {
  let overlay = document.getElementById('loadingOverlay');

  if (show) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-spinner">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.classList.add('show');
  } else if (overlay) {
    overlay.classList.remove('show');
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION HELPER FONKSİYONLARI
// ═══════════════════════════════════════════════════════════════

/**
 * Sayfa için authentication gerekli mi kontrol et
 * Korumalı sayfalarda DOMContentLoaded'da çağrılmalı
 */
function requireAuth() {
  if (!APP_CONFIG.AUTH.isLoggedIn()) {
    APP_CONFIG.AUTH.redirectToLogin();
    return false;
  }
  return true;
}

/**
 * Çıkış yap
 */
async function logout() {
  try {
    // Backend'e logout isteği gönder (opsiyonel)
    await apiPost('auth/logout', {});
  } catch (error) {
    // Hata olsa bile devam et
    console.warn('Logout API error:', error);
  } finally {
    APP_CONFIG.AUTH.clearToken();
    APP_CONFIG.AUTH.redirectToLogin();
  }
}

/**
 * Kullanıcının belirli bir yetkisi var mı kontrol et
 * @param {string} permission - Yetki adı (örn: 'policeDuzenleyebilsin')
 * @returns {boolean}
 */
function hasPermission(permission) {
  const user = APP_CONFIG.AUTH.getUser();
  if (!user || !user.permissions) return false;
  return user.permissions[permission] === '1' || user.permissions[permission] === 1;
}

/**
 * Kullanıcı rolünü al
 * @returns {string} - 'admin', 'editor', 'viewer', 'restricted'
 */
function getUserRole() {
  const user = APP_CONFIG.AUTH.getUser();
  return user?.role || 'viewer';
}

// ═══════════════════════════════════════════════════════════════
// SAYFA BAŞLATMA
// ═══════════════════════════════════════════════════════════════

// Config yüklendiğinde konsola bilgi yaz (development için)
console.log(`[Config] API Base URL: ${APP_CONFIG.API.BASE_URL}`);

// ═══════════════════════════════════════════════════════════════
// OTOMATİK AUTH KONTROLÜ
// ═══════════════════════════════════════════════════════════════
// Login sayfası hariç tüm sayfalarda token kontrolü yap
(function() {
  const currentPath = window.location.pathname;
  const isLoginPage = currentPath.includes('login.html');

  if (!isLoginPage && !APP_CONFIG.AUTH.isLoggedIn()) {
    // Token yok, login sayfasına yönlendir
    APP_CONFIG.AUTH.redirectToLogin();
  }
})();
