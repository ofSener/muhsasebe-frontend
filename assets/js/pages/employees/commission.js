    // ═══════════════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════
    let groups = [];
    let currentGroupId = null;
    let currentGroup = null;
    let currentRuleId = null;
    let insuranceCompanies = [];
    let branches = [];
    let allEmployees = [];
    let selectedMembers = new Set();
    let allSubeler = [];
    let selectedBranches = new Set();
    let confirmCallback = null;

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', async function() {
      requirePermission('komisyonOranlariniDuzenleyebilsin');

      // Load initial data
      await Promise.all([
        loadGroups(),
        loadInsuranceCompanies(),
        loadBranches(),
        loadEmployees(),
        loadSubeler()
      ]);

      // Setup condition field change handler
      document.getElementById('ruleConditionField').addEventListener('change', function() {
        const hasCondition = this.value !== '';
        document.getElementById('ruleConditionOperator').disabled = !hasCondition;
        document.getElementById('ruleConditionValue').disabled = !hasCondition;
        if (!hasCondition) {
          document.getElementById('ruleConditionValue').value = '';
        }
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // API CALLS
    // ═══════════════════════════════════════════════════════════════
    async function loadGroups() {
      try {
        const response = await apiGet('komisyon-gruplari');
        groups = response || [];
        renderGroups();
        updateStats();
      } catch (error) {
        console.error('Gruplar yüklenirken hata:', error);
        showToast('Gruplar yüklenirken hata oluştu', 'error');
        groups = [];
        renderGroups();
      }
    }

    async function loadGroupDetail(groupId) {
      try {
        const response = await apiGet(`komisyon-gruplari/${groupId}`);
        currentGroup = response;
        currentGroupId = groupId;
        renderGroupDetail();
        return response;
      } catch (error) {
        console.error('Grup detayı yüklenirken hata:', error);
        showToast('Grup detayı yüklenirken hata oluştu', 'error');
        return null;
      }
    }

    async function loadInsuranceCompanies() {
      try {
        const response = await apiGet('insurance-companies');
        insuranceCompanies = response || [];
        populateCompanyDropdown();
      } catch (error) {
        console.error('Sigorta şirketleri yüklenirken hata:', error);
        insuranceCompanies = [];
      }
    }

    async function loadBranches() {
      try {
        const response = await apiGet('insurance-types');
        branches = response || [];
        populateBranchDropdown();
      } catch (error) {
        console.error('Branşlar yüklenirken hata:', error);
        branches = [];
      }
    }

    async function loadEmployees() {
      try {
        const user = APP_CONFIG.AUTH.getUser();
        const firmaId = user?.firmaId;
        if (firmaId) {
          const response = await apiGet('kullanicilar', { firmaId });
          // Sadece aktif çalışanları filtrele
          allEmployees = (response || []).filter(emp => emp.aktif === true || emp.aktif === 1);
        }
      } catch (error) {
        console.error('Çalışanlar yüklenirken hata:', error);
        allEmployees = [];
      }
    }

    async function loadSubeler() {
      try {
        const user = APP_CONFIG.AUTH.getUser();
        const firmaId = user?.firmaId;
        if (firmaId) {
          const response = await apiGet('branches', { firmaId });
          allSubeler = response || [];
        }
      } catch (error) {
        console.error('Şubeler yüklenirken hata:', error);
        allSubeler = [];
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function renderGroups() {
      const grid = document.getElementById('groupsGrid');
      const countEl = document.getElementById('groupsCount');

      if (!groups || groups.length === 0) {
        grid.innerHTML = `
          <div class="group-card group-card-add" onclick="openGroupModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>İlk Grubunuzu Oluşturun</span>
          </div>
        `;
        countEl.textContent = '0 grup';
        return;
      }

      countEl.textContent = `${groups.length} grup`;

      grid.innerHTML = groups.map(group => `
        <div class="group-card" onclick="openGroupDetail(${group.id})">
          <div class="group-card-header">
            <div class="group-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div class="group-card-actions">
              <button class="btn-icon" onclick="event.stopPropagation(); editGroup(${group.id})" title="Düzenle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn-icon btn-icon-danger" onclick="event.stopPropagation(); confirmDeleteGroup(${group.id})" title="Sil">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="group-card-title">${escapeHtml(group.grupAdi || 'İsimsiz Grup')}</div>
          <div class="group-card-desc">${escapeHtml(group.aciklama || 'Açıklama yok')}</div>
          <div class="group-card-stats">
            <div class="group-stat">
              <div class="group-stat-value">${group.kuralSayisi ?? 0}</div>
              <div class="group-stat-label">Kural</div>
            </div>
            <div class="group-stat">
              <div class="group-stat-value">${group.uyeSayisi ?? 0}</div>
              <div class="group-stat-label">Üye</div>
            </div>
          </div>
        </div>
      `).join('') + `
        <div class="group-card group-card-add" onclick="openGroupModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Yeni Grup Ekle</span>
        </div>
      `;
    }

    function renderGroupDetail() {
      if (!currentGroup) return;

      document.getElementById('groupDetailTitle').textContent = currentGroup.grupAdi || 'Grup Detayı';
      document.getElementById('groupDetailName').value = currentGroup.grupAdi || '';
      document.getElementById('groupDetailDesc').value = currentGroup.aciklama || '';

      renderRules();
      renderMembers();
      renderBranches();
    }

    function renderRules() {
      const container = document.getElementById('rulesList');
      const countEl = document.getElementById('rulesCount');
      const rules = currentGroup?.kurallar || [];

      countEl.textContent = rules.length;

      if (rules.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <div class="empty-state-title">Henüz kural eklenmemiş</div>
            <div class="empty-state-desc">Bu gruba komisyon kuralları ekleyerek başlayabilirsiniz.</div>
            <button class="btn btn-primary" onclick="openRuleModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              İlk Kuralı Ekle
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = rules.map(rule => {
        const companyName = rule.sigortaSirketiAdi || 'Tüm Şirketler';
        const branchName = rule.bransAdi || 'Tüm Branşlar';
        const condition = formatCondition(rule);
        const rate = rule.komisyonOrani ?? 0;

        return `
          <div class="rule-item" data-rule-id="${rule.id}">
            <div class="rule-info">
              <div class="rule-company">
                <div class="rule-label">Şirket</div>
                <div class="rule-value">${escapeHtml(companyName)}</div>
              </div>
              <div class="rule-branch">
                <div class="rule-label">Branş</div>
                <div class="rule-value">${escapeHtml(branchName)}</div>
              </div>
              <div class="rule-condition">
                <div class="rule-label">Koşul</div>
                <div class="rule-condition-text">${condition || 'Koşul yok'}</div>
              </div>
              <div class="rule-rate">
                <div class="rule-label">Oran</div>
                <div class="rule-rate-value">%${rate}</div>
              </div>
            </div>
            <div class="rule-actions">
              <button class="btn-icon" onclick="editRule(${rule.id})" title="Düzenle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn-icon btn-icon-danger" onclick="confirmDeleteRule(${rule.id})" title="Sil">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    function renderMembers() {
      const container = document.getElementById('membersList');
      const countEl = document.getElementById('membersCount');
      const members = currentGroup?.uyeler || [];

      countEl.textContent = members.length;

      if (members.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="width: 100%;">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <div class="empty-state-title">Henüz üye eklenmemiş</div>
            <div class="empty-state-desc">Bu gruba çalışan ekleyin.</div>
          </div>
        `;
        return;
      }

      container.innerHTML = members.map(member => {
        const name = member.uyeAdi || 'İsimsiz';
        const nameParts = name.split(' ');
        const initials = getInitials(nameParts[0], nameParts[1]);

        return `
          <div class="member-chip">
            <div class="avatar avatar-emerald">${initials}</div>
            <span>${escapeHtml(name)}</span>
            <button class="remove-btn" onclick="removeMember(${member.uyeId})" title="Kaldır">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        `;
      }).join('');
    }

    function renderMemberSelector() {
      const container = document.getElementById('memberSelectorList');
      const searchTerm = document.getElementById('memberSearchInput').value.toLowerCase();
      const currentMemberIds = new Set((currentGroup?.uyeler || []).map(m => m.uyeId));

      // Filter employees not already in the group
      let availableEmployees = allEmployees.filter(emp => !currentMemberIds.has(emp.id));

      // Apply search filter
      if (searchTerm) {
        availableEmployees = availableEmployees.filter(emp => {
          const fullName = `${emp.adi || ''} ${emp.soyadi || ''}`.toLowerCase();
          const email = (emp.email || '').toLowerCase();
          return fullName.includes(searchTerm) || email.includes(searchTerm);
        });
      }

      if (availableEmployees.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 2rem;">
            <div class="empty-state-title">Eklenecek çalışan bulunamadı</div>
            <div class="empty-state-desc">${searchTerm ? 'Arama kriterlerinizi değiştirin' : 'Tüm çalışanlar zaten bu grupta'}</div>
          </div>
        `;
        return;
      }

      container.innerHTML = availableEmployees.map(emp => {
        const initials = getInitials(emp.adi, emp.soyadi);
        const name = `${emp.adi || ''} ${emp.soyadi || ''}`.trim() || 'İsimsiz';
        const isSelected = selectedMembers.has(emp.id);

        return `
          <div class="member-selector-item ${isSelected ? 'selected' : ''}" onclick="toggleMemberSelection(${emp.id})">
            <div class="checkbox">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div class="avatar avatar-sm avatar-cyan">${initials}</div>
            <div class="member-info">
              <div class="member-name">${escapeHtml(name)}</div>
              <div class="member-email">${escapeHtml(emp.email || '-')}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    function renderBranches() {
      const container = document.getElementById('branchesList');
      const countEl = document.getElementById('branchesCount');
      const subeler = currentGroup?.subeler || [];

      countEl.textContent = subeler.length;

      if (subeler.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="width: 100%;">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <div class="empty-state-title">Henüz şube eklenmemiş</div>
            <div class="empty-state-desc">Bu gruba şube ekleyin.</div>
          </div>
        `;
        return;
      }

      container.innerHTML = subeler.map(sube => {
        const name = sube.subeAdi || 'İsimsiz';
        const initials = name.substring(0, 2).toUpperCase();

        return `
          <div class="member-chip">
            <div class="avatar avatar-indigo">${initials}</div>
            <span>${escapeHtml(name)}</span>
            <button class="remove-btn" onclick="removeBranch(${sube.subeId})" title="Kaldır">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        `;
      }).join('');
    }

    function renderBranchSelector() {
      const container = document.getElementById('branchSelectorList');
      const searchTerm = document.getElementById('branchSearchInput').value.toLowerCase();
      const currentBranchIds = new Set((currentGroup?.subeler || []).map(s => s.subeId));

      // Filter branches not already in the group
      let availableBranches = allSubeler.filter(sube => !currentBranchIds.has(sube.id));

      // Apply search filter
      if (searchTerm) {
        availableBranches = availableBranches.filter(sube => {
          const name = (sube.subeAdi || sube.name || '').toLowerCase();
          return name.includes(searchTerm);
        });
      }

      if (availableBranches.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 2rem;">
            <div class="empty-state-title">Eklenecek şube bulunamadı</div>
            <div class="empty-state-desc">${searchTerm ? 'Arama kriterlerinizi değiştirin' : 'Tüm şubeler zaten bu grupta'}</div>
          </div>
        `;
        return;
      }

      container.innerHTML = availableBranches.map(sube => {
        const name = sube.subeAdi || sube.name || 'İsimsiz';
        const initials = name.substring(0, 2).toUpperCase();
        const isSelected = selectedBranches.has(sube.id);

        return `
          <div class="member-selector-item ${isSelected ? 'selected' : ''}" onclick="toggleBranchSelection(${sube.id})">
            <div class="checkbox">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div class="avatar avatar-sm avatar-indigo">${initials}</div>
            <div class="member-info">
              <div class="member-name">${escapeHtml(name)}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    function updateStats() {
      const totalGroups = groups.length;
      const totalRules = groups.reduce((sum, g) => sum + (g.kuralSayisi ?? 0), 0);
      const totalMembers = groups.reduce((sum, g) => sum + (g.uyeSayisi ?? 0), 0);

      document.getElementById('statTotalGroups').textContent = totalGroups;
      document.getElementById('statTotalRules').textContent = totalRules;
      document.getElementById('statTotalMembers').textContent = totalMembers;
    }

    // ═══════════════════════════════════════════════════════════════
    // CUSTOM DROPDOWN COMPONENT
    // ═══════════════════════════════════════════════════════════════
    function createCustomDropdown(selectId, options, placeholder = 'Seçiniz') {
      const container = document.getElementById(selectId + 'Container');
      if (!container) return;

      const currentValue = container.dataset.value || '';
      const currentLabel = options.find(o => o.value == currentValue)?.label || placeholder;

      container.innerHTML = `
        <div class="custom-select-wrapper" data-select-id="${selectId}">
          <input type="hidden" id="${selectId}" name="${selectId}" value="${currentValue}">
          <div class="custom-select-trigger" onclick="toggleDropdown('${selectId}')">
            <span>${escapeHtml(currentLabel)}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="custom-select-dropdown">
            <div class="custom-select-search">
              <input type="text" placeholder="Ara..." oninput="filterDropdownOptions('${selectId}', this.value)">
            </div>
            <div class="custom-select-options">
              ${options.map(opt => `
                <div class="custom-select-option ${opt.value == currentValue ? 'selected' : ''}"
                     data-value="${opt.value}"
                     onclick="selectDropdownOption('${selectId}', '${opt.value}', '${escapeHtml(opt.label)}')">
                  ${escapeHtml(opt.label)}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    function toggleDropdown(selectId) {
      const wrapper = document.querySelector(`[data-select-id="${selectId}"]`);
      const isOpen = wrapper.classList.contains('open');

      // Diğer tüm dropdownları kapat
      document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));

      if (!isOpen) {
        wrapper.classList.add('open');
        const searchInput = wrapper.querySelector('.custom-select-search input');
        if (searchInput) {
          setTimeout(() => searchInput.focus(), 50);
        }
      }
    }

    function selectDropdownOption(selectId, value, label) {
      const wrapper = document.querySelector(`[data-select-id="${selectId}"]`);
      const hiddenInput = document.getElementById(selectId);
      const trigger = wrapper.querySelector('.custom-select-trigger span');

      hiddenInput.value = value;
      trigger.textContent = label;

      // Önceki seçimi kaldır, yenisini işaretle
      wrapper.querySelectorAll('.custom-select-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });

      wrapper.classList.remove('open');

      // Container'a değeri kaydet
      wrapper.parentElement.dataset.value = value;
    }

    function filterDropdownOptions(selectId, searchTerm) {
      const wrapper = document.querySelector(`[data-select-id="${selectId}"]`);
      const options = wrapper.querySelectorAll('.custom-select-option');
      const term = searchTerm.toLowerCase();
      let hasVisible = false;

      options.forEach(opt => {
        const text = opt.textContent.toLowerCase();
        const visible = text.includes(term);
        opt.style.display = visible ? '' : 'none';
        if (visible) hasVisible = true;
      });
    }

    function setDropdownValue(selectId, value) {
      const container = document.getElementById(selectId + 'Container');
      if (container) {
        container.dataset.value = value;
      }
    }

    function getDropdownValue(selectId) {
      const input = document.getElementById(selectId);
      return input ? input.value : '';
    }

    // Sayfa dışına tıklandığında dropdownları kapat
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // DROPDOWN POPULATION
    // ═══════════════════════════════════════════════════════════════
    function populateCompanyDropdown() {
      const options = [
        { value: '', label: 'Varsayılan (Tümü)' },
        ...insuranceCompanies.map(c => ({ value: c.id.toString(), label: c.sirketAdi || c.ad }))
      ];
      createCustomDropdown('ruleCompany', options, 'Varsayılan (Tümü)');
    }

    function populateBranchDropdown() {
      const options = [
        { value: '', label: 'Varsayılan (Tümü)' },
        ...branches.map(b => ({ value: b.id.toString(), label: b.bransAdi }))
      ];
      createCustomDropdown('ruleBranch', options, 'Varsayılan (Tümü)');
    }

    // ═══════════════════════════════════════════════════════════════
    // MODAL HANDLERS
    // ═══════════════════════════════════════════════════════════════
    function openGroupModal(editId = null) {
      const modal = document.getElementById('groupModal');
      const title = document.getElementById('groupModalTitle');
      const submitBtn = document.getElementById('groupSubmitBtn');
      const nameInput = document.getElementById('groupName');
      const descInput = document.getElementById('groupDescription');

      if (editId) {
        const group = groups.find(g => g.id === editId);
        if (group) {
          title.textContent = 'Grubu Düzenle';
          submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Kaydet';
          nameInput.value = group.grupAdi || '';
          descInput.value = group.aciklama || '';
          currentGroupId = editId;
        }
      } else {
        title.textContent = 'Yeni Grup Oluştur';
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Oluştur';
        nameInput.value = '';
        descInput.value = '';
        currentGroupId = null;
      }

      modal.classList.add('active');
    }

    function closeGroupModal() {
      document.getElementById('groupModal').classList.remove('active');
      currentGroupId = null;
    }

    function openGroupDetail(groupId) {
      loadGroupDetail(groupId).then(() => {
        document.getElementById('groupDetailModal').classList.add('active');
      });
    }

    function closeGroupDetailModal() {
      document.getElementById('groupDetailModal').classList.remove('active');
      currentGroupId = null;
      currentGroup = null;
    }

    function openRuleModal(editId = null) {
      const modal = document.getElementById('ruleModal');
      const title = document.getElementById('ruleModalTitle');
      const submitBtn = document.getElementById('ruleSubmitBtn');

      // Reset form - diğer alanlar
      document.getElementById('ruleConditionField').value = '';
      document.getElementById('ruleConditionOperator').value = '>';
      document.getElementById('ruleConditionOperator').disabled = true;
      document.getElementById('ruleConditionValue').value = '';
      document.getElementById('ruleConditionValue').disabled = true;
      document.getElementById('ruleRate').value = '';

      if (editId) {
        const rules = currentGroup?.kurallar || [];
        const rule = rules.find(r => r.id === editId);
        if (rule) {
          title.textContent = 'Kuralı Düzenle';
          submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Kaydet';

          // 9999 = varsayılan, dropdown'da boş değer olarak göster
          const companyVal = rule.sigortaSirketiId === 9999 ? '' : (rule.sigortaSirketiId?.toString() || '');
          const branchVal = rule.bransId === 9999 ? '' : (rule.bransId?.toString() || '');

          setDropdownValue('ruleCompany', companyVal);
          setDropdownValue('ruleBranch', branchVal);
          populateCompanyDropdown();
          populateBranchDropdown();

          // Koşul alanlarını map et (backend PascalCase döndürüyor)
          const fieldMap = { 'BrutPrim': 'brutPrim', 'NetPrim': 'netPrim', 'Komisyon': 'komisyon' };
          const frontendField = fieldMap[rule.kosulAlani] || '';

          // Koşul var mı kontrol et (varsayılan değilse)
          if (rule.kosulAlani && rule.esikDeger > 0) {
            document.getElementById('ruleConditionField').value = frontendField;
            document.getElementById('ruleConditionOperator').disabled = false;
            document.getElementById('ruleConditionOperator').value = rule.operator || '>';
            document.getElementById('ruleConditionValue').disabled = false;
            document.getElementById('ruleConditionValue').value = rule.esikDeger || '';
          }

          document.getElementById('ruleRate').value = rule.komisyonOrani ?? 0;
          currentRuleId = editId;
        }
      } else {
        title.textContent = 'Yeni Kural Ekle';
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Kaydet';
        currentRuleId = null;

        // Reset custom dropdowns
        setDropdownValue('ruleCompany', '');
        setDropdownValue('ruleBranch', '');
        populateCompanyDropdown();
        populateBranchDropdown();
      }

      modal.classList.add('active');
    }

    function closeRuleModal() {
      document.getElementById('ruleModal').classList.remove('active');
      currentRuleId = null;
    }

    function openMemberSelectorModal() {
      selectedMembers.clear();
      document.getElementById('memberSearchInput').value = '';
      renderMemberSelector();
      document.getElementById('memberSelectorModal').classList.add('active');
    }

    function closeMemberSelectorModal() {
      document.getElementById('memberSelectorModal').classList.remove('active');
      selectedMembers.clear();
    }

    function openBranchSelectorModal() {
      selectedBranches.clear();
      document.getElementById('branchSearchInput').value = '';
      renderBranchSelector();
      document.getElementById('branchSelectorModal').classList.add('active');
    }

    function closeBranchSelectorModal() {
      document.getElementById('branchSelectorModal').classList.remove('active');
      selectedBranches.clear();
    }

    function openConfirmModal(title, message, callback) {
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message;
      confirmCallback = callback;
      document.getElementById('confirmModal').classList.add('active');
    }

    function closeConfirmModal() {
      document.getElementById('confirmModal').classList.remove('active');
      confirmCallback = null;
    }

    function confirmAction() {
      if (confirmCallback) {
        confirmCallback();
      }
      closeConfirmModal();
    }

    // ═══════════════════════════════════════════════════════════════
    // CRUD OPERATIONS
    // ═══════════════════════════════════════════════════════════════
    async function saveGroup() {
      const name = document.getElementById('groupName').value.trim();
      const description = document.getElementById('groupDescription').value.trim();

      if (!name) {
        showToast('Grup adı zorunludur', 'error');
        return;
      }

      const btn = document.getElementById('groupSubmitBtn');
      btn.classList.add('btn-loading');
      btn.disabled = true;

      try {
        const data = { grupAdi: name, aciklama: description, aktif: true };

        if (currentGroupId) {
          await apiPut(`komisyon-gruplari/${currentGroupId}`, data);
          showToast('Grup başarıyla güncellendi', 'success');
        } else {
          await apiPost('komisyon-gruplari', data);
          showToast('Grup başarıyla oluşturuldu', 'success');
        }

        closeGroupModal();
        await loadGroups();
      } catch (error) {
        console.error('Grup kaydedilirken hata:', error);
        showToast(error.message || 'Grup kaydedilirken hata oluştu', 'error');
      } finally {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
      }
    }

    async function updateGroupInfo() {
      const name = document.getElementById('groupDetailName').value.trim();
      const description = document.getElementById('groupDetailDesc').value.trim();

      if (!name) {
        showToast('Grup adı zorunludur', 'error');
        return;
      }

      try {
        await apiPut(`komisyon-gruplari/${currentGroupId}`, { grupAdi: name, aciklama: description, aktif: true });
        showToast('Grup bilgileri güncellendi', 'success');
        document.getElementById('groupDetailTitle').textContent = name;
        await loadGroups();
      } catch (error) {
        console.error('Grup bilgileri güncellenirken hata:', error);
        showToast(error.message || 'Güncelleme sırasında hata oluştu', 'error');
      }
    }

    function editGroup(groupId) {
      openGroupModal(groupId);
    }

    function confirmDeleteGroup(groupId) {
      openConfirmModal(
        'Grubu Sil',
        'Bu grubu silmek istediğinizden emin misiniz? Tüm kurallar ve üye atamaları silinecektir.',
        () => deleteGroupById(groupId)
      );
    }

    async function deleteGroupById(groupId) {
      try {
        await apiDelete(`komisyon-gruplari/${groupId}`);
        showToast('Grup başarıyla silindi', 'success');
        await loadGroups();
      } catch (error) {
        console.error('Grup silinirken hata:', error);
        showToast(error.message || 'Grup silinirken hata oluştu', 'error');
      }
    }

    async function deleteGroup() {
      if (!currentGroupId) return;

      openConfirmModal(
        'Grubu Sil',
        'Bu grubu silmek istediğinizden emin misiniz? Tüm kurallar ve üye atamaları silinecektir.',
        async () => {
          try {
            await apiDelete(`komisyon-gruplari/${currentGroupId}`);
            showToast('Grup başarıyla silindi', 'success');
            closeGroupDetailModal();
            await loadGroups();
          } catch (error) {
            console.error('Grup silinirken hata:', error);
            showToast(error.message || 'Grup silinirken hata oluştu', 'error');
          }
        }
      );
    }

    async function saveRule() {
      const companyId = getDropdownValue('ruleCompany') || null;
      const branchId = getDropdownValue('ruleBranch') || null;
      const conditionField = document.getElementById('ruleConditionField').value || null;
      const conditionOperator = conditionField ? document.getElementById('ruleConditionOperator').value : '>';
      const conditionValue = conditionField ? document.getElementById('ruleConditionValue').value : 0;
      const rate = parseFloat(document.getElementById('ruleRate').value);

      if (isNaN(rate) || rate < 0 || rate > 100) {
        showToast('Geçerli bir komisyon oranı girin (0-100)', 'error');
        return;
      }

      const btn = document.getElementById('ruleSubmitBtn');
      btn.classList.add('btn-loading');
      btn.disabled = true;

      // Frontend field names to backend PascalCase mapping
      const fieldMap = { 'brutPrim': 'BrutPrim', 'netPrim': 'NetPrim', 'komisyon': 'Komisyon' };

      try {
        const data = {
          sigortaSirketiId: companyId ? parseInt(companyId) : 9999,  // 9999 = varsayılan
          bransId: branchId ? parseInt(branchId) : 9999,             // 9999 = varsayılan
          kosulAlani: fieldMap[conditionField] || 'NetPrim',
          operator: conditionOperator || '>',
          esikDeger: conditionValue ? parseFloat(conditionValue) : 0,
          komisyonOrani: Math.round(rate)
        };

        if (currentRuleId) {
          await apiPut(`komisyon-gruplari/${currentGroupId}/kurallar/${currentRuleId}`, data);
          showToast('Kural başarıyla güncellendi', 'success');
        } else {
          await apiPost(`komisyon-gruplari/${currentGroupId}/kurallar`, data);
          showToast('Kural başarıyla eklendi', 'success');
        }

        closeRuleModal();
        await loadGroupDetail(currentGroupId);
        await loadGroups();
      } catch (error) {
        console.error('Kural kaydedilirken hata:', error);
        showToast(error.message || 'Kural kaydedilirken hata oluştu', 'error');
      } finally {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
      }
    }

    function editRule(ruleId) {
      openRuleModal(ruleId);
    }

    function confirmDeleteRule(ruleId) {
      openConfirmModal(
        'Kuralı Sil',
        'Bu kuralı silmek istediğinizden emin misiniz?',
        () => deleteRule(ruleId)
      );
    }

    async function deleteRule(ruleId) {
      try {
        await apiDelete(`komisyon-gruplari/${currentGroupId}/kurallar/${ruleId}`);
        showToast('Kural başarıyla silindi', 'success');
        await loadGroupDetail(currentGroupId);
        await loadGroups();
      } catch (error) {
        console.error('Kural silinirken hata:', error);
        showToast(error.message || 'Kural silinirken hata oluştu', 'error');
      }
    }

    function toggleMemberSelection(employeeId) {
      if (selectedMembers.has(employeeId)) {
        selectedMembers.delete(employeeId);
      } else {
        selectedMembers.add(employeeId);
      }
      renderMemberSelector();
    }

    function filterMembers() {
      renderMemberSelector();
    }

    async function addSelectedMembers() {
      if (selectedMembers.size === 0) {
        showToast('Lütfen en az bir çalışan seçin', 'warning');
        return;
      }

      const btn = document.getElementById('addMembersBtn');
      btn.classList.add('btn-loading');
      btn.disabled = true;

      try {
        // Add members one by one
        for (const memberId of selectedMembers) {
          await apiPost(`komisyon-gruplari/${currentGroupId}/uyeler`, { uyeId: memberId });
        }

        showToast(`${selectedMembers.size} üye başarıyla eklendi`, 'success');
        closeMemberSelectorModal();
        await loadGroupDetail(currentGroupId);
        await loadGroups();
      } catch (error) {
        console.error('Üyeler eklenirken hata:', error);
        showToast(error.message || 'Üyeler eklenirken hata oluştu', 'error');
      } finally {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
      }
    }

    async function removeMember(memberId) {
      try {
        await apiDelete(`komisyon-gruplari/${currentGroupId}/uyeler/${memberId}`);
        showToast('Üye gruptan çıkarıldı', 'success');
        await loadGroupDetail(currentGroupId);
        await loadGroups();
      } catch (error) {
        console.error('Üye çıkarılırken hata:', error);
        showToast(error.message || 'Üye çıkarılırken hata oluştu', 'error');
      }
    }

    function toggleBranchSelection(branchId) {
      if (selectedBranches.has(branchId)) {
        selectedBranches.delete(branchId);
      } else {
        selectedBranches.add(branchId);
      }
      renderBranchSelector();
    }

    function filterBranches() {
      renderBranchSelector();
    }

    async function addSelectedBranches() {
      if (selectedBranches.size === 0) {
        showToast('Lütfen en az bir şube seçin', 'warning');
        return;
      }

      const btn = document.getElementById('addBranchesBtn');
      btn.classList.add('btn-loading');
      btn.disabled = true;

      try {
        // Add branches one by one
        for (const branchId of selectedBranches) {
          await apiPost(`komisyon-gruplari/${currentGroupId}/subeler`, { subeId: branchId });
        }

        showToast(`${selectedBranches.size} şube başarıyla eklendi`, 'success');
        closeBranchSelectorModal();
        await loadGroupDetail(currentGroupId);
        await loadGroups();
      } catch (error) {
        console.error('Şubeler eklenirken hata:', error);
        showToast(error.message || 'Şubeler eklenirken hata oluştu', 'error');
      } finally {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
      }
    }

    async function removeBranch(branchId) {
      try {
        await apiDelete(`komisyon-gruplari/${currentGroupId}/subeler/${branchId}`);
        showToast('Şube gruptan çıkarıldı', 'success');
        await loadGroupDetail(currentGroupId);
        await loadGroups();
      } catch (error) {
        console.error('Şube çıkarılırken hata:', error);
        showToast(error.message || 'Şube çıkarılırken hata oluştu', 'error');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function getInitials(firstName, lastName) {
      const f = (firstName || '').charAt(0).toUpperCase();
      const l = (lastName || '').charAt(0).toUpperCase();
      return (f + l) || '??';
    }

    function formatCondition(rule) {
      const field = rule.kosulAlani;
      const operator = rule.operator;
      const value = rule.esikDeger;

      // Koşul yoksa veya varsayılan değerlerse null döndür
      if (!field || field === 'NetPrim' && operator === '>' && value === 0) return null;

      const fieldNames = {
        'BrutPrim': 'Brüt Prim',
        'NetPrim': 'Net Prim',
        'Komisyon': 'Komisyon'
      };

      const fieldName = fieldNames[field] || field;
      return `${fieldName} ${operator} ${formatCurrency(value)}`;
    }

    function formatCurrency(amount) {
      if (amount == null) return '-';
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    }
