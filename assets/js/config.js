/**
 * Global Configuration - Muhasebe Uygulaması
 * Bu dosya tüm sayfalarda kullanılan global ayarları içerir.
 */

// Ortam tespiti: localhost ise local backend, değilse production
const isLocalhost = true;  // Local API'yi kullan
/*
const isLocalhost = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '[::1]' ||  // IPv6 localhost
                    window.location.protocol === 'file:';
*/

// ═══════════════════════════════════════════════════════════════
// TEST ORTAMI AYARLARI
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = {
  // Test ortamında login bypass aktif mi?
  // Production API kullanıldığı için bypass kapalı - gerçek login gerekli
  BYPASS_LOGIN: false,

  // Test kullanıcı bilgileri (localhost'ta otomatik login için)
  TEST_USER: {
    id: 1,
    name: 'Test Kullanıcı',
    email: 'test@test.com',
    firmaId: 1,
    subeId: 1,
    subeAdi: 'Ana Şube',
    profilResmi: null,
    permissions: {
      policeDuzenleyebilsin: '1',
      policeHavuzunuGorebilsin: '1',
      policeAktarabilsin: '1',
      policeDosyalarinaErisebilsin: '1',
      policeYakalamaSecenekleri: '1', // '0' = Kontrol yok, '1' = Soft kontrol, '2' = Hard kontrol
      yetkilerSayfasindaIslemYapabilsin: '1',
      acenteliklerSayfasindaIslemYapabilsin: '1',
      komisyonOranlariniDuzenleyebilsin: '1',
      produktorleriGorebilsin: '1',
      acenteliklereGorePoliceYakalansin: '1',
      gorebilecegiPolicelerveKartlar: '1',
      // Ana menü yetkileri
      musterileriGorebilsin: '1',
      finansSayfasiniGorebilsin: '1',
      // Müşterilerimiz alt yetkileri
      musteriListesiGorebilsin: '1',
      musteriDetayGorebilsin: '1',
      yenilemeTakibiGorebilsin: '1',
      // Finans alt yetkileri
      finansDashboardGorebilsin: '1',
      policeOdemeleriGorebilsin: '1',
      tahsilatTakibiGorebilsin: '1',
      finansRaporlariGorebilsin: '1',
      // Entegrasyon yetkileri
      driveEntegrasyonuGorebilsin: '1'
    }
  },
  TEST_TOKEN: 'test-token-for-development-only'
};

// ═══════════════════════════════════════════════════════════════
// GELİŞTİRİCİ PROFİLLERİ
// ═══════════════════════════════════════════════════════════════
const DEV_PROFILES = {
  omer:  { https: 'https://localhost:36100', http: 'http://localhost:36101' },
  musti: { https: 'https://localhost:36200', http: 'http://localhost:36201' }
};

// localStorage'dan geliştirici seç, yoksa 'omer' default
const currentDev = localStorage.getItem('dev_profile') || 'omer';

// Geliştirici değiştirme fonksiyonu (console'dan kullanılabilir)
function setDevProfile(name) {
  if (DEV_PROFILES[name]) {
    localStorage.setItem('dev_profile', name);
    console.log(`[Config] Geliştirici profili: ${name}`);
    console.log(`[Config] API URL: ${DEV_PROFILES[name].https}`);
    console.log('[Config] Sayfayı yenileyiniz...');
    return true;
  }
  console.error(`[Config] Geçersiz profil. Seçenekler: ${Object.keys(DEV_PROFILES).join(', ')}`);
  return false;
}

const APP_CONFIG = {
  // ═══════════════════════════════════════════════════════════════
  // API AYARLARI
  // ═══════════════════════════════════════════════════════════════
  API: {
    // Omer:  https://localhost:36100 (http://localhost:36101)
    // Musti: https://localhost:36200 (http://localhost:36201)
    // Production: https://muhasebeapi.sigorta.teklifi.al
    // localhost ise dev profil URL'i kullan, değilse production
    BASE_URL: isLocalhost ? DEV_PROFILES[currentDev].https : 'https://muhasebeapi.sigorta.teklifi.al',
    VERSION: 'v1',
    TIMEOUT: 30000, // 30 saniye

    // Tam API URL'i oluşturur
    getUrl: function(endpoint) {
      return `${this.BASE_URL}/api/${endpoint}`;
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // AUTHENTICATION (Access token memory'de, Refresh token localStorage'da)
  // ═══════════════════════════════════════════════════════════════
  AUTH: {
    _accessToken: null,            // Memory'de tutulan access token
    _tokenExpiry: null,            // Token expiry timestamp
    _refreshPromise: null,         // Devam eden refresh isteği (race condition önleme)
    REFRESH_TOKEN_KEY: 'refresh_token',  // localStorage'da refresh token
    USER_KEY: 'current_user',      // localStorage'da user info
    LOGIN_PAGE: '/pages/login.html',

    // Access token'ı memory'den al
    getToken: function() {
      // Token expire olduysa null döndür
      if (this._tokenExpiry && Date.now() > this._tokenExpiry) {
        this._accessToken = null;
        this._tokenExpiry = null;
      }
      return this._accessToken;
    },

    // Access token'ı memory'ye kaydet
    setToken: function(token, expiresIn) {
      this._accessToken = token;
      // expiresIn saniye cinsinden, biraz erken expire olarak kabul et (güvenlik marjı)
      if (expiresIn) {
        this._tokenExpiry = Date.now() + (expiresIn * 1000) - 60000; // 1 dk erken
      }
    },

    // Refresh token'ı localStorage'dan al
    getRefreshToken: function() {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    },

    // Refresh token'ı localStorage'a kaydet
    setRefreshToken: function(refreshToken) {
      if (refreshToken) {
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      }
    },

    // Tüm token'ları sil (logout)
    clearToken: function() {
      this._accessToken = null;
      this._tokenExpiry = null;
      this._refreshPromise = null;
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    },

    // Kullanıcı bilgisini al (non-sensitive data)
    getUser: function() {
      const user = localStorage.getItem(this.USER_KEY);
      return user ? JSON.parse(user) : null;
    },

    // Kullanıcı bilgisini kaydet
    setUser: function(user) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    },

    // Token expire olmuş mu veya olmak üzere mi?
    isTokenExpired: function() {
      if (!this._tokenExpiry) return true;
      // 30 saniye kala expire kabul et
      return Date.now() > (this._tokenExpiry - 30000);
    },

    // Refresh token ile yeni access token al
    // MUTEX: Aynı anda sadece bir refresh isteği yapılır, diğerleri bekler
    // Bu token rotation race condition'ı önler
    refreshToken: async function() {
      // Zaten devam eden bir refresh varsa, onu bekle
      if (this._refreshPromise) {
        console.log('[Auth] Devam eden refresh isteği bekleniyor...');
        return this._refreshPromise;
      }

      // Yeni refresh isteği başlat ve promise'i kaydet
      this._refreshPromise = this._doRefresh();

      try {
        const result = await this._refreshPromise;
        return result;
      } finally {
        // İstek tamamlandığında (başarılı veya başarısız) lock'u serbest bırak
        this._refreshPromise = null;
      }
    },

    // Gerçek refresh işlemi (internal)
    _doRefresh: async function() {
      try {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
          console.log('[Auth] Refresh token bulunamadı');
          return false;
        }

        console.log('[Auth] Token refresh başlatılıyor...');
        const response = await fetch(APP_CONFIG.API.getUrl('auth/refresh'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken: refreshToken })
        });

        if (!response.ok) {
          console.log('[Auth] Token refresh başarısız:', response.status);
          this.clearToken();
          return false;
        }

        const data = await response.json();
        if (data.success && data.token) {
          this.setToken(data.token, data.expiresIn);
          // Yeni refresh token varsa güncelle
          if (data.refreshToken) {
            this.setRefreshToken(data.refreshToken);
          }
          console.log('[Auth] Token refresh başarılı');
          return true;
        }

        return false;
      } catch (error) {
        console.error('[Auth] Token refresh error:', error);
        return false;
      }
    },

    // Giriş yapılmış mı kontrol et
    isLoggedIn: function() {
      // Memory'de token varsa VEYA refresh token varsa (sayfa yenilenmiş olabilir)
      return !!this.getToken() || !!this.getRefreshToken();
    },

    // Login sayfasına yönlendir
    redirectToLogin: function() {
      const currentHref = window.location.href;
      // Login sayfasındaysak yönlendirme yapma
      if (currentHref.includes('login.html')) return;

      // file:// protokolü için özel handling
      if (window.location.protocol === 'file:') {
        // Mevcut dosya yolundan login.html yolunu hesapla
        const pathParts = currentHref.split('/');
        const frontendIndex = pathParts.findIndex(p => p === 'frontend');
        if (frontendIndex !== -1) {
          // frontend klasörüne kadar al ve login.html ekle
          const basePath = pathParts.slice(0, frontendIndex + 1).join('/');
          window.location.href = basePath + '/pages/login.html';
          return;
        }
        // Fallback: pages klasörünü bul
        const pagesIndex = pathParts.findIndex(p => p === 'pages');
        if (pagesIndex !== -1) {
          const basePath = pathParts.slice(0, pagesIndex + 1).join('/');
          window.location.href = basePath + '/login.html';
          return;
        }
      }

      // HTTP/HTTPS için normal yönlendirme
      const pagesIndex = currentHref.indexOf('/pages/');
      if (pagesIndex !== -1) {
        window.location.href = currentHref.substring(0, pagesIndex) + '/pages/login.html';
      } else {
        window.location.href = this.LOGIN_PAGE;
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // YETKİ CACHE SİSTEMİ
  // ═══════════════════════════════════════════════════════════════
  PERMISSIONS: {
    CACHE_KEY: 'user_permissions',
    CACHE_TIMESTAMP_KEY: 'permissions_timestamp',
    CACHE_TTL: 5 * 60 * 1000, // 5 dakika

    // Cache'den yetkileri al (TTL kontrolü ile)
    getCached: function() {
      const cached = localStorage.getItem(this.CACHE_KEY);
      const timestamp = localStorage.getItem(this.CACHE_TIMESTAMP_KEY);

      if (!cached || !timestamp) return null;

      const age = Date.now() - parseInt(timestamp);
      if (age > this.CACHE_TTL) {
        // Cache expired
        this.invalidate();
        return null;
      }

      try {
        return JSON.parse(cached);
      } catch (e) {
        this.invalidate();
        return null;
      }
    },

    // Yetkileri cache'e kaydet
    cache: function(permissions) {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(permissions));
      localStorage.setItem(this.CACHE_TIMESTAMP_KEY, Date.now().toString());
    },

    // Cache'i temizle
    invalidate: function() {
      localStorage.removeItem(this.CACHE_KEY);
      localStorage.removeItem(this.CACHE_TIMESTAMP_KEY);
    },

    // API'den yetkileri çek
    fetchFromApi: async function() {
      try {
        const response = await apiGet('auth/me');
        if (response && response.permissions) {
          this.cache(response.permissions);
          // User bilgisini de güncelle
          const user = APP_CONFIG.AUTH.getUser();
          if (user) {
            user.permissions = response.permissions;
            APP_CONFIG.AUTH.setUser(user);
          }
          return response.permissions;
        }
        return null;
      } catch (error) {
        console.error('[Permissions] API fetch error:', error);
        return null;
      }
    },

    // Yetkileri al (cache varsa onu, yoksa API'den)
    get: async function() {
      // Önce cache'e bak
      const cached = this.getCached();
      if (cached) {
        return cached;
      }

      // Cache yoksa API'den çek
      const permissions = await this.fetchFromApi();
      if (permissions) {
        return permissions;
      }

      // API de başarısız olduysa user'dan al
      const user = APP_CONFIG.AUTH.getUser();
      return user?.permissions || null;
    },

    // Senkron versiyon - mevcut cache veya user'dan al
    getSync: function() {
      const cached = this.getCached();
      if (cached) return cached;

      const user = APP_CONFIG.AUTH.getUser();
      return user?.permissions || null;
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
async function apiRequest(endpoint, options = {}, _isRetry = false) {
  const url = APP_CONFIG.API.getUrl(endpoint);

  // skipAuthRedirect: true ise 401'de otomatik login'e yönlendirme yapma
  const skipAuthRedirect = options.skipAuthRedirect || false;
  delete options.skipAuthRedirect;

  // GÜVENLİK: Token expire olmuşsa önce refresh dene
  if (!skipAuthRedirect && APP_CONFIG.AUTH.isTokenExpired() && APP_CONFIG.AUTH.getUser()) {
    const refreshed = await APP_CONFIG.AUTH.refreshToken();
    if (!refreshed) {
      APP_CONFIG.AUTH.clearToken();
      APP_CONFIG.AUTH.redirectToLogin();
      throw new Error('Oturum süresi doldu');
    }
  }

  const token = APP_CONFIG.AUTH.getToken();

  const defaultOptions = {
    credentials: 'include',  // GÜVENLİK: HttpOnly cookie'ler için gerekli
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
      // Retry olmadıysa ve skip değilse, refresh dene
      if (!_isRetry && !skipAuthRedirect) {
        const refreshed = await APP_CONFIG.AUTH.refreshToken();
        if (refreshed) {
          // Yeni token ile tekrar dene
          return apiRequest(endpoint, options, true);
        }
        APP_CONFIG.AUTH.clearToken();
        APP_CONFIG.AUTH.redirectToLogin();
        throw new Error('Oturum süresi doldu');
      } else if (skipAuthRedirect) {
        // Login gibi istekler için: backend'den gelen hatayı kullan
        try {
          const text = await response.text();
          if (text) {
            const data = JSON.parse(text);
            throw new Error(data.error || data.message || 'E-posta veya parola hatalı');
          }
        } catch (parseError) {
          // JSON parse hatası - varsayılan mesaj kullan
        }
        throw new Error('E-posta veya parola hatalı');
      } else {
        APP_CONFIG.AUTH.clearToken();
        APP_CONFIG.AUTH.redirectToLogin();
        throw new Error('Oturum süresi doldu');
      }
    }

    // 403 Forbidden - Yetki yok
    if (response.status === 403) {
      throw new Error('Bu işlem için yetkiniz yok');
    }

    // Response body'yi güvenli şekilde parse et
    const text = await response.text();
    if (!text || text.trim() === '') {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Sunucudan boş yanıt alındı`);
      }
      return null; // Boş ama başarılı response
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('[API] JSON parse error:', parseError, 'Response text:', text.substring(0, 200));
      throw new Error('Sunucudan geçersiz yanıt alındı');
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Bir hata oluştu');
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
 * @param {string} endpoint - API endpoint
 * @param {object} data - POST body data
 * @param {object} extraOptions - Ek opsiyonlar (örn: { skipAuthRedirect: true })
 */
async function apiPost(endpoint, data = {}, extraOptions = {}) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
    ...extraOptions
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
  console.log('showToast çağrıldı:', message, type);

  // Mevcut toast varsa kaldır
  const existing = document.getElementById('app-toast');
  if (existing) {
    existing.remove();
    console.log('Eski toast kaldırıldı');
  }

  // Renk ayarları
  const colors = {
    success: { bg: '#10b981', icon: '✓' },
    error: { bg: '#ef4444', icon: '✕' },
    warning: { bg: '#f59e0b', icon: '!' },
    info: { bg: '#3b82f6', icon: 'i' }
  };
  const color = colors[type] || colors.info;

  // Toast wrapper - doğrudan HTML'e eklenir
  const toast = document.createElement('div');
  toast.id = 'app-toast';

  // Inline CSS - !important ile override garantisi
  toast.setAttribute('style', `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(0, 0, 0, 0.5) !important;
    backdrop-filter: blur(4px) !important;
    z-index: 2147483647 !important;
    opacity: 0;
    transition: opacity 0.3s ease !important;
  `);

  toast.innerHTML = `
    <div id="app-toast-box" style="
      background: #ffffff !important;
      border-radius: 16px !important;
      padding: 24px 32px !important;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3) !important;
      display: flex !important;
      align-items: center !important;
      gap: 16px !important;
      transform: scale(0.8);
      transition: transform 0.3s ease !important;
    ">
      <div style="
        width: 48px !important;
        height: 48px !important;
        border-radius: 50% !important;
        background: ${color.bg} !important;
        color: white !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 24px !important;
        font-weight: bold !important;
        flex-shrink: 0 !important;
      ">${color.icon}</div>
      <div style="font-size: 16px !important; font-weight: 500 !important; color: #1f2937 !important;">${message}</div>
    </div>
  `;

  // HTML elementine (en üst seviye) ekle
  document.documentElement.appendChild(toast);
  console.log('Toast eklendi:', toast);

  // Animasyon
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    const box = document.getElementById('app-toast-box');
    if (box) box.style.transform = 'scale(1)';
    console.log('Toast gösterildi');
  });

  // 2.5 saniye sonra kapat
  setTimeout(() => {
    toast.style.opacity = '0';
    const box = document.getElementById('app-toast-box');
    if (box) box.style.transform = 'scale(0.8)';
    setTimeout(() => {
      toast.remove();
      console.log('Toast kaldırıldı');
    }, 300);
  }, 2500);
}

// Eski fonksiyon - geriye uyumluluk için
function getToastIcon(type) {
  return '';
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
    // Yetki cache'ini temizle
    APP_CONFIG.PERMISSIONS.invalidate();
    APP_CONFIG.AUTH.clearToken();
    APP_CONFIG.AUTH.redirectToLogin();
  }
}

/**
 * Normalize text for Turkish character handling
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .toLowerCase()
    .trim();
}

/**
 * Kullanıcının belirli bir yetkisi var mı kontrol et
 * @param {string} permission - Yetki adı (örn: 'policeDuzenleyebilsin')
 * @returns {boolean}
 */
function hasPermission(permission) {
  // Önce cache'den, yoksa user'dan al
  const permissions = APP_CONFIG.PERMISSIONS.getSync();
  if (!permissions) return false;

  // Try exact match first
  if (permissions[permission] === '1' || permissions[permission] === 1) {
    return true;
  }

  // Try normalized match (for Turkish char mismatches)
  const normalizedPerm = normalizeText(permission);
  for (const [key, value] of Object.entries(permissions)) {
    if (normalizeText(key) === normalizedPerm && (value === '1' || value === 1)) {
      return true;
    }
  }

  return false;
}

/**
 * PoliceYakalamaSecenekleri için özel kontrol
 * Tüm değerler ('0', '1', '2') geçerli - backend'de sadece login kontrolü var
 * @returns {boolean}
 */
function hasPoliceYakalamaPermission() {
  const permissions = APP_CONFIG.PERMISSIONS.getSync();
  const value = permissions?.policeYakalamaSecenekleri;
  return value === '0' || value === '1' || value === '2';
}

/**
 * GorebilecegiPolicelerveKartlar için özel kontrol
 * '4' (hiçbiri) hariç tüm değerler geçerli
 * @returns {boolean}
 */
function hasViewPermission() {
  const permissions = APP_CONFIG.PERMISSIONS.getSync();
  const value = permissions?.gorebilecegiPolicelerveKartlar;
  return value && value !== '4';
}

/**
 * Navbar'daki kullanıcı bilgilerini güncelle
 * Tüm sayfalarda kullanılabilir
 */
function updateNavbarUser() {
  const user = APP_CONFIG.AUTH.getUser();
  if (!user) return;

  // Kullanıcı adını göster
  const userNameEl = document.querySelector('.navbar-user-name');
  if (userNameEl) userNameEl.textContent = user.name || 'Kullanıcı';

  // Şube adını göster
  const userRoleEl = document.querySelector('.navbar-user-role');
  if (userRoleEl) userRoleEl.textContent = user.subeAdi || 'Kullanıcı';

  // Avatar initials
  const avatarEl = document.querySelector('.navbar-avatar');
  if (avatarEl && user.name) {
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    avatarEl.textContent = initials;
  }

  // Kullanıcı dropdown menüsünü ekle
  setupUserDropdown();
}

/**
 * Kullanıcı dropdown menüsünü oluştur ve ekle
 */
function setupUserDropdown() {
  const navbarUser = document.querySelector('.navbar-user');
  if (!navbarUser || navbarUser.classList.contains('dropdown')) return;

  // navbar-user'ı dropdown'a çevir
  navbarUser.classList.add('dropdown');
  navbarUser.style.cursor = 'pointer';

  // Dropdown menüyü oluştur
  const dropdownMenu = document.createElement('div');
  dropdownMenu.className = 'dropdown-menu user-dropdown-menu';
  dropdownMenu.innerHTML = `
    <a class="dropdown-item" href="javascript:void(0)" onclick="showProfileModal()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
      Profilim
    </a>
    <div class="dropdown-divider"></div>
    <a class="dropdown-item dropdown-item-danger" href="javascript:void(0)" onclick="logout()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
        <polyline points="16,17 21,12 16,7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      Cikis Yap
    </a>
  `;
  navbarUser.appendChild(dropdownMenu);

  // Tıklama olayını ekle
  navbarUser.addEventListener('click', function(e) {
    e.stopPropagation();
    this.classList.toggle('open');
  });

  // Dışarı tıklandığında kapat
  document.addEventListener('click', function() {
    navbarUser.classList.remove('open');
  });
}

/**
 * Profil modalını göster (placeholder)
 */
function showProfileModal() {
  showToast('Profil sayfasi yaklinda...', 'info');
}

/**
 * Kullanıcı yetkilerine göre menü öğelerini gizle/göster
 * Sayfa yüklendiğinde çağrılır
 */
async function applyPermissions() {
  const user = APP_CONFIG.AUTH.getUser();
  if (!user) return;

  // Yetkileri cache'den veya API'den al
  await APP_CONFIG.PERMISSIONS.get();

  // Menü öğelerini yetkiye göre gizle
  // Selector -> Yetki adı eşleştirmesi (veya [parent, child] dizisi)
  const menuRules = {
    // Dashboard & Policies
    'a[href*="index.html"]': 'gorebilecegiPolicelerveKartlar',
    'a[href*="my-policies.html"]': 'gorebilecegiPolicelerveKartlar',
    'a[href*="add-manual.html"]': 'policeDuzenleyebilsin',

    // Poliçe İşlemleri
    'a[href*="pool.html"]': 'policeHavuzunuGorebilsin',
    'a[href*="captured.html"]': 'policeYakalamaSecenekleri',
    'a[href*="bulk-import.html"]': 'policeAktarabilsin',

    // Çalışan Yönetimi
    'a[href*="employees/list.html"]': 'produktorleriGorebilsin',
    'a[href*="employees/performance.html"]': 'produktorleriGorebilsin',
    'a[href*="employees/tracking.html"]': 'produktorleriGorebilsin',
    'a[href*="commission.html"]': 'komisyonOranlariniDuzenleyebilsin',

    // Müşterilerimiz - Alt yetkileri
    'a[href*="customers/list.html"]': 'musterileriGorebilsin',
    'a[href*="customers/detail.html"]': 'musteriDetayGorebilsin',
    'a[href*="customers/renewals.html"]': 'yenilemeTakibiGorebilsin',

    // Finans - Alt yetkileri
    'a[href*="finance/dashboard.html"]': 'finansDashboardGorebilsin',
    'a[href*="finance/policies.html"]': 'policeOdemeleriGorebilsin',
    'a[href*="finance/payments.html"]': 'policeOdemeleriGorebilsin',
    'a[href*="finance/collections.html"]': 'tahsilatTakibiGorebilsin',
    'a[href*="finance/collection.html"]': 'tahsilatTakibiGorebilsin',
    'a[href*="finance/reports.html"]': 'finansRaporlariGorebilsin',
    'a[href*="my-earnings.html"]': 'kazanclarimGorebilsin',
    'a[href*="report-settings.html"]': 'finansRaporlariGorebilsin',

    // Sistem Ayarları
    'a[href*="permissions.html"]': 'yetkilerSayfasindaIslemYapabilsin',
    'a[href*="agencies.html"]': 'acenteliklerSayfasindaIslemYapabilsin',
    'a[href*="agency-codes.html"]': 'acenteliklerSayfasindaIslemYapabilsin',
    'a[href*="commission-rates.html"]': 'komisyonOranlariniDuzenleyebilsin',
    'a[href*="drive-integration.html"]': 'driveEntegrasyonuGorebilsin'
  };

  // Alt menü gruplarını da kontrol et (tüm alt öğeler gizliyse grubu da gizle)
  const submenuGroups = {
    'Çalışanlarım': 'produktorleriGorebilsin',
    'Müşterilerimiz': 'musterileriGorebilsin',
    'Finans': 'finansSayfasiniGorebilsin'
  };

  Object.entries(menuRules).forEach(([selector, permission]) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      // Permission bir array ise (parent + child), ikisinin de kontrolü gerekir
      let hasAccess = false;

      // Özel kontroller - multi-value yetkiler için
      if (permission === 'policeYakalamaSecenekleri') {
        hasAccess = hasPoliceYakalamaPermission();
      } else if (permission === 'gorebilecegiPolicelerveKartlar') {
        hasAccess = hasViewPermission();
      } else if (Array.isArray(permission)) {
        // Parent ve child yetkisi kontrol edilir
        hasAccess = permission.every(p => hasPermission(p));
      } else {
        hasAccess = hasPermission(permission);
      }

      if (!hasAccess) {
        // Sadece linki gizle (parent nav-item değil, çünkü submenu item olabilir)
        el.style.display = 'none';
      }
    });
  });

  // Alt menü gruplarını kontrol et - eğer içindeki tüm linkler gizliyse grubu da gizle
  Object.entries(submenuGroups).forEach(([groupName, permission]) => {
    if (!hasPermission(permission)) {
      const normalizedGroupName = normalizeText(groupName);

      // Grup adına göre nav-item'ı bul ve gizle
      document.querySelectorAll('.nav-item.has-submenu').forEach(navItem => {
        const navText = navItem.querySelector('.nav-text');
        if (navText) {
          const elementText = normalizeText(navText.textContent.trim());
          if (elementText === normalizedGroupName) {
            navItem.style.display = 'none';
          }
        }
      });
    }
  });

  // DİNAMİK PARENT MENÜ GİZLEME
  // Tüm menü kuralları uygulandıktan SONRA parent menüleri kontrol et
  // Eğer bir parent menünün tüm alt menüleri gizliyse, parent'ı da gizle
  document.querySelectorAll('.nav-item.has-submenu').forEach(parentItem => {
    // Zaten gizli olan parent'ları atla
    if (parentItem.style.display === 'none') return;

    const submenu = parentItem.querySelector('.submenu');
    if (!submenu) return;

    // Submenu içindeki tüm linkleri kontrol et
    const allLinks = submenu.querySelectorAll('.nav-link');
    if (allLinks.length === 0) {
      // Alt menü yoksa parent'ı gizle
      parentItem.style.display = 'none';
      return;
    }

    // Görünür linkleri say
    const visibleLinks = Array.from(allLinks).filter(link => {
      // Link'in kendisi gizli mi?
      if (link.style.display === 'none') return false;

      // Link'in parent li elementi gizli mi?
      const parentLi = link.closest('li');
      if (parentLi && parentLi.style.display === 'none') return false;

      return true;
    });

    // Görünür link yoksa parent menüyü de gizle
    if (visibleLinks.length === 0) {
      parentItem.style.display = 'none';
    }
  });

  // Dashboard'daki yetki bazlı elementleri kontrol et
  applyDashboardPermissions();
}

/**
 * Dashboard'daki elementleri yetkiye göre gizle/göster
 */
function applyDashboardPermissions() {
  const user = APP_CONFIG.AUTH.getUser();
  if (!user) return;

  // Dashboard kartlarını yetkiye göre gizle
  // Permission bir string veya array olabilir (array: tüm yetkiler gerekli)
  const dashboardRules = {
    '.dashboard-pool-card': 'policeHavuzunuGorebilsin',
    '.dashboard-captured-card': 'policeYakalamaSecenekleri',
    '.dashboard-employees-card': 'produktorleriGorebilsin',
    '.dashboard-commission-card': 'komisyonOranlariniDuzenleyebilsin',
    '.dashboard-customers-card': 'musterileriGorebilsin',
    '.dashboard-finance-card': 'finansSayfasiniGorebilsin',
    // Granüler yetkiler
    '.dashboard-renewals-card': ['musterileriGorebilsin', 'yenilemeTakibiGorebilsin'],
    '.dashboard-collections-card': ['finansSayfasiniGorebilsin', 'tahsilatTakibiGorebilsin']
  };

  Object.entries(dashboardRules).forEach(([selector, permission]) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      let hasAccess = false;

      // Özel kontroller - multi-value yetkiler için
      if (permission === 'policeYakalamaSecenekleri') {
        hasAccess = hasPoliceYakalamaPermission();
      } else if (permission === 'gorebilecegiPolicelerveKartlar') {
        hasAccess = hasViewPermission();
      } else if (Array.isArray(permission)) {
        hasAccess = permission.every(p => hasPermission(p));
      } else {
        hasAccess = hasPermission(permission);
      }

      if (!hasAccess) {
        el.style.display = 'none';
      }
    });
  });
}

/**
 * Belirli bir sayfaya erişim yetkisi kontrolü
 * Korumalı sayfalarda çağrılır
 * @param {string} permission - Gerekli yetki adı
 * @param {string} redirectUrl - Yetki yoksa yönlendirilecek URL (default: index)
 * @returns {boolean}
 */
function requirePermission(permission, redirectUrl = '../../index.html') {
  if (!hasPermission(permission)) {
    showToast('Bu sayfaya erişim yetkiniz yok', 'error');
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 1500);
    return false;
  }
  return true;
}

/**
 * Düzenleme/silme butonlarını yetkiye göre devre dışı bırak
 * @param {string} permission - Gerekli yetki adı
 * @param {string} selectors - Devre dışı bırakılacak buton seçicileri (virgülle ayrılmış)
 */
function disableButtonsWithoutPermission(permission, selectors = '.btn-edit, .btn-delete') {
  if (!hasPermission(permission)) {
    document.querySelectorAll(selectors).forEach(btn => {
      btn.disabled = true;
      btn.classList.add('disabled');
      btn.title = 'Bu işlem için yetkiniz yok';
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.5';
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// SAYFA BAŞLATMA
// ═══════════════════════════════════════════════════════════════

// Config yüklendiğinde konsola bilgi yaz (development için)
console.log(`[Config] Geliştirici: ${currentDev.toUpperCase()}`);
console.log(`[Config] API Base URL: ${APP_CONFIG.API.BASE_URL}`);
console.log(`[Config] Profil değiştirmek için: setDevProfile('omer') veya setDevProfile('musti')`);
if (TEST_MODE.BYPASS_LOGIN) {
  console.log(`[Config] 🧪 TEST MODU AKTIF - Login bypass edilecek`);
}

// ═══════════════════════════════════════════════════════════════
// OTOMATİK AUTH KONTROLÜ
// ═══════════════════════════════════════════════════════════════
// Login sayfası hariç tüm sayfalarda token kontrolü yap
(async function() {
  const currentPath = window.location.pathname;
  const isLoginPage = currentPath.includes('login.html');

  // TEST ORTAMI: localhost'ta otomatik test kullanıcısı ile giriş
  if (TEST_MODE.BYPASS_LOGIN && !isLoginPage && !APP_CONFIG.AUTH.isLoggedIn()) {
    console.log('[Test Mode] Otomatik test kullanıcısı ayarlanıyor...');
    APP_CONFIG.AUTH.setToken(TEST_MODE.TEST_TOKEN, 7200);
    APP_CONFIG.AUTH.setUser(TEST_MODE.TEST_USER);
    return;
  }

  // Sayfa yenilendiğinde memory'deki token kaybolur
  // localStorage'daki refresh token ile yeni access token al
  if (!isLoginPage && !APP_CONFIG.AUTH.getToken() && APP_CONFIG.AUTH.getRefreshToken()) {
    console.log('[Auth] Sayfa yenilendi, token refresh deneniyor...');
    const refreshed = await APP_CONFIG.AUTH.refreshToken();
    if (!refreshed) {
      console.log('[Auth] Token refresh başarısız, login\'e yönlendiriliyor...');
      APP_CONFIG.AUTH.clearToken();
      APP_CONFIG.AUTH.redirectToLogin();
      return;
    }
    console.log('[Auth] Token refresh başarılı');
  }

  if (!isLoginPage && !APP_CONFIG.AUTH.isLoggedIn()) {
    // Token yok, login sayfasına yönlendir
    APP_CONFIG.AUTH.redirectToLogin();
  }
})();

// ═══════════════════════════════════════════════════════════════
// OTOMATİK NAVBAR GÜNCELLEME VE YETKİ KONTROLÜ
// ═══════════════════════════════════════════════════════════════
// Sayfa yüklendiğinde navbar'daki kullanıcı bilgilerini güncelle
// Not: applyPermissions() artık sidebar.js'den çağrılıyor (race condition fix)
document.addEventListener('DOMContentLoaded', function() {
  updateNavbarUser();
});

// ═══════════════════════════════════════════════════════════════
// GOOGLE DRIVE API FONKSİYONLARI
// ═══════════════════════════════════════════════════════════════

/**
 * Google Drive bağlantı durumunu al
 * @returns {Promise<object>} - { isConnected, connectedEmail, connectedAt, syncedFolders, uploadedFiles, usedStorage, lastSyncAt }
 */
async function getDriveStatus() {
  return apiGet('drive/status');
}

/**
 * Google Drive OAuth bağlantısını başlat
 * @returns {Promise<object>} - { authorizationUrl, state }
 */
async function initiateDriveConnection() {
  return apiPost('drive/connect');
}

/**
 * Google Drive bağlantısını kes
 * @returns {Promise<object>} - { success: boolean }
 */
async function disconnectDrive() {
  return apiDelete('drive/disconnect');
}

/**
 * Drive yükleme geçmişini al
 * @param {number} page - Sayfa numarası
 * @param {number} pageSize - Sayfa başına kayıt
 * @returns {Promise<object>} - { items, totalCount, page, pageSize }
 */
async function getDriveHistory(page = 1, pageSize = 20) {
  return apiGet(`drive/history?page=${page}&pageSize=${pageSize}`);
}

/**
 * PDF dosyasını Google Drive'a yükle
 * @param {File} file - Yüklenecek PDF dosyası
 * @returns {Promise<object>} - { success, fileId, webViewLink, drivePath, errorMessage }
 */
async function uploadFileToDrive(file) {
  const formData = new FormData();
  formData.append('file', file);

  const token = APP_CONFIG.AUTH.getToken();
  const url = APP_CONFIG.API.getUrl('drive/upload');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 saniye timeout (dosya yükleme için)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Content-Type header'ı eklemeyin - browser FormData için otomatik ayarlar
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      APP_CONFIG.AUTH.clearToken();
      APP_CONFIG.AUTH.redirectToLogin();
      throw new Error('Oturum süresi doldu');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.errorMessage || data.error || 'Yükleme başarısız');
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Yükleme zaman aşımına uğradı');
    }
    throw error;
  }
}

// Global scope'a ekle
window.getDriveStatus = getDriveStatus;
window.initiateDriveConnection = initiateDriveConnection;
window.disconnectDrive = disconnectDrive;
window.getDriveHistory = getDriveHistory;
window.uploadFileToDrive = uploadFileToDrive;
