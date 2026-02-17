// ============================================================
//  YENILEME TAKİBİ — Table-based Renewals Page
// ============================================================

// Global state
let allPolicies = [];
let filteredPolicies = [];
let currentPage = 1;
const pageSize = 20;
let insuranceCompanies = [];
let policyTypes = [];
let activeUrgencyFilter = null; // 7, 15, 30, or null

// Quote state
let activePollings = {}; // { policyId: { intervalId, webQueryId, productCode, attempts } }
let currentQuotePolicyId = null;
let currentQuoteType = null;

// Quote type mapping (policeTuruAdi → API quoteType)
// Exact matches tried first, then keyword fallback via resolveQuoteType()
const QUOTE_TYPE_MAP = {
  'Trafik': 'traffic',
  'Kasko': 'casco',
  'IMM': 'imm',
  'İMM': 'imm',
  'Işyeri': 'imm',
  'İşyeri': 'imm',
  'DASK': 'dask',
  'Konut': 'house',
  'Saglik': 'tss',
  'Sağlık': 'tss',
  'TSS': 'tss',
  'Tamamlayıcı Sağlık': 'tss',
  'Tamamlayici Saglik': 'tss',
  'Tamamlayıcı Sağlık Sigortası': 'tss',
  'Zorunlu Trafik': 'traffic',
  'Oto Trafik': 'traffic',
  'Zorunlu Trafik Sigortası': 'traffic',
  'Oto Kasko': 'casco',
  'Zorunlu Deprem': 'dask',
  'Konut Sigortası': 'house'
};

// Keyword-based fallback: if exact match fails, check if type name contains keywords
const QUOTE_TYPE_KEYWORDS = [
  { keywords: ['tss', 'tamamlayıcı', 'tamamlayici'], type: 'tss' },
  { keywords: ['sağlık', 'saglik', 'saglık', 'sağlik'], type: 'tss' },
  { keywords: ['trafik'], type: 'traffic' },
  { keywords: ['kasko'], type: 'casco' },
  { keywords: ['dask', 'deprem'], type: 'dask' },
  { keywords: ['konut', 'mesken'], type: 'house' },
  { keywords: ['imm', 'işyeri', 'isyeri', 'ışyeri'], type: 'imm' }
];

function resolveQuoteType(policeTuru) {
  if (!policeTuru) return null;
  // 1) Exact match
  if (QUOTE_TYPE_MAP[policeTuru]) return QUOTE_TYPE_MAP[policeTuru];
  // 2) Keyword search (case-insensitive)
  const lower = policeTuru.toLocaleLowerCase('tr-TR');
  for (const rule of QUOTE_TYPE_KEYWORDS) {
    if (rule.keywords.some(kw => lower.includes(kw))) return rule.type;
  }
  return null;
}

// Quote types that require extra info forms
const NEEDS_EXTRA_FORM = {
  'dask': 'daskHouse',
  'house': 'daskHouse',
  'tss': 'tss'
};

// API quoteType → GetQuoteDetail product kodu
const PRODUCT_CODE_MAP = {
  'traffic': 0,
  'casco': 1,
  'dask': 5,
  'tss': 7,
  'imm': 0,
  'house': 5
};

// Policy type colors
const TYPE_COLORS = {
  'Kasko':  { bg: 'rgba(0,212,255,0.12)', fg: '#00d4ff' },
  'Trafik': { bg: 'rgba(16,185,129,0.12)', fg: '#10b981' },
  'DASK':   { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
  'Sağlık': { bg: 'rgba(236,72,153,0.12)', fg: '#ec4899' },
  'TSS':    { bg: 'rgba(236,72,153,0.12)', fg: '#ec4899' },
  'Konut':  { bg: 'rgba(99,102,241,0.12)', fg: '#6366f1' },
  'İşyeri': { bg: 'rgba(6,182,212,0.12)',  fg: '#06b6d4' },
  'İMM':    { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' },
  'IMM':    { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' }
};
const DEFAULT_TYPE_COLOR = { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' };

function resolveTypeColor(policeTuru) {
  if (!policeTuru) return DEFAULT_TYPE_COLOR;
  if (TYPE_COLORS[policeTuru]) return TYPE_COLORS[policeTuru];
  // Keyword fallback using resolved quote type
  const qt = resolveQuoteType(policeTuru);
  const qtToColor = {
    'tss': TYPE_COLORS['Sağlık'],
    'traffic': TYPE_COLORS['Trafik'],
    'casco': TYPE_COLORS['Kasko'],
    'dask': TYPE_COLORS['DASK'],
    'house': TYPE_COLORS['Konut'],
    'imm': TYPE_COLORS['İMM']
  };
  return (qt && qtToColor[qt]) || DEFAULT_TYPE_COLOR;
}

// ============================================================
//  INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {
  // Dev mode: show test panel if ?dev=1 or localStorage.devMode
  const params = new URLSearchParams(window.location.search);
  if (params.has('dev') || localStorage.getItem('devMode')) {
    const testPanel = document.getElementById('testPanel');
    if (testPanel) testPanel.style.display = 'block';
  }

  // Initialize global phone input from logged-in user's GSM
  initPhoneInput();

  await loadData();
  setupEventListeners();
});

// ============================================================
//  GLOBAL PHONE INPUT
// ============================================================

function initPhoneInput() {
  const phoneInput = document.getElementById('quotePhoneNumber');
  const phoneStatus = document.getElementById('phoneStatus');
  if (!phoneInput) return;

  try {
    const userData = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (userData.gsmNo) {
      let gsm = String(userData.gsmNo).replace(/\D/g, '');
      // Remove country code (90) if present
      if (gsm.startsWith('90') && gsm.length > 10) gsm = gsm.substring(2);
      // Remove leading zero if present
      if (gsm.startsWith('0') && gsm.length > 10) gsm = gsm.substring(1);

      phoneInput.value = gsm;
      if (gsm.startsWith('5') && gsm.length === 10) {
        phoneStatus.textContent = '\u2713';
        phoneStatus.style.color = 'var(--success, #10b981)';
      } else {
        phoneStatus.textContent = 'Format kontrol edin';
        phoneStatus.style.color = 'var(--warning, #f59e0b)';
      }
    } else {
      phoneStatus.textContent = 'GSM bulunamadi';
      phoneStatus.style.color = 'var(--warning, #f59e0b)';
    }
  } catch (e) {
    console.error('Phone init error:', e);
  }

  // Live validation on input
  phoneInput.addEventListener('input', function() {
    const val = this.value.replace(/\D/g, '');
    this.value = val;
    if (val.startsWith('5') && val.length === 10) {
      phoneStatus.textContent = '\u2713';
      phoneStatus.style.color = 'var(--success, #10b981)';
    } else if (val.length > 0) {
      phoneStatus.textContent = '5 ile baslamali, 10 hane';
      phoneStatus.style.color = 'var(--warning, #f59e0b)';
    } else {
      phoneStatus.textContent = '';
    }
  });
}

/** Returns the validated phone number from the global input, or null if invalid */
function getGlobalPhone() {
  const phoneInput = document.getElementById('quotePhoneNumber');
  if (!phoneInput) return null;
  const val = phoneInput.value.replace(/\D/g, '');
  if (val.startsWith('5') && val.length === 10) return val;
  return null;
}

// ============================================================
//  DATA LOADING
// ============================================================

async function loadData() {
  try {
    const response = await apiGet('policies/renewals', {
      daysAhead: 60,
      pageSize: 1000
    });

    if (response && response.items) {
      allPolicies = response.items.map(item => ({
        id: item.id,
        sigortaSirketi: item.sigortaSirketiAdi || 'N/A',
        sigortaSirketiId: item.sigortaSirketiId,
        policeTuru: item.policeTuruAdi || 'N/A',
        policeTuruId: item.policeTuruId,
        policeNumarasi: item.policeNumarasi,
        plaka: item.plaka,
        tanzimTarihi: item.tanzimTarihi,
        baslangicTarihi: item.baslangicTarihi,
        bitisTarihi: item.bitisTarihi,
        brutPrim: item.brutPrim,
        netPrim: item.netPrim,
        sigortaliAdi: item.sigortaliAdi,
        cepTelefonu: item.cepTelefonu,
        yenilemeDurumu: item.yenilemeDurumu,
        tcKimlikNo: item.tcKimlikNo,
        vergiNo: item.vergiNo,
        musteriId: item.musteriId
      }));

      filteredPolicies = [...allPolicies];

      // Extract unique companies and types
      const companiesSet = new Set();
      const typesSet = new Set();
      allPolicies.forEach(p => {
        if (p.sigortaSirketi) companiesSet.add(p.sigortaSirketi);
        if (p.policeTuru) typesSet.add(p.policeTuru);
      });

      insuranceCompanies = Array.from(companiesSet).sort();
      policyTypes = Array.from(typesSet).sort();

      populateFilters();
      applySort();
      updateStats();
      renderTable();
    } else {
      showEmpty('Yenilecek poliçe bulunamadı');
    }
  } catch (error) {
    console.error('Error loading policies:', error);
    showError();
  }
}

// ============================================================
//  FILTERS & SORTING
// ============================================================

function populateFilters() {
  const companySelect = document.getElementById('filterCompany');
  const typeSelect = document.getElementById('filterType');

  insuranceCompanies.forEach(company => {
    const opt = document.createElement('option');
    opt.value = company;
    opt.textContent = company;
    companySelect.appendChild(opt);
  });

  policyTypes.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    typeSelect.appendChild(opt);
  });
}

function applyFilters() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
  const companyFilter = document.getElementById('filterCompany').value;
  const typeFilter = document.getElementById('filterType').value;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  filteredPolicies = allPolicies.filter(policy => {
    // Search filter
    if (searchTerm) {
      const haystack = [
        policy.sigortaliAdi,
        policy.policeNumarasi,
        policy.plaka,
        policy.cepTelefonu
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }

    // Company filter
    if (companyFilter && policy.sigortaSirketi !== companyFilter) return false;

    // Type filter
    if (typeFilter && policy.policeTuru !== typeFilter) return false;

    // Urgency chip filter
    if (activeUrgencyFilter) {
      const days = getDaysRemaining(policy.bitisTarihi);
      if (days > activeUrgencyFilter) return false;
    }

    return true;
  });

  currentPage = 1;
  applySort();
  updateStats();
  renderTable();
}

function applySort() {
  const sortVal = document.getElementById('sortBy').value;
  if (!sortVal) return;

  const [field, order] = sortVal.split('_');
  filteredPolicies.sort((a, b) => {
    let aVal, bVal;
    if (field === 'BitisTarihi') {
      aVal = new Date(a.bitisTarihi);
      bVal = new Date(b.bitisTarihi);
    } else if (field === 'BrutPrim') {
      aVal = a.brutPrim || 0;
      bVal = b.brutPrim || 0;
    } else {
      aVal = a[field] || '';
      bVal = b[field] || '';
    }
    return order === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCompany').value = '';
  document.getElementById('filterType').value = '';
  document.getElementById('sortBy').value = 'BitisTarihi_asc';

  // Reset urgency chips
  activeUrgencyFilter = null;
  document.querySelectorAll('.rn-chip').forEach(c => c.classList.remove('active'));

  filteredPolicies = [...allPolicies];
  currentPage = 1;
  applySort();
  updateStats();
  renderTable();
}

function filterByUrgency(days, chipEl) {
  // Toggle logic
  if (activeUrgencyFilter === days) {
    // Deactivate
    activeUrgencyFilter = null;
    document.querySelectorAll('.rn-chip').forEach(c => c.classList.remove('active'));
  } else {
    activeUrgencyFilter = days;
    document.querySelectorAll('.rn-chip').forEach(c => c.classList.remove('active'));
    if (chipEl) chipEl.classList.add('active');
  }
  applyFilters();
}

// ============================================================
//  STATS
// ============================================================

function updateStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let count7 = 0, count15 = 0, count30 = 0, totalRevenue = 0;

  // Stats are always computed from allPolicies (not filtered)
  allPolicies.forEach(policy => {
    const days = getDaysRemaining(policy.bitisTarihi);
    if (days <= 7)  count7++;
    if (days <= 15) count15++;
    if (days <= 30) count30++;
    totalRevenue += policy.brutPrim || 0;
  });

  document.getElementById('count-7').textContent = count7;
  document.getElementById('count-15').textContent = count15;
  document.getElementById('count-30').textContent = count30;
  document.getElementById('count-revenue').textContent = formatCurrency(totalRevenue);
  document.getElementById('tableResultCount').textContent = filteredPolicies.length;
}

// ============================================================
//  TABLE RENDERING
// ============================================================

function renderTable() {
  const tbody = document.getElementById('policiesBody');
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const page = filteredPolicies.slice(start, end);

  if (page.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="rn-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <span>Filtreye uygun poliçe bulunamadı</span>
        </div>
      </td></tr>`;
    document.getElementById('paginationContainer').style.display = 'none';
    document.getElementById('tableResultCount').textContent = '0';
    return;
  }

  let html = '';
  page.forEach(policy => {
    html += createPolicyRow(policy);
    html += createExpandRow(policy.id);
  });
  tbody.innerHTML = html;

  document.getElementById('tableResultCount').textContent = filteredPolicies.length;
  updatePagination();
}

function createPolicyRow(policy) {
  const days = getDaysRemaining(policy.bitisTarihi);
  const urgency = days <= 7 ? 'critical' : days <= 15 ? 'warning' : 'normal';
  const colors = resolveTypeColor(policy.policeTuru);
  const phone = formatPhone(policy.cepTelefonu);

  return `
    <tr class="rn-row" data-id="${policy.id}">
      <td><div class="rn-urgency-strip ${urgency}"></div></td>
      <td style="text-align:center;">
        <span class="rn-days ${urgency}">${days}</span>
      </td>
      <td>
        <div class="rn-customer-name">${escapeHtml(policy.sigortaliAdi || 'İsimsiz')}</div>
        ${phone !== '-' ? `<div class="rn-customer-phone">${phone}</div>` : ''}
      </td>
      <td>
        <span class="rn-type-pill" style="background:${colors.bg};color:${colors.fg};">
          ${escapeHtml(policy.policeTuru)}
        </span>
      </td>
      <td><span class="rn-plate">${escapeHtml(policy.plaka || policy.policeNumarasi || '-')}</span></td>
      <td>${escapeHtml(truncate(policy.sigortaSirketi, 18))}</td>
      <td><span class="rn-date">${formatDate(policy.bitisTarihi)}</span></td>
      <td><span class="rn-premium">${formatCurrency(policy.brutPrim)}</span></td>
      <td>
        <div class="rn-actions">
          <button class="rn-act-btn rn-act-quote" onclick="createQuote(${policy.id})" title="Teklif Çalış">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            Teklif
          </button>
          <button class="rn-act-btn rn-act-wa" onclick="sendWhatsApp(${policy.id})" title="WhatsApp">
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

function createExpandRow(policyId) {
  return `
    <tr class="rn-expand" id="expand-${policyId}" style="display:none;">
      <td colspan="9">
        <div class="rn-expand-inner" id="expand-inner-${policyId}"></div>
      </td>
    </tr>`;
}

// ============================================================
//  EXPAND ROW — Inline Quote Results
// ============================================================

function openExpandRow(policyId) {
  const row = document.getElementById(`expand-${policyId}`);
  if (!row) return;
  row.style.display = 'table-row';

  const inner = document.getElementById(`expand-inner-${policyId}`);
  inner.innerHTML = `
    <div class="rn-expand-header">
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span class="rn-expand-title">Teklif Sonuçları</span>
        <span class="rn-expand-status processing" id="expand-status-${policyId}">
          <span class="rn-pulse-dot"></span> Sorgulanıyor...
        </span>
      </div>
      <button class="rn-expand-close" onclick="closeExpandRow(${policyId})" title="Kapat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="rn-expand-loading" id="expand-loading-${policyId}">
      <div class="rn-spinner" style="width:20px;height:20px;"></div>
      <span>Sigorta şirketlerinden teklifler bekleniyor...</span>
    </div>
    <div class="rn-offers-grid" id="expand-offers-${policyId}"></div>
  `;
}

function closeExpandRow(policyId) {
  const row = document.getElementById(`expand-${policyId}`);
  if (row) row.style.display = 'none';
  stopPollingForPolicy(policyId);
}

function updateExpandRow(policyId, results) {
  const loadingEl = document.getElementById(`expand-loading-${policyId}`);
  const offersEl = document.getElementById(`expand-offers-${policyId}`);
  const statusEl = document.getElementById(`expand-status-${policyId}`);

  if (!offersEl) return; // expand row not visible

  if (results.quotes && results.quotes.length > 0) {
    if (loadingEl) loadingEl.style.display = 'none';

    // Sort by premium (cheapest first)
    const sorted = [...results.quotes].sort((a, b) => {
      if (!a.grossPremium && !b.grossPremium) return 0;
      if (!a.grossPremium) return 1;
      if (!b.grossPremium) return -1;
      return a.grossPremium - b.grossPremium;
    });

    const cheapestPremium = sorted.find(q => q.grossPremium > 0)?.grossPremium;

    offersEl.innerHTML = sorted.map(quote => {
      const isError = quote.status === 'error';
      const isRejected = quote.status === 'rejected';
      const isCheapest = !isError && !isRejected && quote.grossPremium > 0 && quote.grossPremium === cheapestPremium;

      let cardClass = '';
      if (isCheapest) cardClass = 'cheapest';
      else if (isError) cardClass = 'error';
      else if (isRejected) cardClass = 'rejected';

      let premiumHtml;
      if (isError) {
        premiumHtml = `<span class="rn-offer-premium" style="color:var(--danger);font-size:0.6875rem;">${escapeHtml(quote.errorMessage || 'Hata')}</span>`;
      } else if (isRejected) {
        premiumHtml = `<span class="rn-offer-premium" style="color:var(--warning);">Red</span>`;
      } else if (quote.grossPremium) {
        premiumHtml = `<span class="rn-offer-premium">${formatCurrency(quote.grossPremium)}</span>`;
      } else {
        premiumHtml = `<span class="rn-offer-premium" style="color:var(--text-dim);font-size:0.6875rem;">Bekleniyor...</span>`;
      }

      return `
        <div class="rn-offer ${cardClass}" title="${escapeHtml(quote.insuranceCompanyName || '')}">
          <span class="rn-offer-company">${escapeHtml(quote.insuranceCompanyName || '?')}</span>
          ${premiumHtml}
        </div>`;
    }).join('');
  }

  // Update status badge
  if (statusEl) {
    if (results.status === 'completed') {
      const count = (results.quotes || []).filter(q => q.grossPremium > 0).length;
      statusEl.className = 'rn-expand-status completed';
      statusEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20,6 9,17 4,12"/></svg> ${count} teklif`;
    } else {
      statusEl.className = 'rn-expand-status processing';
      statusEl.innerHTML = `<span class="rn-pulse-dot"></span> Sorgulanıyor...`;
    }
  }

  if (results.status === 'completed' && loadingEl) {
    loadingEl.style.display = 'none';
  }
}

// ============================================================
//  PAGINATION
// ============================================================

function updatePagination() {
  const totalPages = Math.ceil(filteredPolicies.length / pageSize);
  const container = document.getElementById('paginationContainer');
  const controls = document.getElementById('paginationControls');
  const info = document.getElementById('paginationInfo');

  if (totalPages <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, filteredPolicies.length);
  info.textContent = `${start}-${end} / ${filteredPolicies.length} police`;

  let html = '';
  html += `<button class="rn-pg-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15,18 9,12 15,6"/></svg>
  </button>`;

  // Page buttons with smart range
  const maxVisible = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button class="rn-pg-btn" onclick="changePage(1)">1</button>`;
    if (startPage > 2) html += `<span style="padding:0 0.25rem;color:var(--text-dim);">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="rn-pg-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span style="padding:0 0.25rem;color:var(--text-dim);">...</span>`;
    html += `<button class="rn-pg-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
  }

  html += `<button class="rn-pg-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9,18 15,12 9,6"/></svg>
  </button>`;

  controls.innerHTML = html;
}

function changePage(page) {
  const totalPages = Math.ceil(filteredPolicies.length / pageSize);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
  // Scroll to table top
  document.querySelector('.rn-table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
//  EVENT LISTENERS
// ============================================================

function setupEventListeners() {
  // Search
  document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));

  // Filter selects
  document.getElementById('filterCompany').addEventListener('change', applyFilters);
  document.getElementById('filterType').addEventListener('change', applyFilters);

  // Sort
  document.getElementById('sortBy').addEventListener('change', function() {
    applySort();
    renderTable();
  });

  // Reset filters
  document.getElementById('btnResetFilters').addEventListener('click', resetFilters);

  // Urgency chips
  document.querySelectorAll('.rn-chip[data-filter]').forEach(chip => {
    chip.addEventListener('click', function() {
      const val = this.getAttribute('data-filter');
      if (val === 'all') {
        // Revenue chip — reset to show all
        activeUrgencyFilter = null;
        document.querySelectorAll('.rn-chip').forEach(c => c.classList.remove('active'));
        applyFilters();
      } else {
        filterByUrgency(parseInt(val), this);
      }
    });
  });

  // Bulk auto quote
  document.getElementById('btnBulkAutoQuote').addEventListener('click', openBulkAutoQuoteModal);

  // Excel export
  const excelBtn = document.getElementById('btnExcelExport');
  if (excelBtn) excelBtn.addEventListener('click', exportToExcel);

  // Modal overlay clicks
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
      closeBulkAutoQuoteModal();
      closeDaskHouseForm();
      closeTssForm();
      closeTcAssignModal();
    }
  });

  // Enter key for TC assign modal
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const tcModal = document.getElementById('tcAssignModal');
      if (tcModal && tcModal.classList.contains('show')) {
        e.preventDefault();
        saveAndQuote();
      }
    }
    // Escape to close modals
    if (e.key === 'Escape') {
      closeBulkAutoQuoteModal();
      closeDaskHouseForm();
      closeTssForm();
      closeTcAssignModal();
    }
  });
}

// ============================================================
//  QUOTE CREATION FLOW
// ============================================================

async function createQuote(policyId) {
  const policy = allPolicies.find(p => p.id === policyId);
  if (!policy) {
    showToast('Police bulunamadi', 'error');
    return;
  }

  // TC check
  if (!policy.tcKimlikNo && !policy.vergiNo) {
    openTcAssignModal(policy);
    return;
  }

  const quoteType = resolveQuoteType(policy.policeTuru);
  if (!quoteType) {
    showToast(`"${policy.policeTuru}" turu icin teklif destegi henuz mevcut degil`, 'warning');
    return;
  }

  // Müşteri kartı kontrolü — yoksa oluştur, varsa bağla
  if (!policy.musteriId) {
    try {
      const nameParts = splitName(policy.sigortaliAdi);
      const result = await apiPost('customers/ensure', {
        tcKimlikNo: policy.tcKimlikNo || null,
        vergiNo: policy.vergiNo || null,
        adi: nameParts.adi,
        soyadi: nameParts.soyadi,
        gsm: policy.cepTelefonu ? String(policy.cepTelefonu) : null,
        policeId: policy.id
      });

      if (result && result.success) {
        policy.musteriId = result.customerId;
        const label = result.isNew ? 'Musteri karti olusturuldu' : 'Mevcut musteri karti baglandi';
        showToast(`${label}: ${result.customerName || ''}`, 'success');
      }
    } catch (err) {
      console.error('Ensure customer error:', err);
      // Müşteri kartı oluşturulamazsa teklif akışını engelleme
    }
  }

  proceedWithQuote(policy, quoteType);
}

function splitName(fullName) {
  if (!fullName) return { adi: null, soyadi: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { adi: parts[0] || null, soyadi: null };
  return { adi: parts.slice(0, -1).join(' '), soyadi: parts[parts.length - 1] };
}

function proceedWithQuote(policy, quoteType) {
  currentQuotePolicyId = policy.id;
  currentQuoteType = quoteType;

  const extraForm = NEEDS_EXTRA_FORM[quoteType];
  if (extraForm === 'daskHouse') {
    openDaskHouseForm(policy, quoteType);
  } else if (extraForm === 'tss') {
    openTssForm(policy);
  } else {
    submitQuote(policy.id, quoteType, {});
  }
}

// ============================================================
//  TC ASSIGN MODAL
// ============================================================

function openTcAssignModal(policy) {
  currentQuotePolicyId = policy.id;

  const modal = document.getElementById('tcAssignModal');
  document.getElementById('tcAssignSubtitle').textContent =
    `${policy.sigortaliAdi || 'Isimsiz'}${policy.plaka ? ' | ' + policy.plaka : ''} | ${policy.policeNumarasi || ''}`;

  document.getElementById('tcAssignInput').value = '';
  document.getElementById('vknAssignInput').value = '';

  const customerLinkDiv = document.getElementById('tcAssignCustomerLink');
  if (policy.musteriId) {
    customerLinkDiv.style.display = 'flex';
    document.getElementById('tcAssignCustomerDetailLink').href =
      `../customers/detail.html?id=${policy.musteriId}`;
  } else {
    customerLinkDiv.style.display = 'none';
  }

  modal.classList.add('show');
  setTimeout(() => document.getElementById('tcAssignInput').focus(), 100);
}

function closeTcAssignModal() {
  document.getElementById('tcAssignModal').classList.remove('show');
}

async function saveAndQuote() {
  const tc = document.getElementById('tcAssignInput').value.trim();
  const vkn = document.getElementById('vknAssignInput').value.trim();

  if (!tc && !vkn) {
    showToast('TC Kimlik No veya Vergi No giriniz', 'warning');
    return;
  }

  if (tc && (tc.length !== 11 || !/^\d+$/.test(tc))) {
    showToast('TC Kimlik No 11 haneli ve sadece rakamlardan olusmalidir', 'warning');
    return;
  }

  if (vkn && (vkn.length !== 10 || !/^\d+$/.test(vkn))) {
    showToast('Vergi No 10 haneli ve sadece rakamlardan olusmalidir', 'warning');
    return;
  }

  const policyId = currentQuotePolicyId;
  const btn = document.getElementById('btnSaveAndQuote');
  btn.disabled = true;
  btn.textContent = 'Kaydediliyor...';

  try {
    const assignResult = await apiPost(`policies/${policyId}/assign-tc`, {
      policyId: policyId,
      tcKimlikNo: tc || null,
      vergiNo: vkn || null
    });

    if (!assignResult || !assignResult.success) {
      showToast(assignResult?.errorMessage || 'TC atamasi basarisiz', 'error');
      btn.disabled = false;
      btn.textContent = 'Kaydet ve Teklif Calis';
      return;
    }

    const policy = allPolicies.find(p => p.id === policyId);
    if (policy) {
      if (tc) policy.tcKimlikNo = tc;
      if (vkn) policy.vergiNo = vkn;
      if (assignResult.musteriId) policy.musteriId = assignResult.musteriId;
    }

    const cascadeMsg = assignResult.cascadeUpdated > 0
      ? ` (${assignResult.cascadeUpdated} ek police guncellendi)`
      : '';
    showToast(`TC/VKN kaydedildi${cascadeMsg}`, 'success');

    closeTcAssignModal();

    if (policy) {
      // Müşteri kartı kontrolü — TC yeni kaydedildi, kart oluştur/bağla
      if (!policy.musteriId) {
        try {
          const nameParts = splitName(policy.sigortaliAdi);
          const ensureResult = await apiPost('customers/ensure', {
            tcKimlikNo: policy.tcKimlikNo || null,
            vergiNo: policy.vergiNo || null,
            adi: nameParts.adi,
            soyadi: nameParts.soyadi,
            gsm: policy.cepTelefonu ? String(policy.cepTelefonu) : null,
            policeId: policy.id
          });
          if (ensureResult && ensureResult.success) {
            policy.musteriId = ensureResult.customerId;
            const label = ensureResult.isNew ? 'Musteri karti olusturuldu' : 'Mevcut musteri karti baglandi';
            showToast(`${label}: ${ensureResult.customerName || ''}`, 'success');
          }
        } catch (err) {
          console.error('Ensure customer error:', err);
        }
      }

      const quoteType = resolveQuoteType(policy.policeTuru);
      if (quoteType) proceedWithQuote(policy, quoteType);
    }

  } catch (error) {
    console.error('TC assign error:', error);
    showToast('TC atamasi sirasinda hata olustu', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Kaydet ve Teklif Calis';
  }
}

// ============================================================
//  QUOTE SUBMISSION & POLLING
// ============================================================

async function submitQuote(policyId, quoteType, extraData) {
  const policy = allPolicies.find(p => p.id === policyId);
  if (!policy) return;

  // Validate global phone
  const phone = getGlobalPhone();
  if (!phone) {
    showToast('Gecerli bir telefon numarasi giriniz (5 ile baslayan 10 hane)', 'warning');
    const phoneInput = document.getElementById('quotePhoneNumber');
    if (phoneInput) phoneInput.focus();
    return;
  }

  // Open expand row for this policy
  openExpandRow(policyId);

  try {
    const requestBody = { quoteType, cepTelefonu: phone, ...extraData };
    const response = await apiPost(`policies/${policyId}/create-quote`, requestBody);

    if (!response || !response.isSuccessful) {
      showExpandError(policyId, response?.message || 'Teklif gonderilemedi');
      return;
    }

    // webQueryId null/undefined/0 → sorgu kuyruğa alındı ama henüz ID atanmadı
    if (!response.webQueryId) {
      showExpandError(policyId, response.message || 'Sorgu kuyruga alindi ancak henuz ID atanamadi. Telefon numarasi girildiginden emin olun.');
      return;
    }

    showToast('Teklif sorgusu baslatildi', 'success');

    const productCode = PRODUCT_CODE_MAP[quoteType] ?? 0;
    startPollingForPolicy(policyId, response.webQueryId, productCode);

  } catch (error) {
    console.error('Quote submission error:', error);
    showExpandError(policyId, 'Teklif gonderilirken bir hata olustu');
  }
}

function showExpandError(policyId, message) {
  const loadingEl = document.getElementById(`expand-loading-${policyId}`);
  const statusEl = document.getElementById(`expand-status-${policyId}`);

  if (loadingEl) {
    loadingEl.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" width="20" height="20">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style="color:var(--danger);">${escapeHtml(message)}</span>`;
  }
  if (statusEl) {
    statusEl.className = 'rn-expand-status';
    statusEl.style.cssText = 'background:var(--danger-bg);color:var(--danger);';
    statusEl.textContent = 'Hata';
  }
}

function startPollingForPolicy(policyId, webQueryId, productCode) {
  stopPollingForPolicy(policyId);

  const maxAttempts = 60;
  let attempts = 0;

  // First fetch immediately
  fetchAndUpdateExpandRow(policyId, webQueryId, productCode);

  const intervalId = setInterval(async () => {
    attempts++;
    const shouldStop = await fetchAndUpdateExpandRow(policyId, webQueryId, productCode);

    if (shouldStop || attempts >= maxAttempts) {
      stopPollingForPolicy(policyId);
      if (attempts >= maxAttempts) {
        const statusEl = document.getElementById(`expand-status-${policyId}`);
        if (statusEl) {
          statusEl.className = 'rn-expand-status';
          statusEl.style.cssText = 'background:var(--warning-bg);color:var(--warning);';
          statusEl.textContent = 'Zaman asimi';
        }
      }
    }
  }, 5000);

  activePollings[policyId] = { intervalId, webQueryId, productCode, attempts: 0 };
}

function stopPollingForPolicy(policyId) {
  if (activePollings[policyId]) {
    clearInterval(activePollings[policyId].intervalId);
    delete activePollings[policyId];
  }
}

async function fetchAndUpdateExpandRow(policyId, webQueryId, productCode) {
  try {
    const results = await apiGet('policies/quote-results', { webQueryId, product: productCode });

    if (!results || !results.isSuccessful) return false;

    updateExpandRow(policyId, results);

    return results.status === 'completed';
  } catch (error) {
    console.error('Polling error for policy', policyId, error);
    return false;
  }
}

// ============================================================
//  DASK / KONUT FORM
// ============================================================

function openDaskHouseForm(policy, quoteType) {
  const modal = document.getElementById('daskHouseFormModal');
  const title = document.getElementById('daskHouseFormTitle');
  const konutFields = modal.querySelectorAll('.konut-only');
  const daskOnlyFields = [
    document.getElementById('daskKullanimSekliField'),
    document.getElementById('daskPoliceNoField')
  ];

  if (quoteType === 'house') {
    title.textContent = 'Konut Sigortasi — Ek Bilgiler';
    konutFields.forEach(f => f.style.display = 'block');
    daskOnlyFields.forEach(f => { if (f) f.style.display = 'none'; });
  } else {
    title.textContent = 'DASK — Ek Bilgiler';
    konutFields.forEach(f => f.style.display = 'none');
    daskOnlyFields.forEach(f => { if (f) f.style.display = 'block'; });
  }

  ['daskBinaAdresi', 'daskUAVTKodu', 'daskBrutM2', 'daskInsaatYili',
   'daskToplamKat', 'daskBulunduguKat', 'daskYapiTarzi', 'daskKullanimSekli',
   'daskMevcutPoliceNo', 'daskBinaBeyanDegeri', 'daskEsyaBeyanDegeri'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  modal.classList.add('show');
}

function closeDaskHouseForm() {
  document.getElementById('daskHouseFormModal').classList.remove('show');
}

function submitDaskHouseQuote() {
  const quoteType = currentQuoteType;
  const policyId = currentQuotePolicyId;

  if (quoteType === 'dask') {
    const extraData = {
      daskData: {
        binaAdresi: document.getElementById('daskBinaAdresi').value || null,
        uavtKodu: document.getElementById('daskUAVTKodu').value || null,
        brutM2: parseFloat(document.getElementById('daskBrutM2').value) || null,
        binaInsaatYili: parseInt(document.getElementById('daskInsaatYili').value) || null,
        toplamKatSayisi: parseInt(document.getElementById('daskToplamKat').value) || null,
        bulunduguKat: parseInt(document.getElementById('daskBulunduguKat').value) || null,
        yapiTarzi: parseInt(document.getElementById('daskYapiTarzi').value) || null,
        kullanimSekli: parseInt(document.getElementById('daskKullanimSekli').value) || null,
        mevcutPoliceNo: document.getElementById('daskMevcutPoliceNo').value || null
      }
    };
    closeDaskHouseForm();
    submitQuote(policyId, quoteType, extraData);
  } else if (quoteType === 'house') {
    const extraData = {
      houseData: {
        binaAdresi: document.getElementById('daskBinaAdresi').value || null,
        uavtKodu: document.getElementById('daskUAVTKodu').value || null,
        brutM2: parseFloat(document.getElementById('daskBrutM2').value) || null,
        binaInsaatYili: parseInt(document.getElementById('daskInsaatYili').value) || null,
        toplamKatSayisi: parseInt(document.getElementById('daskToplamKat').value) || null,
        bulunduguKat: parseInt(document.getElementById('daskBulunduguKat').value) || null,
        yapiTarzi: parseInt(document.getElementById('daskYapiTarzi').value) || null,
        binaBeyanDegeri: parseFloat(document.getElementById('daskBinaBeyanDegeri').value) || null,
        esyaBeyanDegeri: parseFloat(document.getElementById('daskEsyaBeyanDegeri').value) || null
      }
    };
    closeDaskHouseForm();
    submitQuote(policyId, quoteType, extraData);
  }
}

// ============================================================
//  TSS FORM
// ============================================================

function openTssForm(policy) {
  const modal = document.getElementById('tssFormModal');

  ['tssDogumTarihi', 'tssBoy', 'tssKilo', 'tssAgTipi', 'tssPlanTipi'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const dogumTeminatiEl = document.getElementById('tssDogumTeminati');
  if (dogumTeminatiEl) dogumTeminatiEl.checked = false;

  modal.classList.add('show');
  setTimeout(() => document.getElementById('tssDogumTarihi')?.focus(), 100);
}

function closeTssForm() {
  document.getElementById('tssFormModal').classList.remove('show');
}

function submitTssQuote() {
  const dogumTarihi = document.getElementById('tssDogumTarihi').value;

  if (!dogumTarihi) {
    showToast('Dogum tarihi zorunludur', 'warning');
    return;
  }

  const extraData = {
    tssData: {
      dogumTarihi: dogumTarihi,
      boy: document.getElementById('tssBoy').value || null,
      kilo: document.getElementById('tssKilo').value || null,
      agTipi: parseInt(document.getElementById('tssAgTipi').value) || null,
      planTipi: parseInt(document.getElementById('tssPlanTipi').value) || null,
      dogumTeminati: document.getElementById('tssDogumTeminati').checked || null
    }
  };

  closeTssForm();
  submitQuote(currentQuotePolicyId, 'tss', extraData);
}

// ============================================================
//  BULK QUOTE
// ============================================================

function sendWhatsApp(policyId) {
  const policy = allPolicies.find(p => p.id === policyId);
  if (!policy || !policy.cepTelefonu) {
    showToast('Telefon numarasi bulunamadi', 'warning');
    return;
  }
  const phone = '90' + String(policy.cepTelefonu).replace(/\D/g, '');
  const msg = encodeURIComponent(
    `Sayin ${policy.sigortaliAdi || 'Musterimiz'}, ${formatDate(policy.bitisTarihi)} tarihinde sona erecek ${policy.policeTuru || ''} policeniz icin yenileme teklifi hazirladik. Detaylar icin bize ulasabilirsiniz.`
  );
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}

function openBulkAutoQuoteModal() {
  const modal = document.getElementById('bulkAutoQuoteModal');
  modal.classList.add('show');

  const checkboxes = document.getElementById('bulkBranchesCheckboxes');
  checkboxes.innerHTML = policyTypes.map(type => `
    <div class="checkbox-item">
      <input type="checkbox" id="branch-${type}" value="${type}" checked>
      <label for="branch-${type}">${type}</label>
    </div>
  `).join('');

  updateBulkQuoteStats();

  document.getElementById('bulkDaysFilter').addEventListener('change', updateBulkQuoteStats);
  checkboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', updateBulkQuoteStats);
  });
}

function closeBulkAutoQuoteModal() {
  document.getElementById('bulkAutoQuoteModal').classList.remove('show');
}

function updateBulkQuoteStats() {
  const days = parseInt(document.getElementById('bulkDaysFilter').value);
  const selectedBranches = Array.from(document.querySelectorAll('#bulkBranchesCheckboxes input:checked')).map(cb => cb.value);

  const matching = allPolicies.filter(policy => {
    const d = getDaysRemaining(policy.bitisTarihi);
    return d <= days && selectedBranches.includes(policy.policeTuru);
  });

  const totalRevenue = matching.reduce((sum, p) => sum + (p.brutPrim || 0), 0);

  document.getElementById('bulkQuoteCount').textContent = matching.length;
  document.getElementById('bulkQuoteRevenue').textContent = formatCurrency(totalRevenue);
}

async function executeBulkAutoQuote() {
  // Validate global phone before bulk operation
  const phone = getGlobalPhone();
  if (!phone) {
    showToast('Toplu teklif icin gecerli bir telefon numarasi giriniz', 'warning');
    closeBulkAutoQuoteModal();
    const phoneInput = document.getElementById('quotePhoneNumber');
    if (phoneInput) phoneInput.focus();
    return;
  }

  const days = parseInt(document.getElementById('bulkDaysFilter').value);
  const selectedBranches = Array.from(document.querySelectorAll('#bulkBranchesCheckboxes input:checked')).map(cb => cb.value);

  const vehicleTypes = ['traffic', 'casco', 'imm'];
  const eligible = allPolicies.filter(policy => {
    const d = getDaysRemaining(policy.bitisTarihi);
    const quoteType = resolveQuoteType(policy.policeTuru);
    return d <= days
      && selectedBranches.includes(policy.policeTuru)
      && quoteType
      && vehicleTypes.includes(quoteType)
      && (policy.tcKimlikNo || policy.vergiNo);
  });

  if (eligible.length === 0) {
    showToast('Uygun police bulunamadi (TC Kimlik No gerekli, sadece arac policeleri desteklenir)', 'warning');
    return;
  }

  const footer = document.querySelector('#bulkAutoQuoteModal .modal-footer');
  footer.innerHTML = `
    <div class="bulk-progress-container" style="width: 100%;">
      <div class="bulk-progress-bar">
        <div class="bulk-progress-fill" id="bulkProgressFill" style="width: 0%"></div>
      </div>
      <div class="bulk-progress-text" id="bulkProgressText">0 / ${eligible.length} teklif gonderiliyor...</div>
    </div>
  `;

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < eligible.length; i++) {
    const policy = eligible[i];
    const quoteType = resolveQuoteType(policy.policeTuru);

    // Müşteri kartı yoksa otomatik oluştur
    if (!policy.musteriId) {
      try {
        const np = splitName(policy.sigortaliAdi);
        const er = await apiPost('customers/ensure', {
          tcKimlikNo: policy.tcKimlikNo || null, vergiNo: policy.vergiNo || null,
          adi: np.adi, soyadi: np.soyadi,
          gsm: policy.cepTelefonu ? String(policy.cepTelefonu) : null,
          policeId: policy.id
        });
        if (er && er.success) policy.musteriId = er.customerId;
      } catch (_) { /* devam et */ }
    }

    try {
      const response = await apiPost(`policies/${policy.id}/create-quote`, { quoteType, cepTelefonu: phone });
      if (response && response.isSuccessful) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (err) {
      errorCount++;
    }

    const progress = Math.round(((i + 1) / eligible.length) * 100);
    document.getElementById('bulkProgressFill').style.width = progress + '%';
    document.getElementById('bulkProgressText').textContent =
      `${i + 1} / ${eligible.length} teklif gonderiliyor...`;

    if (i < eligible.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  document.getElementById('bulkProgressText').textContent =
    `Tamamlandi! ${successCount} basarili, ${errorCount} hata`;

  showToast(`Toplu teklif tamamlandi: ${successCount} basarili, ${errorCount} hata`, successCount > 0 ? 'success' : 'error');

  setTimeout(() => {
    closeBulkAutoQuoteModal();
    footer.innerHTML = `
      <button class="btn-modal btn-outline" onclick="closeBulkAutoQuoteModal()">Iptal</button>
      <button class="btn-modal btn-primary" onclick="executeBulkAutoQuote()">Teklif Calis</button>
    `;
  }, 3000);
}

// ============================================================
//  EXCEL EXPORT
// ============================================================

function exportToExcel() {
  if (filteredPolicies.length === 0) {
    showToast('Disa aktarilacak polce yok', 'warning');
    return;
  }

  const headers = ['Musteri', 'Telefon', 'Police Turu', 'Plaka', 'Sirket', 'Bitis Tarihi', 'Kalan Gun', 'Brut Prim'];
  const rows = filteredPolicies.map(p => [
    p.sigortaliAdi || '',
    p.cepTelefonu || '',
    p.policeTuru || '',
    p.plaka || '',
    p.sigortaSirketi || '',
    formatDate(p.bitisTarihi),
    getDaysRemaining(p.bitisTarihi),
    p.brutPrim || 0
  ]);

  let csv = '\uFEFF'; // BOM for Turkish chars
  csv += headers.join(';') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yenileme-takibi-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`${filteredPolicies.length} polce disa aktarildi`, 'success');
}

// ============================================================
//  DEV TEST PANEL
// ============================================================

function toggleTestPanel() {
  const body = document.getElementById('testPanelBody');
  const chevron = document.getElementById('testPanelChevron');
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function onTestQuoteTypeChange() {
  const type = document.getElementById('testQuoteType').value;
  const isVehicle = ['traffic', 'casco', 'imm'].includes(type);

  document.getElementById('testVehicleFields').style.display = isVehicle ? 'block' : 'none';
  document.getElementById('testTssFields').style.display = type === 'tss' ? 'block' : 'none';
  document.getElementById('testDaskFields').style.display = type === 'dask' ? 'block' : 'none';
  document.getElementById('testHouseFields').style.display = type === 'house' ? 'block' : 'none';
}

function testLog(message, level) {
  const container = document.getElementById('testLogContainer');
  const log = document.getElementById('testLog');
  container.style.display = 'block';

  const now = new Date();
  const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const cls = level === 'success' ? 'log-success' : level === 'error' ? 'log-error' : 'log-info';

  log.innerHTML += `<div class="log-entry"><span class="log-time">[${time}]</span><span class="${cls}">${escapeHtml(message)}</span></div>`;
  log.scrollTop = log.scrollHeight;
}

function clearTestLog() {
  document.getElementById('testLog').innerHTML = '';
  document.getElementById('testLogContainer').style.display = 'none';
}

async function submitTestQuote() {
  const quoteType = document.getElementById('testQuoteType').value;
  const tcKimlikNo = document.getElementById('testTcKimlikNo').value.trim();
  const telefon = document.getElementById('testTelefon').value.trim() || getGlobalPhone() || '';

  if (!tcKimlikNo) {
    showToast('TC Kimlik No giriniz', 'warning');
    return;
  }
  if (tcKimlikNo.length !== 11 || !/^\d+$/.test(tcKimlikNo)) {
    showToast('TC Kimlik No 11 haneli ve sadece rakamlardan olusmalidir', 'warning');
    return;
  }

  const isVehicle = ['traffic', 'casco', 'imm'].includes(quoteType);
  let plaka = '';
  let sigortaliAdi = null;
  let extraData = {};

  if (isVehicle) {
    plaka = document.getElementById('testPlaka').value.trim().toUpperCase();
    if (!plaka) {
      showToast('Arac policeleri icin plaka zorunludur', 'warning');
      return;
    }
  } else if (quoteType === 'tss') {
    sigortaliAdi = document.getElementById('testSigortaliAdi').value.trim();
    const dogumTarihi = document.getElementById('testTssDogumTarihi').value;
    if (!sigortaliAdi) {
      showToast('TSS icin sigortali adi zorunludur', 'warning');
      return;
    }
    if (!dogumTarihi) {
      showToast('TSS icin dogum tarihi zorunludur', 'warning');
      return;
    }
    extraData.tssData = {
      dogumTarihi: dogumTarihi,
      boy: document.getElementById('testTssBoy').value || null,
      kilo: document.getElementById('testTssKilo').value || null,
      agTipi: parseInt(document.getElementById('testTssAgTipi').value) || null,
      planTipi: parseInt(document.getElementById('testTssPlanTipi').value) || null,
      dogumTeminati: document.getElementById('testTssDogumTeminati').checked || null
    };
  } else if (quoteType === 'dask') {
    extraData.daskData = {
      binaAdresi: document.getElementById('testDaskBinaAdresi').value || null,
      uavtKodu: document.getElementById('testDaskUAVTKodu').value || null,
      brutM2: parseFloat(document.getElementById('testDaskBrutM2').value) || null,
      binaInsaatYili: parseInt(document.getElementById('testDaskInsaatYili').value) || null,
      toplamKatSayisi: parseInt(document.getElementById('testDaskToplamKat').value) || null,
      bulunduguKat: parseInt(document.getElementById('testDaskBulunduguKat').value) || null,
      yapiTarzi: parseInt(document.getElementById('testDaskYapiTarzi').value) || null,
      kullanimSekli: parseInt(document.getElementById('testDaskKullanimSekli').value) || null,
      mevcutPoliceNo: document.getElementById('testDaskMevcutPoliceNo').value || null
    };
  } else if (quoteType === 'house') {
    extraData.houseData = {
      binaAdresi: document.getElementById('testHouseBinaAdresi').value || null,
      uavtKodu: document.getElementById('testHouseUAVTKodu').value || null,
      brutM2: parseFloat(document.getElementById('testHouseBrutM2').value) || null,
      binaInsaatYili: parseInt(document.getElementById('testHouseInsaatYili').value) || null,
      toplamKatSayisi: parseInt(document.getElementById('testHouseToplamKat').value) || null,
      bulunduguKat: parseInt(document.getElementById('testHouseBulunduguKat').value) || null,
      yapiTarzi: parseInt(document.getElementById('testHouseYapiTarzi').value) || null,
      binaBeyanDegeri: parseFloat(document.getElementById('testHouseBinaBeyanDegeri').value) || null,
      esyaBeyanDegeri: parseFloat(document.getElementById('testHouseEsyaBeyanDegeri').value) || null
    };
  }

  const btn = document.getElementById('btnTestQuote');
  btn.disabled = true;
  btn.textContent = 'Gonderiliyor...';

  const quoteTypeLabels = {
    'traffic': 'Trafik', 'casco': 'Kasko', 'imm': 'IMM',
    'dask': 'DASK', 'house': 'Konut', 'tss': 'TSS'
  };
  testLog(`${quoteTypeLabels[quoteType]} teklifi gonderiliyor: TC=${tcKimlikNo}${plaka ? ', plaka=' + plaka : ''}`, 'info');
  testLog(`API URL: ${APP_CONFIG.API.getUrl('policies/test-quote')}`, 'info');

  try {
    const requestBody = {
      quoteType,
      tcKimlikNo,
      plaka: plaka || null,
      cepTelefonu: telefon || null,
      sigortaliAdi: sigortaliAdi,
      ...extraData
    };
    testLog(`Request: ${JSON.stringify(requestBody)}`, 'info');

    const response = await apiPost('policies/test-quote', requestBody);

    if (!response || !response.isSuccessful) {
      const msg = response?.message || 'Teklif gonderilemedi';
      testLog(`HATA: ${msg}`, 'error');
      showToast(msg, 'error');
      return;
    }

    // webQueryId null/undefined/0 kontrolü
    if (!response.webQueryId) {
      const msg = response.message || 'Sorgu kuyruga alindi ancak webQueryId atanamadi';
      testLog(`UYARI: ${msg}`, 'error');
      showToast(msg, 'warning');
      return;
    }

    testLog(`Sorgu baslatildi! webQueryId=${response.webQueryId}`, 'success');
    showToast('Teklif sorgusu baslatildi', 'success');

    const productCode = PRODUCT_CODE_MAP[quoteType] ?? 0;
    testLog(`Polling baslatildi: webQueryId=${response.webQueryId}, productCode=${productCode}`, 'info');

    // Start polling and log results
    pollTestQuoteResults(response.webQueryId, productCode);

  } catch (error) {
    console.error('Test quote error:', error);
    const detail = error.status ? `HTTP ${error.status}: ${error.message || error}` : (error.message || error);
    testLog(`ISTISNA: ${detail}`, 'error');
    showToast('Teklif gonderilirken hata olustu', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="5,3 19,12 5,21 5,3"/></svg>
      Test Gonder
    `;
  }
}

// Polling specifically for test panel (results logged to test log)
function pollTestQuoteResults(webQueryId, productCode) {
  const maxAttempts = 60;
  let attempts = 0;

  const poll = async () => {
    try {
      const results = await apiGet('policies/quote-results', { webQueryId, product: productCode });
      if (!results || !results.isSuccessful) return false;

      if (results.quotes && results.quotes.length > 0) {
        const sorted = [...results.quotes].sort((a, b) => (a.grossPremium || 999999) - (b.grossPremium || 999999));
        testLog(`${results.quotes.length} teklif alindi (${results.status})`, 'success');
        sorted.forEach(q => {
          if (q.grossPremium) {
            testLog(`  ${q.insuranceCompanyName}: ${formatCurrency(q.grossPremium)}`, 'success');
          } else if (q.status === 'error') {
            testLog(`  ${q.insuranceCompanyName}: HATA - ${q.errorMessage || ''}`, 'error');
          } else {
            testLog(`  ${q.insuranceCompanyName}: Bekleniyor...`, 'info');
          }
        });
      }
      return results.status === 'completed';
    } catch (err) {
      testLog(`Polling hatasi: ${err.message || err}`, 'error');
      return false;
    }
  };

  // Immediate first poll
  poll();

  const intervalId = setInterval(async () => {
    attempts++;
    const done = await poll();
    if (done || attempts >= maxAttempts) {
      clearInterval(intervalId);
      if (done) {
        testLog('Polling tamamlandi.', 'success');
      } else {
        testLog('Polling zaman asimi.', 'error');
      }
    }
  }, 5000);
}

// ============================================================
//  UTILITY FUNCTIONS
// ============================================================

function getDaysRemaining(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '-';
  return amount.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL';
}

function formatPhone(phone) {
  if (!phone) return '-';
  const s = String(phone).replace(/\D/g, '');
  if (s.length === 10) {
    return `0${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6, 8)} ${s.slice(8)}`;
  }
  return s || '-';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function showEmpty(msg) {
  const tbody = document.getElementById('policiesBody');
  tbody.innerHTML = `
    <tr><td colspan="9">
      <div class="rn-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <span>${escapeHtml(msg)}</span>
      </div>
    </td></tr>`;
  document.getElementById('paginationContainer').style.display = 'none';
}

function showError() {
  const tbody = document.getElementById('policiesBody');
  tbody.innerHTML = `
    <tr><td colspan="9">
      <div class="rn-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32" style="color:var(--danger);">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span style="color:var(--danger);">Veriler yuklenirken bir hata olustu</span>
      </div>
    </td></tr>`;
}
