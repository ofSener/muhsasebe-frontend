/**
 * AppComponents.Calendar
 * Outlook-style calendar component with month/week/day views.
 *
 * Usage:
 *   var cal = AppComponents.Calendar.create({
 *     container: document.getElementById('calendarArea'),
 *     view: 'month',
 *     date: new Date(),
 *     tasks: [],
 *     maxTasksPerDay: 3,
 *     onDayClick: function(dateStr) {},
 *     onDayDblClick: function(dateStr) {},
 *     onTaskClick: function(task) {},
 *     onTaskDrop: function(taskId, newDate, newTime) {},
 *     onViewChange: function(view) {},
 *     onNavigate: function(date) {}
 *   });
 *
 *   cal.setView('week');
 *   cal.setDate(new Date());
 *   cal.setTasks(tasks);
 *   cal.refresh();
 *   cal.destroy();
 */

(function() {
  'use strict';

  window.AppComponents = window.AppComponents || {};

  // ── Turkish locale ─────────────────────────────────────────
  var MONTHS = ['Ocak','Subat','Mart','Nisan','Mayis','Haziran','Temmuz','Agustos','Eylul','Ekim','Kasim','Aralik'];
  var DAYS_SHORT = ['Pzt','Sal','Car','Per','Cum','Cmt','Paz'];
  var DAYS_FULL = ['Pazartesi','Sali','Carsamba','Persembe','Cuma','Cumartesi','Pazar'];

  // ── Helpers ────────────────────────────────────────────────
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return dateStr(new Date()); }
  function sameDay(a, b) { return dateStr(a) === dateStr(b); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Monday-based day of week (0=Mon, 6=Sun)
  function dayOfWeek(d) {
    var dow = d.getDay();
    return dow === 0 ? 6 : dow - 1;
  }

  // Get the Monday of the week containing date d
  function getMonday(d) {
    var result = new Date(d);
    var dow = dayOfWeek(result);
    result.setDate(result.getDate() - dow);
    return result;
  }

  function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    var parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  var TYPE_COLORS = ['birthday', 'occasion', 'survey', 'crosssell', 'familytss'];

  // ── Calendar factory ───────────────────────────────────────

  function create(opts) {
    var _container = opts.container;
    var _view = opts.view || 'month';
    var _date = opts.date ? new Date(opts.date) : new Date();
    var _tasks = opts.tasks || [];
    var _maxPerDay = opts.maxTasksPerDay || 3;
    var _selectedDate = null;

    // Callbacks
    var _onDayClick = opts.onDayClick || null;
    var _onDayDblClick = opts.onDayDblClick || null;
    var _onTaskClick = opts.onTaskClick || null;
    var _onTaskDrop = opts.onTaskDrop || null;
    var _onViewChange = opts.onViewChange || null;
    var _onNavigate = opts.onNavigate || null;

    // Drag state
    var _dragTaskId = null;

    // Root element
    var _root = el('div', 'at-calendar');
    _container.innerHTML = '';
    _container.appendChild(_root);

    // ── Build task lookup by date ──────────────────────────
    var _tasksByDate = {};
    function rebuildTaskIndex() {
      _tasksByDate = {};
      for (var i = 0; i < _tasks.length; i++) {
        var t = _tasks[i];
        if (!_tasksByDate[t.date]) _tasksByDate[t.date] = [];
        _tasksByDate[t.date].push(t);
      }
    }
    rebuildTaskIndex();

    // ── Header ─────────────────────────────────────────────
    function renderHeader() {
      var header = el('div', 'at-cal-header');

      var nav = el('div', 'at-cal-nav');

      var prevBtn = el('button', 'at-cal-nav-btn');
      prevBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>';
      prevBtn.title = 'Onceki';
      prevBtn.addEventListener('click', function() { navigate(-1); });

      var title = el('span', 'at-cal-title');
      title.id = 'calTitle';

      var nextBtn = el('button', 'at-cal-nav-btn');
      nextBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,6 15,12 9,18"/></svg>';
      nextBtn.title = 'Sonraki';
      nextBtn.addEventListener('click', function() { navigate(1); });

      var todayBtn = el('button', 'at-cal-today-btn', 'Bugun');
      todayBtn.addEventListener('click', function() {
        _date = new Date();
        render();
        if (_onNavigate) _onNavigate(new Date(_date));
      });

      nav.appendChild(prevBtn);
      nav.appendChild(todayBtn);
      nav.appendChild(title);
      nav.appendChild(nextBtn);

      // View tabs
      var views = el('div', 'at-cal-views');
      var viewNames = [['month', 'Ay'], ['week', 'Hafta'], ['day', 'Gun']];
      viewNames.forEach(function(v) {
        var btn = el('button', 'at-cal-view-btn' + (_view === v[0] ? ' active' : ''), v[1]);
        btn.dataset.view = v[0];
        btn.addEventListener('click', function() {
          setView(v[0]);
        });
        views.appendChild(btn);
      });

      header.appendChild(nav);
      header.appendChild(views);
      return header;
    }

    function updateTitle() {
      var titleEl = _root.querySelector('#calTitle');
      if (!titleEl) return;
      if (_view === 'month') {
        titleEl.textContent = MONTHS[_date.getMonth()] + ' ' + _date.getFullYear();
      } else if (_view === 'week') {
        var mon = getMonday(_date);
        var sun = new Date(mon);
        sun.setDate(sun.getDate() + 6);
        var label = pad(mon.getDate()) + ' ' + MONTHS[mon.getMonth()];
        if (mon.getMonth() !== sun.getMonth()) {
          label += ' - ' + pad(sun.getDate()) + ' ' + MONTHS[sun.getMonth()];
        } else {
          label += ' - ' + pad(sun.getDate());
        }
        label += ' ' + sun.getFullYear();
        titleEl.textContent = label;
      } else {
        titleEl.textContent = pad(_date.getDate()) + ' ' + MONTHS[_date.getMonth()] + ' ' + _date.getFullYear() + ', ' + DAYS_FULL[dayOfWeek(_date)];
      }
    }

    // ── Navigation ─────────────────────────────────────────
    function navigate(dir) {
      if (_view === 'month') {
        _date.setMonth(_date.getMonth() + dir);
      } else if (_view === 'week') {
        _date.setDate(_date.getDate() + dir * 7);
      } else {
        _date.setDate(_date.getDate() + dir);
      }
      render();
      if (_onNavigate) _onNavigate(new Date(_date));
    }

    // ── Drag & Drop helpers ────────────────────────────────
    function makeDraggable(element, task) {
      element.draggable = true;
      element.addEventListener('dragstart', function(e) {
        _dragTaskId = task.id;
        e.dataTransfer.setData('text/plain', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(function() { element.classList.add('at-task-dragging'); }, 0);
      });
      element.addEventListener('dragend', function() {
        element.classList.remove('at-task-dragging');
        _dragTaskId = null;
        // Remove all drag-over classes
        var overs = _root.querySelectorAll('.at-cal-day--drag-over, .at-cal-time-slot--drag-over, .at-cal-day-time-slot--drag-over');
        for (var i = 0; i < overs.length; i++) overs[i].classList.remove('at-cal-day--drag-over', 'at-cal-time-slot--drag-over', 'at-cal-day-time-slot--drag-over');
      });
    }

    function makeDropTarget(element, dateString, timeStr) {
      element.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        element.classList.add(_view === 'month' ? 'at-cal-day--drag-over' : 'at-cal-time-slot--drag-over');
      });
      element.addEventListener('dragleave', function() {
        element.classList.remove('at-cal-day--drag-over', 'at-cal-time-slot--drag-over', 'at-cal-day-time-slot--drag-over');
      });
      element.addEventListener('drop', function(e) {
        e.preventDefault();
        element.classList.remove('at-cal-day--drag-over', 'at-cal-time-slot--drag-over', 'at-cal-day-time-slot--drag-over');
        var taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (taskId && _onTaskDrop) {
          _onTaskDrop(taskId, dateString, timeStr || null);
        }
      });
    }

    // ── Task card builders ─────────────────────────────────
    function compactCard(task) {
      var statusCls = ' at-task-card--status-' + task.status;

      var card = el('div', 'at-task-card--compact at-task-card--type-' + task.type + statusCls);
      card.innerHTML = '<span class="at-task-time">' + escapeHtml(task.time) + '</span> ' + escapeHtml(task.title);
      card.title = task.title + ' - ' + task.customerName;
      card.addEventListener('click', function(e) {
        e.stopPropagation();
        if (_onTaskClick) _onTaskClick(task);
      });
      makeDraggable(card, task);
      return card;
    }

    function expandedCard(task, startHour) {
      var statusCls = ' at-task-card--status-' + task.status;

      var card = el('div', 'at-task-card--expanded at-task-card--type-' + task.type + statusCls);

      // Position: calculate top and height based on time
      var mins = timeToMinutes(task.time);
      var topOffset = (mins - startHour * 60) * (60 / 60); // 60px per hour, 1px per minute
      var height = Math.max((task.duration || 30) * (60 / 60), 24);
      card.style.top = topOffset + 'px';
      card.style.height = height + 'px';

      card.innerHTML =
        '<div class="at-task-card-title">' + escapeHtml(task.title) + '</div>' +
        '<div class="at-task-card-customer">' + escapeHtml(task.customerName) + '</div>' +
        '<div class="at-task-card-time">' + escapeHtml(task.time) + '</div>';
      card.title = task.title + ' - ' + task.customerName;
      card.addEventListener('click', function(e) {
        e.stopPropagation();
        if (_onTaskClick) _onTaskClick(task);
      });
      makeDraggable(card, task);
      return card;
    }

    // ══════════════════════════════════════════════════════
    //  MONTH VIEW
    // ══════════════════════════════════════════════════════

    function renderMonth() {
      var body = el('div', 'at-cal-body');

      // Day-of-week header
      var dowRow = el('div', 'at-cal-dow-row');
      for (var d = 0; d < 7; d++) {
        dowRow.appendChild(el('div', 'at-cal-dow-cell', DAYS_SHORT[d]));
      }
      body.appendChild(dowRow);

      // Calculate grid dates
      var year = _date.getFullYear();
      var month = _date.getMonth();
      var firstOfMonth = new Date(year, month, 1);
      var startDow = dayOfWeek(firstOfMonth);
      var gridStart = new Date(firstOfMonth);
      gridStart.setDate(gridStart.getDate() - startDow);

      var grid = el('div', 'at-cal-grid');
      var today = todayStr();

      for (var i = 0; i < 42; i++) {
        var cellDate = new Date(gridStart);
        cellDate.setDate(gridStart.getDate() + i);
        var ds = dateStr(cellDate);
        var isOther = cellDate.getMonth() !== month;
        var isToday = ds === today;
        var isSelected = _selectedDate === ds;

        var cls = 'at-cal-day';
        if (isOther) cls += ' at-cal-day--other';
        if (isToday) cls += ' at-cal-day--today';
        if (isSelected) cls += ' at-cal-day--selected';

        var cell = el('div', cls);
        cell.dataset.date = ds;

        var dayNum = el('div', 'at-cal-day-num', String(cellDate.getDate()));
        cell.appendChild(dayNum);

        // Tasks for this day
        var dayTasks = _tasksByDate[ds] || [];
        if (dayTasks.length > 0) {
          var taskContainer = el('div', 'at-cal-day-tasks');
          var show = Math.min(dayTasks.length, _maxPerDay);
          for (var j = 0; j < show; j++) {
            taskContainer.appendChild(compactCard(dayTasks[j]));
          }
          if (dayTasks.length > _maxPerDay) {
            var more = el('div', 'at-cal-more-badge', '+' + (dayTasks.length - _maxPerDay) + ' daha');
            more.addEventListener('click', function(dateArg) {
              return function(e) {
                e.stopPropagation();
                _date = new Date(dateArg);
                setView('day');
              };
            }(ds));
            taskContainer.appendChild(more);
          }
          cell.appendChild(taskContainer);
        }

        // Click handlers
        (function(dateArg) {
          var clickTimer = null;
          cell.addEventListener('click', function() {
            if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
            clickTimer = setTimeout(function() {
              clickTimer = null;
              _selectedDate = dateArg;
              render();
              if (_onDayClick) _onDayClick(dateArg);
            }, 250);
          });
          cell.addEventListener('dblclick', function() {
            if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
            if (_onDayDblClick) _onDayDblClick(dateArg);
          });
        })(ds);

        // Drop target
        makeDropTarget(cell, ds);

        grid.appendChild(cell);

        // Stop at 6 weeks if we've past the month
        if (i >= 35 && cellDate.getMonth() !== month) break;
      }

      body.appendChild(grid);
      return body;
    }

    // ══════════════════════════════════════════════════════
    //  WEEK VIEW
    // ══════════════════════════════════════════════════════

    function renderWeek() {
      var body = el('div', 'at-cal-body');
      var startHour = 8;
      var endHour = 19;
      var monday = getMonday(_date);
      var today = todayStr();

      // Column headers
      var headerRow = el('div', 'at-cal-week-header');
      headerRow.appendChild(el('div', 'at-cal-week-header-gutter'));
      for (var d = 0; d < 7; d++) {
        var colDate = new Date(monday);
        colDate.setDate(monday.getDate() + d);
        var ds = dateStr(colDate);
        var isToday = ds === today;
        var hdr = el('div', 'at-cal-week-header-day' + (isToday ? ' at-cal-week-header-day--today' : ''));
        hdr.innerHTML = '<span class="at-cal-week-dow">' + DAYS_SHORT[d] + '</span>' +
                         '<span class="at-cal-week-daynum">' + colDate.getDate() + '</span>';
        headerRow.appendChild(hdr);
      }
      body.appendChild(headerRow);

      // All-day strip
      var alldayStrip = el('div', 'at-cal-allday-strip');
      alldayStrip.appendChild(el('div', 'at-cal-allday-label', 'Tum gun'));
      for (var d2 = 0; d2 < 7; d2++) {
        alldayStrip.appendChild(el('div', 'at-cal-allday-cell'));
      }
      body.appendChild(alldayStrip);

      // Time grid
      var weekBody = el('div', 'at-cal-week-body');

      // Time gutter
      var gutter = el('div', 'at-cal-time-gutter');
      for (var h = startHour; h <= endHour; h++) {
        gutter.appendChild(el('div', 'at-cal-time-label', pad(h) + ':00'));
      }
      weekBody.appendChild(gutter);

      // 7 day columns
      for (var d3 = 0; d3 < 7; d3++) {
        var colDate2 = new Date(monday);
        colDate2.setDate(monday.getDate() + d3);
        var ds2 = dateStr(colDate2);

        var col = el('div', 'at-cal-week-col');
        col.dataset.date = ds2;

        // Time slots
        for (var h2 = startHour; h2 <= endHour; h2++) {
          var slot = el('div', 'at-cal-time-slot');
          slot.dataset.date = ds2;
          slot.dataset.time = pad(h2) + ':00';
          makeDropTarget(slot, ds2, pad(h2) + ':00');
          slot.addEventListener('click', (function(dateArg) {
            return function() {
              if (_onDayClick) _onDayClick(dateArg);
            };
          })(ds2));
          col.appendChild(slot);
        }

        // Place task cards
        var dayTasks = _tasksByDate[ds2] || [];
        for (var t = 0; t < dayTasks.length; t++) {
          var task = dayTasks[t];
          var mins = timeToMinutes(task.time);
          if (mins >= startHour * 60 && mins <= endHour * 60) {
            col.appendChild(expandedCard(task, startHour));
          }
        }

        // Now line
        if (ds2 === today) {
          var now = new Date();
          var nowMins = now.getHours() * 60 + now.getMinutes();
          if (nowMins >= startHour * 60 && nowMins <= endHour * 60) {
            var nowLine = el('div', 'at-cal-now-line');
            nowLine.style.top = ((nowMins - startHour * 60) * (60 / 60)) + 'px';
            col.appendChild(nowLine);
          }
        }

        weekBody.appendChild(col);
      }

      body.appendChild(weekBody);

      // Scroll to 8am
      setTimeout(function() {
        var wb = _root.querySelector('.at-cal-week-body');
        if (wb) wb.scrollTop = 0;
      }, 50);

      return body;
    }

    // ══════════════════════════════════════════════════════
    //  DAY VIEW
    // ══════════════════════════════════════════════════════

    function renderDay() {
      var body = el('div', 'at-cal-body');
      var startHour = 8;
      var endHour = 19;
      var ds = dateStr(_date);
      var today = todayStr();

      // Day header
      var dayHeader = el('div', 'at-cal-day-view-header');
      dayHeader.innerHTML =
        '<div class="at-cal-day-view-daynum">' + _date.getDate() + '</div>' +
        '<div class="at-cal-day-view-info">' +
          '<div class="at-cal-day-view-dow">' + DAYS_FULL[dayOfWeek(_date)] + '</div>' +
          '<div class="at-cal-day-view-date">' + MONTHS[_date.getMonth()] + ' ' + _date.getFullYear() + '</div>' +
        '</div>';
      body.appendChild(dayHeader);

      // Time grid
      var dayBody = el('div', 'at-cal-day-view-body');

      // Gutter
      var gutter = el('div', 'at-cal-time-gutter');
      for (var h = startHour; h <= endHour; h++) {
        gutter.appendChild(el('div', 'at-cal-time-label', pad(h) + ':00'));
      }
      dayBody.appendChild(gutter);

      // Single column
      var col = el('div', 'at-cal-day-view-col');

      for (var h2 = startHour; h2 <= endHour; h2++) {
        var slot = el('div', 'at-cal-day-time-slot');
        slot.dataset.date = ds;
        slot.dataset.time = pad(h2) + ':00';
        makeDropTarget(slot, ds, pad(h2) + ':00');
        col.appendChild(slot);
      }

      // Tasks
      var dayTasks = _tasksByDate[ds] || [];
      for (var t = 0; t < dayTasks.length; t++) {
        var task = dayTasks[t];
        var mins = timeToMinutes(task.time);
        if (mins >= startHour * 60 && mins <= endHour * 60) {
          col.appendChild(expandedCard(task, startHour));
        }
      }

      // Now line
      if (ds === today) {
        var now = new Date();
        var nowMins = now.getHours() * 60 + now.getMinutes();
        if (nowMins >= startHour * 60 && nowMins <= endHour * 60) {
          var nowLine = el('div', 'at-cal-now-line');
          nowLine.style.top = ((nowMins - startHour * 60) * (60 / 60)) + 'px';
          col.appendChild(nowLine);
        }
      }

      dayBody.appendChild(col);
      body.appendChild(dayBody);

      // No tasks message
      if (dayTasks.length === 0) {
        var empty = el('div', 'at-cal-empty');
        empty.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
                          '<span class="at-cal-empty-text">Bu gun icin gorev yok</span>';
        body.appendChild(empty);
      }

      return body;
    }

    // ══════════════════════════════════════════════════════
    //  RENDER
    // ══════════════════════════════════════════════════════

    function render() {
      _root.innerHTML = '';
      _root.appendChild(renderHeader());
      updateTitle();

      // Update active view tab
      var btns = _root.querySelectorAll('.at-cal-view-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].dataset.view === _view);
      }

      if (_view === 'month') {
        _root.appendChild(renderMonth());
      } else if (_view === 'week') {
        _root.appendChild(renderWeek());
      } else {
        _root.appendChild(renderDay());
      }
    }

    // ══════════════════════════════════════════════════════
    //  PUBLIC API
    // ══════════════════════════════════════════════════════

    function setView(view) {
      if (view === _view) return;
      _view = view;
      render();
      if (_onViewChange) _onViewChange(view);
    }

    function setDate(d) {
      _date = new Date(d);
      render();
      if (_onNavigate) _onNavigate(new Date(_date));
    }

    function setTasks(tasks) {
      _tasks = tasks;
      rebuildTaskIndex();
      render();
    }

    function refresh() {
      rebuildTaskIndex();
      render();
    }

    function destroy() {
      _root.innerHTML = '';
      if (_root.parentNode) _root.parentNode.removeChild(_root);
    }

    function getView() { return _view; }
    function getDate() { return new Date(_date); }

    // Initial render
    render();

    return {
      setView: setView,
      setDate: setDate,
      setTasks: setTasks,
      refresh: refresh,
      destroy: destroy,
      getView: getView,
      getDate: getDate
    };
  }

  // ── Register ─────────────────────────────────────────────
  AppComponents.Calendar = { create: create };

})();
