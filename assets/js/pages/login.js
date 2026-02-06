    // ═══════════════════════════════════════════════════════════════
    // LOGO RAIN GENERATOR
    // ═══════════════════════════════════════════════════════════════
    const logoRain = document.getElementById('logoRain');
    const logoPath = '../assets/images/logos/ihsanai-logo.png';
    const emojis = ['🤖', '💜', '✨', '🚀', '💎', '⚡', '🔮', '🌟'];

    // Create falling logos
    for (let i = 0; i < 30; i++) {
      const logo = document.createElement('div');
      logo.className = 'falling-logo';

      // Try to use actual logo, fallback to random emoji
      const img = new Image();
      img.src = logoPath;
      img.onload = function() {
        logo.innerHTML = '';
        logo.appendChild(img.cloneNode());
        logo.classList.add('has-img');
      };
      img.onerror = function() {
        // Use random emoji as fallback
        logo.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        logo.style.setProperty('--emoji', `"${logo.textContent}"`);
      };

      logoRain.appendChild(logo);
    }

    // Try to load logo for card
    const cardLogo = document.getElementById('cardLogo');
    const cardLogoImg = new Image();
    cardLogoImg.src = logoPath;
    cardLogoImg.onload = function() {
      cardLogo.innerHTML = '';
      cardLogo.appendChild(cardLogoImg);
    };

    // ═══════════════════════════════════════════════════════════════
    // 3D TILT EFFECT
    // ═══════════════════════════════════════════════════════════════
    const loginCard = document.getElementById('loginCard');

    loginCard.addEventListener('mousemove', (e) => {
      const rect = loginCard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 15;
      const rotateY = (centerX - x) / 15;

      loginCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    loginCard.addEventListener('mouseleave', () => {
      loginCard.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
    });

    // ═══════════════════════════════════════════════════════════════
    // PARTY MODE (Easter Egg - Type "party")
    // ═══════════════════════════════════════════════════════════════
    let partyCode = '';
    document.addEventListener('keypress', (e) => {
      partyCode += e.key;
      if (partyCode.includes('party')) {
        document.body.classList.toggle('party-mode');
        partyCode = '';
      }
      if (partyCode.length > 10) partyCode = partyCode.slice(-5);
    });

    // ═══════════════════════════════════════════════════════════════
    // LOGIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', function() {
      if (typeof TEST_MODE !== 'undefined' && TEST_MODE.BYPASS_LOGIN) {
        console.log('[Test Mode] Login bypass aktif');
        APP_CONFIG.AUTH.setToken(TEST_MODE.TEST_TOKEN);
        APP_CONFIG.AUTH.setUser(TEST_MODE.TEST_USER);
        window.location.href = '../index.html';
        return;
      }

      const token = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.AUTH.getToken() : null;
      if (token) {
        validateTokenAndRedirect();
      }

      const rememberedEmail = localStorage.getItem('remembered_email');
      if (rememberedEmail) {
        document.getElementById('email').value = rememberedEmail;
        document.getElementById('rememberMe').checked = true;
      }
    });

    async function validateTokenAndRedirect() {
      try {
        const response = await apiGet('auth/me');
        if (response && response.id) {
          window.location.href = '../index.html';
        }
      } catch (error) {
        APP_CONFIG.AUTH.clearToken();
      }
    }

    function togglePassword() {
      const passwordInput = document.getElementById('password');
      const eyeIcon = document.getElementById('eyeIcon');

      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = `
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        `;
      } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = `
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        `;
      }
    }

    function showError(message) {
      const errorDiv = document.getElementById('errorMessage');
      const errorText = document.getElementById('errorText');
      errorText.textContent = message;
      errorDiv.classList.add('show');
    }

    function hideError() {
      const errorDiv = document.getElementById('errorMessage');
      errorDiv.classList.remove('show');
    }

    async function handleLogin(event) {
      event.preventDefault();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const rememberMe = document.getElementById('rememberMe').checked;
      const loginButton = document.getElementById('loginButton');

      if (!email || !password) {
        showError('E-posta ve parola gereklidir');
        return;
      }

      loginButton.classList.add('loading');
      loginButton.disabled = true;
      hideError();

      try {
        const response = await apiPost('auth/login', {
          email: email,
          password: password
        }, { skipAuthRedirect: true });

        if (response.success && response.token) {
          // Access token memory'de, refresh token localStorage'da saklanır
          APP_CONFIG.AUTH.setToken(response.token, response.expiresIn);

          // Refresh token'ı localStorage'a kaydet
          if (response.refreshToken) {
            APP_CONFIG.AUTH.setRefreshToken(response.refreshToken);
          }

          APP_CONFIG.AUTH.setUser({
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            firmaId: response.user.firmaId,
            subeId: response.user.subeId,
            subeAdi: response.user.subeAdi,
            profilResmi: response.user.profilResmi,
            permissions: response.user.permissions
          });

          if (response.user.permissions) {
            APP_CONFIG.PERMISSIONS.cache(response.user.permissions);
          }

          if (rememberMe) {
            localStorage.setItem('remembered_email', email);
          } else {
            localStorage.removeItem('remembered_email');
          }

          showToast('Giris basarili!', 'success');

          setTimeout(() => {
            window.location.href = '../index.html';
          }, 800);

        } else {
          showError(response.message || 'Giris basarisiz');
        }

      } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Giris sirasinda bir hata olustu');
      } finally {
        loginButton.classList.remove('loading');
        loginButton.disabled = false;
      }
    }

    document.getElementById('password').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        document.getElementById('loginForm').dispatchEvent(new Event('submit'));
      }
    });
