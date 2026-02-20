/**
 * AgentMockData — Otonom AI Agent icin mock veri
 * AI agent musteri verisi + kurallara dayanarak otomatik gorev uretir.
 * Kullanici sadece izler, onaylar/reddeder.
 */

(function() {
  'use strict';

  window.AgentMockData = window.AgentMockData || {};

  // ============================================================
  //  ENUMS
  // ============================================================

  /** Gorev turleri */
  var TASK_TYPES = {
    BIRTHDAY: 0,
    OCCASION: 1,
    SURVEY: 2,
    CROSSSELL: 3,
    FAMILY_TSS: 4
  };

  var TASK_TYPE_LABELS = {
    0: 'Dogum Gunu Hatirlatma',
    1: 'Ozel Gun Tebriki',
    2: 'Memnuniyet Anketi',
    3: 'Capraz Satis',
    4: 'Aile TSS'
  };

  var TASK_TYPE_ICONS = {
    0: 'cake',
    1: 'gift',
    2: 'clipboard',
    3: 'trending-up',
    4: 'users'
  };

  /** AI aksiyon turleri */
  var ACTION_TYPES = {
    SMS: 0,
    CALL: 1,
    OFFER: 2,
    EMAIL: 3,
    SURVEY_SEND: 4
  };

  var ACTION_LABELS = {
    0: 'SMS Gonder',
    1: 'Telefon ile Ara',
    2: 'Teklif Hazirla',
    3: 'E-posta Gonder',
    4: 'Anket Gonder'
  };

  var ACTION_ICONS = {
    0: 'message-square',
    1: 'phone',
    2: 'file-text',
    3: 'mail',
    4: 'bar-chart-2'
  };

  /** Gorev durumlari — AI agent odakli */
  var STATUS = {
    PENDING_APPROVAL: 0,  // AI onerdi, kullanici onay bekliyor
    SCHEDULED: 1,         // Onaylandi, planlanan zamanda calisacak
    RUNNING: 2,           // AI simdi calisiyor
    COMPLETED: 3,         // Basariyla tamamlandi
    FAILED: 4,            // AI calistirdi ama basarisiz oldu
    REJECTED: 5           // Kullanici reddetti
  };

  var STATUS_LABELS = {
    0: 'Onay Bekliyor',
    1: 'Planlandi',
    2: 'Calisiyor',
    3: 'Tamamlandi',
    4: 'Basarisiz',
    5: 'Reddedildi'
  };

  var STATUS_CSS = {
    0: 'pending',
    1: 'scheduled',
    2: 'running',
    3: 'completed',
    4: 'failed',
    5: 'rejected'
  };

  /** Oncelik */
  var PRIORITY = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };
  var PRIORITY_LABELS = { 0: 'Dusuk', 1: 'Normal', 2: 'Yuksek', 3: 'Acil' };

  /** Gorev kaynagi */
  var SOURCE = { AUTO: 'auto', RULE: 'rule' };

  // ============================================================
  //  AUTOMATION RULES
  // ============================================================

  var _rules = [
    {
      id: 1,
      name: 'Dogum Gunu Hatirlatma',
      description: 'Musterinin dogum gunundan 1 gun once otomatik tebrik SMS\'i gonderir.',
      taskType: TASK_TYPES.BIRTHDAY,
      action: ACTION_TYPES.SMS,
      enabled: true,
      triggerDaysBefore: 1,
      icon: 'cake'
    },
    {
      id: 2,
      name: 'Police Yenileme Aramasi',
      description: 'Police bitis tarihinden 30 gun once musteri aranir, yenileme teklifi sunulur.',
      taskType: TASK_TYPES.CROSSSELL,
      action: ACTION_TYPES.CALL,
      enabled: true,
      triggerDaysBefore: 30,
      icon: 'phone'
    },
    {
      id: 3,
      name: 'Memnuniyet Anketi',
      description: 'Police onaylama sonrasi 15 gun icinde memnuniyet anketi gonderir.',
      taskType: TASK_TYPES.SURVEY,
      action: ACTION_TYPES.SURVEY_SEND,
      enabled: true,
      triggerDaysBefore: 0,
      icon: 'clipboard'
    },
    {
      id: 4,
      name: 'Capraz Satis Teklifi',
      description: 'Tek bransi olan musterilere otomatik capraz satis teklifi hazirlar.',
      taskType: TASK_TYPES.CROSSSELL,
      action: ACTION_TYPES.OFFER,
      enabled: true,
      triggerDaysBefore: 0,
      icon: 'trending-up'
    },
    {
      id: 5,
      name: 'Aile TSS Calismasi',
      description: 'TSS policesi olan musterinin ailesine yonelik TSS teklifi olusturur.',
      taskType: TASK_TYPES.FAMILY_TSS,
      action: ACTION_TYPES.OFFER,
      enabled: false,
      triggerDaysBefore: 0,
      icon: 'users'
    },
    {
      id: 6,
      name: 'Ozel Gun Tebriki',
      description: 'Bayram ve ozel gunlerde toplu tebrik SMS\'i gonderir.',
      taskType: TASK_TYPES.OCCASION,
      action: ACTION_TYPES.SMS,
      enabled: true,
      triggerDaysBefore: 0,
      icon: 'gift'
    }
  ];

  // ============================================================
  //  CUSTOMERS (30)
  // ============================================================

  var _customers = [
    { id: 1,  name: 'Ahmet Yilmaz',       phone: '0532 111 2233', tc: '12345678901', birthDate: '1985-03-15', policeBrans: ['Trafik'] },
    { id: 2,  name: 'Fatma Demir',         phone: '0533 222 3344', tc: '23456789012', birthDate: '1990-07-22', policeBrans: ['Kasko','Trafik'] },
    { id: 3,  name: 'Mehmet Kaya',         phone: '0535 333 4455', tc: '34567890123', birthDate: '1978-01-10', policeBrans: ['DASK','Konut'] },
    { id: 4,  name: 'Ayse Celik',          phone: '0536 444 5566', tc: '45678901234', birthDate: '1992-11-05', policeBrans: ['Trafik'] },
    { id: 5,  name: 'Mustafa Sahin',       phone: '0537 555 6677', tc: '56789012345', birthDate: '1988-02-28', policeBrans: ['Kasko','Trafik','TSS'] },
    { id: 6,  name: 'Zeynep Ozturk',       phone: '0538 666 7788', tc: '67890123456', birthDate: '1995-06-18', policeBrans: ['Saglik'] },
    { id: 7,  name: 'Huseyin Arslan',      phone: '0539 777 8899', tc: '78901234567', birthDate: '1982-09-30', policeBrans: ['Trafik','DASK'] },
    { id: 8,  name: 'Emine Dogan',         phone: '0541 888 9900', tc: '89012345678', birthDate: '1987-12-03', policeBrans: ['Kasko'] },
    { id: 9,  name: 'Ali Kilic',           phone: '0542 999 0011', tc: '90123456789', birthDate: '1993-04-25', policeBrans: ['Trafik'] },
    { id: 10, name: 'Hatice Aydin',        phone: '0543 111 2244', tc: '01234567890', birthDate: '1980-08-14', policeBrans: ['TSS','Saglik'] },
    { id: 11, name: 'Ibrahim Yildiz',      phone: '0544 222 3355', tc: '11122233344', birthDate: '1975-05-20', policeBrans: ['Trafik','Kasko'] },
    { id: 12, name: 'Merve Polat',         phone: '0545 333 4466', tc: '22233344455', birthDate: '1998-10-08', policeBrans: ['Trafik'] },
    { id: 13, name: 'Osman Ozdemir',       phone: '0546 444 5577', tc: '33344455566', birthDate: '1983-02-14', policeBrans: ['DASK'] },
    { id: 14, name: 'Elif Erdogan',        phone: '0547 555 6688', tc: '44455566677', birthDate: '1991-07-01', policeBrans: ['Kasko','Trafik'] },
    { id: 15, name: 'Hasan Tas',           phone: '0548 666 7799', tc: '55566677788', birthDate: '1986-11-27', policeBrans: ['TSS'] },
    { id: 16, name: 'Kubra Acar',          phone: '0549 777 8800', tc: '66677788899', birthDate: '1994-03-09', policeBrans: ['Trafik'] },
    { id: 17, name: 'Emre Tekin',          phone: '0551 888 9911', tc: '77788899900', birthDate: '1989-06-12', policeBrans: ['Kasko','DASK'] },
    { id: 18, name: 'Busra Kurt',          phone: '0552 999 0022', tc: '88899900011', birthDate: '1996-01-30', policeBrans: ['Saglik'] },
    { id: 19, name: 'Serkan Basaran',      phone: '0553 111 2255', tc: '99900011122', birthDate: '1981-08-21', policeBrans: ['Trafik','Kasko','DASK'] },
    { id: 20, name: 'Seda Aksoy',          phone: '0554 222 3366', tc: '10111213141', birthDate: '1993-12-17', policeBrans: ['Trafik'] },
    { id: 21, name: 'Burak Korkmaz',       phone: '0555 333 4477', tc: '20212223242', birthDate: '1984-04-06', policeBrans: ['TSS','Trafik'] },
    { id: 22, name: 'Tugba Cinar',         phone: '0556 444 5588', tc: '30313233343', birthDate: '1997-09-15', policeBrans: ['Trafik'] },
    { id: 23, name: 'Volkan Yalcin',       phone: '0557 555 6699', tc: '40414243444', birthDate: '1979-02-19', policeBrans: ['Kasko','Trafik','DASK','Konut'] },
    { id: 24, name: 'Derya Koc',           phone: '0558 666 7700', tc: '50515253545', birthDate: '1990-05-28', policeBrans: ['Saglik','TSS'] },
    { id: 25, name: 'Cem Kaplan',          phone: '0559 777 8811', tc: '60616263646', birthDate: '1987-10-11', policeBrans: ['Trafik'] },
    { id: 26, name: 'Pinar Gunes',         phone: '0561 888 9922', tc: '70717273747', birthDate: '1992-03-24', policeBrans: ['Kasko'] },
    { id: 27, name: 'Tolga Simsek',        phone: '0562 999 0033', tc: '80818283848', birthDate: '1985-07-07', policeBrans: ['Trafik','TSS'] },
    { id: 28, name: 'Esra Cetin',          phone: '0563 111 2266', tc: '90919293949', birthDate: '1994-11-19', policeBrans: ['Trafik'] },
    { id: 29, name: 'Murat Kocer',         phone: '0564 222 3377', tc: '10203040506', birthDate: '1976-06-03', policeBrans: ['Kasko','Trafik','DASK'] },
    { id: 30, name: 'Gamze Yaman',         phone: '0565 333 4488', tc: '60708090101', birthDate: '1999-01-22', policeBrans: ['Trafik'] }
  ];

  // ============================================================
  //  AI REASONS (neden bu gorev olusturuldu)
  // ============================================================

  var REASONS = {
    0: [
      'Musterinin dogum gunu yaklasiyior. Otomatik tebrik SMS\'i planlanmistir.',
      'Dogum gunu hatirlatmasi - {name} {date} tarihinde dogum gununu kutlayacak.'
    ],
    1: [
      'Ramazan Bayrami yaklasiyior. Toplu tebrik mesaji gonderilecek.',
      'Ozel gun tebriki - musteriye bayram/kutlama mesaji planlanmistir.'
    ],
    2: [
      'Musterinin policesi {days} gun once onaylandi. Memnuniyet anketi gonderilecek.',
      'Police sonrasi degerlendirme - musteri deneyimi olcumu yapilacak.'
    ],
    3: [
      'Musterinin sadece {brans} policesi var. Ek brans teklifi hazirlanacak.',
      'Police bitis tarihi yaklasiyior ({date}). Yenileme + ek teklif sunulacak.'
    ],
    4: [
      'Musterinin TSS policesi var. Aile bireylerini kapsayan genisletilmis TSS teklifi hazirlanacak.',
      'Musterinin cocuklari icin TSS teklifi olusturulacak.'
    ]
  };

  // ============================================================
  //  AI ACTIVITY LOG
  // ============================================================

  var _activityLog = [];

  function addActivity(type, message, taskId) {
    _activityLog.unshift({
      id: _activityLog.length + 1,
      type: type, // 'created', 'completed', 'failed', 'approved', 'rejected'
      message: message,
      taskId: taskId || null,
      timestamp: new Date().toISOString()
    });
    if (_activityLog.length > 50) _activityLog.length = 50;
  }

  // ============================================================
  //  TASK GENERATION
  // ============================================================

  var _nextId = 1;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function generateDate(base, offsetDays) {
    var d = new Date(base);
    d.setDate(d.getDate() + offsetDays);
    return d;
  }

  var HOURS = ['09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00'];

  function makeReason(type, customer) {
    var templates = REASONS[type];
    var tpl = randomItem(templates);
    return tpl
      .replace('{name}', customer.name)
      .replace('{date}', customer.birthDate || '')
      .replace('{days}', String(randomInt(10, 30)))
      .replace('{brans}', (customer.policeBrans || [])[0] || 'Trafik');
  }

  function generateTasks() {
    var tasks = [];
    var today = new Date();
    var start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    var totalDays = 90;

    // Type → action mapping
    var typeActions = {
      0: [ACTION_TYPES.SMS],
      1: [ACTION_TYPES.SMS, ACTION_TYPES.EMAIL],
      2: [ACTION_TYPES.SURVEY_SEND],
      3: [ACTION_TYPES.CALL, ACTION_TYPES.OFFER],
      4: [ACTION_TYPES.OFFER, ACTION_TYPES.CALL]
    };

    var titles = {
      0: ['Dogum gunu tebrik SMS\'i', 'Dogum gunu kutlama mesaji'],
      1: ['Bayram tebrik mesaji', 'Ozel gun tebriki', 'Yilbasi kutlamasi'],
      2: ['Police memnuniyet anketi', 'Hasar sureci degerlendirmesi', 'Hizmet kalitesi anketi'],
      3: ['Kasko teklifi hazirla', 'DASK teklifi sun', 'Saglik sigortasi onerisi', 'Police yenileme aramasi'],
      4: ['Aile TSS paketi olustur', 'Es ve cocuklar icin TSS teklifi']
    };

    for (var i = 0; i < 75; i++) {
      var type = i < 15 ? 0 : i < 27 ? 1 : i < 42 ? 2 : i < 58 ? 3 : 4;
      var customer = _customers[i % 30];
      var taskDate = generateDate(start, randomInt(0, totalDays));
      var ds = dateStr(taskDate);
      var isPast = ds < dateStr(today);
      var isToday = ds === dateStr(today);

      // Status distribution: past=mostly completed, future=pending/scheduled, today=mixed
      var status;
      if (isPast) {
        var r = Math.random();
        status = r < 0.55 ? STATUS.COMPLETED : r < 0.70 ? STATUS.FAILED : r < 0.80 ? STATUS.REJECTED : STATUS.COMPLETED;
      } else if (isToday) {
        var r2 = Math.random();
        status = r2 < 0.3 ? STATUS.RUNNING : r2 < 0.5 ? STATUS.SCHEDULED : r2 < 0.7 ? STATUS.PENDING_APPROVAL : STATUS.COMPLETED;
      } else {
        var r3 = Math.random();
        status = r3 < 0.45 ? STATUS.PENDING_APPROVAL : STATUS.SCHEDULED;
      }

      var action = randomItem(typeActions[type]);
      var title = randomItem(titles[type]);
      var policyNo = (type === 3 || type === 4) ? randomItem(['TRF','KSK','DSK','SGL']) + '-' + randomInt(100000, 999999) : '';

      var completedAt = null;
      var resultMessage = null;
      if (status === STATUS.COMPLETED) {
        completedAt = ds + 'T' + randomItem(HOURS);
        resultMessage = 'Basariyla tamamlandi.';
        if (action === ACTION_TYPES.SMS) resultMessage = 'SMS basariyla gonderildi.';
        if (action === ACTION_TYPES.CALL) resultMessage = 'Musteri aranarak bilgilendirildi.';
        if (action === ACTION_TYPES.OFFER) resultMessage = 'Teklif hazirlandi ve musteriye iletildi.';
        if (action === ACTION_TYPES.SURVEY_SEND) resultMessage = 'Anket linki gonderildi, musteri yanit verdi.';
      } else if (status === STATUS.FAILED) {
        completedAt = ds + 'T' + randomItem(HOURS);
        resultMessage = randomItem([
          'Telefon numarasina ulasilamadi.',
          'SMS gonderilemedi — numara gecersiz.',
          'Musteri mesgul, tekrar denenecek.',
          'API hatasi — baglanti zaman asimi.'
        ]);
      }

      tasks.push({
        id: _nextId++,
        type: type,
        action: action,
        title: title,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        date: ds,
        time: randomItem(HOURS),
        duration: type === 0 ? 5 : type === 2 ? 10 : type === 3 ? 30 : type === 4 ? 45 : 5,
        status: status,
        priority: type === 4 ? PRIORITY.HIGH : (type === 3 ? randomItem([PRIORITY.NORMAL, PRIORITY.HIGH]) : PRIORITY.NORMAL),
        source: Math.random() < 0.6 ? SOURCE.AUTO : SOURCE.RULE,
        ruleId: null,
        aiReason: makeReason(type, customer),
        policyNo: policyNo,
        createdAt: dateStr(generateDate(taskDate, -randomInt(1, 7))),
        completedAt: completedAt,
        resultMessage: resultMessage
      });
    }

    // Sort by date then time
    tasks.sort(function(a, b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); });

    // Generate activity log from completed/failed tasks
    tasks.forEach(function(t) {
      if (t.status === STATUS.COMPLETED) {
        addActivity('completed', ACTION_LABELS[t.action] + ' — ' + t.customerName + ': ' + t.resultMessage, t.id);
      } else if (t.status === STATUS.FAILED) {
        addActivity('failed', ACTION_LABELS[t.action] + ' — ' + t.customerName + ': ' + t.resultMessage, t.id);
      }
    });

    // Add some recent "created" activities
    for (var k = 0; k < 5; k++) {
      var recentTask = tasks[tasks.length - 1 - k];
      if (recentTask) {
        addActivity('created', 'Yeni gorev olusturuldu: ' + recentTask.title + ' — ' + recentTask.customerName, recentTask.id);
      }
    }

    return tasks;
  }

  var _tasks = generateTasks();

  // ============================================================
  //  HELPERS
  // ============================================================

  function getTasksForDate(ds) {
    return _tasks.filter(function(t) { return t.date === ds; });
  }

  function getTasksForRange(startDate, endDate) {
    var s = typeof startDate === 'string' ? startDate : dateStr(startDate);
    var e = typeof endDate === 'string' ? endDate : dateStr(endDate);
    return _tasks.filter(function(t) { return t.date >= s && t.date <= e; });
  }

  function getTasksByType(type) {
    return _tasks.filter(function(t) { return t.type === type; });
  }

  function getTasksByStatus(status) {
    return _tasks.filter(function(t) { return t.status === status; });
  }

  function getTaskById(id) {
    for (var i = 0; i < _tasks.length; i++) {
      if (_tasks[i].id === id) return _tasks[i];
    }
    return null;
  }

  function updateTask(id, updates) {
    for (var i = 0; i < _tasks.length; i++) {
      if (_tasks[i].id === id) {
        Object.assign(_tasks[i], updates);
        return _tasks[i];
      }
    }
    return null;
  }

  function getAllTasks() {
    return _tasks.slice();
  }

  // ── Task actions (approve / reject / postpone) ──────────

  function approveTask(id) {
    var t = updateTask(id, { status: STATUS.SCHEDULED });
    if (t) addActivity('approved', 'Gorev onaylandi: ' + t.title + ' — ' + t.customerName, id);
    return t;
  }

  function rejectTask(id) {
    var t = updateTask(id, { status: STATUS.REJECTED });
    if (t) addActivity('rejected', 'Gorev reddedildi: ' + t.title + ' — ' + t.customerName, id);
    return t;
  }

  function postponeTask(id, newDate) {
    var t = updateTask(id, { date: newDate, status: STATUS.PENDING_APPROVAL });
    if (t) addActivity('created', 'Gorev ertelendi: ' + t.title + ' — ' + newDate, id);
    return t;
  }

  function approveAll() {
    var count = 0;
    _tasks.forEach(function(t) {
      if (t.status === STATUS.PENDING_APPROVAL) {
        t.status = STATUS.SCHEDULED;
        count++;
      }
    });
    if (count > 0) addActivity('approved', count + ' gorev toplu onaylandi.', null);
    return count;
  }

  // ── Rules ───────────────────────────────────────────────

  function getRules() { return _rules.slice(); }

  function toggleRule(ruleId, enabled) {
    for (var i = 0; i < _rules.length; i++) {
      if (_rules[i].id === ruleId) {
        _rules[i].enabled = enabled;
        return _rules[i];
      }
    }
    return null;
  }

  // ── Activity Log ────────────────────────────────────────

  function getActivityLog(limit) {
    return _activityLog.slice(0, limit || 20);
  }

  // ── Agent Stats ─────────────────────────────────────────

  function getAgentStats() {
    var today = dateStr(new Date());
    var stats = {
      totalTasks: _tasks.length,
      pendingApproval: 0,
      scheduled: 0,
      running: 0,
      completedToday: 0,
      completedTotal: 0,
      failedTotal: 0,
      todayTasks: 0,
      successRate: 0
    };
    _tasks.forEach(function(t) {
      if (t.status === STATUS.PENDING_APPROVAL) stats.pendingApproval++;
      if (t.status === STATUS.SCHEDULED) stats.scheduled++;
      if (t.status === STATUS.RUNNING) stats.running++;
      if (t.status === STATUS.COMPLETED) {
        stats.completedTotal++;
        if (t.date === today) stats.completedToday++;
      }
      if (t.status === STATUS.FAILED) stats.failedTotal++;
      if (t.date === today) stats.todayTasks++;
    });
    var attempted = stats.completedTotal + stats.failedTotal;
    stats.successRate = attempted > 0 ? Math.round((stats.completedTotal / attempted) * 100) : 100;
    return stats;
  }

  function searchCustomers(query) {
    if (!query || query.length < 2) return [];
    var q = query.toLowerCase();
    return _customers.filter(function(c) {
      return c.name.toLowerCase().indexOf(q) !== -1 ||
             c.phone.replace(/\s/g, '').indexOf(q.replace(/\s/g, '')) !== -1;
    }).slice(0, 10);
  }

  function getCustomerById(id) {
    for (var i = 0; i < _customers.length; i++) {
      if (_customers[i].id === id) return _customers[i];
    }
    return null;
  }

  // ============================================================
  //  PUBLIC API
  // ============================================================

  AgentMockData.TASK_TYPES = TASK_TYPES;
  AgentMockData.TASK_TYPE_LABELS = TASK_TYPE_LABELS;
  AgentMockData.TASK_TYPE_ICONS = TASK_TYPE_ICONS;
  AgentMockData.ACTION_TYPES = ACTION_TYPES;
  AgentMockData.ACTION_LABELS = ACTION_LABELS;
  AgentMockData.ACTION_ICONS = ACTION_ICONS;
  AgentMockData.STATUS = STATUS;
  AgentMockData.STATUS_LABELS = STATUS_LABELS;
  AgentMockData.STATUS_CSS = STATUS_CSS;
  AgentMockData.PRIORITY = PRIORITY;
  AgentMockData.PRIORITY_LABELS = PRIORITY_LABELS;
  AgentMockData.SOURCE = SOURCE;

  AgentMockData.getTasksForDate = getTasksForDate;
  AgentMockData.getTasksForRange = getTasksForRange;
  AgentMockData.getTasksByType = getTasksByType;
  AgentMockData.getTasksByStatus = getTasksByStatus;
  AgentMockData.getTaskById = getTaskById;
  AgentMockData.updateTask = updateTask;
  AgentMockData.getAllTasks = getAllTasks;
  AgentMockData.approveTask = approveTask;
  AgentMockData.rejectTask = rejectTask;
  AgentMockData.postponeTask = postponeTask;
  AgentMockData.approveAll = approveAll;
  AgentMockData.getRules = getRules;
  AgentMockData.toggleRule = toggleRule;
  AgentMockData.getActivityLog = getActivityLog;
  AgentMockData.getAgentStats = getAgentStats;
  AgentMockData.searchCustomers = searchCustomers;
  AgentMockData.getCustomerById = getCustomerById;
  AgentMockData.customers = _customers;

})();
