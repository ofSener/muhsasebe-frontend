    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    let asimlar = [];

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', async function() {
      requirePermission('komisyonOranlariniDuzenleyebilsin');
      await loadAsimlar();
    });

    // ═══════════════════════════════════════════════════════════════
    // API
    // ═══════════════════════════════════════════════════════════════
    async function loadAsimlar() {
      try {
        const response = await apiGet('kota-kontrolleri');
        asimlar = response || [];
        renderTable();
        updateStats();
      } catch (error) {
        console.error('Kota aşımları yüklenirken hata:', error);
        showToast('Kota aşımları yüklenirken hata oluştu', 'error');
        asimlar = [];
        renderTable();
        updateStats();
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════
    function renderTable() {
      const tbody = document.getElementById('asimlarBody');
      const countEl = document.getElementById('asimlarCount');

      if (!asimlar || asimlar.length === 0) {
        countEl.textContent = '0 aşım';
        tbody.innerHTML = `
          <tr>
            <td colspan="9">
              <div class="empty-state">
                <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <div class="empty-state-title">Kota aşımı bulunamadı</div>
                <div class="empty-state-desc">Tüm çalışanlar kota limitleri dahilinde çalışıyor.</div>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      countEl.textContent = `${asimlar.length} aşım`;

      tbody.innerHTML = asimlar.map((asim, index) => {
        const initials = getInitials(asim.produktorAdi);
        const avatarClass = `avatar-${(asim.produktorId % 6) + 1}`;
        const subeAdi = asim.subeAdi || 'Tümü';
        const sirketAdi = asim.sigortaSirketAdi || 'Tümü';
        const bransAdi = asim.bransAdi || 'Tümü';
        const turuLabel = getMaksimumTuruLabel(asim.maksimumTuru);
        const limitText = getLimitText(asim);
        const gerceklesenText = getGerceklesenText(asim);
        const asimText = getAsimText(asim);
        const dateText = getDateRangeText(asim);

        return `
          <tr>
            <td>
              <div class="employee-cell">
                <div class="avatar ${avatarClass}">${initials}</div>
                <span class="name">${escapeHtml(asim.produktorAdi || 'Bilinmiyor')}</span>
              </div>
            </td>
            <td>${escapeHtml(subeAdi)}</td>
            <td>${escapeHtml(sirketAdi)}</td>
            <td>${escapeHtml(bransAdi)}</td>
            <td><span class="badge-tur">${escapeHtml(turuLabel)}</span></td>
            <td><span class="text-limit">${limitText}</span></td>
            <td><span class="text-value">${gerceklesenText}</span></td>
            <td><span class="badge-asim">${asimText}</span></td>
            <td><span class="text-date">${dateText}</span></td>
          </tr>
        `;
      }).join('');
    }

    function updateStats() {
      const total = asimlar.length;
      const uniqueUyeler = new Set(asimlar.map(a => a.produktorId)).size;
      const uniqueKotalar = new Set(asimlar.map(a => a.kotaId)).size;

      document.getElementById('statToplamAsim').textContent = total;
      document.getElementById('statAsanUye').textContent = uniqueUyeler;
      document.getElementById('statAsilanKota').textContent = uniqueKotalar;
    }

    // ═══════════════════════════════════════════════════════════════
    // FORMATTERS
    // ═══════════════════════════════════════════════════════════════
    function getMaksimumTuruLabel(turu) {
      switch (turu) {
        case 0: return 'Brüt Prim';
        case 1: return 'Poliçe Adedi';
        case 2: return 'Prim / Adet';
        case 3: return 'Trafik Oranı';
        default: return 'Bilinmiyor';
      }
    }

    function getLimitText(asim) {
      switch (asim.maksimumTuru) {
        case 0:
          return formatCurrency(asim.maksBrutPrim);
        case 1:
          return `${asim.maksPoliceAdeti ?? 0} Adet`;
        case 2:
          return `${formatCurrency(asim.maksBrutPrim)} / ${asim.maksPoliceAdeti ?? 0} Adet`;
        case 3:
          return `%${asim.trafikPrimOrani ?? 0}`;
        default:
          return '-';
      }
    }

    function getGerceklesenText(asim) {
      switch (asim.maksimumTuru) {
        case 0:
          return formatCurrency(asim.gerceklesenBrutPrim);
        case 1:
          return `${asim.gerceklesenPoliceAdeti} Adet`;
        case 2: {
          const parts = [];
          if (asim.maksBrutPrim) parts.push(formatCurrency(asim.gerceklesenBrutPrim));
          if (asim.maksPoliceAdeti) parts.push(`${asim.gerceklesenPoliceAdeti} Adet`);
          return parts.join(' / ') || '-';
        }
        case 3:
          return `%${asim.gerceklesenTrafikOrani?.toFixed(1) ?? '0'}`;
        default:
          return '-';
      }
    }

    function getAsimText(asim) {
      const parts = [];

      switch (asim.maksimumTuru) {
        case 0:
          if (asim.asimBrutPrim) parts.push(`+${formatCurrency(asim.asimBrutPrim)}`);
          break;
        case 1:
          if (asim.asimPoliceAdeti) parts.push(`+${asim.asimPoliceAdeti} Adet`);
          break;
        case 2:
          if (asim.asimBrutPrim) parts.push(`+${formatCurrency(asim.asimBrutPrim)}`);
          if (asim.asimPoliceAdeti) parts.push(`+${asim.asimPoliceAdeti} Adet`);
          break;
        case 3:
          if (asim.asimTrafikOrani) parts.push(`+%${asim.asimTrafikOrani.toFixed(1)}`);
          break;
      }

      return parts.length > 0 ? parts.join(' / ') : '-';
    }

    function getDateRangeText(asim) {
      const start = formatDate(asim.baslangicTarihi);
      const end = formatDate(asim.bitisTarihi);
      if (start && end) return `${start} — ${end}`;
      if (start) return `${start} —`;
      if (end) return `— ${end}`;
      return '-';
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════
    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
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

    function formatDate(dateStr) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function getInitials(name) {
      if (!name) return '??';
      const parts = name.trim().split(' ');
      const f = (parts[0] || '').charAt(0).toUpperCase();
      const l = (parts[parts.length - 1] || '').charAt(0).toUpperCase();
      return (f + l) || '??';
    }
