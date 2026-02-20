// ============================================================
//  1. CONSTANTS & STATE
// ============================================================
let allPolicies = [];
let filteredPolicies = [];
let currentPage = 1;
const pageSize = 20;
let insuranceCompanies = [];
let policyTypes = [];
let activeUrgencyFilter = null;
let activePollings = {};
let currentQuotePolicyId = null;
let currentQuoteType = null;
let quoteEventSource = null;
let realtimeQuotes = {};
let activeWebQueryIds = {};
let selectedIds = new Set();
let selectedPolicyId = null;
let rightPanelMode = 'placeholder';
let wizardStep = 'review';
const wizEditedTC = {};
const wizEditedPhone = {};
let wizSendResults = [];
let wizTrackingPolls = {};
let wizTrackingResults = {};
const RENEWAL_STATES = {
  0: { label: 'Bekliyor', css: 'bekliyor', icon: '\u23F3' },
  2: { label: 'Teklif Al\u0131nd\u0131', css: 'teklif', icon: '\uD83D\uDCCB' },
  3: { label: '\u0130letildi', css: 'iletildi', icon: '\uD83D\uDCE4' },
  1: { label: 'Yenilenmi\u015F', css: 'policelesti', icon: '\u2705' },
  4: { label: 'Poli\u00E7ele\u015Fti', css: 'policelesti', icon: '\u2705' },
  5: { label: 'Reddetti', css: 'reddetti', icon: '\u274C' },
};
const ACTIVE_STATES = [0, 2, 3];
const COMPLETED_STATES = [1, 4, 5];
let activeStatusFilter = 'active';
let completedPoliciesCache = null;
let policyQueryLog = {};
let localQueryBatches = [];
const QUOTE_TYPE_MAP = {
  'Trafik': 'traffic', 'Kasko': 'casco', 'IMM': 'imm', '\u0130MM': 'imm',
  'I\u015Fyeri': 'imm', '\u0130\u015Fyeri': 'imm', 'DASK': 'dask', 'Konut': 'house',
  'Saglik': 'tss', 'Sa\u011Fl\u0131k': 'tss', 'TSS': 'tss',
  'Tamamlay\u0131c\u0131 Sa\u011Fl\u0131k': 'tss', 'Tamamlayici Saglik': 'tss',
  'Tamamlay\u0131c\u0131 Sa\u011Fl\u0131k Sigortas\u0131': 'tss',
  'Zorunlu Trafik': 'traffic', 'Oto Trafik': 'traffic',
  'Zorunlu Trafik Sigortas\u0131': 'traffic', 'Oto Kasko': 'casco',
  'Zorunlu Deprem': 'dask', 'Konut Sigortas\u0131': 'house'
};
const QUOTE_TYPE_KEYWORDS = [
  { keywords: ['tss', 'tamamlay\u0131c\u0131', 'tamamlayici'], type: 'tss' },
  { keywords: ['sa\u011Fl\u0131k', 'saglik', 'sagl\u0131k', 'sa\u011Flik'], type: 'tss' },
  { keywords: ['trafik'], type: 'traffic' },
  { keywords: ['kasko'], type: 'casco' },
  { keywords: ['dask', 'deprem'], type: 'dask' },
  { keywords: ['konut', 'mesken'], type: 'house' },
  { keywords: ['imm', 'i\u015Fyeri', 'isyeri', '\u0131\u015Fyeri'], type: 'imm' }
];
function resolveQuoteType(policeTuru) {
  if (!policeTuru) return null;
  if (QUOTE_TYPE_MAP[policeTuru]) return QUOTE_TYPE_MAP[policeTuru];
  const lower = policeTuru.toLocaleLowerCase('tr-TR');
  for (const rule of QUOTE_TYPE_KEYWORDS) {
    if (rule.keywords.some(kw => lower.includes(kw))) return rule.type;
  }
  return null;
}
const NEEDS_EXTRA_FORM = { 'dask': 'daskHouse', 'house': 'daskHouse', 'tss': 'tss' };
const PRODUCT_CODE_MAP = { 'traffic': 0, 'casco': 1, 'dask': 5, 'tss': 7, 'imm': 0, 'house': 5 };
const QUOTE_TYPE_LABELS = { 'traffic': 'Trafik', 'casco': 'Kasko', 'imm': '\u0130MM', 'dask': 'DASK', 'tss': 'TSS', 'house': 'Konut' };
const TYPE_COLORS = {
  'Kasko': { bg: 'rgba(0,212,255,0.12)', fg: '#00d4ff' },
  'Trafik': { bg: 'rgba(16,185,129,0.12)', fg: '#10b981' },
  'DASK': { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
  'Sa\u011Fl\u0131k': { bg: 'rgba(236,72,153,0.12)', fg: '#ec4899' },
  'TSS': { bg: 'rgba(236,72,153,0.12)', fg: '#ec4899' },
  'Konut': { bg: 'rgba(99,102,241,0.12)', fg: '#6366f1' },
  '\u0130\u015Fyeri': { bg: 'rgba(6,182,212,0.12)', fg: '#06b6d4' },
  '\u0130MM': { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' },
  'IMM': { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' }
};
const DEFAULT_TYPE_COLOR = { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' };
function resolveTypeColor(policeTuru) {
  if (!policeTuru) return DEFAULT_TYPE_COLOR;
  if (TYPE_COLORS[policeTuru]) return TYPE_COLORS[policeTuru];
  const qt = resolveQuoteType(policeTuru);
  const m = { 'tss': TYPE_COLORS['Sa\u011Fl\u0131k'], 'traffic': TYPE_COLORS['Trafik'], 'casco': TYPE_COLORS['Kasko'], 'dask': TYPE_COLORS['DASK'], 'house': TYPE_COLORS['Konut'], 'imm': TYPE_COLORS['\u0130MM'] };
  return (qt && m[qt]) || DEFAULT_TYPE_COLOR;
}

// ============================================================
//  2. INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('dev') || localStorage.getItem('devMode')) {
    const tp = document.getElementById('testPanel');
    if (tp) tp.style.display = 'block';
  }
  initPhoneInput();
  await loadData();
  setupEventListeners();
  loadQuoteHistory();
  connectQuoteStream();
});
window.addEventListener('beforeunload', () => { disconnectQuoteStream(); });

// ============================================================
//  3. PHONE INPUT
// ============================================================
function initPhoneInput() {
  const phoneInput = document.getElementById('quotePhoneNumber');
  const phoneStatus = document.getElementById('phoneStatus');
  if (!phoneInput) return;
  try {
    const userData = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (userData.gsmNo) {
      let gsm = String(userData.gsmNo).replace(/\D/g, '');
      if (gsm.startsWith('90') && gsm.length > 10) gsm = gsm.substring(2);
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
  } catch (e) { console.error('Phone init error:', e); }
  phoneInput.addEventListener('input', function() {
    const val = this.value.replace(/\D/g, '');
    this.value = val;
    if (val.startsWith('5') && val.length === 10) {
      phoneStatus.textContent = '\u2713'; phoneStatus.style.color = 'var(--success, #10b981)';
    } else if (val.length > 0) {
      phoneStatus.textContent = '5 ile baslamali, 10 hane'; phoneStatus.style.color = 'var(--warning, #f59e0b)';
    } else { phoneStatus.textContent = ''; }
  });
}
function getGlobalPhone() {
  const pi = document.getElementById('quotePhoneNumber');
  if (!pi) return null;
  const val = pi.value.replace(/\D/g, '');
  return (val.startsWith('5') && val.length === 10) ? val : null;
}
function togglePhonePopover() {
  const popover = document.getElementById('phonePopover');
  if (!popover) return;
  const isVisible = popover.style.display !== 'none';
  popover.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) document.getElementById('quotePhoneNumber')?.focus();
}

// ============================================================
//  4. DATA LOADING
// ============================================================
async function loadData() {
  try {
    const response = await apiGet('policies/renewals', { daysAhead: 60, pageSize: 1000 });
    if (response && response.items) {
      allPolicies = response.items.map(item => ({
        id: item.id, sigortaSirketi: item.sigortaSirketiAdi || 'N/A', sigortaSirketiId: item.sigortaSirketiId,
        policeTuru: item.policeTuruAdi || 'N/A', policeTuruId: item.policeTuruId, policeNumarasi: item.policeNumarasi,
        plaka: item.plaka, tanzimTarihi: item.tanzimTarihi, baslangicTarihi: item.baslangicTarihi,
        bitisTarihi: item.bitisTarihi, brutPrim: item.brutPrim, netPrim: item.netPrim,
        sigortaliAdi: item.sigortaliAdi, cepTelefonu: item.cepTelefonu, yenilemeDurumu: item.yenilemeDurumu,
        tcKimlikNo: item.tcKimlikNo, vergiNo: item.vergiNo, musteriId: item.musteriId,
        dogumTarihi: item.dogumTarihi, musteriGsm: item.musteriGsm, musteriEmail: item.musteriEmail,
        musteriAdres: item.musteriAdres, musteriIl: item.musteriIl, musteriIlce: item.musteriIlce,
        sonWebQueryId: item.sonWebQueryId, sonSorguProductCode: item.sonSorguProductCode, sonSorguTarihi: item.sonSorguTarihi
      }));
      filteredPolicies = [...allPolicies];
      const cs = new Set(), ts = new Set();
      allPolicies.forEach(p => { if (p.sigortaSirketi) cs.add(p.sigortaSirketi); if (p.policeTuru) ts.add(p.policeTuru); });
      insuranceCompanies = Array.from(cs).sort();
      policyTypes = Array.from(ts).sort();
      populateFilters(); applySort(); updateStats(); updateStatusTabCounts(); renderTable();
    } else { showEmpty('Yenilecek police bulunamadi'); }
  } catch (error) { console.error('Error loading policies:', error); showError(); }
}
async function loadCompletedPolicies() {
  try {
    const response = await apiGet('policies/renewals', { includeCompleted: true, daysAhead: 90, pageSize: 1000 });
    if (response && response.items) {
      completedPoliciesCache = response.items.map(item => ({
        id: item.id, sigortaSirketi: item.sigortaSirketiAdi, sigortaSirketiId: item.sigortaSirketiId,
        policeTuru: item.policeTuruAdi, policeTuruId: item.policeTuruId, policeNumarasi: item.policeNumarasi,
        plaka: item.plaka, tanzimTarihi: item.tanzimTarihi, baslangicTarihi: item.baslangicTarihi,
        bitisTarihi: item.bitisTarihi, brutPrim: item.brutPrim, netPrim: item.netPrim,
        sigortaliAdi: item.sigortaliAdi, cepTelefonu: item.cepTelefonu, yenilemeDurumu: item.yenilemeDurumu,
        tcKimlikNo: item.tcKimlikNo, vergiNo: item.vergiNo, musteriId: item.musteriId,
        dogumTarihi: item.dogumTarihi, musteriGsm: item.musteriGsm, musteriEmail: item.musteriEmail,
        musteriAdres: item.musteriAdres, musteriIl: item.musteriIl, musteriIlce: item.musteriIlce,
        sonWebQueryId: item.sonWebQueryId, sonSorguProductCode: item.sonSorguProductCode, sonSorguTarihi: item.sonSorguTarihi
      }));
      const tc = document.getElementById('tabCountCompleted');
      if (tc) tc.textContent = completedPoliciesCache.length;
    }
  } catch (error) { console.error('Failed to load completed policies:', error); showToast('Tamamlananlar yuklenemedi', 'error'); }
}

// ============================================================
//  5. FILTERS & SORTING
// ============================================================
function populateFilters() {
  const cs = document.getElementById('filterCompany'), ts = document.getElementById('filterType');
  insuranceCompanies.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; cs.appendChild(o); });
  policyTypes.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; ts.appendChild(o); });
}
function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const cf = document.getElementById('filterCompany').value;
  const tf = document.getElementById('filterType').value;
  filteredPolicies = allPolicies.filter(p => {
    if (search) { const h = [p.sigortaliAdi, p.policeNumarasi, p.plaka, p.cepTelefonu].filter(Boolean).join(' ').toLowerCase(); if (!h.includes(search)) return false; }
    if (cf && p.sigortaSirketi !== cf) return false;
    if (tf && p.policeTuru !== tf) return false;
    if (activeUrgencyFilter) { if (getDaysRemaining(p.bitisTarihi) > activeUrgencyFilter) return false; }
    if (activeStatusFilter === 'active') { if (!ACTIVE_STATES.includes(p.yenilemeDurumu)) return false; }
    else if (activeStatusFilter === 'completed') { if (!COMPLETED_STATES.includes(p.yenilemeDurumu)) return false; }
    else if (activeStatusFilter !== null && activeStatusFilter !== 'active') { if (p.yenilemeDurumu !== parseInt(activeStatusFilter)) return false; }
    return true;
  });
  currentPage = 1; applySort(); updateStats(); updateStatusTabCounts(); renderTable();
}
function applySort() {
  const sv = document.getElementById('sortBy').value; if (!sv) return;
  const [field, order] = sv.split('_');
  filteredPolicies.sort((a, b) => {
    let aV, bV;
    if (field === 'BitisTarihi') { aV = new Date(a.bitisTarihi); bV = new Date(b.bitisTarihi); }
    else if (field === 'BrutPrim') { aV = a.brutPrim || 0; bV = b.brutPrim || 0; }
    else { aV = a[field] || ''; bV = b[field] || ''; }
    return order === 'asc' ? (aV > bV ? 1 : -1) : (aV < bV ? 1 : -1);
  });
}
function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCompany').value = '';
  document.getElementById('filterType').value = '';
  document.getElementById('sortBy').value = 'BitisTarihi_asc';
  activeUrgencyFilter = null;
  document.querySelectorAll('.rn-stat-card').forEach(c => c.classList.remove('rn-stat-card--active'));
  filteredPolicies = [...allPolicies]; currentPage = 1; applySort(); updateStats(); renderTable();
}
function filterByUrgency(days, cardEl) {
  if (activeUrgencyFilter === days) {
    activeUrgencyFilter = null;
    document.querySelectorAll('.rn-stat-card').forEach(c => c.classList.remove('rn-stat-card--active'));
  } else {
    activeUrgencyFilter = days;
    document.querySelectorAll('.rn-stat-card').forEach(c => c.classList.remove('rn-stat-card--active'));
    if (cardEl) cardEl.classList.add('rn-stat-card--active');
  }
  applyFilters();
}

// ============================================================
//  6. STATS
// ============================================================
function updateStats() {
  let count7 = 0, count15 = 0, count30 = 0, totalRevenue = 0;
  allPolicies.forEach(p => {
    const d = getDaysRemaining(p.bitisTarihi);
    if (d <= 7) count7++; if (d <= 15) count15++; if (d <= 30) count30++;
    totalRevenue += p.brutPrim || 0;
  });
  const e7 = document.getElementById('statCount7');
  const e15 = document.getElementById('statCount15');
  const e30 = document.getElementById('statCount30');
  const eR = document.getElementById('statRevenue');
  if (e7) e7.textContent = count7;
  if (e15) e15.textContent = count15;
  if (e30) e30.textContent = count30;
  if (eR) eR.textContent = formatCurrency(totalRevenue);
  document.getElementById('tableResultCount').textContent = filteredPolicies.length;
}
function updateStatusTabCounts() {
  const counts = { 0: 0, 2: 0, 3: 0 }; let activeTotal = 0;
  allPolicies.forEach(p => { if (ACTIVE_STATES.includes(p.yenilemeDurumu)) { counts[p.yenilemeDurumu] = (counts[p.yenilemeDurumu] || 0) + 1; activeTotal++; } });
  const tA = document.getElementById('tabCountActive'), t0 = document.getElementById('tabCount0'), t2 = document.getElementById('tabCount2'), t3 = document.getElementById('tabCount3'), tC = document.getElementById('tabCountCompleted');
  if (tA) tA.textContent = activeTotal; if (t0) t0.textContent = counts[0] || 0; if (t2) t2.textContent = counts[2] || 0; if (t3) t3.textContent = counts[3] || 0;
  if (tC) tC.textContent = completedPoliciesCache ? completedPoliciesCache.length : '?';
}

// ============================================================
//  7. TABLE RENDERING
// ============================================================
function renderTable() {
  const tbody = document.getElementById('policiesBody');
  const start = (currentPage - 1) * pageSize, end = start + pageSize;
  const page = filteredPolicies.slice(start, end);
  if (page.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="rn-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><span>Filtreye uygun police bulunamadi</span></div></td></tr>';
    document.getElementById('paginationContainer').style.display = 'none';
    document.getElementById('tableResultCount').textContent = '0'; return;
  }
  let html = ''; page.forEach(p => { html += createPolicyRow(p); }); tbody.innerHTML = html;
  tbody.querySelectorAll('.rn-row').forEach(row => {
    const id = parseInt(row.dataset.id);
    row.addEventListener('click', (e) => { if (e.target.closest('.rn-checkbox, .rn-act-btn, button, a')) return; handleRowClick(id); });
    const cb = row.querySelector('.rn-row-cb');
    if (cb) cb.addEventListener('change', (e) => { e.stopPropagation(); handleCheckboxChange(id, cb.checked); });
  });
  document.getElementById('tableResultCount').textContent = filteredPolicies.length;
  updatePagination(); updateSelectionBar();
  if (selectedPolicyId && rightPanelMode === 'detail') { const r = tbody.querySelector(`.rn-row[data-id="${selectedPolicyId}"]`); if (r) r.classList.add('selected'); }
}
function createPolicyRow(policy) {
  const days = getDaysRemaining(policy.bitisTarihi);
  const urgency = days <= 7 ? 'critical' : days <= 15 ? 'warning' : 'normal';
  const colors = resolveTypeColor(policy.policeTuru);
  const phone = formatPhone(policy.cepTelefonu);
  const isChecked = selectedIds.has(policy.id) ? 'checked' : '';
  const isSelected = policy.id === selectedPolicyId && rightPanelMode === 'detail';
  const st = RENEWAL_STATES[policy.yenilemeDurumu] || RENEWAL_STATES[0];
  return `<tr class="rn-row${isSelected ? ' selected' : ''}" data-id="${policy.id}">
    <td><div class="rn-urgency-strip ${urgency}"></div></td>
    <td class="rn-th--checkbox"><input type="checkbox" class="rn-checkbox rn-row-cb" data-id="${policy.id}" ${isChecked}></td>
    <td style="text-align:center;"><span class="rn-days ${urgency}">${days}</span></td>
    <td><div class="rn-customer-name">${escapeHtml(policy.sigortaliAdi || 'Isimsiz')}</div>${phone !== '-' ? `<div class="rn-customer-phone">${phone}</div>` : ''}
      <span class="rn-state-badge rn-state-badge--${st.css}" data-state-id="${policy.id}" onclick="event.stopPropagation();openStatePopover(event, ${policy.id})">${st.label}</span></td>
    <td><span class="rn-type-pill" style="background:${colors.bg};color:${colors.fg};">${escapeHtml(policy.policeTuru)}</span></td>
    <td><span class="rn-plate">${escapeHtml(policy.plaka || policy.policeNumarasi || '-')}</span></td>
    <td>${escapeHtml(truncate(policy.sigortaSirketi, 18))}</td>
    <td><span class="rn-date">${formatDate(policy.bitisTarihi)}</span></td>
    <td><span class="rn-premium">${formatCurrency(policy.brutPrim)}</span></td>
    <td><div class="rn-actions">
      <button class="rn-act-btn rn-act-quote" onclick="createQuote(${policy.id})" title="Teklif Calis"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>Teklif</button>
      <button class="rn-act-btn rn-act-wa" onclick="sendWhatsApp(${policy.id})" title="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></button>
    </div></td></tr>`;
}

// ============================================================
//  8. PAGINATION
// ============================================================
function updatePagination() {
  const totalPages = Math.ceil(filteredPolicies.length / pageSize);
  const container = document.getElementById('paginationContainer');
  const controls = document.getElementById('paginationControls');
  const info = document.getElementById('paginationInfo');
  if (totalPages <= 1) { container.style.display = 'none'; return; }
  container.style.display = 'flex';
  const s = (currentPage - 1) * pageSize + 1, e = Math.min(currentPage * pageSize, filteredPolicies.length);
  info.textContent = `${s}-${e} / ${filteredPolicies.length} police`;
  let html = `<button class="rn-pg-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15,18 9,12 15,6"/></svg></button>`;
  const mv = 7; let sp = Math.max(1, currentPage - Math.floor(mv / 2)); let ep = Math.min(totalPages, sp + mv - 1);
  if (ep - sp < mv - 1) sp = Math.max(1, ep - mv + 1);
  if (sp > 1) { html += `<button class="rn-pg-btn" onclick="changePage(1)">1</button>`; if (sp > 2) html += '<span style="padding:0 0.25rem;color:var(--text-dim);">...</span>'; }
  for (let i = sp; i <= ep; i++) html += `<button class="rn-pg-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
  if (ep < totalPages) { if (ep < totalPages - 1) html += '<span style="padding:0 0.25rem;color:var(--text-dim);">...</span>'; html += `<button class="rn-pg-btn" onclick="changePage(${totalPages})">${totalPages}</button>`; }
  html += `<button class="rn-pg-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9,18 15,12 9,6"/></svg></button>`;
  controls.innerHTML = html;
}
function changePage(page) {
  const tp = Math.ceil(filteredPolicies.length / pageSize);
  if (page < 1 || page > tp) return;
  currentPage = page; renderTable();
  document.querySelector('.rn-table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
//  9. SELECTION & PANEL STATE
// ============================================================
function handleRowClick(policyId) { if (rightPanelMode === 'wizard') return; selectPolicyForDetail(policyId); }
function handleCheckboxChange(policyId, checked) { if (checked) selectedIds.add(policyId); else selectedIds.delete(policyId); updateSelectionBar(); }
function updateSelectionBar() {
  const bar = document.getElementById('selectionBar'), count = selectedIds.size;
  if (count > 0) { bar.style.display = 'flex'; document.getElementById('selCount').textContent = count; } else { bar.style.display = 'none'; }
  const hcb = document.getElementById('selectAllCheckbox');
  if (hcb) { const s = (currentPage - 1) * pageSize, e = s + pageSize; const pids = filteredPolicies.slice(s, e).map(p => p.id); hcb.checked = pids.length > 0 && pids.every(id => selectedIds.has(id)); }
}
function showRightPanel(mode) {
  rightPanelMode = mode;
  document.getElementById('panelPlaceholder').style.display = mode === 'placeholder' ? 'flex' : 'none';
  document.getElementById('panelDetail').style.display = mode === 'detail' ? 'block' : 'none';
  document.getElementById('panelWizard').style.display = mode === 'wizard' ? 'flex' : 'none';
}

// ============================================================
//  10. STATUS PIPELINE
// ============================================================
async function handleStatusTabClick(status) {
  if (status === 'completed' && !completedPoliciesCache) await loadCompletedPolicies();
  activeStatusFilter = status;
  document.querySelectorAll('.rn-status-tab').forEach(t => t.classList.toggle('active', t.dataset.status === status));
  if (status === 'completed' && completedPoliciesCache) { filteredPolicies = completedPoliciesCache.slice(); currentPage = 1; applySort(); updateStats(); renderTable(); }
  else applyFilters();
}
async function updateRenewalStatus(policyId, newStatus) {
  try {
    const r = await apiPut(`policies/${policyId}/renewal-status`, { status: newStatus });
    if (!r || !r.success) { showToast(r?.errorMessage || 'Durum guncellenemedi', 'error'); return false; }
    const p = allPolicies.find(x => x.id === policyId); if (p) p.yenilemeDurumu = newStatus;
    if (COMPLETED_STATES.includes(newStatus)) completedPoliciesCache = null;
    applyFilters(); showToast(`Durum guncellendi: ${RENEWAL_STATES[newStatus]?.label || newStatus}`, 'success');
    if (selectedPolicyId === policyId && rightPanelMode === 'detail') { if (COMPLETED_STATES.includes(newStatus)) closeDetailPanel(); else renderDetailPanel(p); }
    return true;
  } catch (error) { console.error('Renewal status update error:', error); showToast('Durum guncellenirken hata olustu', 'error'); return false; }
}
async function batchUpdateRenewalStatus(policyIds, newStatus) {
  if (!policyIds || policyIds.length === 0) return;
  try {
    const r = await apiPut('policies/batch-renewal-status', { policyIds: Array.from(policyIds), status: newStatus });
    if (!r || !r.success) { showToast(r?.errorMessage || 'Toplu durum guncellenemedi', 'error'); return; }
    policyIds.forEach(id => { const p = allPolicies.find(x => x.id === id); if (p) p.yenilemeDurumu = newStatus; });
    if (COMPLETED_STATES.includes(newStatus)) completedPoliciesCache = null;
    selectedIds.clear(); updateSelectionBar(); applyFilters();
    showToast(`${r.updatedCount} police durumu guncellendi: ${RENEWAL_STATES[newStatus]?.label || newStatus}`, 'success');
  } catch (error) { console.error('Batch renewal status update error:', error); showToast('Toplu durum guncellenirken hata olustu', 'error'); }
}

// ============================================================
//  11. STATE POPOVER
// ============================================================
function openStatePopover(event, policyId) {
  closeStatePopover();
  const policy = allPolicies.find(p => p.id === policyId) || (completedPoliciesCache || []).find(p => p.id === policyId);
  if (!policy) return;
  const currentStatus = policy.yenilemeDurumu;
  const badge = event.currentTarget, rect = badge.getBoundingClientRect();
  const popover = document.createElement('div'); popover.className = 'rn-state-popover'; popover.id = 'statePopover';
  const options = [
    { value: 0, label: 'Bekliyor', color: '#d97706' }, { value: 2, label: 'Teklif Alindi', color: '#2563eb' },
    { value: 3, label: 'Musteriye Iletildi', color: '#4f46e5' }, { value: -1, label: 'sep' },
    { value: 4, label: 'Policelesti', color: '#059669' }, { value: 5, label: 'Reddetti / Vazgecti', color: '#dc2626' },
  ];
  options.forEach(opt => {
    if (opt.value === -1) { const sep = document.createElement('div'); sep.className = 'rn-state-popover-sep'; popover.appendChild(sep); return; }
    const isCurrent = opt.value === currentStatus;
    const item = document.createElement('div'); item.className = `rn-state-popover-item${isCurrent ? ' current' : ''}`;
    item.innerHTML = `<span class="rn-state-popover-dot" style="background:${opt.color}"></span>${opt.label}<svg class="rn-state-popover-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20,6 9,17 4,12"/></svg>`;
    if (!isCurrent) item.addEventListener('click', (e) => { e.stopPropagation(); closeStatePopover(); updateRenewalStatus(policyId, opt.value); });
    popover.appendChild(item);
  });
  const portal = document.getElementById('statePopoverPortal') || document.body; portal.appendChild(popover);
  const popRect = popover.getBoundingClientRect();
  let top = rect.bottom + 4, left = rect.left;
  if (top + popRect.height > window.innerHeight - 8) top = rect.top - popRect.height - 4;
  if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
  popover.style.top = top + 'px'; popover.style.left = left + 'px';
  setTimeout(() => { document.addEventListener('click', _closePopoverOnOutside); document.addEventListener('scroll', closeStatePopover, true); }, 10);
}
function _closePopoverOnOutside(e) { const p = document.getElementById('statePopover'); if (p && !p.contains(e.target)) closeStatePopover(); }
function closeStatePopover() { const p = document.getElementById('statePopover'); if (p) p.remove(); document.removeEventListener('click', _closePopoverOnOutside); document.removeEventListener('scroll', closeStatePopover, true); }

// ============================================================
//  12. DETAIL PANEL
// ============================================================
function selectPolicyForDetail(policyId) {
  const policy = allPolicies.find(p => p.id === policyId) || (completedPoliciesCache || []).find(p => p.id === policyId);
  if (!policy) return;
  selectedPolicyId = policyId;
  document.querySelectorAll('.rn-row').forEach(row => row.classList.toggle('selected', parseInt(row.dataset.id) === policyId));
  showRightPanel('detail'); renderDetailPanel(policy);
  if (!activePollings[policyId] && policy.sonWebQueryId) autoFetchQuoteResults(policy);
}
function makeCollapsible(title, content, defaultOpen) {
  return `<div class="rn-detail-section collapsible${defaultOpen ? '' : ' collapsed'}">
    <div class="rn-detail-section-title" onclick="this.parentElement.classList.toggle('collapsed')">${title}<svg class="rn-collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6,9 12,15 18,9"/></svg></div>
    <div class="rn-detail-section-body">${content}</div></div>`;
}
function renderDetailPanel(policy) {
  const container = document.getElementById('panelDetail');
  const days = getDaysRemaining(policy.bitisTarihi);
  const urgencyColor = days <= 7 ? 'var(--danger)' : days <= 15 ? 'var(--warning)' : 'var(--info)';
  const urgencyBg = days <= 7 ? 'var(--danger-bg)' : days <= 15 ? 'var(--warning-bg)' : 'var(--info-bg)';
  const colors = resolveTypeColor(policy.policeTuru);
  const quoteType = resolveQuoteType(policy.policeTuru);
  const quoteTypeLabel = quoteType ? QUOTE_TYPE_LABELS[quoteType] : null;
  const warnings = [];
  if (!policy.tcKimlikNo && !policy.vergiNo) warnings.push({ type: 'warn', text: 'TC/VKN eksik' });
  if (!policy.cepTelefonu && !policy.musteriGsm) warnings.push({ type: 'info', text: 'Telefon yok' });
  if (!policy.dogumTarihi) warnings.push({ type: 'info', text: 'Dogum tarihi yok' });
  if (!quoteType) warnings.push({ type: 'warn', text: 'Teklif destegi yok' });
  if (policy.tcKimlikNo || policy.vergiNo) warnings.push({ type: 'ok', text: policy.tcKimlikNo ? 'TC mevcut' : 'VKN mevcut' });
  const currentState = RENEWAL_STATES[policy.yenilemeDurumu] || RENEWAL_STATES[0];
  const waSvg = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  // Count existing offers for badge
  const existingOffers = realtimeQuotes[policy.id] || [];
  const offerCount = existingOffers.length;
  let html = '';
  // --- Compact Header ---
  html += `<div class="rn-detail-header"><div class="rn-detail-header-top"><h2 class="rn-detail-name" title="${escapeHtml(policy.sigortaliAdi || '')}">${escapeHtml(policy.sigortaliAdi || 'Isimsiz')}</h2><div style="display:flex;align-items:center;gap:0.375rem;"><span class="rn-detail-badge" style="background:${urgencyBg};color:${urgencyColor};">${days}g</span><button class="rn-detail-close" id="btnCloseDetail" title="Kapat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div></div><div class="rn-detail-header-sub"><span style="background:${colors.bg};color:${colors.fg};padding:1px 6px;border-radius:4px;font-size:0.6875rem;font-weight:600;">${escapeHtml(policy.policeTuru)}</span><span class="dot">&middot;</span><span>${escapeHtml(policy.sigortaSirketi)}</span><span class="dot">&middot;</span><span style="font-weight:600;color:var(--primary);">${formatCurrency(policy.brutPrim)}</span></div></div>`;
  // --- Actions bar ---
  html += `<div class="rn-detail-actions"><span class="rn-state-badge rn-state-badge--${currentState.css}" style="font-size:0.6875rem;padding:3px 10px;cursor:pointer;" data-state-id="${policy.id}" onclick="event.stopPropagation();openStatePopover(event, ${policy.id})">${currentState.label} &#9662;</span><div style="flex:1;"></div><button class="rn-btn rn-btn--primary" id="detailQuoteBtn" style="padding:0.25rem 0.625rem;font-size:0.6875rem;" ${!quoteType ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>${quoteType ? 'Teklif' : 'Yok'}</button>`;
  if (policy.cepTelefonu) html += `<button class="rn-btn rn-btn--outline" id="detailWhatsAppBtn" style="padding:0.25rem 0.5rem;font-size:0.6875rem;background:#25D366;color:white;border-color:#25D366;">${waSvg}</button>`;
  html += `</div>`;
  // --- Tabs ---
  html += `<div class="rn-detail-tabs"><button class="rn-detail-tab active" data-tab="info" onclick="switchDetailTab(this)">Bilgi</button><button class="rn-detail-tab" data-tab="quote" onclick="switchDetailTab(this)">Teklif<span class="rn-detail-tab-badge" id="offersCount-${policy.id}">${offerCount || '-'}</span></button></div>`;

  // === TAB 1: Bilgi ===
  let tabInfo = '<div class="rn-detail-tab-panel active" data-tab-panel="info">';
  // Customer + Policy in one compact grid
  const displayPhone = policy.cepTelefonu || policy.musteriGsm;
  tabInfo += `<div class="rn-detail-grid"><div><div class="rn-detail-label">Ad Soyad</div><div class="rn-detail-value">${escapeHtml(policy.sigortaliAdi || '-')}</div></div><div><div class="rn-detail-label">Telefon</div><div class="rn-detail-value mono">${displayPhone ? formatPhone(displayPhone) : '<span style="color:var(--warning);">Eksik</span>'}</div></div><div><div class="rn-detail-label">TC Kimlik No</div><div class="rn-detail-value mono">${policy.tcKimlikNo ? escapeHtml(policy.tcKimlikNo) : '<span style="color:var(--warning);">Eksik</span>'}</div></div><div><div class="rn-detail-label">Vergi No</div><div class="rn-detail-value mono">${policy.vergiNo ? escapeHtml(policy.vergiNo) : '<span style="color:var(--text-dim);">-</span>'}</div></div><div><div class="rn-detail-label">Dogum Tarihi</div><div class="rn-detail-value">${policy.dogumTarihi ? formatDate(policy.dogumTarihi) : '<span style="color:var(--text-dim);">-</span>'}</div></div><div><div class="rn-detail-label">Plaka</div><div class="rn-detail-value mono">${escapeHtml(policy.plaka || '-')}</div></div><div><div class="rn-detail-label">Police No</div><div class="rn-detail-value mono">${escapeHtml(policy.policeNumarasi || '-')}</div></div><div><div class="rn-detail-label">Bitis</div><div class="rn-detail-value" style="color:${urgencyColor};font-weight:700;">${formatDate(policy.bitisTarihi)}</div></div><div><div class="rn-detail-label">Brut Prim</div><div class="rn-detail-value mono" style="color:var(--primary);">${formatCurrency(policy.brutPrim)}</div></div><div><div class="rn-detail-label">Net Prim</div><div class="rn-detail-value mono">${formatCurrency(policy.netPrim)}</div></div>${policy.musteriEmail ? `<div><div class="rn-detail-label">Email</div><div class="rn-detail-value" style="font-size:0.6875rem;">${escapeHtml(policy.musteriEmail)}</div></div>` : ''}${policy.musteriIl ? `<div><div class="rn-detail-label">Sehir</div><div class="rn-detail-value">${escapeHtml(policy.musteriIl)}${policy.musteriIlce ? ' / ' + escapeHtml(policy.musteriIlce) : ''}</div></div>` : ''}</div>`;
  // Warnings inline
  if (warnings.length > 0) {
    tabInfo += '<div style="display:flex;flex-wrap:wrap;gap:0.25rem;margin-top:0.5rem;">';
    warnings.forEach(w => {
      const wc = w.type === 'warn' ? 'var(--warning)' : w.type === 'ok' ? 'var(--success)' : 'var(--info)';
      const wi = w.type === 'ok' ? '&#10003;' : w.type === 'warn' ? '&#9888;' : '&#8505;';
      tabInfo += `<span style="font-size:0.625rem;padding:2px 6px;border-radius:4px;background:color-mix(in srgb, ${wc} 15%, transparent);color:${wc};">${wi} ${escapeHtml(w.text)}</span>`;
    });
    tabInfo += '</div>';
  }
  if (policy.musteriId) tabInfo += `<a class="rn-customer-link" href="../customers/detail.html?id=${policy.musteriId}" target="_blank" style="margin-top:0.5rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Musteri Karti</a>`;
  // Query log at bottom of info tab
  const qLog = policyQueryLog[policy.id] || [];
  if (qLog.length > 0) {
    tabInfo += '<div style="margin-top:0.75rem;border-top:1px solid var(--border-subtle);padding-top:0.5rem;">';
    tabInfo += '<div style="font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:0.375rem;">Sorgu Gecmisi</div>';
    tabInfo += '<div class="rn-detail-queries">';
    qLog.slice().reverse().forEach(entry => {
      const time = new Date(entry.timestamp).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const tl = QUOTE_TYPE_LABELS[entry.quoteType] || entry.quoteType; const tc2 = resolveTypeColor(tl);
      const rt = entry.resultCount !== null ? `${entry.resultCount} teklif` : 'Bekleniyor...';
      const rc = entry.resultCount !== null ? 'var(--text-primary)' : 'var(--text-dim)';
      const pt = entry.bestPremium ? formatCurrency(entry.bestPremium) : '';
      tabInfo += `<div class="rn-query-entry"><span class="rn-query-time">${time}</span><span class="rn-type-pill" style="background:${tc2.bg};color:${tc2.fg};font-size:0.5625rem;padding:0.125rem 0.375rem;">${escapeHtml(tl)}</span><span style="color:${rc};">${rt}</span>${pt ? `<span class="rn-query-result">${pt}</span>` : ''}</div>`;
    });
    tabInfo += '</div></div>';
  }
  tabInfo += '</div>';
  html += tabInfo;

  // === TAB 2: Teklif ===
  let tabQuote = '<div class="rn-detail-tab-panel" data-tab-panel="quote">';
  // TC query history container (loaded async)
  tabQuote += `<div id="tcQueryHistory-${policy.id}" class="rn-tc-query-history"><div style="font-size:0.75rem;color:var(--text-dim);">Sorgu gecmisi yukleniyor...</div></div>`;
  if (quoteType) tabQuote += `<div style="font-size:0.6875rem;color:var(--text-dim);margin-bottom:0.5rem;">Algilanan tur: <strong style="color:var(--text-secondary);">${escapeHtml(quoteTypeLabel)}</strong></div>`;
  tabQuote += `<div class="rn-quote-status" id="detailQuoteStatus-${policy.id}"></div>`;
  // Documents/Drive links (above offers)
  tabQuote += `<div id="detailDocuments-${policy.id}" class="rn-docs-section"></div>`;
  tabQuote += `<div class="rn-offers-grid" id="detailOffers-${policy.id}"></div>`;
  tabQuote += '</div>';
  html += tabQuote;

  // --- Render ---
  container.innerHTML = html;
  document.getElementById('btnCloseDetail').addEventListener('click', closeDetailPanel);
  const qBtn = document.getElementById('detailQuoteBtn'); if (qBtn && quoteType) qBtn.addEventListener('click', () => createQuote(policy.id));
  const waBtn = document.getElementById('detailWhatsAppBtn'); if (waBtn) waBtn.addEventListener('click', () => sendWhatsApp(policy.id));
  if (activePollings[policy.id]) { showDetailPollingStatus(policy.id, 'Sorgu devam ediyor...'); switchDetailTabByName('quote'); }
  // Load TC query history for Teklif tab (also loads offers + documents for latest query)
  const tcForHistory = policy.tcKimlikNo || policy.vergiNo;
  if (tcForHistory) loadTcQueryHistory(tcForHistory, policy.id);
  else { const hEl = document.getElementById(`tcQueryHistory-${policy.id}`); if (hEl) hEl.innerHTML = '<div style="font-size:0.75rem;color:var(--text-dim);">TC/VKN bilgisi yok — sorgu gecmisi yuklenemez</div>'; }
}
function switchDetailTab(tabEl) {
  const panel = tabEl.closest('#panelDetail') || document.getElementById('panelDetail');
  if (!panel) return;
  const tabName = tabEl.dataset.tab;
  panel.querySelectorAll('.rn-detail-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  panel.querySelectorAll('.rn-detail-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tabPanel === tabName));
}
function switchDetailTabByName(tabName) {
  const panel = document.getElementById('panelDetail'); if (!panel) return;
  const tab = panel.querySelector(`.rn-detail-tab[data-tab="${tabName}"]`);
  if (tab) switchDetailTab(tab);
}
function closeDetailPanel() { selectedPolicyId = null; document.querySelectorAll('.rn-row').forEach(r => r.classList.remove('selected')); showRightPanel('placeholder'); }
function showDetailPollingStatus(policyId, message) { const el = document.getElementById(`detailQuoteStatus-${policyId}`); if (!el) return; el.innerHTML = `<div class="rn-quote-status-bar polling"><div class="rn-pulse-dot"></div><span>${escapeHtml(message)}</span></div>`; }
function showDetailErrorStatus(policyId, message) { const el = document.getElementById(`detailQuoteStatus-${policyId}`); if (!el) return; el.innerHTML = `<div class="rn-quote-status-bar error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${escapeHtml(message)}</span></div>`; }
function showDetailCompletedStatus(policyId, count) { const el = document.getElementById(`detailQuoteStatus-${policyId}`); if (!el) return; el.innerHTML = `<div class="rn-quote-status-bar completed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20,6 9,17 4,12"/></svg><span>${count} teklif alindi</span></div>`; }
function updateDetailOffers(policyId, results) {
  const offersEl = document.getElementById(`detailOffers-${policyId}`); if (!offersEl) return;
  if (!results.quotes || results.quotes.length === 0) return;
  const badge = document.getElementById(`offersCount-${policyId}`);
  if (badge) badge.textContent = results.quotes.length;
  const sorted = [...results.quotes].sort((a, b) => { if (!a.grossPremium && !b.grossPremium) return 0; if (!a.grossPremium) return 1; if (!b.grossPremium) return -1; return a.grossPremium - b.grossPremium; });
  const cheapest = sorted.find(q => q.grossPremium > 0)?.grossPremium;
  const succCnt = sorted.filter(q => q.grossPremium > 0 && q.status !== 'error' && q.status !== 'rejected').length;
  let h = `<div class="rn-offers-header"><span>Teklif Sonuclari</span><span class="rn-offers-count">${succCnt} / ${sorted.length}</span></div>`;
  h += sorted.map(q => {
    const isErr = q.status === 'error', isRej = q.status === 'rejected';
    const isCh = !isErr && !isRej && q.grossPremium > 0 && q.grossPremium === cheapest;
    const cc = isCh ? 'cheapest' : isErr ? 'error' : isRej ? 'rejected' : '';
    // Status badge
    let sb = ''; const pn = q.proposalNo || '';
    if (pn.startsWith('Onay:')) sb = '<span class="rn-offer-status rn-offer-status--onay">&#10003;</span>';
    else if (pn.startsWith('Red:') || isRej) sb = '<span class="rn-offer-status rn-offer-status--red">R</span>';
    else if (pn.startsWith('Belirsiz:')) sb = '<span class="rn-offer-status rn-offer-status--belirsiz">?</span>';
    else if (pn.startsWith('Hata:') || isErr) sb = '<span class="rn-offer-status rn-offer-status--hata">!</span>';
    // Premium display
    let ph;
    if (isErr) ph = '<span class="rn-offer-premium">Hata</span>';
    else if (isRej) ph = '<span class="rn-offer-premium">Red</span>';
    else if (q.grossPremium) ph = `<span class="rn-offer-premium">${formatCurrency(q.grossPremium)}</span>`;
    else ph = '<span class="rn-offer-premium" style="color:var(--text-dim);">...</span>';
    return `<div class="rn-offer ${cc}">${sb}<span class="rn-offer-company">${escapeHtml(q.insuranceCompanyName || '?')}</span>${ph}</div>`;
  }).join('');
  offersEl.innerHTML = h;
}
async function autoFetchQuoteResults(policy) {
  if (!policy.sonWebQueryId || policy.sonSorguProductCode == null) return;
  const pid = policy.id, wqid = policy.sonWebQueryId, pc = policy.sonSorguProductCode;
  const sEl = document.getElementById(`detailQuoteStatus-${pid}`);
  if (sEl) sEl.innerHTML = '<div class="rn-quote-status-bar polling"><div class="rn-pulse-dot"></div><span>Son sorgu sonuclari yukleniyor...</span></div>';
  try {
    const r = await apiGet('policies/quote-results', { webQueryId: wqid, product: pc });
    if (r && r.isSuccessful && r.status === 'error') {
      showDetailErrorStatus(pid, r.errorMessage || 'Sorgu hatali'); updateRowQuoteState(pid, 'error');
    } else if (r && r.isSuccessful && r.quotes && r.quotes.length > 0) {
      updateDetailOffers(pid, r);
      if (r.quoteFilePath) window._lastQuoteFilePaths = { ...(window._lastQuoteFilePaths || {}), [wqid]: r.quoteFilePath };
      if (r.status === 'completed') { const cnt = (r.quotes || []).filter(q => q.grossPremium > 0).length; showDetailCompletedStatus(pid, cnt); window._lastQuoteResults = { ...(window._lastQuoteResults || {}), [pid]: r.quotes || [] }; loadQuoteDocuments(wqid, pc, pid); }
      else { const cnt = (r.quotes || []).filter(q => q.grossPremium > 0).length; showDetailPollingStatus(pid, `${cnt} teklif geldi, bekleniyor...`); updateRowQuoteState(pid, 'polling', cnt); startPollingForPolicy(pid, wqid, pc); }
    }
    else if (sEl) sEl.innerHTML = '';
  } catch (error) { console.error('Auto-fetch error:', error); if (sEl) sEl.innerHTML = ''; }
}

// ============================================================
//  12b. TC QUERY HISTORY (Teklif tab)
// ============================================================
async function loadTcQueryHistory(tc, policyId) {
  const container = document.getElementById(`tcQueryHistory-${policyId}`);
  if (!container) return;
  try {
    const r = await apiGet('policies/tc-query-history', { tc, limit: 5 });
    if (!r || !r.isSuccessful || !r.queries || r.queries.length === 0) {
      container.innerHTML = '<div style="font-size:0.75rem;color:var(--text-dim);">Henuz teklif sorgusu yapilmamis</div>';
      return;
    }
    const productColors = { 0: { bg: 'color-mix(in srgb, var(--info) 15%, transparent)', fg: 'var(--info)' }, 1: { bg: 'color-mix(in srgb, var(--primary) 15%, transparent)', fg: 'var(--primary)' }, 5: { bg: 'color-mix(in srgb, var(--warning) 15%, transparent)', fg: 'var(--warning)' }, 7: { bg: 'color-mix(in srgb, var(--success) 15%, transparent)', fg: 'var(--success)' } };
    let html = `<div style="font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:0.375rem;">Son ${r.queries.length} Sorgu</div>`;
    r.queries.forEach((q, idx) => {
      // Use guncellemeTarihi (DATETIME) when available, fallback to eklenmeTarihi (DATE — may lack time)
      const dt = new Date(q.guncellemeTarihi || q.eklenmeTarihi);
      const dateStr = dt.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const ago = timeAgo(dt);
      const pc = productColors[q.productCode] || { bg: 'color-mix(in srgb, var(--text-dim) 15%, transparent)', fg: 'var(--text-dim)' };
      const isActive = idx === 0;
      // Extra info for health queries: ağ tipi + toplam kişi sayısı
      let extraInfo = '';
      if (q.productCode === 7) {
        const agLabel = q.agTipi === 1 ? 'Genis' : q.agTipi === 2 ? 'Dar' : '';
        const toplamKisi = 1 + (q.ekSigortaliSayisi || 0); // 1 (asıl sigortalı) + ek sigortalılar
        const parts = [];
        if (agLabel) parts.push(agLabel);
        parts.push(toplamKisi + ' kisi');
        extraInfo = `<span class="rn-qh-extra">${parts.join(' / ')}</span>`;
      }
      html += `<div class="rn-qh-entry${isActive ? ' rn-qh-entry--latest' : ''}" data-wqid="${q.webQueryId}" data-product="${q.productCode}" onclick="loadQueryResult(${q.webQueryId}, ${q.productCode}, ${policyId})" title="Tiklayarak sonuclari yukle">`;
      html += `<span class="rn-type-pill" style="background:${pc.bg};color:${pc.fg};font-size:0.5625rem;padding:0.125rem 0.375rem;">${escapeHtml(q.productName || '')}</span>`;
      if (extraInfo) html += extraInfo;
      html += `<span class="rn-qh-date">${dateStr}</span>`;
      if (ago) html += `<span class="rn-qh-ago">${ago}</span>`;
      html += `<span class="rn-qh-id">ID:${q.webQueryId}</span>`;
      html += '</div>';
    });
    container.innerHTML = html;
    // Auto-load the latest query result (offers + documents)
    if (r.queries.length > 0) {
      const latest = r.queries[0];
      loadQueryResult(latest.webQueryId, latest.productCode, policyId);
    }
  } catch (err) {
    console.error('TC query history error:', err);
    container.innerHTML = '<div style="font-size:0.75rem;color:var(--text-dim);">Sorgu gecmisi yuklenemedi</div>';
  }
}
async function loadQueryResult(webQueryId, productCode, policyId) {
  // Highlight active entry
  const container = document.getElementById(`tcQueryHistory-${policyId}`);
  if (container) container.querySelectorAll('.rn-qh-entry').forEach(e => e.classList.toggle('rn-qh-entry--active', parseInt(e.dataset.wqid) === webQueryId));
  // Show loading
  showDetailPollingStatus(policyId, 'Sonuclar yukleniyor...');
  try {
    const r = await apiGet('policies/quote-results', { webQueryId, product: productCode });
    if (!r || !r.isSuccessful) { showDetailErrorStatus(policyId, 'Sonuc alinamadi'); return; }
    if (r.status === 'error') {
      showDetailErrorStatus(policyId, r.errorMessage || 'Sorgu hatali');
    } else if (r.status === 'completed') {
      const cnt = (r.quotes || []).filter(q => q.grossPremium > 0).length;
      showDetailCompletedStatus(policyId, cnt);
    } else if (r.status === 'in_progress') {
      showDetailPollingStatus(policyId, 'Teklif isleniyor...');
    } else {
      const el = document.getElementById(`detailQuoteStatus-${policyId}`);
      if (el) el.innerHTML = '';
    }
    updateDetailOffers(policyId, r);
    // Load documents for this query too
    loadQuoteDocuments(webQueryId, productCode, policyId);
  } catch (err) {
    console.error('loadQueryResult error:', err);
    showDetailErrorStatus(policyId, 'Sonuc yuklenemedi');
  }
}

// ============================================================
//  13. DOCUMENT SHARING
// ============================================================
// Track active document poll so we can cancel when switching queries
let _activeDocPollId = null;
async function loadQuoteDocuments(webQueryId, productCode, policyId) {
  const container = document.getElementById(`detailDocuments-${policyId}`);
  if (!container) return [];
  // Cancel any previous document polling
  if (_activeDocPollId) { clearInterval(_activeDocPollId); _activeDocPollId = null; }
  container.innerHTML = '';
  const docs = await fetchQuoteDocuments(webQueryId, productCode, policyId, container);
  if (docs.length > 0) return docs;
  // Only poll for docs if this is a recent/active query (within 10 min)
  const isRecentQuery = activePollings[policyId];
  if (!isRecentQuery) { container.innerHTML = ''; return []; }
  container.innerHTML = '<div style="font-size:0.75rem;color:var(--text-dim);"><div class="rn-pulse-dot" style="display:inline-block;vertical-align:middle;margin-right:6px;"></div>Raporlar bekleniyor...</div>';
  let docAttempts = 0;
  _activeDocPollId = setInterval(async () => {
    docAttempts++;
    const result = await fetchQuoteDocuments(webQueryId, productCode, policyId, container);
    if (result.length > 0 || docAttempts >= 18) {
      clearInterval(_activeDocPollId); _activeDocPollId = null;
      if (result.length === 0) container.innerHTML = '';
    }
  }, 10000);
  return [];
}
async function fetchQuoteDocuments(webQueryId, productCode, policyId, container) {
  try {
    const result = await apiGet('policies/quote-documents', { webQueryId, product: productCode });
    let docs = (result && result.isSuccessful && result.documents) ? result.documents : [];
    // Fallback: use quoteFilePath from GetQuoteDetail response
    if (docs.length === 0) {
      const fp = (window._lastQuoteFilePaths || {})[webQueryId];
      if (fp) docs = [{ id: 0, cinsi: 3, cinsiLabel: 'Karsilastirma Tablosu', fileUrl: fp, sigortaSirketi: '', eklenmeTarihi: new Date().toISOString() }];
    }
    if (docs.length === 0) return [];
    if (container) {
      renderDocuments(container, docs, policyId);
      const mainUrl = docs[0]?.fileUrl;
      if (mainUrl) {
        window._lastDocUrl = mainUrl;
        const copyBtn = document.getElementById(`copyLinkBtn-${policyId}`);
        if (copyBtn) copyBtn.style.display = '';
      }
    }
    return docs;
  } catch (err) { console.error('Fetch documents error:', err); return []; }
}
function renderDocuments(container, documents, policyId) {
  let html = '';
  documents.forEach(doc => {
    html += `<div class="rn-doc-item"><svg class="rn-doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg><span class="rn-doc-name">${escapeHtml(doc.cinsiLabel || 'Dosya')}</span><div class="rn-doc-actions"><button class="rn-share-btn" onclick="downloadDocument('${escapeHtml(doc.fileUrl)}')" title="Indir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button><button class="rn-share-btn" onclick="copyDocumentLink('${escapeHtml(doc.fileUrl)}')" title="Link Kopyala"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></div></div>`;
  });
  container.innerHTML = html;
}
function downloadDocument(url) { window.open(url, '_blank'); }
function copyDocumentLink(url) {
  navigator.clipboard.writeText(url).then(() => { showToast('Link kopyalandi', 'success'); }).catch(() => {
    const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('Link kopyalandi', 'success');
  });
}
async function uploadToDrive(url, fileName, policyId) {
  showToast('Drive\'a yukleniyor...', 'info');
  try { const r = await apiPost('drive/upload-url', { url, fileName }); if (r && r.success) showToast('Drive\'a yuklendi', 'success'); else showToast(r?.errorMessage || 'Drive yukleme hatasi', 'error'); }
  catch (err) { console.error('Drive upload error:', err); showToast('Drive yukleme hatasi', 'error'); }
}

// ============================================================
//  14. QUOTE CREATION FLOW
// ============================================================
async function createQuote(policyId) {
  const policy = allPolicies.find(p => p.id === policyId);
  if (!policy) { showToast('Police bulunamadi', 'error'); return; }
  if (!policy.tcKimlikNo && !policy.vergiNo) { openTcAssignModal(policy); return; }
  const quoteType = resolveQuoteType(policy.policeTuru);
  if (!quoteType) { showToast(`"${policy.policeTuru}" turu icin teklif destegi henuz mevcut degil`, 'warning'); return; }
  if (!policy.musteriId) {
    try {
      const np = splitName(policy.sigortaliAdi);
      const r = await apiPost('customers/ensure', { tcKimlikNo: policy.tcKimlikNo || null, vergiNo: policy.vergiNo || null, adi: np.adi, soyadi: np.soyadi, gsm: policy.cepTelefonu ? String(policy.cepTelefonu) : null, policeId: policy.id });
      if (r && r.success) { policy.musteriId = r.customerId; showToast(`${r.isNew ? 'Musteri karti olusturuldu' : 'Mevcut musteri karti baglandi'}: ${r.customerName || ''}`, 'success'); }
    } catch (err) { console.error('Ensure customer error:', err); }
  }
  // Araç bazlı tekliflerde eksik bilgi kontrolü — popup ile sor
  const isVehicle = ['traffic', 'casco', 'imm'].includes(quoteType);
  if (isVehicle) {
    const missing = [];
    if (!policy.dogumTarihi) missing.push('dogumTarihi');
    if (!policy.cepTelefonu && !policy.musteriGsm) missing.push('telefon');
    if (missing.length > 0) { openMissingInfoModal(policy, quoteType, missing); return; }
  }
  proceedWithQuote(policy, quoteType);
}
function splitName(fullName) { if (!fullName) return { adi: null, soyadi: null }; const p = fullName.trim().split(/\s+/); if (p.length <= 1) return { adi: p[0] || null, soyadi: null }; return { adi: p.slice(0, -1).join(' '), soyadi: p[p.length - 1] }; }

// ============================================================
//  14b. MISSING INFO MODAL (Eksik müşteri bilgileri popup)
// ============================================================
let _missingInfoContext = null;
function openMissingInfoModal(policy, quoteType, missingFields) {
  _missingInfoContext = { policy, quoteType, missingFields };
  const modal = document.getElementById('missingInfoModal');
  document.getElementById('missingInfoSubtitle').textContent = `${policy.sigortaliAdi || 'Isimsiz'}${policy.plaka ? ' | ' + policy.plaka : ''}`;
  let fieldsHtml = '';
  if (missingFields.includes('dogumTarihi')) {
    fieldsHtml += `<div class="modal-field" style="margin-top:1rem;"><label class="modal-label">Dogum Tarihi</label><input type="date" id="missingDogumTarihi" class="modal-input"></div>`;
  }
  if (missingFields.includes('telefon')) {
    fieldsHtml += `<div class="modal-field" style="margin-top:0.75rem;"><label class="modal-label">Cep Telefonu</label><input type="text" id="missingTelefon" class="modal-input" placeholder="5XX XXX XX XX" maxlength="11" inputmode="numeric"></div>`;
  }
  document.getElementById('missingInfoFields').innerHTML = fieldsHtml;
  modal.classList.add('show');
  const firstInput = modal.querySelector('input'); if (firstInput) setTimeout(() => firstInput.focus(), 100);
}
function closeMissingInfoModal() { document.getElementById('missingInfoModal').classList.remove('show'); _missingInfoContext = null; }
async function submitWithMissingInfo(saveToCustomer) {
  if (!_missingInfoContext) return;
  const { policy, quoteType, missingFields } = _missingInfoContext;
  const btn = document.getElementById('btnSaveMissing');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  try {
    // Girilen değerleri topla
    const dogumEl = document.getElementById('missingDogumTarihi');
    const telEl = document.getElementById('missingTelefon');
    const dogum = dogumEl ? dogumEl.value : null;
    const tel = telEl ? telEl.value.trim() : null;

    // Müşteri kartına kaydet
    if (saveToCustomer && policy.musteriId) {
      const updateData = {};
      if (dogum) updateData.dogumTarihi = dogum;
      if (tel) updateData.gsm = tel;
      if (Object.keys(updateData).length > 0) {
        try {
          const r = await apiPut(`customers/${policy.musteriId}`, updateData);
          if (r && r.success) {
            if (dogum) policy.dogumTarihi = dogum;
            if (tel) { policy.musteriGsm = tel; if (!policy.cepTelefonu) policy.cepTelefonu = tel; }
            showToast('Musteri bilgileri guncellendi', 'success');
          } else { showToast(r?.errorMessage || 'Musteri guncelenemedi', 'warning'); }
        } catch (err) { console.error('Customer update error:', err); }
      }
    }
    closeMissingInfoModal();
    proceedWithQuote(policy, quoteType);
  } catch (error) { console.error('Missing info submit error:', error); showToast('Hata olustu', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Kaydet ve Teklif Calis'; }
}

function proceedWithQuote(policy, quoteType) {
  currentQuotePolicyId = policy.id; currentQuoteType = quoteType;
  const ef = NEEDS_EXTRA_FORM[quoteType];
  if (ef === 'daskHouse') openDaskHouseForm(policy, quoteType);
  else if (ef === 'tss') openTssForm(policy);
  else submitQuote(policy.id, quoteType, {});
}

// ============================================================
//  15. TC ASSIGN MODAL
// ============================================================
function openTcAssignModal(policy) {
  currentQuotePolicyId = policy.id;
  const modal = document.getElementById('tcAssignModal');
  document.getElementById('tcAssignSubtitle').textContent = `${policy.sigortaliAdi || 'Isimsiz'}${policy.plaka ? ' | ' + policy.plaka : ''} | ${policy.policeNumarasi || ''}`;
  document.getElementById('tcAssignInput').value = ''; document.getElementById('vknAssignInput').value = '';
  const cld = document.getElementById('tcAssignCustomerLink');
  if (policy.musteriId) { cld.style.display = 'flex'; document.getElementById('tcAssignCustomerDetailLink').href = `../customers/detail.html?id=${policy.musteriId}`; } else cld.style.display = 'none';
  modal.classList.add('show'); setTimeout(() => document.getElementById('tcAssignInput').focus(), 100);
}
function closeTcAssignModal() { document.getElementById('tcAssignModal').classList.remove('show'); }
async function saveAndQuote() {
  const tc = document.getElementById('tcAssignInput').value.trim(), vkn = document.getElementById('vknAssignInput').value.trim();
  if (!tc && !vkn) { showToast('TC Kimlik No veya Vergi No giriniz', 'warning'); return; }
  if (tc && (tc.length !== 11 || !/^\d+$/.test(tc))) { showToast('TC Kimlik No 11 haneli ve sadece rakamlardan olusmalidir', 'warning'); return; }
  if (vkn && (vkn.length !== 10 || !/^\d+$/.test(vkn))) { showToast('Vergi No 10 haneli ve sadece rakamlardan olusmalidir', 'warning'); return; }
  const policyId = currentQuotePolicyId, btn = document.getElementById('btnSaveAndQuote');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  try {
    const ar = await apiPost(`policies/${policyId}/assign-tc`, { policyId, tcKimlikNo: tc || null, vergiNo: vkn || null });
    if (!ar || !ar.success) { showToast(ar?.errorMessage || 'TC atamasi basarisiz', 'error'); btn.disabled = false; btn.textContent = 'Kaydet ve Teklif Calis'; return; }
    const policy = allPolicies.find(p => p.id === policyId);
    if (policy) { if (tc) policy.tcKimlikNo = tc; if (vkn) policy.vergiNo = vkn; if (ar.musteriId) policy.musteriId = ar.musteriId; }
    showToast(`TC/VKN kaydedildi${ar.cascadeUpdated > 0 ? ` (${ar.cascadeUpdated} ek police guncellendi)` : ''}`, 'success');
    closeTcAssignModal();
    if (policy) {
      if (!policy.musteriId) { try { const np = splitName(policy.sigortaliAdi); const er = await apiPost('customers/ensure', { tcKimlikNo: policy.tcKimlikNo || null, vergiNo: policy.vergiNo || null, adi: np.adi, soyadi: np.soyadi, gsm: policy.cepTelefonu ? String(policy.cepTelefonu) : null, policeId: policy.id }); if (er && er.success) { policy.musteriId = er.customerId; showToast(`${er.isNew ? 'Musteri karti olusturuldu' : 'Mevcut musteri karti baglandi'}: ${er.customerName || ''}`, 'success'); } } catch (err) { console.error('Ensure customer error:', err); } }
      const qt = resolveQuoteType(policy.policeTuru); if (qt) proceedWithQuote(policy, qt);
    }
  } catch (error) { console.error('TC assign error:', error); showToast('TC atamasi sirasinda hata olustu', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Kaydet ve Teklif Calis'; }
}

// ============================================================
//  16. QUOTE SUBMISSION & POLLING
// ============================================================
async function submitQuote(policyId, quoteType, extraData) {
  const policy = allPolicies.find(p => p.id === policyId); if (!policy) return;
  const phone = getGlobalPhone();
  if (!phone) { showToast('Gecerli bir telefon numarasi giriniz (5 ile baslayan 10 hane)', 'warning'); togglePhonePopover(); document.getElementById('quotePhoneNumber')?.focus(); return; }
  selectPolicyForDetail(policyId);
  // Eski teklif sonuclarini temizle — yeni sorgu basliyor
  const offersEl = document.getElementById(`detailOffers-${policyId}`); if (offersEl) offersEl.innerHTML = '';
  delete realtimeQuotes[policyId];
  showDetailPollingStatus(policyId, 'Teklif sorgusu gonderiliyor...');
  updateRowQuoteState(policyId, 'sending');
  const btn = document.getElementById('detailQuoteBtn'); if (btn) { btn.disabled = true; btn.textContent = 'Gonderiliyor...'; }
  try {
    const response = await apiPost(`policies/${policyId}/create-quote`, { quoteType, cepTelefonu: phone, ...extraData });
    // Uyarıları her durumda göster (erken dönüşlerden önce)
    if (response && response.warnings && response.warnings.length > 0) { response.warnings.forEach(w => showToast(w, 'warning', 6000)); }
    if (!response || !response.isSuccessful) { showDetailErrorStatus(policyId, response?.message || 'Teklif gonderilemedi'); updateRowQuoteState(policyId, 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Teklif Calis'; } return; }
    if (!response.webQueryId) { showDetailErrorStatus(policyId, response.message || 'Sorgu kuyruga alindi ancak henuz ID atanamadi.'); updateRowQuoteState(policyId, 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Teklif Calis'; } return; }
    showToast('Teklif sorgusu baslatildi', 'success'); showDetailPollingStatus(policyId, 'Sigorta sirketlerinden teklifler bekleniyor...'); switchDetailTabByName('quote');
    const productCode = PRODUCT_CODE_MAP[quoteType] ?? 0;
    activeWebQueryIds[response.webQueryId] = policyId; startQuoteTracking(policyId, response.webQueryId, productCode);
    policy.sonWebQueryId = response.webQueryId; policy.sonSorguProductCode = productCode; policy.sonSorguTarihi = new Date().toISOString();
    if (policy.yenilemeDurumu === 0) updateRenewalStatus(policyId, 2);
    if (!policyQueryLog[policyId]) policyQueryLog[policyId] = [];
    policyQueryLog[policyId].push({ timestamp: new Date().toISOString(), quoteType, webQueryId: response.webQueryId, productCode, resultCount: null, bestPremium: null });
  } catch (error) { console.error('Quote submission error:', error); showDetailErrorStatus(policyId, 'Teklif gonderilirken bir hata olustu'); updateRowQuoteState(policyId, 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Teklif Calis'; } }
}
function startPollingForPolicy(policyId, webQueryId, productCode) {
  stopPollingForPolicy(policyId); const maxAttempts = 60; let attempts = 0;
  fetchAndUpdateDetailOffers(policyId, webQueryId, productCode);
  const intervalId = setInterval(async () => {
    attempts++; const shouldStop = await fetchAndUpdateDetailOffers(policyId, webQueryId, productCode);
    if (shouldStop || attempts >= maxAttempts) { stopPollingForPolicy(policyId); if (attempts >= maxAttempts) { showDetailErrorStatus(policyId, 'Zaman asimi'); updateRowQuoteState(policyId, 'error'); } const b = document.getElementById('detailQuoteBtn'); if (b) { b.disabled = false; b.textContent = 'Teklif Calis'; } }
  }, 5000);
  activePollings[policyId] = { intervalId, webQueryId, productCode, attempts: 0 };
}
function stopPollingForPolicy(policyId) { if (activePollings[policyId]) { clearInterval(activePollings[policyId].intervalId); delete activePollings[policyId]; } }
async function fetchAndUpdateDetailOffers(policyId, webQueryId, productCode) {
  try {
    const r = await apiGet('policies/quote-results', { webQueryId, product: productCode }); if (!r || !r.isSuccessful) return false;
    // Sorgu hatali ise polling'i durdur ve hata goster
    if (r.status === 'error') {
      showDetailErrorStatus(policyId, r.errorMessage || 'Sorgu hatali');
      updateRowQuoteState(policyId, 'error');
      const b = document.getElementById('detailQuoteBtn'); if (b) { b.disabled = false; b.textContent = 'Teklif Calis'; }
      return true; // polling'i durdur
    }
    updateDetailOffers(policyId, r);
    // Store quoteFilePath from API response for document sharing fallback
    if (r.quoteFilePath) window._lastQuoteFilePaths = { ...(window._lastQuoteFilePaths || {}), [webQueryId]: r.quoteFilePath };
    if (r.status === 'in_progress') {
      const cnt = (r.quotes || []).filter(q => q.grossPremium > 0).length;
      showDetailPollingStatus(policyId, `${cnt} teklif geldi, bekleniyor...`);
      updateRowQuoteState(policyId, 'polling', cnt);
    }
    if (r.status === 'completed') {
      const cnt = (r.quotes || []).filter(q => q.grossPremium > 0).length; showDetailCompletedStatus(policyId, cnt);
      updateRowQuoteState(policyId, 'completed', cnt);
      const b = document.getElementById('detailQuoteBtn'); if (b) { b.disabled = false; b.textContent = 'Teklif Calis'; }
      const le = policyQueryLog[policyId]; if (le && le.length > 0) { const last = le[le.length - 1]; if (last.resultCount === null) { last.resultCount = (r.quotes || []).length; const vp = (r.quotes || []).filter(q => q.grossPremium > 0).map(q => q.grossPremium); last.bestPremium = vp.length > 0 ? Math.min(...vp) : null; } }
      // Store latest quote results for sharing
      window._lastQuoteResults = { ...(window._lastQuoteResults || {}), [policyId]: r.quotes || [] };
      loadQuoteDocuments(webQueryId, productCode, policyId);
    }
    return r.status === 'completed';
  } catch (error) { console.error('Polling error for policy', policyId, error); return false; }
}

// ============================================================
//  17. SSE REAL-TIME
// ============================================================
function connectQuoteStream() {
  if (quoteEventSource) { quoteEventSource.close(); quoteEventSource = null; }
  const token = APP_CONFIG.AUTH.getToken(); if (!token) { updateConnectionIndicator('disconnected'); return; }
  const url = `${APP_CONFIG.API.getUrl('policies/quote-stream')}?access_token=${encodeURIComponent(token)}`;
  quoteEventSource = new EventSource(url);
  quoteEventSource.addEventListener('connected', (e) => { try { const d = JSON.parse(e.data); console.log('SSE: connected userId:', d.userId); updateConnectionIndicator('connected'); const aq = Object.keys(activeWebQueryIds); if (aq.length > 0) aq.forEach(wq => { const pid = activeWebQueryIds[wq]; const p = allPolicies.find(x => x.id === pid); fetchAndUpdateDetailOffers(pid, parseInt(wq), p ? (p.sonSorguProductCode ?? 0) : 0); }); } catch (err) { updateConnectionIndicator('connected'); } });
  quoteEventSource.addEventListener('quote-result', (e) => { try { handleRealtimeQuoteResult(JSON.parse(e.data)); } catch (err) {} });
  quoteEventSource.addEventListener('quote-completed', (e) => { try { handleQuoteCompleted(JSON.parse(e.data)); } catch (err) {} });
  quoteEventSource.addEventListener('quote-error', (e) => { try { handleQuoteError(JSON.parse(e.data)); } catch (err) {} });
  quoteEventSource.addEventListener('heartbeat', () => { updateConnectionIndicator('connected'); });
  quoteEventSource.onerror = () => {
    if (quoteEventSource && quoteEventSource.readyState === EventSource.CLOSED) {
      updateConnectionIndicator('reconnecting');
      setTimeout(async () => { try { const ok = await APP_CONFIG.AUTH.refreshToken(); if (ok) connectQuoteStream(); else updateConnectionIndicator('disconnected'); } catch (err) { updateConnectionIndicator('disconnected'); } }, 3000);
    } else updateConnectionIndicator('reconnecting');
  };
}
function disconnectQuoteStream() { if (quoteEventSource) { quoteEventSource.close(); quoteEventSource = null; } updateConnectionIndicator('disconnected'); }
function updateConnectionIndicator(status) {
  const dot = document.getElementById('sseConnectionDot'), text = document.getElementById('sseConnectionText'); if (!dot) return;
  dot.classList.remove('connected', 'reconnecting');
  if (status === 'connected') { dot.classList.add('connected'); if (text) text.textContent = 'Canli'; }
  else if (status === 'reconnecting') { dot.classList.add('reconnecting'); if (text) text.textContent = 'Yeniden baglaniliyor'; }
  else { if (text) text.textContent = 'Baglanti yok'; }
}
function handleRealtimeQuoteResult(result) {
  const policy = allPolicies.find(p => p.sonWebQueryId === result.webQueryId); if (!policy) return;
  const pid = policy.id; if (!realtimeQuotes[pid]) realtimeQuotes[pid] = [];
  const existing = realtimeQuotes[pid].find(q => q.insuranceCompanyName === result.insuranceCompanyName);
  if (existing) Object.assign(existing, result); else realtimeQuotes[pid].push(result);
  if (selectedPolicyId === pid) appendOrUpdateOffer(pid, result);
  updateRowQuoteBadge(pid, realtimeQuotes[pid].length);
  showDetailPollingStatus(pid, `${realtimeQuotes[pid].filter(q => q.grossPremium > 0).length} teklif geldi, bekleniyor...`);
}
function handleQuoteCompleted(data) {
  const policy = allPolicies.find(p => p.sonWebQueryId === data.webQueryId); if (!policy) return;
  const pid = policy.id, cnt = realtimeQuotes[pid]?.filter(q => q.grossPremium > 0).length || 0;
  showDetailCompletedStatus(pid, cnt); stopPollingForPolicy(pid); delete activeWebQueryIds[data.webQueryId];
  const b = document.getElementById('detailQuoteBtn'); if (b) { b.disabled = false; b.textContent = 'Teklif Calis'; }
  showToast(`${cnt} teklif tamamlandi`, 'success');
  // Reload documents — the API generates comparison PDFs after quote completion
  loadQuoteDocuments(data.webQueryId, policy.sonSorguProductCode || 0, pid);
}
function handleQuoteError(data) {
  const msg = data.description || data.message || 'Teklif sorgusunda hata olustu'; showToast(msg, 'error');
  if (data.webQueryId) { const p = allPolicies.find(x => x.sonWebQueryId === data.webQueryId); if (p) showDetailErrorStatus(p.id, msg); }
}
function appendOrUpdateOffer(policyId, result) {
  const offersEl = document.getElementById(`detailOffers-${policyId}`); if (!offersEl) return;
  if (!offersEl.querySelector('.rn-rt-offers-header')) offersEl.innerHTML = `<div class="rn-rt-offers-header"><span>Teklif Sonuclari</span><span class="rn-rt-offers-count" id="offersCount-${policyId}">0</span></div>`;
  const offerHtml = createOfferCard(result);
  const ec = offersEl.querySelector(`[data-company="${CSS.escape(result.insuranceCompanyName)}"]`);
  if (ec) { ec.outerHTML = offerHtml; } else {
    const cards = [...offersEl.querySelectorAll('.rn-rt-offer')];
    const ib = cards.find(c => parseFloat(c.dataset.premium || '999999') > (result.grossPremium || 999999));
    const tmp = document.createElement('div'); tmp.innerHTML = offerHtml; const nc = tmp.firstElementChild;
    nc.style.opacity = '0'; nc.style.transform = 'translateY(-10px)';
    if (ib) offersEl.insertBefore(nc, ib); else offersEl.appendChild(nc);
    requestAnimationFrame(() => { nc.style.transition = 'opacity 0.3s, transform 0.3s'; nc.style.opacity = '1'; nc.style.transform = 'translateY(0)'; });
  }
  const ce = document.getElementById(`offersCount-${policyId}`);
  if (ce) { const t = offersEl.querySelectorAll('.rn-rt-offer').length; const s = offersEl.querySelectorAll('.rn-rt-offer:not(.error):not(.rejected)').length; ce.textContent = `${s} / ${t}`; }
}
function createOfferCard(result) {
  const prem = result.grossPremium > 0 ? formatCurrency(result.grossPremium) : '<span style="color:var(--text-dim)">Ret</span>';
  const sc = result.status === 'rejected' ? 'rejected' : result.status === 'error' ? 'error' : '';
  return `<div class="rn-rt-offer ${sc}" data-company="${escapeHtml(result.insuranceCompanyName)}" data-premium="${result.grossPremium || 999999}"><div class="rn-rt-offer-company">${escapeHtml(result.insuranceCompanyName)}</div><div class="rn-rt-offer-premium">${prem}</div>${result.proposalNo ? `<div class="rn-rt-offer-proposal">${escapeHtml(result.proposalNo)}</div>` : ''}${result.description ? `<div class="rn-rt-offer-desc">${escapeHtml(result.description)}</div>` : ''}</div>`;
}
function updateRowQuoteBadge(policyId, count) {
  if (count <= 0) return; const row = document.querySelector(`.rn-row[data-id="${policyId}"]`); if (!row) return;
  const ac = row.querySelector('.rn-actions'); if (!ac) return;
  let badge = ac.querySelector('.rn-quote-count-badge');
  if (!badge) { badge = document.createElement('span'); badge.className = 'rn-quote-count-badge'; badge.style.cssText = 'font-size:0.625rem;padding:1px 6px;border-radius:9999px;background:var(--primary);color:white;font-weight:700;margin-left:0.25rem;'; ac.appendChild(badge); }
  badge.textContent = count;
}
function updateRowQuoteState(policyId, state, count) {
  const row = document.querySelector(`.rn-row[data-id="${policyId}"]`); if (!row) return;
  const ac = row.querySelector('.rn-actions'); if (!ac) return;
  let indicator = ac.querySelector('.rn-row-quote-state');
  if (!indicator) { indicator = document.createElement('div'); indicator.className = 'rn-row-quote-state'; ac.prepend(indicator); }
  if (state === 'sending') {
    indicator.innerHTML = '<div class="rn-pulse-dot"></div>';
    indicator.title = 'Teklif gonderiliyor...';
    row.classList.add('quoting');
  } else if (state === 'polling') {
    indicator.innerHTML = `<div class="rn-pulse-dot"></div><span class="rn-row-quote-count">${count || ''}</span>`;
    indicator.title = `${count || 0} teklif geldi, bekleniyor...`;
    row.classList.add('quoting');
  } else if (state === 'completed') {
    indicator.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="3" width="12" height="12"><polyline points="20,6 9,17 4,12"/></svg><span class="rn-row-quote-count">${count || ''}</span>`;
    indicator.title = `${count || 0} teklif alindi`;
    row.classList.remove('quoting');
    setTimeout(() => { indicator.remove(); row.classList.remove('quoting'); }, 10000);
  } else if (state === 'error') {
    indicator.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="3" width="12" height="12"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>';
    indicator.title = 'Teklif hatasi';
    row.classList.remove('quoting');
    setTimeout(() => { indicator.remove(); }, 10000);
  } else { indicator.remove(); row.classList.remove('quoting'); }
}
function startQuoteTracking(policyId, webQueryId, productCode) {
  activeWebQueryIds[webQueryId] = policyId;
  showDetailPollingStatus(policyId, 'Sigorta sirketlerinden teklifler bekleniyor...');
  // Her zaman polling baslat — SSE bonus hiz saglar ama SignalR event'leri her zaman gelmeyebilir
  startPollingForPolicy(policyId, webQueryId, productCode);
}

// ============================================================
//  18. DASK / KONUT FORM
// ============================================================
function openDaskHouseForm(policy, quoteType) {
  const modal = document.getElementById('daskHouseFormModal'), title = document.getElementById('daskHouseFormTitle');
  const konutFields = modal.querySelectorAll('.konut-only');
  const daskOnlyFields = [document.getElementById('daskKullanimSekliField'), document.getElementById('daskPoliceNoField')];
  if (quoteType === 'house') { title.textContent = 'Konut Sigortasi — Ek Bilgiler'; konutFields.forEach(f => f.style.display = 'block'); daskOnlyFields.forEach(f => { if (f) f.style.display = 'none'; }); }
  else { title.textContent = 'DASK — Ek Bilgiler'; konutFields.forEach(f => f.style.display = 'none'); daskOnlyFields.forEach(f => { if (f) f.style.display = 'block'; }); }
  ['daskBinaAdresi','daskUAVTKodu','daskBrutM2','daskInsaatYili','daskToplamKat','daskBulunduguKat','daskYapiTarzi','daskKullanimSekli','daskMevcutPoliceNo','daskBinaBeyanDegeri','daskEsyaBeyanDegeri'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  modal.classList.add('show');
}
function closeDaskHouseForm() { document.getElementById('daskHouseFormModal').classList.remove('show'); }
function submitDaskHouseQuote() {
  const qt = currentQuoteType, pid = currentQuotePolicyId;
  if (qt === 'dask') { closeDaskHouseForm(); submitQuote(pid, qt, { daskData: { binaAdresi: document.getElementById('daskBinaAdresi').value||null, uavtKodu: document.getElementById('daskUAVTKodu').value||null, brutM2: parseFloat(document.getElementById('daskBrutM2').value)||null, binaInsaatYili: parseInt(document.getElementById('daskInsaatYili').value)||null, toplamKatSayisi: parseInt(document.getElementById('daskToplamKat').value)||null, bulunduguKat: parseInt(document.getElementById('daskBulunduguKat').value)||null, yapiTarzi: parseInt(document.getElementById('daskYapiTarzi').value)||null, kullanimSekli: parseInt(document.getElementById('daskKullanimSekli').value)||null, mevcutPoliceNo: document.getElementById('daskMevcutPoliceNo').value||null } }); }
  else if (qt === 'house') { closeDaskHouseForm(); submitQuote(pid, qt, { houseData: { binaAdresi: document.getElementById('daskBinaAdresi').value||null, uavtKodu: document.getElementById('daskUAVTKodu').value||null, brutM2: parseFloat(document.getElementById('daskBrutM2').value)||null, binaInsaatYili: parseInt(document.getElementById('daskInsaatYili').value)||null, toplamKatSayisi: parseInt(document.getElementById('daskToplamKat').value)||null, bulunduguKat: parseInt(document.getElementById('daskBulunduguKat').value)||null, yapiTarzi: parseInt(document.getElementById('daskYapiTarzi').value)||null, binaBeyanDegeri: parseFloat(document.getElementById('daskBinaBeyanDegeri').value)||null, esyaBeyanDegeri: parseFloat(document.getElementById('daskEsyaBeyanDegeri').value)||null } }); }
}

// ============================================================
//  19. TSS FORM
// ============================================================
async function openTssForm(policy) {
  const modal = document.getElementById('tssFormModal');
  ['tssDogumTarihi','tssBoy','tssKilo','tssAgTipi','tssPlanTipi'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const dt = document.getElementById('tssDogumTeminati'); if (dt) dt.checked = false;
  modal.querySelectorAll('.tss-customer-note').forEach(el => el.remove());
  ['tssDogumTarihi','tssBoy','tssKilo'].forEach(id => { const el = document.getElementById(id); if (el) el.closest('.modal-field').style.display = ''; });
  modal._customerFields = {};
  if (policy.musteriId) {
    try {
      const c = await apiGet(`customers/${policy.musteriId}`);
      if (c) { const hl = [];
        if (c.dogumTarihi) { document.getElementById('tssDogumTarihi').closest('.modal-field').style.display = 'none'; modal._customerFields.dogumTarihi = c.dogumTarihi; hl.push('Dogum Tarihi (' + formatDate(c.dogumTarihi) + ')'); }
        if (c.boy) { document.getElementById('tssBoy').closest('.modal-field').style.display = 'none'; modal._customerFields.boy = c.boy; hl.push('Boy (' + c.boy + ' cm)'); }
        if (c.kilo) { document.getElementById('tssKilo').closest('.modal-field').style.display = 'none'; modal._customerFields.kilo = c.kilo; hl.push('Kilo (' + c.kilo + ' kg)'); }
        if (hl.length > 0) { const desc = modal.querySelector('.modal-description'); const note = document.createElement('div'); note.className = 'tss-customer-note'; note.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg> ${hl.join(', ')} — musteri kartindan alinacak`; desc.after(note); }
      }
    } catch (e) { console.warn('Musteri bilgisi alinamadi:', e); }
  }
  modal.classList.add('show');
  const ff = modal._customerFields.dogumTarihi ? document.getElementById('tssAgTipi') : document.getElementById('tssDogumTarihi');
  setTimeout(() => ff?.focus(), 100);
}
function closeTssForm() { document.getElementById('tssFormModal').classList.remove('show'); }
function submitTssQuote() {
  const modal = document.getElementById('tssFormModal'), cf = modal._customerFields || {};
  const dT = document.getElementById('tssDogumTarihi').value;
  if (!cf.dogumTarihi && !dT) { showToast('Dogum tarihi zorunludur', 'warning'); return; }
  const extraData = { tssData: { dogumTarihi: cf.dogumTarihi ? null : dT, boy: cf.boy ? null : (document.getElementById('tssBoy').value || null), kilo: cf.kilo ? null : (document.getElementById('tssKilo').value || null), agTipi: parseInt(document.getElementById('tssAgTipi').value) || null, planTipi: parseInt(document.getElementById('tssPlanTipi').value) || null, dogumTeminati: document.getElementById('tssDogumTeminati').checked || null } };
  const policy = allPolicies.find(p => p.id === currentQuotePolicyId);
  if (policy && policy.musteriId) {
    const cu = {}; if (!cf.dogumTarihi && dT) cu.dogumTarihi = dT; if (!cf.boy && document.getElementById('tssBoy').value) cu.boy = parseInt(document.getElementById('tssBoy').value); if (!cf.kilo && document.getElementById('tssKilo').value) cu.kilo = parseInt(document.getElementById('tssKilo').value);
    if (Object.keys(cu).length > 0) apiPut(`customers/${policy.musteriId}`, cu).catch(e => console.warn('Musteri karti guncellenemedi:', e));
  }
  closeTssForm(); submitQuote(currentQuotePolicyId, 'tss', extraData);
}

// ============================================================
//  20. WIZARD MODE
// ============================================================
function enterWizardMode() {
  if (selectedIds.size === 0) { showToast('En az 1 police seciniz', 'warning'); return; }
  wizardStep = 'review'; wizSendResults = [];
  Object.keys(wizEditedTC).forEach(k => delete wizEditedTC[k]); Object.keys(wizEditedPhone).forEach(k => delete wizEditedPhone[k]);
  stopAllWizardPolling(); wizTrackingResults = {};
  showRightPanel('wizard'); updateWizStepIndicator(); renderWizReview(); updateWizFooter();
}
function exitWizardMode() { stopAllWizardPolling(); wizardStep = 'review'; showRightPanel('placeholder'); }
function stopAllWizardPolling() { Object.values(wizTrackingPolls).forEach(p => clearInterval(p.intervalId)); wizTrackingPolls = {}; }
function updateWizStepIndicator() {
  const steps = ['review','send','track'], ci = steps.indexOf(wizardStep);
  document.querySelectorAll('.rn-wiz-step').forEach(el => { const idx = steps.indexOf(el.dataset.step); el.classList.remove('active','completed'); if (idx === ci) el.classList.add('active'); else if (idx < ci) el.classList.add('completed'); });
  document.querySelectorAll('.rn-wiz-connector').forEach((el, i) => el.classList.toggle('completed', i < ci));
}
function updateWizFooter() {
  const bb = document.getElementById('wizBtnBack'), nb = document.getElementById('wizBtnNext');
  if (wizardStep === 'review') { bb.disabled = true; nb.innerHTML = 'Ileri <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'; nb.disabled = false; nb.className = 'rn-btn rn-btn--primary'; }
  else if (wizardStep === 'send') { bb.disabled = false; nb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Tumunu Gonder'; nb.disabled = false; nb.className = 'rn-btn rn-btn--primary'; }
  else if (wizardStep === 'track') { bb.disabled = true; nb.textContent = 'Kapat'; nb.className = 'rn-btn rn-btn--outline'; nb.disabled = false; }
}
function wizGoBack() { if (wizardStep === 'send') { wizardStep = 'review'; updateWizStepIndicator(); renderWizReview(); updateWizFooter(); showWizPanel('wizReview'); } }
function wizGoNext() { if (wizardStep === 'review') { wizardStep = 'send'; updateWizStepIndicator(); renderWizSend(); updateWizFooter(); showWizPanel('wizSend'); } else if (wizardStep === 'send') wizSendAll(); else if (wizardStep === 'track') exitWizardMode(); }
function showWizPanel(activeId) { document.querySelectorAll('.rn-wiz-panel').forEach(p => p.classList.remove('active')); document.getElementById(activeId).classList.add('active'); }
function renderWizReview() {
  const selected = allPolicies.filter(p => selectedIds.has(p.id)), panel = document.getElementById('wizReview');
  let issueCount = 0, html = '';
  selected.forEach(p => {
    const tc = wizEditedTC[p.id] || p.tcKimlikNo || p.vergiNo || '', phone = wizEditedPhone[p.id] || p.cepTelefonu || '';
    const qt = resolveQuoteType(p.policeTuru), hasTc = tc.length >= 10, hasQt = !!qt;
    let ri = 0; if (!hasTc) ri++; if (!hasQt) ri++; if (ri > 0) issueCount++;
    const colors = resolveTypeColor(p.policeTuru);
    html += `<div class="rn-review-card"><div class="rn-review-card-header"><span class="rn-review-card-name">${escapeHtml(p.sigortaliAdi || 'Isimsiz')}</span><span class="rn-type-pill" style="background:${colors.bg};color:${colors.fg};font-size:0.625rem;">${escapeHtml(p.policeTuru)}</span></div>
      <div class="rn-review-row"><span class="rn-review-dot ${hasTc ? 'ok' : 'missing'}"></span><span style="color:var(--text-dim);min-width:30px;">TC:</span>${hasTc ? `<span class="rn-mono" style="font-size:0.75rem;">${maskTc(tc)}</span>` : `<input type="text" class="rn-review-inline-input" placeholder="TC Kimlik No" maxlength="11" value="${escapeHtml(wizEditedTC[p.id] || '')}" data-pid="${p.id}" data-field="tc">`}</div>
      <div class="rn-review-row"><span class="rn-review-dot ${hasQt ? 'ok' : 'missing'}"></span><span style="color:var(--text-dim);min-width:30px;">Tur:</span><span style="font-size:0.75rem;${!hasQt ? 'color:var(--danger)' : ''}">${hasQt ? QUOTE_TYPE_LABELS[qt] : 'Desteklenmiyor'}</span></div>
      ${ri === 0 ? '<div style="font-size:0.6875rem;color:var(--success);font-weight:600;margin-top:0.125rem;">Hazir</div>' : `<div style="font-size:0.6875rem;color:var(--warning);font-weight:600;margin-top:0.125rem;">${ri} eksik</div>`}</div>`;
  });
  let banner; if (issueCount === 0) banner = '<div class="rn-review-banner ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg><span>Tum policeler gonderime hazir!</span></div>';
  else banner = `<div class="rn-review-banner warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span><strong>${issueCount}</strong> policede eksik bilgi var.</span></div>`;
  panel.innerHTML = banner + html;
  panel.querySelectorAll('.rn-review-inline-input').forEach(input => { input.addEventListener('change', function() { const pid = parseInt(this.dataset.pid); if (this.dataset.field === 'tc') wizEditedTC[pid] = this.value.trim(); else if (this.dataset.field === 'phone') wizEditedPhone[pid] = this.value.replace(/\D/g, ''); }); });
}
function renderWizSend() {
  const selected = allPolicies.filter(p => selectedIds.has(p.id)), panel = document.getElementById('wizSend');
  let readyCount = 0, notReadyCount = 0, totalPrim = 0; const byType = {};
  selected.forEach(p => { const tc = wizEditedTC[p.id] || p.tcKimlikNo || p.vergiNo || '', qt = resolveQuoteType(p.policeTuru); if (tc.length >= 10 && qt) { readyCount++; const lb = QUOTE_TYPE_LABELS[qt] || qt; byType[lb] = (byType[lb] || 0) + 1; } else notReadyCount++; totalPrim += p.brutPrim || 0; });
  const phone = getGlobalPhone(), phoneOk = !!phone;
  let html = `<div class="rn-send-summary"><div class="rn-send-summary-item"><span class="label">Toplam Secili</span><span class="value">${selected.length}</span></div><div class="rn-send-summary-item"><span class="label">Gonderime Hazir</span><span class="value" style="color:var(--primary);">${readyCount}</span></div>`;
  if (notReadyCount > 0) html += `<div class="rn-send-summary-item"><span class="label">Eksik Bilgi (Atlanacak)</span><span class="value" style="color:var(--warning);">${notReadyCount}</span></div>`;
  Object.entries(byType).forEach(([lb, cnt]) => { html += `<div class="rn-send-summary-item"><span class="label">${escapeHtml(lb)}</span><span class="value">${cnt}</span></div>`; });
  html += `<div class="rn-send-summary-item"><span class="label">Toplam Prim</span><span class="value">${formatCurrency(totalPrim)}</span></div><div class="rn-send-summary-item"><span class="label">Telefon</span><span class="value" style="color:${phoneOk ? 'var(--success)' : 'var(--danger)'};">${phoneOk ? phone : 'Gecersiz!'}</span></div></div>`;
  if (!phoneOk) html += '<div class="rn-review-banner warn" style="margin-bottom:0.75rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>Gecerli bir telefon numarasi girin.</span></div>';
  html += '<div class="rn-send-progress" id="wizSendProgress" style="display:none;"><div class="rn-send-progress-bar"><div class="rn-send-progress-fill" id="wizProgressFill"></div></div><div class="rn-send-progress-text" id="wizProgressText">0 / 0</div></div><div id="wizSendStatusList"></div>';
  panel.innerHTML = html;
}
async function wizSendAll() {
  const phone = getGlobalPhone(); if (!phone) { showToast('Gecerli bir telefon numarasi giriniz', 'warning'); document.getElementById('quotePhoneNumber')?.focus(); return; }
  const selected = allPolicies.filter(p => selectedIds.has(p.id)); wizSendResults = [];
  selected.forEach(p => { const tc = wizEditedTC[p.id] || p.tcKimlikNo || p.vergiNo || '', qt = resolveQuoteType(p.policeTuru); if (tc.length >= 10 && qt) wizSendResults.push({ policyId: p.id, policy: p, quoteType: qt, tc, status: 'pending', webQueryId: null, productCode: PRODUCT_CODE_MAP[qt] ?? 0, message: '' }); });
  if (wizSendResults.length === 0) { showToast('Gonderilecek police yok', 'warning'); return; }
  const nb = document.getElementById('wizBtnNext'), bb = document.getElementById('wizBtnBack'); nb.disabled = true; bb.disabled = true;
  document.getElementById('wizSendProgress').style.display = 'block'; renderWizSendStatus();
  let successCount = 0, errorCount = 0;
  for (let i = 0; i < wizSendResults.length; i++) {
    const sr = wizSendResults[i]; sr.status = 'sending'; renderWizSendStatus(); updateWizProgress(i, wizSendResults.length);
    try {
      if (wizEditedTC[sr.policyId]) { try { await apiPost(`policies/${sr.policyId}/assign-tc`, { policyId: sr.policyId, tcKimlikNo: wizEditedTC[sr.policyId], vergiNo: null }); sr.policy.tcKimlikNo = wizEditedTC[sr.policyId]; } catch (e) {} }
      if (!sr.policy.musteriId) { try { const np = splitName(sr.policy.sigortaliAdi); const er = await apiPost('customers/ensure', { tcKimlikNo: sr.policy.tcKimlikNo||null, vergiNo: sr.policy.vergiNo||null, adi: np.adi, soyadi: np.soyadi, gsm: sr.policy.cepTelefonu ? String(sr.policy.cepTelefonu) : null, policeId: sr.policy.id }); if (er && er.success) sr.policy.musteriId = er.customerId; } catch (_) {} }
      const response = await apiPost(`policies/${sr.policyId}/create-quote`, { quoteType: sr.quoteType, cepTelefonu: phone });
      if (response && response.isSuccessful && response.webQueryId) { sr.status = 'sent'; sr.webQueryId = response.webQueryId; sr.message = `webQueryId: ${response.webQueryId}`; activeWebQueryIds[response.webQueryId] = sr.policyId; successCount++; }
      else { sr.status = 'error'; sr.message = response?.message || 'Teklif gonderilemedi'; if (response && response.isSuccessful && !response.webQueryId) sr.message = 'webQueryId alinamadi'; errorCount++; }
    } catch (error) { sr.status = 'error'; sr.message = error.message || 'Beklenmeyen hata'; errorCount++; }
    renderWizSendStatus(); updateWizProgress(i + 1, wizSendResults.length);
    if (i < wizSendResults.length - 1) await new Promise(resolve => setTimeout(resolve, 1500));
  }
  document.getElementById('wizProgressText').textContent = `Tamamlandi! ${successCount} basarili, ${errorCount} hata`;
  showToast(`Toplu teklif: ${successCount} basarili, ${errorCount} hata`, successCount > 0 ? 'success' : 'error');
  if (successCount > 0) {
    const autoIds = wizSendResults.filter(sr => sr.status === 'sent' && sr.policy.yenilemeDurumu === 0).map(sr => sr.policyId);
    if (autoIds.length > 0) await batchUpdateRenewalStatus(autoIds, 2);
    wizSendResults.filter(sr => sr.status === 'sent').forEach(sr => { if (!policyQueryLog[sr.policyId]) policyQueryLog[sr.policyId] = []; policyQueryLog[sr.policyId].push({ timestamp: new Date().toISOString(), quoteType: sr.quoteType, webQueryId: sr.webQueryId, productCode: sr.productCode, resultCount: null, bestPremium: null }); });
    setTimeout(() => { wizardStep = 'track'; updateWizStepIndicator(); renderWizTrack(); updateWizFooter(); showWizPanel('wizTrack'); }, 1500);
  } else { nb.disabled = false; bb.disabled = false; }
}
function renderWizSendStatus() {
  const list = document.getElementById('wizSendStatusList'); if (!list) return;
  let html = ''; wizSendResults.forEach(sr => {
    let icon = '', mc = '';
    if (sr.status === 'pending') icon = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/></svg>';
    else if (sr.status === 'sending') icon = '<div class="rn-spinner" style="width:16px;height:16px;border-width:2px;"></div>';
    else if (sr.status === 'sent') { icon = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" width="16" height="16"><polyline points="20,6 9,17 4,12"/></svg>'; mc = 'color:var(--success);'; }
    else if (sr.status === 'error') { icon = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'; mc = 'color:var(--danger);'; }
    const colors = resolveTypeColor(sr.policy.policeTuru);
    html += `<div class="rn-send-status-row"><div class="rn-send-status-icon">${icon}</div><span class="rn-send-status-name">${escapeHtml(sr.policy.sigortaliAdi || 'Isimsiz')}</span><span class="rn-type-pill" style="background:${colors.bg};color:${colors.fg};font-size:0.5625rem;padding:0.125rem 0.375rem;">${escapeHtml(sr.policy.policeTuru)}</span><span class="rn-send-status-msg" style="${mc}">${escapeHtml(sr.message)}</span></div>`;
  }); list.innerHTML = html;
}
function updateWizProgress(current, total) { const p = Math.round((current / total) * 100); const f = document.getElementById('wizProgressFill'), t = document.getElementById('wizProgressText'); if (f) f.style.width = p + '%'; if (t) t.textContent = `${current} / ${total} gonderiliyor...`; }
function renderWizTrack() {
  const panel = document.getElementById('wizTrack'), si = wizSendResults.filter(sr => sr.status === 'sent' && sr.webQueryId), ei = wizSendResults.filter(sr => sr.status === 'error');
  let html = `<div class="rn-track-stats"><div class="rn-track-stat"><div class="rn-track-stat-value" style="color:var(--info);">${si.length}</div><div class="rn-track-stat-label">Sorgulaniyor</div></div><div class="rn-track-stat"><div class="rn-track-stat-value" id="wizTrackCompleted" style="color:var(--success);">0</div><div class="rn-track-stat-label">Tamamlanan</div></div><div class="rn-track-stat"><div class="rn-track-stat-value" style="color:var(--danger);">${ei.length}</div><div class="rn-track-stat-label">Hata</div></div></div>`;
  if (si.length > 0) html += '<div class="rn-track-auto" id="wizTrackAutoRefresh"><div class="rn-spinner" style="width:14px;height:14px;border-width:2px;"></div><span>Otomatik guncelleniyor (5 sn)</span></div>';
  html += '<div id="wizTrackCards"></div>'; panel.innerHTML = html; startWizardPolling(); updateWizTrackCards();
}
function startWizardPolling() {
  stopAllWizardPolling(); const si = wizSendResults.filter(sr => sr.status === 'sent' && sr.webQueryId); if (si.length === 0) return;
  si.forEach(sr => { const wq = sr.webQueryId; if (!wizTrackingResults[wq]) wizTrackingResults[wq] = { status: 'polling', quotes: [], policyId: sr.policyId };
    pollWizQuoteResult(wq, sr.productCode, sr.policyId);
    const iid = setInterval(() => { const tp = wizTrackingPolls[wq]; if (!tp) return; tp.attempts++; if (tp.attempts >= 60) { clearInterval(tp.intervalId); wizTrackingResults[wq].status = 'timeout'; updateWizTrackCards(); checkWizPollingDone(); return; } pollWizQuoteResult(wq, sr.productCode, sr.policyId); }, 5000);
    wizTrackingPolls[wq] = { intervalId: iid, attempts: 0, policyId: sr.policyId, productCode: sr.productCode };
  });
}
async function pollWizQuoteResult(webQueryId, productCode, policyId) {
  try { const r = await apiGet('policies/quote-results', { webQueryId, product: productCode }); if (!r || !r.isSuccessful) return;
    wizTrackingResults[webQueryId] = { status: r.status || 'polling', quotes: r.quotes || [], policyId, errorMessage: r.errorMessage || null, quoteFilePath: r.quoteFilePath || null };
    if (r.status === 'completed' || r.status === 'error') { if (wizTrackingPolls[webQueryId]) { clearInterval(wizTrackingPolls[webQueryId].intervalId); delete wizTrackingPolls[webQueryId]; } }
    updateWizTrackCards(); checkWizPollingDone();
  } catch (error) { console.error('Wizard polling error:', error); }
}
function updateWizTrackCards() {
  const container = document.getElementById('wizTrackCards'); if (!container) return;
  const si = wizSendResults.filter(sr => sr.status === 'sent' && sr.webQueryId); let completedCount = 0, html = '';
  si.forEach(sr => {
    const tr = wizTrackingResults[sr.webQueryId], isC = tr && tr.status === 'completed', isT = tr && tr.status === 'timeout', isE = tr && tr.status === 'error'; if (isC) completedCount++;
    const colors = resolveTypeColor(sr.policy.policeTuru);
    let sH; if (isC) { const qc = (tr.quotes || []).filter(q => q.grossPremium > 0).length; sH = `<span class="rn-track-card-status" style="background:var(--success-bg);color:var(--success);">${qc} teklif</span>`; }
    else if (isE) sH = `<span class="rn-track-card-status" style="background:var(--danger-bg);color:var(--danger);" title="${escapeHtml(tr.errorMessage || '')}">${escapeHtml(tr.errorMessage || 'Sorgu hatali')}</span>`;
    else if (isT) sH = '<span class="rn-track-card-status" style="background:var(--warning-bg);color:var(--warning);">Zaman asimi</span>';
    else sH = '<span class="rn-track-card-status" style="background:var(--info-bg);color:var(--info);">Sorgulaniyor...</span>';
    let bp = ''; if (tr && tr.quotes && tr.quotes.length > 0) { const vq = tr.quotes.filter(q => q.grossPremium > 0); if (vq.length > 0) { const best = vq.reduce((m, q) => q.grossPremium < m.grossPremium ? q : m); bp = `<div style="font-size:0.75rem;color:var(--success);font-weight:600;margin-top:0.25rem;">En uygun: ${formatCurrency(best.grossPremium)} (${escapeHtml(best.insuranceCompanyName || '?')})</div>`; } }
    // Tamamlanan sorgular için dosya linki
    let docLink = '';
    if (isC && tr.quoteFilePath) {
      docLink = `<div style="margin-top:0.375rem;display:flex;gap:0.375rem;"><a href="${escapeHtml(tr.quoteFilePath)}" target="_blank" class="rn-btn rn-btn--outline" style="padding:2px 8px;font-size:0.625rem;text-decoration:none;display:inline-flex;align-items:center;gap:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>Karsilastirma</a><button class="rn-btn rn-btn--outline" style="padding:2px 8px;font-size:0.625rem;" onclick="copyDocumentLink('${escapeHtml(tr.quoteFilePath)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></div>`;
    }
    html += `<div class="rn-track-card"><div class="rn-track-card-header"><span class="rn-track-card-name">${escapeHtml(sr.policy.sigortaliAdi || 'Isimsiz')}</span>${sH}</div><span class="rn-type-pill" style="background:${colors.bg};color:${colors.fg};font-size:0.625rem;">${escapeHtml(sr.policy.policeTuru)}</span>${bp}${docLink}</div>`;
  });
  container.innerHTML = html; const ce = document.getElementById('wizTrackCompleted'); if (ce) ce.textContent = completedCount;
}
function checkWizPollingDone() {
  if (Object.keys(wizTrackingPolls).length === 0) {
    const ar = document.getElementById('wizTrackAutoRefresh'); if (ar) ar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" width="14" height="14"><polyline points="20,6 9,17 4,12"/></svg><span style="color:var(--success);">Tum sorgular tamamlandi</span>';
    const si = wizSendResults.filter(sr => sr.status === 'sent' && sr.webQueryId);
    if (si.length > 0) { const batch = { id: 'batch-' + Date.now(), timestamp: new Date().toISOString(), policies: si.map(sr => ({ policyId: sr.policyId, name: sr.policy.sigortaliAdi, quoteType: sr.quoteType, webQueryId: sr.webQueryId, results: wizTrackingResults[sr.webQueryId]?.quotes || [] })) }; localQueryBatches.unshift(batch);
      si.forEach(sr => { const le = policyQueryLog[sr.policyId]; if (le && le.length > 0) { const last = le[le.length - 1]; if (last.resultCount === null) { const tr = wizTrackingResults[sr.webQueryId]; if (tr) { last.resultCount = (tr.quotes || []).length; const vp = (tr.quotes || []).filter(q => q.grossPremium > 0).map(q => q.grossPremium); last.bestPremium = vp.length > 0 ? Math.min(...vp) : null; } } } });
    }
  }
}

// ============================================================
//  21. WHATSAPP
// ============================================================
function getQuotesForPolicy(policyId) {
  // Merge quotes from both sources: SSE realtime + polling results
  const rt = realtimeQuotes[policyId] || [];
  const stored = (window._lastQuoteResults || {})[policyId] || [];
  return stored.length > 0 ? stored : rt;
}
function sendWhatsApp(policyId) {
  const policy = allPolicies.find(p => p.id === policyId);
  if (!policy || !policy.cepTelefonu) { showToast('Telefon numarasi bulunamadi', 'warning'); return; }
  const phone = '90' + String(policy.cepTelefonu).replace(/\D/g, '');
  let message = `Sayin ${policy.sigortaliAdi || 'Musterimiz'},\n\n${formatDate(policy.bitisTarihi)} tarihinde sona erecek ${policy.policeTuru || ''} policeniz icin yenileme teklifleri hazirladik.\n`;
  const quotes = getQuotesForPolicy(policyId); const validQuotes = quotes.filter(q => q.grossPremium > 0);
  if (validQuotes.length > 0) { const best = validQuotes.reduce((min, q) => q.grossPremium < min.grossPremium ? q : min); message += `\nEn uygun teklif: ${best.insuranceCompanyName} - ${formatCurrency(best.grossPremium)}`; message += `\n${validQuotes.length} sirketten teklif alindi.\n`; }
  if (window._lastDocUrl) message += `\nKarsilastirma tablosu: ${window._lastDocUrl}\n`;
  message += '\nDetayli bilgi icin bize ulasabilirsiniz.';
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}
function shareViaWhatsApp(policyId, documentUrl) {
  const policy = allPolicies.find(p => p.id === policyId);
  if (!policy || !policy.cepTelefonu) { showToast('Telefon numarasi bulunamadi', 'warning'); return; }
  const phone = '90' + String(policy.cepTelefonu).replace(/\D/g, '');
  let message = `Sayin ${policy.sigortaliAdi || 'Musterimiz'},\n\n${policy.policeTuru || ''} policenizin yenileme teklifleri hazir.\n`;
  const quotes = getQuotesForPolicy(policyId); const validQuotes = quotes.filter(q => q.grossPremium > 0);
  if (validQuotes.length > 0) { const best = validQuotes.reduce((min, q) => q.grossPremium < min.grossPremium ? q : min); message += `\nEn uygun: ${best.insuranceCompanyName} - ${formatCurrency(best.grossPremium)}`; message += `\n${validQuotes.length} sirketten teklif alindi\n`; }
  if (documentUrl) message += `\nKarsilastirma tablosu: ${documentUrl}\n`;
  message += '\nDetayli bilgi icin bize ulasabilirsiniz.';
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

// ============================================================
//  22. EXCEL EXPORT
// ============================================================
function exportToExcel() {
  if (filteredPolicies.length === 0) { showToast('Disa aktarilacak police yok', 'warning'); return; }
  const headers = ['Musteri','Telefon','Police Turu','Plaka','Sirket','Bitis Tarihi','Kalan Gun','Brut Prim'];
  const rows = filteredPolicies.map(p => [p.sigortaliAdi||'', p.cepTelefonu||'', p.policeTuru||'', p.plaka||'', p.sigortaSirketi||'', formatDate(p.bitisTarihi), getDaysRemaining(p.bitisTarihi), p.brutPrim||0]);
  let csv = '\uFEFF'; csv += headers.join(';') + '\n';
  rows.forEach(row => { csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';') + '\n'; });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }), url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `yenileme-takibi-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  showToast(`${filteredPolicies.length} police disa aktarildi`, 'success');
}

// ============================================================
//  23. QUOTE HISTORY
// ============================================================
let quoteHistoryData = [];
async function loadQuoteHistory() {
  const wrap = document.getElementById('historyTableWrap'), badge = document.getElementById('historyCount');
  wrap.innerHTML = '<div class="rn-history-empty"><div class="rn-spinner" style="width:20px;height:20px;"></div><span>Sorgu gecmisi yukleniyor...</span></div>';
  try {
    const response = await apiGet('policies/quote-history');
    if (!response || !response.isSuccessful) { wrap.innerHTML = `<div class="rn-history-empty"><span>${escapeHtml(response?.errorMessage || 'Sorgu gecmisi alinamadi')}</span></div>`; return; }
    quoteHistoryData = response.queries || []; renderQuoteHistory();
  } catch (error) { console.error('[QuoteHistory] Error:', error); wrap.innerHTML = '<div class="rn-history-empty"><span style="color:var(--danger);">Sorgu gecmisi yuklenirken hata olustu</span></div>'; }
}
function renderQuoteHistory() {
  const wrap = document.getElementById('historyTableWrap'), badge = document.getElementById('historyCount');
  let html = '';
  if (localQueryBatches.length > 0) {
    localQueryBatches.forEach(batch => {
      const time = new Date(batch.timestamp).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      html += `<div class="rn-history-batch"><div class="rn-history-batch-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>Toplu Sorgu &mdash; ${batch.policies.length} police<span style="margin-left:auto;font-weight:400;color:var(--text-dim);">${time}</span></div><div class="rn-history-batch-body"><table class="rn-history-table" style="margin:0;"><tbody>`;
      batch.policies.forEach(p => {
        const rc = p.results?.length || 0, vq = (p.results || []).filter(q => q.grossPremium > 0), best = vq.sort((a, b) => a.grossPremium - b.grossPremium)[0];
        const tl = QUOTE_TYPE_LABELS[p.quoteType] || p.quoteType, tc = resolveTypeColor(tl);
        html += `<tr><td style="font-weight:600;">${escapeHtml(p.name || 'Isimsiz')}</td><td><span class="rn-type-pill" style="background:${tc.bg};color:${tc.fg};font-size:0.5625rem;padding:0.125rem 0.375rem;">${escapeHtml(tl)}</span></td><td>${rc > 0 ? rc + ' teklif' : '<span style="color:var(--text-dim);">-</span>'}</td><td style="text-align:right;font-weight:600;color:var(--success);">${best ? formatCurrency(best.grossPremium) : '-'}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    });
  }
  if (quoteHistoryData.length > 0) {
    html += '<table class="rn-history-table"><thead><tr><th>Ad Soyad</th><th>TC / VKN</th><th>Kaynak</th><th>Sirket</th><th>Sonuc</th></tr></thead><tbody>';
    quoteHistoryData.forEach((entry) => {
      const rh = buildResultBadges(entry), td = entry.tcVergiNo ? maskTc(entry.tcVergiNo) : '-', sl = entry.sorguKaynagi || '-';
      html += `<tr><td><div style="font-weight:600;">${escapeHtml(entry.adiSoyadi || 'Isimsiz')}</div></td><td><span class="rn-mono" style="font-size:0.75rem;">${td}</span></td><td><span class="rn-history-source">${escapeHtml(sl)}</span></td><td><span style="font-variant-numeric:tabular-nums;">${entry.sorgulananSirketSayisi || 0}</span></td><td>${rh}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  if (localQueryBatches.length === 0 && quoteHistoryData.length === 0) html = '<div class="rn-history-empty"><span>Henuz sorgu gecmisi bulunmuyor</span></div>';
  wrap.innerHTML = html;
  const total = localQueryBatches.reduce((s, b) => s + b.policies.length, 0) + quoteHistoryData.length;
  if (badge) badge.textContent = total;
}
function buildResultBadges(entry) {
  const parts = [];
  if (entry.onaySayisi > 0) parts.push(`<span class="onay">${entry.onaySayisi} Onay</span>`);
  if (entry.redSayisi > 0) parts.push(`<span class="red">${entry.redSayisi} Red</span>`);
  if (entry.belirsizSayisi > 0) parts.push(`<span class="belirsiz">${entry.belirsizSayisi} Bel.</span>`);
  if (parts.length === 0) parts.push('<span style="color:var(--text-dim);">-</span>');
  return `<div class="rn-history-result">${parts.join('')}</div>`;
}

// ============================================================
//  24. DEV TEST PANEL
// ============================================================
function toggleTestPanel() { const b = document.getElementById('testPanelBody'), c = document.getElementById('testPanelChevron'); const o = b.style.display !== 'none'; b.style.display = o ? 'none' : 'block'; c.style.transform = o ? '' : 'rotate(180deg)'; }
function onTestQuoteTypeChange() {
  const type = document.getElementById('testQuoteType').value, iv = ['traffic','casco','imm'].includes(type);
  document.getElementById('testVehicleFields').style.display = iv ? 'block' : 'none';
  document.getElementById('testTssFields').style.display = type === 'tss' ? 'block' : 'none';
  document.getElementById('testDaskFields').style.display = type === 'dask' ? 'block' : 'none';
  document.getElementById('testHouseFields').style.display = type === 'house' ? 'block' : 'none';
}
function testLog(message, level) {
  const container = document.getElementById('testLogContainer'), log = document.getElementById('testLog'); container.style.display = 'block';
  const now = new Date(), time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const cls = level === 'success' ? 'log-success' : level === 'error' ? 'log-error' : 'log-info';
  log.innerHTML += `<div class="log-entry"><span class="log-time">[${time}]</span><span class="${cls}">${escapeHtml(message)}</span></div>`; log.scrollTop = log.scrollHeight;
}
function clearTestLog() { document.getElementById('testLog').innerHTML = ''; document.getElementById('testLogContainer').style.display = 'none'; }
async function submitTestQuote() {
  const quoteType = document.getElementById('testQuoteType').value, tcKimlikNo = document.getElementById('testTcKimlikNo').value.trim(), telefon = document.getElementById('testTelefon').value.trim() || getGlobalPhone() || '';
  if (!tcKimlikNo) { showToast('TC Kimlik No giriniz', 'warning'); return; }
  if (tcKimlikNo.length !== 11 || !/^\d+$/.test(tcKimlikNo)) { showToast('TC Kimlik No 11 haneli ve sadece rakamlardan olusmalidir', 'warning'); return; }
  const iv = ['traffic','casco','imm'].includes(quoteType); let plaka = '', sigortaliAdi = null, extraData = {};
  if (iv) { plaka = document.getElementById('testPlaka').value.trim().toUpperCase(); if (!plaka) { showToast('Arac policeleri icin plaka zorunludur', 'warning'); return; } }
  else if (quoteType === 'tss') { sigortaliAdi = document.getElementById('testSigortaliAdi').value.trim(); const dT = document.getElementById('testTssDogumTarihi').value; if (!sigortaliAdi) { showToast('TSS icin sigortali adi zorunludur', 'warning'); return; } if (!dT) { showToast('TSS icin dogum tarihi zorunludur', 'warning'); return; } extraData.tssData = { dogumTarihi: dT, boy: document.getElementById('testTssBoy').value||null, kilo: document.getElementById('testTssKilo').value||null, agTipi: parseInt(document.getElementById('testTssAgTipi').value)||null, planTipi: parseInt(document.getElementById('testTssPlanTipi').value)||null, dogumTeminati: document.getElementById('testTssDogumTeminati').checked||null }; }
  else if (quoteType === 'dask') { extraData.daskData = { binaAdresi: document.getElementById('testDaskBinaAdresi').value||null, uavtKodu: document.getElementById('testDaskUAVTKodu').value||null, brutM2: parseFloat(document.getElementById('testDaskBrutM2').value)||null, binaInsaatYili: parseInt(document.getElementById('testDaskInsaatYili').value)||null, toplamKatSayisi: parseInt(document.getElementById('testDaskToplamKat').value)||null, bulunduguKat: parseInt(document.getElementById('testDaskBulunduguKat').value)||null, yapiTarzi: parseInt(document.getElementById('testDaskYapiTarzi').value)||null, kullanimSekli: parseInt(document.getElementById('testDaskKullanimSekli').value)||null, mevcutPoliceNo: document.getElementById('testDaskMevcutPoliceNo').value||null }; }
  else if (quoteType === 'house') { extraData.houseData = { binaAdresi: document.getElementById('testHouseBinaAdresi').value||null, uavtKodu: document.getElementById('testHouseUAVTKodu').value||null, brutM2: parseFloat(document.getElementById('testHouseBrutM2').value)||null, binaInsaatYili: parseInt(document.getElementById('testHouseInsaatYili').value)||null, toplamKatSayisi: parseInt(document.getElementById('testHouseToplamKat').value)||null, bulunduguKat: parseInt(document.getElementById('testHouseBulunduguKat').value)||null, yapiTarzi: parseInt(document.getElementById('testHouseYapiTarzi').value)||null, binaBeyanDegeri: parseFloat(document.getElementById('testHouseBinaBeyanDegeri').value)||null, esyaBeyanDegeri: parseFloat(document.getElementById('testHouseEsyaBeyanDegeri').value)||null }; }
  const btn = document.getElementById('btnTestQuote'); btn.disabled = true; btn.textContent = 'Gonderiliyor...';
  const qtl = { 'traffic': 'Trafik', 'casco': 'Kasko', 'imm': 'IMM', 'dask': 'DASK', 'house': 'Konut', 'tss': 'TSS' };
  testLog(`${qtl[quoteType]} teklifi gonderiliyor: TC=${tcKimlikNo}${plaka ? ', plaka=' + plaka : ''}`, 'info');
  try {
    const requestBody = { quoteType, tcKimlikNo, plaka: plaka||null, cepTelefonu: telefon||null, sigortaliAdi, ...extraData };
    testLog(`Request: ${JSON.stringify(requestBody)}`, 'info');
    const response = await apiPost('policies/test-quote', requestBody);
    if (!response || !response.isSuccessful) { testLog(`HATA: ${response?.message || 'Teklif gonderilemedi'}`, 'error'); showToast(response?.message || 'Teklif gonderilemedi', 'error'); return; }
    if (!response.webQueryId) { testLog(`UYARI: ${response.message || 'webQueryId atanamadi'}`, 'error'); showToast(response.message || 'webQueryId atanamadi', 'warning'); return; }
    testLog(`Sorgu baslatildi! webQueryId=${response.webQueryId}`, 'success'); showToast('Teklif sorgusu baslatildi', 'success');
    const pc = PRODUCT_CODE_MAP[quoteType] ?? 0; testLog(`Polling baslatildi: webQueryId=${response.webQueryId}, productCode=${pc}`, 'info');
    pollTestQuoteResults(response.webQueryId, pc);
  } catch (error) { const detail = error.status ? `HTTP ${error.status}: ${error.message || error}` : (error.message || error); testLog(`ISTISNA: ${detail}`, 'error'); showToast('Teklif gonderilirken hata olustu', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="5,3 19,12 5,21 5,3"/></svg> Test Gonder'; }
}
function pollTestQuoteResults(webQueryId, productCode) {
  const maxAttempts = 60; let attempts = 0;
  const poll = async () => {
    try { const r = await apiGet('policies/quote-results', { webQueryId, product: productCode }); if (!r || !r.isSuccessful) return false;
      if (r.status === 'error') { testLog(`SORGU HATASI: ${r.errorMessage || 'Bilinmeyen hata'}`, 'error'); return true; }
      if (r.quotes && r.quotes.length > 0) { const sorted = [...r.quotes].sort((a, b) => (a.grossPremium||999999) - (b.grossPremium||999999)); testLog(`${r.quotes.length} teklif alindi (${r.status})`, 'success');
        sorted.forEach(q => { if (q.grossPremium) testLog(`  ${q.insuranceCompanyName}: ${formatCurrency(q.grossPremium)}`, 'success'); else if (q.status === 'error') testLog(`  ${q.insuranceCompanyName}: HATA - ${q.errorMessage||''}`, 'error'); else testLog(`  ${q.insuranceCompanyName}: Bekleniyor...`, 'info'); }); }
      return r.status === 'completed';
    } catch (err) { testLog(`Polling hatasi: ${err.message || err}`, 'error'); return false; }
  };
  poll();
  const iid = setInterval(async () => { attempts++; const done = await poll(); if (done || attempts >= maxAttempts) { clearInterval(iid); testLog(done ? 'Polling tamamlandi.' : 'Polling zaman asimi.', done ? 'success' : 'error'); } }, 5000);
}

// ============================================================
//  25. EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('filterCompany').addEventListener('change', applyFilters);
  document.getElementById('filterType').addEventListener('change', applyFilters);
  document.getElementById('sortBy').addEventListener('change', function() { applySort(); renderTable(); });
  document.getElementById('btnResetFilters').addEventListener('click', resetFilters);
  // Stat cards (replace old urgency chips)
  document.querySelectorAll('.rn-stat-card[data-filter]').forEach(card => {
    card.addEventListener('click', function() {
      const val = this.getAttribute('data-filter');
      if (val === 'all') { activeUrgencyFilter = null; document.querySelectorAll('.rn-stat-card').forEach(c => c.classList.remove('rn-stat-card--active')); applyFilters(); }
      else filterByUrgency(parseInt(val), this);
    });
  });
  // Phone popover
  const phoneBtn = document.getElementById('phonePopoverBtn');
  if (phoneBtn) phoneBtn.addEventListener('click', togglePhonePopover);
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('phonePopover'), btn = document.getElementById('phonePopoverBtn');
    if (popover && popover.style.display !== 'none' && !popover.contains(e.target) && btn && !btn.contains(e.target)) popover.style.display = 'none';
  });
  // Bulk auto quote button — now triggers wizard mode
  const bulkBtn = document.getElementById('btnBulkAutoQuote');
  if (bulkBtn) {
    bulkBtn.addEventListener('click', () => {
      if (selectedIds.size > 0) { enterWizardMode(); }
      else { filteredPolicies.forEach(p => selectedIds.add(p.id)); renderTable(); enterWizardMode(); }
    });
  }
  // Selection controls
  document.getElementById('selectAllCheckbox').addEventListener('change', function() {
    const s = (currentPage - 1) * pageSize, e = s + pageSize, items = filteredPolicies.slice(s, e);
    if (this.checked) items.forEach(p => selectedIds.add(p.id)); else items.forEach(p => selectedIds.delete(p.id)); renderTable();
  });
  document.getElementById('btnSelectAllVisible').addEventListener('click', () => { filteredPolicies.forEach(p => selectedIds.add(p.id)); renderTable(); });
  document.getElementById('btnClearSelection').addEventListener('click', () => { selectedIds.clear(); renderTable(); });
  document.getElementById('btnBatchWizard').addEventListener('click', enterWizardMode);
  // Status filter tabs
  const statusTabs = document.getElementById('statusTabs');
  if (statusTabs) statusTabs.addEventListener('click', function(e) { const tab = e.target.closest('.rn-status-tab'); if (!tab) return; handleStatusTabClick(tab.dataset.status); });
  // Batch state change dropdown
  const bss = document.getElementById('batchStateSelect');
  if (bss) bss.addEventListener('change', function() { const ns = parseInt(this.value); if (isNaN(ns)) return; const ids = Array.from(selectedIds); if (ids.length === 0) { showToast('Durum degistirmek icin police secin', 'warning'); this.value = ''; return; } batchUpdateRenewalStatus(ids, ns); this.value = ''; });
  // Wizard navigation
  document.getElementById('wizBtnBack').addEventListener('click', wizGoBack);
  document.getElementById('wizBtnNext').addEventListener('click', wizGoNext);
  // Excel export
  const excelBtn = document.getElementById('btnExcelExport'); if (excelBtn) excelBtn.addEventListener('click', exportToExcel);
  // Modal overlay clicks
  document.addEventListener('click', function(e) { if (e.target.classList.contains('modal-overlay')) { closeDaskHouseForm(); closeTssForm(); closeTcAssignModal(); } });
  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { const tcModal = document.getElementById('tcAssignModal'); if (tcModal && tcModal.classList.contains('show')) { e.preventDefault(); saveAndQuote(); } }
    if (e.key === 'Escape') { closeStatePopover(); closeDaskHouseForm(); closeTssForm(); closeTcAssignModal(); }
  });
}

// ============================================================
//  26. UTILITIES
// ============================================================
function getDaysRemaining(expiryDate) { const today = new Date(); today.setHours(0,0,0,0); return Math.ceil((new Date(expiryDate) - today) / (1000*60*60*24)); }
function formatDate(dateStr) { if (!dateStr) return '-'; return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatCurrency(amount) { if (!amount && amount !== 0) return '-'; return amount.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL'; }
function formatPhone(phone) { if (!phone) return '-'; const s = String(phone).replace(/\D/g, ''); if (s.length === 10) return `0${s.slice(0,3)} ${s.slice(3,6)} ${s.slice(6,8)} ${s.slice(8)}`; return s || '-'; }
function escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function truncate(str, maxLen) { if (!str) return ''; return str.length > maxLen ? str.substring(0, maxLen) + '...' : str; }
function debounce(func, wait) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); }; }
function maskTc(tc) { if (!tc || tc.length < 5) return tc || ''; return tc.substring(0, 3) + '***' + tc.substring(tc.length - 2); }
function timeAgo(date) { const s = Math.floor((Date.now() - date.getTime()) / 1000); if (s < 60) return 'az once'; if (s < 3600) return Math.floor(s/60) + ' dk once'; if (s < 86400) return Math.floor(s/3600) + ' saat once'; if (s < 604800) return Math.floor(s/86400) + ' gun once'; return ''; }
function showEmpty(msg) { const tbody = document.getElementById('policiesBody'); tbody.innerHTML = `<tr><td colspan="10"><div class="rn-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><span>${escapeHtml(msg)}</span></div></td></tr>`; document.getElementById('paginationContainer').style.display = 'none'; }
function showError() { const tbody = document.getElementById('policiesBody'); tbody.innerHTML = '<tr><td colspan="10"><div class="rn-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32" style="color:var(--danger);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span style="color:var(--danger);">Veriler yuklenirken bir hata olustu</span></div></td></tr>'; }
