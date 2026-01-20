/**
 * Global Configuration - Muhasebe Uygulaması
 * Bu dosya tüm sayfalarda kullanılan global ayarları içerir.
 */

// Ortam tespiti: localhost ise local backend, değilse production
const isLocalhost = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.protocol === 'file:';

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
    BASE_URL: isLocalhost ? DEV_PROFILES[currentDev].https : 'https://muhasebeapi.sigorta.teklifi.al',
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
      const currentHref = window.location.href;
      // Login sayfasındaysak yönlendirme yapma
      if (currentHref.includes('login.html')) return;

      // /pages/ klasörünün konumunu bul ve login.html yolunu oluştur
      const pagesIndex = currentHref.indexOf('/pages/');
      if (pagesIndex !== -1) {
        // /pages/ bulundu, login.html yolunu oluştur
        window.location.href = currentHref.substring(0, pagesIndex) + '/pages/login.html';
      } else {
        // Fallback: göreceli yol dene
        window.location.href = this.LOGIN_PAGE;
      }
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

  // skipAuthRedirect: true ise 401'de otomatik login'e yönlendirme yapma
  const skipAuthRedirect = options.skipAuthRedirect || false;
  delete options.skipAuthRedirect;

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
      if (!skipAuthRedirect) {
        APP_CONFIG.AUTH.clearToken();
        APP_CONFIG.AUTH.redirectToLogin();
        throw new Error('Oturum süresi doldu');
      } else {
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
      }
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

  // Şube adını göster (yoksa rolü göster)
  const userRoleEl = document.querySelector('.navbar-user-role');
  if (userRoleEl) userRoleEl.textContent = user.subeAdi || user.role || '';

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
function applyPermissions() {
  const user = APP_CONFIG.AUTH.getUser();
  if (!user) return;

  // Menü öğelerini yetkiye göre gizle
  const menuRules = {
    'a[href*="pool.html"]': 'policeHavuzunuGorebilsin',
    'a[href*="permissions.html"]': 'yetkilerSayfasindaIslemYapabilsin',
    'a[href*="agency-codes.html"]': 'acenteliklerSayfasindaIslemYapabilsin',
    'a[href*="commission.html"]': 'komisyonOranlariniDuzenleyebilsin'
  };

  Object.entries(menuRules).forEach(([selector, permission]) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (!hasPermission(permission)) {
        // Önce parent nav-item'ı dene, yoksa elementi kaldır
        const navItem = el.closest('.nav-item');
        if (navItem) {
          navItem.style.display = 'none';
        } else {
          el.style.display = 'none';
        }
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

// ═══════════════════════════════════════════════════════════════
// OTOMATİK NAVBAR GÜNCELLEME VE YETKİ KONTROLÜ
// ═══════════════════════════════════════════════════════════════
// Sayfa yüklendiğinde navbar'daki kullanıcı bilgilerini güncelle ve yetkileri uygula
document.addEventListener('DOMContentLoaded', function() {
  updateNavbarUser();
  applyPermissions();
});
