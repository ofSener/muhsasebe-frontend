/**
 * AI Agent - Gorev Takvimi (Otonom AI)
 * Kullanici gorev olusturmaz — AI agent otomatik uretir.
 * Kullanici: izler, onaylar, reddeder, erteler.
 */

// ============================================================
//  STATE
// ============================================================

var _calendarInstance = null;
var _allTasks = [];
var _filteredTasks = [];

var _filters = {
  types: [0, 1, 2, 3, 4],
  statuses: null // null = show all
};

// ============================================================
//  HELPERS
// ============================================================

function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function toDateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function todayStr2() { return toDateStr(new Date()); }

var escHtml = (AppComponents._utils && AppComponents._utils.escapeHtml)
  ? AppComponents._utils.escapeHtml
  : function(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; };

var STATUS = AgentMockData.STATUS;
var STATUS_LABELS = AgentMockData.STATUS_LABELS;
var STATUS_CSS = AgentMockData.STATUS_CSS;
var ACTION_LABELS = AgentMockData.ACTION_LABELS;
var TYPE_LABELS = AgentMockData.TASK_TYPE_LABELS;

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  loadTasks();
  initCalendar();
  initMiniCalendar();
  initFilters();
  initRules();
  initApproveAll();
  initFab();
  refreshPanel();
});

// ============================================================
//  LOAD & FILTER
// ============================================================

function loadTasks() {
  _allTasks = AgentMockData.getAllTasks();
  applyFilters();
}

function applyFilters() {
  _filteredTasks = _allTasks.filter(function(t) {
    return _filters.types.indexOf(t.type) !== -1;
  });
  if (_calendarInstance) {
    _calendarInstance.setTasks(_filteredTasks);
  }
  refreshPanel();
}

// ============================================================
//  CALENDAR
// ============================================================

function initCalendar() {
  var container = document.getElementById('calendarArea');
  if (!container) return;

  _calendarInstance = AppComponents.Calendar.create({
    container: container,
    view: 'month',
    date: new Date(),
    tasks: _filteredTasks,
    maxTasksPerDay: 3,
    onDayClick: function() {},
    onDayDblClick: function(dateString) {
      if (_calendarInstance) {
        _calendarInstance.setDate(new Date(dateString));
        _calendarInstance.setView('day');
      }
    },
    onTaskClick: function(task) { openTaskDetail(task); },
    onTaskDrop: function(taskId, newDate, newTime) {
      var task = AgentMockData.getTaskById(taskId);
      if (!task) return;
      // Only allow moving pending/scheduled tasks
      if (task.status > 1) {
        toast('Tamamlanmis veya calisan gorevler tasinamaz.', 'error');
        return;
      }
      var updates = { date: newDate };
      if (newTime) updates.time = newTime;
      AgentMockData.updateTask(taskId, updates);
      loadTasks();
      toast('Gorev ' + newDate + ' tarihine tasindi.', 'success');
    },
    onViewChange: function() {},
    onNavigate: function() {}
  });
}

// ============================================================
//  TASK DETAIL MODAL (Read-only + Actions)
// ============================================================

function openTaskDetail(task) {
  if (!task) return;

  var statusBadge = '<span class="at-status-badge at-status-badge--' + STATUS_CSS[task.status] + '">' + STATUS_LABELS[task.status] + '</span>';
  var actionBadge = '<span class="at-action-badge">' + ACTION_LABELS[task.action] + '</span>';
  var typeDot = '<span class="at-category-dot at-category-dot--' + ['birthday','occasion','survey','crosssell','familytss'][task.type] + '"></span>';
  var sourceLabel = task.source === 'auto' ? 'Otomatik (musteri verisi)' : 'Kural tabanli';

  var content = '<div class="at-detail">';

  // Header row
  content += '<div class="at-detail-header">' +
    '<div class="at-detail-type">' + typeDot + ' ' + escHtml(TYPE_LABELS[task.type]) + '</div>' +
    statusBadge +
    '</div>';

  // Title
  content += '<h3 class="at-detail-title">' + escHtml(task.title) + '</h3>';

  // Customer
  content += '<div class="at-detail-row">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
    '<span><strong>' + escHtml(task.customerName) + '</strong> &middot; ' + escHtml(task.customerPhone) + '</span>' +
    '</div>';

  // Date + Time + Action
  content += '<div class="at-detail-row">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
    '<span>' + task.date + ' &middot; ' + task.time + ' &middot; ~' + task.duration + ' dk</span>' +
    '</div>';

  content += '<div class="at-detail-row">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>' +
    '<span>Aksiyon: ' + actionBadge + ' &middot; Kaynak: ' + sourceLabel + '</span>' +
    '</div>';

  if (task.policyNo) {
    content += '<div class="at-detail-row">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>' +
      '<span>Police: <strong>' + escHtml(task.policyNo) + '</strong></span>' +
      '</div>';
  }

  // AI Reason
  content += '<div class="at-detail-reason">' +
    '<div class="at-detail-reason-label">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>' +
      ' AI Gerekce' +
    '</div>' +
    '<p>' + escHtml(task.aiReason) + '</p>' +
    '</div>';

  // Result (if completed or failed)
  if (task.resultMessage) {
    var resultClass = task.status === STATUS.COMPLETED ? 'success' : 'failed';
    content += '<div class="at-detail-result at-detail-result--' + resultClass + '">' +
      '<strong>' + (task.status === STATUS.COMPLETED ? 'Sonuc:' : 'Hata:') + '</strong> ' +
      escHtml(task.resultMessage) +
      '</div>';
  }

  content += '</div>';

  // Footer — action buttons based on status
  var footerEl = document.createElement('div');
  footerEl.style.display = 'contents';

  var closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-secondary';
  closeBtn.textContent = 'Kapat';
  closeBtn.addEventListener('click', function() { AppComponents.Modal.close(); });

  if (task.status === STATUS.PENDING_APPROVAL) {
    // Reject
    var rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn at-btn-reject';
    rejectBtn.textContent = 'Reddet';
    rejectBtn.addEventListener('click', function() {
      AgentMockData.rejectTask(task.id);
      AppComponents.Modal.close(true);
      loadTasks();
      toast('Gorev reddedildi.', 'success');
    });

    // Postpone
    var postponeBtn = document.createElement('button');
    postponeBtn.className = 'btn btn-secondary';
    postponeBtn.textContent = 'Ertele (+7 gun)';
    postponeBtn.addEventListener('click', function() {
      var newDate = new Date(task.date);
      newDate.setDate(newDate.getDate() + 7);
      AgentMockData.postponeTask(task.id, toDateStr(newDate));
      AppComponents.Modal.close(true);
      loadTasks();
      toast('Gorev 7 gun ertelendi.', 'success');
    });

    // Approve
    var approveBtn = document.createElement('button');
    approveBtn.className = 'btn at-btn-approve';
    approveBtn.textContent = 'Onayla';
    approveBtn.addEventListener('click', function() {
      AgentMockData.approveTask(task.id);
      AppComponents.Modal.close(true);
      loadTasks();
      toast('Gorev onaylandi.', 'success');
    });

    footerEl.appendChild(rejectBtn);
    footerEl.appendChild(postponeBtn);
    footerEl.appendChild(closeBtn);
    footerEl.appendChild(approveBtn);
  } else if (task.status === STATUS.SCHEDULED) {
    // Allow rejection of scheduled tasks too
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn at-btn-reject';
    cancelBtn.textContent = 'Iptal Et';
    cancelBtn.addEventListener('click', function() {
      AgentMockData.rejectTask(task.id);
      AppComponents.Modal.close(true);
      loadTasks();
      toast('Gorev iptal edildi.', 'success');
    });
    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(closeBtn);
  } else {
    footerEl.appendChild(closeBtn);
  }

  AppComponents.Modal.open({
    title: 'Gorev Detayi',
    content: content,
    size: 'lg',
    footer: footerEl
  });
}

// ============================================================
//  APPROVE ALL
// ============================================================

function initApproveAll() {
  var btn = document.getElementById('approveAllBtn');
  if (!btn) return;
  btn.addEventListener('click', function() {
    var pendingCount = AgentMockData.getAgentStats().pendingApproval;
    if (pendingCount === 0) {
      toast('Onay bekleyen gorev yok.', 'info');
      return;
    }
    AppComponents.Modal.confirm(
      'Toplu Onay',
      pendingCount + ' gorev onaylanacak. Devam etmek istiyor musunuz?',
      {
        confirmText: 'Evet, Tumu Onayla',
        confirmClass: 'btn at-btn-approve',
        onConfirm: function() {
          var count = AgentMockData.approveAll();
          loadTasks();
          toast(count + ' gorev onaylandi.', 'success');
        }
      }
    );
  });
}

// ============================================================
//  FAB (Mobile — toggle panel)
// ============================================================

function initFab() {
  var fab = document.getElementById('fabBtn');
  var panel = document.getElementById('leftPanel');
  if (fab && panel) {
    fab.addEventListener('click', function() {
      panel.classList.toggle('at-panel--visible');
    });
  }
}

// ============================================================
//  MINI CALENDAR
// ============================================================

function initMiniCalendar() {
  var container = document.getElementById('miniCalendar');
  if (!container) return;
  renderMiniCalendar(container, new Date());
}

function renderMiniCalendar(container, refDate) {
  var MONTHS = ['Ocak','Subat','Mart','Nisan','Mayis','Haziran','Temmuz','Agustos','Eylul','Ekim','Kasim','Aralik'];
  var DAYS = ['Pt','Sa','Ca','Pe','Cu','Ct','Pz'];
  var year = refDate.getFullYear();
  var month = refDate.getMonth();
  var today = todayStr2();

  // Dates with tasks
  var taskDates = {};
  _allTasks.forEach(function(t) { taskDates[t.date] = true; });

  var html = '<div class="at-mini-cal-header">' +
    '<span class="at-mini-cal-title">' + MONTHS[month] + ' ' + year + '</span>' +
    '<div class="at-mini-cal-nav">' +
      '<button data-dir="-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg></button>' +
      '<button data-dir="1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,6 15,12 9,18"/></svg></button>' +
    '</div></div>';

  html += '<div class="at-mini-cal-grid">';
  for (var d = 0; d < 7; d++) {
    html += '<div class="at-mini-cal-dow">' + DAYS[d] + '</div>';
  }

  var first = new Date(year, month, 1);
  var startDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
  var gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() - startDow);

  for (var i = 0; i < 42; i++) {
    var cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + i);
    var ds = toDateStr(cellDate);
    var isOther = cellDate.getMonth() !== month;
    var isToday = ds === today;
    var hasTasks = taskDates[ds];

    var cls = 'at-mini-cal-day';
    if (isOther) cls += ' at-mini-cal-day--other';
    if (isToday) cls += ' at-mini-cal-day--today';
    if (hasTasks) cls += ' at-mini-cal-day--has-tasks';

    html += '<div class="' + cls + '" data-date="' + ds + '">' + cellDate.getDate() + '</div>';
    if (i >= 35 && cellDate.getMonth() !== month) break;
  }
  html += '</div>';
  container.innerHTML = html;

  // Nav buttons
  container.querySelectorAll('.at-mini-cal-nav button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      renderMiniCalendar(container, new Date(year, month + parseInt(this.dataset.dir, 10), 1));
    });
  });

  // Day clicks → navigate main calendar
  container.querySelectorAll('.at-mini-cal-day').forEach(function(el) {
    el.addEventListener('click', function() {
      var ds2 = this.dataset.date;
      if (!ds2) return;
      if (_calendarInstance) _calendarInstance.setDate(new Date(ds2));
      container.querySelectorAll('.at-mini-cal-day--selected').forEach(function(s) { s.classList.remove('at-mini-cal-day--selected'); });
      this.classList.add('at-mini-cal-day--selected');
    });
  });
}

// ============================================================
//  FILTERS
// ============================================================

function initFilters() {
  var catContainer = document.getElementById('categoryFilters');
  if (catContainer) {
    catContainer.addEventListener('change', function(e) {
      if (e.target.type !== 'checkbox') return;
      var type = parseInt(e.target.dataset.type, 10);
      if (isNaN(type)) return;
      if (e.target.checked) {
        if (_filters.types.indexOf(type) === -1) _filters.types.push(type);
      } else {
        _filters.types = _filters.types.filter(function(t) { return t !== type; });
      }
      applyFilters();
    });
  }
}

// ============================================================
//  AUTOMATION RULES
// ============================================================

function initRules() {
  renderRules();
}

function renderRules() {
  var container = document.getElementById('rulesList');
  if (!container) return;

  var rules = AgentMockData.getRules();
  var html = '';
  rules.forEach(function(rule) {
    html += '<div class="at-rule-item">' +
      '<div class="at-rule-info">' +
        '<div class="at-rule-name">' + escHtml(rule.name) + '</div>' +
        '<div class="at-rule-desc">' + escHtml(rule.description) + '</div>' +
      '</div>' +
      '<label class="at-rule-toggle">' +
        '<input type="checkbox" ' + (rule.enabled ? 'checked' : '') + ' data-rule-id="' + rule.id + '">' +
        '<span class="at-rule-toggle-slider"></span>' +
      '</label>' +
    '</div>';
  });
  container.innerHTML = html;

  // Toggle handlers
  container.querySelectorAll('input[data-rule-id]').forEach(function(input) {
    input.addEventListener('change', function() {
      var ruleId = parseInt(this.dataset.ruleId, 10);
      var enabled = this.checked;
      AgentMockData.toggleRule(ruleId, enabled);
      toast(enabled ? 'Kural aktif edildi.' : 'Kural devre disi birakildi.', 'success');
    });
  });
}

// ============================================================
//  PANEL UPDATES
// ============================================================

function refreshPanel() {
  updateStats();
  updateCategoryCounts();
  updateActivityLog();
}

function updateStats() {
  var stats = AgentMockData.getAgentStats();

  setText('statPending', stats.pendingApproval);
  setText('statToday', stats.todayTasks);
  setText('statRunning', stats.running);
  setText('statSuccess', '%' + stats.successRate);
  setText('pendingCount', stats.pendingApproval);

  // Hide approve-all if no pending
  var approveBtn = document.getElementById('approveAllBtn');
  if (approveBtn) {
    approveBtn.style.display = stats.pendingApproval > 0 ? '' : 'none';
  }
}

function updateCategoryCounts() {
  var counts = {};
  _allTasks.forEach(function(t) { counts[t.type] = (counts[t.type] || 0) + 1; });
  for (var type = 0; type <= 4; type++) {
    var el = document.querySelector('[data-type-count="' + type + '"]');
    if (el) el.textContent = counts[type] || 0;
  }
}

function updateActivityLog() {
  var container = document.getElementById('activityList');
  if (!container) return;

  var log = AgentMockData.getActivityLog(8);
  if (log.length === 0) {
    container.innerHTML = '<div class="at-upcoming-empty">Henuz aktivite yok</div>';
    return;
  }

  var typeIcons = {
    created: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    completed: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    failed: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    approved: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    rejected: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
  };

  var html = '';
  log.forEach(function(item) {
    var icon = typeIcons[item.type] || typeIcons.created;
    html += '<div class="at-activity-item">' +
      '<span class="at-activity-icon">' + icon + '</span>' +
      '<span class="at-activity-text">' + escHtml(item.message) + '</span>' +
    '</div>';
  });
  container.innerHTML = html;
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function toast(msg, type) {
  if (typeof showToast === 'function') {
    showToast(msg, type);
  } else if (AppComponents.Toast && AppComponents.Toast[type]) {
    AppComponents.Toast[type](msg);
  }
}
