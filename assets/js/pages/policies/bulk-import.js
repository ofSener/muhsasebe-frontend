    // State
    let currentSessionId = null;
    let currentPreviewData = null;
    let currentPage = 1;
    const pageSize = 50;
    let availableFormats = []; // Şirket formatları ve pattern'leri
    let detectedCompanyId = null; // Otomatik tespit edilen şirket ID
    let detectedCompanyName = null; // Otomatik tespit edilen şirket adı

    // Elements
    const fileInput = document.getElementById('fileInput');
    const uploadDropzone = document.getElementById('uploadDropzone');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileSize = document.getElementById('selectedFileSize');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const sigortaSirketiSelect = document.getElementById('sigortaSirketiSelect');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadCard = document.getElementById('uploadCard');
    const loadingCard = document.getElementById('loadingCard');
    const previewCard = document.getElementById('previewCard');
    const resultCard = document.getElementById('resultCard');
    const cancelBtn = document.getElementById('cancelBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    const newImportBtn = document.getElementById('newImportBtn');

    // Wizard steps
    const wizardStep1 = document.getElementById('wizardStep1');
    const wizardStep2 = document.getElementById('wizardStep2');
    const wizardStep3 = document.getElementById('wizardStep3');

    // Initialize
    document.addEventListener('DOMContentLoaded', async function() {
      requirePermission('policeAktarabilsin');
      await loadSigortaSirketleri();
      setupEventListeners();
    });

    // Load sigorta sirketleri for dropdown and supported formats
    async function loadSigortaSirketleri() {
      try {
        // Load both formats and insurance companies in parallel
        const [formatsResponse, companiesResponse] = await Promise.all([
          apiGet('excel-import/formats'),
          apiGet('insurance-companies', { sadeceFaal: true })
        ]);

        // Create a map of company id -> company info (including kod for logo)
        const companyMap = {};
        if (companiesResponse) {
          companiesResponse.forEach(company => {
            companyMap[company.id] = company;
          });
        }

        // Populate dropdown and supported formats grid
        if (formatsResponse && formatsResponse.formats) {
          // Store formats globally for filename detection
          availableFormats = formatsResponse.formats;

          const formatsGrid = document.getElementById('supportedFormatsGrid');
          formatsGrid.innerHTML = '';

          formatsResponse.formats.forEach(format => {
            // Standardize company name
            const displayName = standardizeCompanyName(format.sigortaSirketiAdi);

            // Add to dropdown
            const option = document.createElement('option');
            option.value = format.sigortaSirketiId;
            option.textContent = displayName;
            sigortaSirketiSelect.appendChild(option);

            // Add to supported formats grid with logo
            const company = companyMap[format.sigortaSirketiId];
            const kod = company?.kod?.toLowerCase() || '';
            const logoPath = kod ? `../../assets/images/logos/insurance-companies/${kod}.png` : '';
            const initials = getCompanyInitials(format.sigortaSirketiAdi);

            const formatItem = document.createElement('div');
            formatItem.className = 'format-item';
            formatItem.innerHTML = `
              ${logoPath
                ? `<img class="format-logo" src="${logoPath}" alt="${displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="format-logo-placeholder" style="display: none;">${initials}</div>`
                : `<div class="format-logo-placeholder">${initials}</div>`
              }
              <span class="format-name">${displayName}</span>
            `;
            formatsGrid.appendChild(formatItem);
          });
        }
      } catch (error) {
        console.error('Sigorta şirketleri yüklenemedi:', error);
        // Show static fallback if API fails
        renderStaticFormats();
      }
    }

    // Get company initials for placeholder
    function getCompanyInitials(name) {
      return name.split(' ')
        .filter(word => word.length > 0)
        .slice(0, 2)
        .map(word => word[0].toUpperCase())
        .join('');
    }

    // Static fallback if API fails
    function renderStaticFormats() {
      const formats = [
        { name: 'ANKARA SİGORTA', initials: 'AS' },
        { name: 'UNİCO SİGORTA', initials: 'US' },
        { name: 'QUİCK SİGORTA', initials: 'QS' },
        { name: 'HEPİYİ SİGORTA', initials: 'HS' },
        { name: 'NEOVA SİGORTA', initials: 'NS' },
        { name: 'SOMPO SİGORTA', initials: 'SS' },
        { name: 'HDI SİGORTA', initials: 'HD' },
        { name: 'AK SİGORTA', initials: 'AK' }
      ];

      const formatsGrid = document.getElementById('supportedFormatsGrid');
      formatsGrid.innerHTML = formats.map(f => `
        <div class="format-item">
          <div class="format-logo-placeholder">${f.initials}</div>
          <span class="format-name">${f.name}</span>
        </div>
      `).join('');
    }

    // Fallback pattern map (if backend doesn't return patterns)
    const fallbackPatterns = {
      9: ['ankara', 'ank'],                     // Ankara Sigorta
      7: ['hdi'],                               // HDI Sigorta
      17: ['unico'],                            // Unico Sigorta
      110: ['quick', 'quıck'],                  // Quick Sigorta (Turkish ı variant)
      61: ['sompo'],                            // Sompo Sigorta
      126: ['hepiyi', 'hep iyi'],               // Hepiyi Sigorta
      93: ['neova'],                            // Neova Sigorta
      4: ['aksigorta', 'ak_'],                  // AK Sigorta
      104: ['doga', 'doğa'],                     // Doğa Sigorta
      96: ['koru'],                               // Koru Sigorta
      19: ['corpus']                              // Corpus Sigorta
    };

    // Turkish character normalization helper
    function normalizeTurkish(str) {
      if (!str) return '';
      return str
        .replace(/İ/g, 'i').replace(/I/g, 'i')
        .replace(/Ğ/g, 'g').replace(/Ü/g, 'u')
        .replace(/Ş/g, 's').replace(/Ö/g, 'o').replace(/Ç/g, 'c')
        .toLowerCase()
        .replace(/ı/g, 'i').replace(/ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ö/g, 'o').replace(/ç/g, 'c');
    }

    // Standardize company name to UPPERCASE format
    function standardizeCompanyName(name) {
      if (!name) return '';

      // Convert to uppercase with Turkish locale
      let standardized = name.toLocaleUpperCase('tr-TR');

      // Remove common prefixes and suffixes to get base name
      standardized = standardized
        .replace(/^S\.?S\.?\s*/gi, '')                    // Remove S.S. prefix
        .replace(/\s*KOOPERATİFİ\s*/gi, ' ')              // Remove KOOPERATİFİ
        .replace(/\s*SİGORTA\s*A\.?Ş\.?/gi, '')
        .replace(/\s*SİGORTA/gi, '')                      // Remove all SİGORTA occurrences
        .replace(/\s*SIGORTA\s*A\.?Ş\.?/gi, '')
        .replace(/\s*SIGORTA/gi, '')                      // Remove all SIGORTA occurrences
        .replace(/\s*A\.?Ş\.?$/gi, '')
        .replace(/\s+/g, ' ')                             // Normalize spaces
        .trim();

      // Add SİGORTA suffix
      return standardized + ' SİGORTA';
    }

    // Detect company from filename using patterns
    function detectCompanyFromFileName(fileName) {
      if (!fileName) return null;

      const normalizedFileName = normalizeTurkish(fileName);

      // First try patterns from backend
      if (availableFormats.length > 0) {
        for (const format of availableFormats) {
          const patterns = format.fileNamePatterns || fallbackPatterns[format.sigortaSirketiId] || [];
          for (const pattern of patterns) {
            if (normalizedFileName.includes(normalizeTurkish(pattern))) {
              return {
                id: format.sigortaSirketiId,
                name: standardizeCompanyName(format.sigortaSirketiAdi)
              };
            }
          }
        }
      }

      // Fallback: try all fallback patterns even if formats not loaded
      for (const [id, patterns] of Object.entries(fallbackPatterns)) {
        for (const pattern of patterns) {
          if (normalizedFileName.includes(normalizeTurkish(pattern))) {
            // Try to find company name from dropdown
            const option = sigortaSirketiSelect.querySelector(`option[value="${id}"]`);
            if (option) {
              return {
                id: parseInt(id),
                name: option.textContent
              };
            }
          }
        }
      }

      return null;
    }

    // Update detection UI based on result
    function updateDetectionUI(detected) {
      const resultDiv = document.getElementById('detectionResult');
      const successDiv = document.getElementById('detectionSuccess');
      const warningDiv = document.getElementById('detectionWarning');
      const companyNameSpan = document.getElementById('detectedCompanyName');

      // Check if manual selection exists
      const manualSelection = sigortaSirketiSelect.value;

      // Hide mismatch warning by default
      document.getElementById('detectionMismatch').style.display = 'none';

      if (detected) {
        // Company detected from filename
        detectedCompanyId = detected.id;
        detectedCompanyName = detected.name;
        companyNameSpan.textContent = detected.name;
        successDiv.style.display = 'flex';
        warningDiv.style.display = 'none';
        resultDiv.style.display = 'block';
        uploadBtn.disabled = false;

        // Auto-select in dropdown for clarity
        sigortaSirketiSelect.value = detected.id;
      } else if (manualSelection) {
        // Manual selection exists - no need for detection warning
        detectedCompanyId = null;
        resultDiv.style.display = 'none';
        uploadBtn.disabled = false;
      } else {
        // No detection and no manual selection
        detectedCompanyId = null;
        successDiv.style.display = 'none';
        warningDiv.style.display = 'flex';
        resultDiv.style.display = 'block';
        uploadBtn.disabled = true;
      }
    }

    // Clear detection UI
    function clearDetectionUI() {
      detectedCompanyId = null;
      detectedCompanyName = null;
      document.getElementById('detectionResult').style.display = 'none';
      document.getElementById('detectionMismatch').style.display = 'none';
    }

    // Check if upload should be enabled
    function checkUploadEnabled() {
      const hasFile = fileInput.files && fileInput.files.length > 0;
      const hasManualSelection = sigortaSirketiSelect.value !== '';
      const hasDetection = detectedCompanyId !== null;

      if (!hasFile) {
        uploadBtn.disabled = true;
        return;
      }

      // File exists - check if we have detection or manual selection
      if (hasDetection || hasManualSelection) {
        uploadBtn.disabled = false;
      } else {
        uploadBtn.disabled = true;
      }
    }

    // Setup event listeners
    function setupEventListeners() {
      // File input change - handles both click and drag/drop
      fileInput.addEventListener('change', handleFileSelect);

      // Drag and drop visual feedback
      uploadDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadDropzone.classList.add('dragover');
      });

      uploadDropzone.addEventListener('dragleave', () => {
        uploadDropzone.classList.remove('dragover');
      });

      uploadDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadDropzone.classList.remove('dragover');
        // File will be handled by the input change event
      });

      // Remove file button
      removeFileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearSelectedFile();
      });

      // Sigorta şirketi dropdown change - re-check upload enabled state
      sigortaSirketiSelect.addEventListener('change', () => {
        const selectedValue = sigortaSirketiSelect.value;
        const mismatchDiv = document.getElementById('detectionMismatch');
        const mismatchText = document.getElementById('detectionMismatchText');
        const resultDiv = document.getElementById('detectionResult');
        const successDiv = document.getElementById('detectionSuccess');

        if (selectedValue) {
          // Manual selection made
          if (detectedCompanyId && parseInt(selectedValue) !== detectedCompanyId) {
            // Selection differs from detection - show mismatch warning
            const selectedOption = sigortaSirketiSelect.options[sigortaSirketiSelect.selectedIndex];
            mismatchText.innerHTML = `Sistem bu dosyanın <strong>${detectedCompanyName}</strong>'a ait olduğunu tespit etti. <strong>${selectedOption.text}</strong> seçmek istediğinize emin misiniz?`;
            successDiv.style.display = 'none';
            mismatchDiv.style.display = 'flex';
            resultDiv.style.display = 'block';
          } else {
            // Selection matches detection or no detection - hide mismatch
            mismatchDiv.style.display = 'none';
            if (detectedCompanyId) {
              successDiv.style.display = 'flex';
              resultDiv.style.display = 'block';
            } else {
              resultDiv.style.display = 'none';
            }
          }
        } else if (fileInput.files && fileInput.files.length > 0) {
          // Cleared back to auto-detect, re-run detection
          mismatchDiv.style.display = 'none';
          const detected = detectCompanyFromFileName(fileInput.files[0].name);
          updateDetectionUI(detected);
        }
        checkUploadEnabled();
      });

      // Upload button
      uploadBtn.addEventListener('click', uploadFile);

      // Cancel button
      cancelBtn.addEventListener('click', resetToUpload);

      // Confirm button
      confirmBtn.addEventListener('click', confirmImport);

      // New import button
      newImportBtn.addEventListener('click', resetToUpload);

      // Pagination buttons
      document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
          goToPage(currentPage - 1);
        }
      });

      document.getElementById('nextPageBtn').addEventListener('click', () => {
        if (currentPreviewData && currentPreviewData.rows) {
          const totalPages = Math.ceil(currentPreviewData.rows.length / pageSize);
          if (currentPage < totalPages) {
            goToPage(currentPage + 1);
          }
        }
      });
    }

    // Handle file selection
    function handleFileSelect(e) {
      const file = e.target.files[0];
      if (file) {
        showSelectedFile(file);
      }
    }

    // Show selected file
    async function showSelectedFile(file) {
      selectedFileName.textContent = file.name;
      selectedFileSize.textContent = formatFileSize(file.size);
      selectedFileInfo.style.display = 'flex';
      uploadDropzone.classList.add('has-file');

      const manualSelection = sigortaSirketiSelect.value;

      // 1. First try filename-based detection (fast)
      let fileNameDetected = detectCompanyFromFileName(file.name);

      // 2. If filename detection fails, try header-based detection via backend
      if (!fileNameDetected) {
        try {
          // For XML files, skip SheetJS parsing and call API directly with empty headers
          const isXmlFile = file.name.toLowerCase().endsWith('.xml');
          const headers = isXmlFile ? [] : await readExcelHeaders(file);

          // Call API for detection (backend can detect XML from filename/content)
          fileNameDetected = await detectFormatFromAPI(file.name, headers);
        } catch (err) {
          console.warn('Header-based detection failed:', err);
        }
      }

      // Store detected values regardless of manual selection
      if (fileNameDetected) {
        detectedCompanyId = fileNameDetected.id;
        detectedCompanyName = fileNameDetected.name;
      } else {
        detectedCompanyId = null;
        detectedCompanyName = null;
      }

      // Check if manual selection differs from detection
      if (manualSelection) {
        if (fileNameDetected && parseInt(manualSelection) !== fileNameDetected.id) {
          // Manual selection differs from detection - show mismatch warning
          const selectedOption = sigortaSirketiSelect.options[sigortaSirketiSelect.selectedIndex];
          const mismatchDiv = document.getElementById('detectionMismatch');
          const mismatchText = document.getElementById('detectionMismatchText');
          const resultDiv = document.getElementById('detectionResult');
          const successDiv = document.getElementById('detectionSuccess');
          const warningDiv = document.getElementById('detectionWarning');

          mismatchText.innerHTML = `Sistem bu dosyanın <strong>${fileNameDetected.name}</strong>'a ait olduğunu tespit etti. <strong>${selectedOption.text}</strong> seçmek istediğinize emin misiniz?`;
          successDiv.style.display = 'none';
          warningDiv.style.display = 'none';
          mismatchDiv.style.display = 'flex';
          resultDiv.style.display = 'block';
        }
        uploadBtn.disabled = false;
        return;
      }

      // No manual selection - use detection result
      if (fileNameDetected) {
        updateDetectionUI(fileNameDetected);
        return;
      }

      // 3. No detection - show warning
      updateDetectionUI(null);
    }

    // Read Excel headers using SheetJS
    async function readExcelHeaders(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', sheetRows: 10 });

            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            if (!sheet) {
              resolve([]);
              return;
            }

            // Convert to JSON to find headers
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // Find the header row (first row with meaningful data)
            // Check first 10 rows for header keywords
            const headerKeywords = ['POLICE', 'POLİÇE', 'PRIM', 'PRİM', 'BRÜT', 'NET'];
            let headerRow = null;

            for (let i = 0; i < Math.min(10, json.length); i++) {
              const row = json[i];
              if (Array.isArray(row) && row.length > 0) {
                const rowStr = row.join(' ').toUpperCase();
                if (headerKeywords.some(kw => rowStr.includes(kw))) {
                  headerRow = row;
                  break;
                }
              }
            }

            // If no header keywords found, use first non-empty row
            if (!headerRow) {
              for (let i = 0; i < Math.min(5, json.length); i++) {
                const row = json[i];
                if (Array.isArray(row) && row.filter(c => c).length > 3) {
                  headerRow = row;
                  break;
                }
              }
            }

            const headers = headerRow
              ? headerRow.filter(h => h != null).map(h => String(h).trim())
              : [];

            resolve(headers);
          } catch (err) {
            console.error('SheetJS parse error:', err);
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }

    // Call backend API to detect format from headers
    async function detectFormatFromAPI(fileName, headers) {
      try {
        const url = APP_CONFIG.API.getUrl('excel-import/detect-format');
        const token = APP_CONFIG.AUTH.getToken();

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({ fileName, headers })
        });

        if (!response.ok) {
          console.warn('Detect format API error:', response.status);
          return null;
        }

        const result = await response.json();

        if (result.detected) {
          console.log('Format detected via API:', result.detectionMethod, result.sigortaSirketiAdi);
          return {
            id: result.sigortaSirketiId,
            name: result.sigortaSirketiAdi
          };
        }

        return null;
      } catch (err) {
        console.error('Detect format API error:', err);
        return null;
      }
    }

    // Clear selected file
    function clearSelectedFile() {
      fileInput.value = '';
      selectedFileInfo.style.display = 'none';
      uploadDropzone.classList.remove('has-file');
      uploadBtn.disabled = true;
      // Reset dropdown to auto-detect mode
      sigortaSirketiSelect.value = '';
      clearDetectionUI();
    }

    // Format file size
    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Upload file
    async function uploadFile() {
      const file = fileInput.files[0];
      if (!file) {
        showToast('Lütfen bir dosya seçin', 'warning');
        return;
      }

      // Show loading
      uploadCard.style.display = 'none';
      loadingCard.style.display = 'block';
      previewCard.style.display = 'none';
      resultCard.style.display = 'none';

      // Give browser time to render and start the spinner animation
      // Without this delay, the main thread blocks before animation can start
      await new Promise(resolve => setTimeout(resolve, 50));

      try {
        const formData = new FormData();
        formData.append('file', file);

        // API call - sigortaSirketiId query parameter olarak gönderilmeli
        const sigortaSirketiId = sigortaSirketiSelect.value;
        let url = APP_CONFIG.API.getUrl('excel-import/upload');
        if (sigortaSirketiId) {
          url += `?sigortaSirketiId=${sigortaSirketiId}`;
        }
        const token = APP_CONFIG.AUTH.getToken();

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: formData
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Dosya işlenirken hata oluştu');
        }

        // Store session data
        currentSessionId = data.importSessionId;
        currentPreviewData = data;

        // Show preview
        showPreview(data);

      } catch (error) {
        console.error('Upload error:', error);
        showToast(error.message || 'Dosya yüklenirken hata oluştu', 'error');
        resetToUpload();
      }
    }

    // Show preview
    function showPreview(data) {
      loadingCard.style.display = 'none';
      previewCard.style.display = 'block';

      // Update wizard steps
      wizardStep1.classList.remove('active');
      wizardStep1.classList.add('completed');
      wizardStep2.classList.add('active');

      // Update detected company in dropdown
      if (data.sigortaSirketiId) {
        sigortaSirketiSelect.value = data.sigortaSirketiId;
      }

      // Update header
      document.getElementById('detectedFormat').textContent = data.sigortaSirketiAdi || 'Bilinmeyen Format';
      document.getElementById('validCountBadge').innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
        Geçerli: ${data.validRows}
      `;
      document.getElementById('invalidCountBadge').innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        Hatalı: ${data.invalidRows}
      `;
      document.getElementById('totalRowsInfo').textContent = `Toplam ${data.totalRows} satır okundu`;
      document.getElementById('confirmBtnText').textContent = `${data.validRows} Geçerli Kaydı İçeri Aktar`;

      // Reset to first page and render
      currentPage = 1;
      renderPage();
      renderPagination();

      // Show floating action box
      showFloatingBox(data);
    }

    // Render current page of rows
    function renderPage() {
      if (!currentPreviewData || !currentPreviewData.rows) return;

      const rows = currentPreviewData.rows;
      const totalPages = Math.ceil(rows.length / pageSize);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, rows.length);
      const pageRows = rows.slice(startIndex, endIndex);

      const tbody = document.getElementById('previewTableBody');
      tbody.innerHTML = '';

      pageRows.forEach(row => {
        const tr = document.createElement('tr');
        if (!row.isValid) {
          tr.classList.add('row-error');
        }

        // Determine if it's a zeyil (ZeyilNo > 0 OR İptal kaydı)
        const zeyilNoValue = parseInt(row.zeyilNo) || 0;
        const isIptal = row.policeTipi === 'İPTAL' || row.policeTipi === 'IPTAL';
        const isZeyil = zeyilNoValue > 0 || isIptal;

        // Build sigortalı display text (Ad Soyad or just Ad)
        const sigortaliDisplay = row.sigortaliSoyadi
          ? `${row.sigortaliAdi || ''} ${row.sigortaliSoyadi}`.trim()
          : (row.sigortaliAdi || '-');

        // TC/VKN - prefer TCKN, fallback to VKN
        const tcVknDisplay = row.tckn || row.vkn || '-';

        // Store row index for detail view
        const rowIndex = rows.indexOf(row);

        tr.innerHTML = `
          <td>
            <button class="btn-icon" onclick="showRowDetail(${rowIndex})" title="Detay Görüntüle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </td>
          <td class="font-mono">${row.rowNumber}</td>
          <td class="font-mono">${row.policeNo || '-'}</td>
          <td>${sigortaliDisplay}</td>
          <td class="font-mono">${tcVknDisplay}</td>
          <td><span class="badge badge-primary">${row.brans || '-'}</span></td>
          <td style="white-space: nowrap;">${formatDate(row.baslangicTarihi)}</td>
          <td style="white-space: nowrap;">${formatDate(row.bitisTarihi)}</td>
          <td class="font-mono" style="text-align: right; white-space: nowrap;">${formatCurrency(row.brutPrim)}</td>
          <td>
            ${isZeyil
              ? `<span class="badge badge-warning" title="Zeyil No: ${zeyilNoValue}">Zeyil</span>`
              : '<span class="badge badge-success">Yeni</span>'
            }
          </td>
          <td>
            ${row.isValid
              ? '<span class="status-badge-sm success"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg> Geçerli</span>'
              : `<span class="status-badge-sm danger"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> ${row.validationErrors?.join(', ') || 'Hatalı'}</span>`
            }
          </td>
        `;

        tbody.appendChild(tr);
      });

      // Scroll to top of table
      document.querySelector('.table-container')?.scrollTo(0, 0);
    }

    // Render pagination controls
    function renderPagination() {
      if (!currentPreviewData || !currentPreviewData.rows) return;

      const totalRows = currentPreviewData.rows.length;
      const totalPages = Math.ceil(totalRows / pageSize);

      // Update pagination info
      document.getElementById('paginationInfo').textContent = `Sayfa ${currentPage} / ${totalPages}`;

      // Update prev/next buttons
      document.getElementById('prevPageBtn').disabled = currentPage === 1;
      document.getElementById('nextPageBtn').disabled = currentPage === totalPages;

      // Render page buttons
      const pagesContainer = document.getElementById('paginationPages');
      pagesContainer.innerHTML = '';

      // Calculate which pages to show
      const pagesToShow = [];
      const maxVisiblePages = 7;

      if (totalPages <= maxVisiblePages) {
        // Show all pages
        for (let i = 1; i <= totalPages; i++) {
          pagesToShow.push(i);
        }
      } else {
        // Always show first page
        pagesToShow.push(1);

        if (currentPage > 3) {
          pagesToShow.push('...');
        }

        // Pages around current
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
          if (!pagesToShow.includes(i)) {
            pagesToShow.push(i);
          }
        }

        if (currentPage < totalPages - 2) {
          pagesToShow.push('...');
        }

        // Always show last page
        if (!pagesToShow.includes(totalPages)) {
          pagesToShow.push(totalPages);
        }
      }

      // Render page buttons
      pagesToShow.forEach(page => {
        if (page === '...') {
          const ellipsis = document.createElement('span');
          ellipsis.className = 'pagination-ellipsis';
          ellipsis.textContent = '...';
          pagesContainer.appendChild(ellipsis);
        } else {
          const btn = document.createElement('button');
          btn.className = 'pagination-page' + (page === currentPage ? ' active' : '');
          btn.textContent = page;
          btn.onclick = () => goToPage(page);
          pagesContainer.appendChild(btn);
        }
      });
    }

    // Go to specific page
    function goToPage(page) {
      if (!currentPreviewData || !currentPreviewData.rows) return;

      const totalPages = Math.ceil(currentPreviewData.rows.length / pageSize);
      if (page < 1 || page > totalPages) return;

      currentPage = page;
      renderPage();
      renderPagination();
    }

    // Confirm import with batch processing
    const BATCH_SIZE = 50;
    let importStats = { success: 0, duplicate: 0, failed: 0, errors: [] };

    async function confirmImport() {
      if (!currentSessionId) {
        showToast('Oturum bulunamadı', 'error');
        return;
      }

      const totalValidRows = currentPreviewData?.validRows || 0;
      if (totalValidRows === 0) {
        showToast('Kaydedilecek geçerli veri yok', 'warning');
        return;
      }

      // Reset stats
      importStats = { success: 0, duplicate: 0, failed: 0, errors: [] };

      // Hide confirm button, show progress modal
      confirmBtn.disabled = true;
      showProgressModal(totalValidRows);

      try {
        let skip = 0;
        let hasMore = true;

        while (hasMore) {
          const response = await apiPost('excel-import/confirm-batch', {
            sessionId: currentSessionId,
            skip: skip,
            take: BATCH_SIZE
          });

          if (!response.success) {
            throw new Error(response.errorMessage || 'Aktarım başarısız');
          }

          // Update cumulative stats
          importStats.success += response.successCount;
          importStats.duplicate += response.duplicateCount;
          importStats.failed += response.failedCount;
          if (response.errors && response.errors.length > 0) {
            importStats.errors.push(...response.errors);
          }

          // Update progress UI
          updateProgressModal(response.processedSoFar, totalValidRows, importStats);

          // Check if more batches
          hasMore = response.hasMoreBatches;
          skip += BATCH_SIZE;

          // Small delay to prevent overwhelming the server
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        // Hide progress modal and show result
        hideProgressModal();
        showResult({
          totalProcessed: totalValidRows,
          successCount: importStats.success,
          failedCount: importStats.failed,
          duplicateCount: importStats.duplicate,
          errors: importStats.errors
        });

      } catch (error) {
        console.error('Confirm error:', error);
        hideProgressModal();
        showToast(error.message || 'Aktarım sırasında hata oluştu', 'error');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg> <span id="confirmBtnText">${currentPreviewData?.validRows || 0} Geçerli Kaydı İçeri Aktar</span>`;
      }
    }

    // Progress Modal Functions
    function showProgressModal(total) {
      const modal = document.getElementById('importProgressModal');
      document.getElementById('progressCurrent').textContent = '0';
      document.getElementById('progressTotal').textContent = total.toLocaleString('tr-TR');
      document.getElementById('progressBar').style.width = '0%';
      document.getElementById('progressSuccess').textContent = '0';
      document.getElementById('progressDuplicate').textContent = '0';
      document.getElementById('progressFailed').textContent = '0';
      document.getElementById('progressMessage').textContent = 'Lütfen bekleyin...';
      modal.classList.add('active');
    }

    function updateProgressModal(current, total, stats) {
      const percentage = Math.round((current / total) * 100);
      document.getElementById('progressCurrent').textContent = current.toLocaleString('tr-TR');
      document.getElementById('progressBar').style.width = percentage + '%';
      document.getElementById('progressSuccess').textContent = stats.success.toLocaleString('tr-TR');
      document.getElementById('progressDuplicate').textContent = stats.duplicate.toLocaleString('tr-TR');
      document.getElementById('progressFailed').textContent = stats.failed.toLocaleString('tr-TR');
      document.getElementById('progressMessage').textContent = `%${percentage} tamamlandı`;
    }

    function hideProgressModal() {
      const modal = document.getElementById('importProgressModal');
      modal.classList.remove('active');
    }

    // Show result
    function showResult(data) {
      previewCard.style.display = 'none';
      resultCard.style.display = 'block';

      // Update wizard steps
      wizardStep2.classList.remove('active');
      wizardStep2.classList.add('completed');
      wizardStep3.classList.add('active');
      wizardStep3.classList.add('completed');

      // Update stats
      document.getElementById('resultTotal').textContent = data.totalProcessed;
      document.getElementById('resultSuccess').textContent = data.successCount;
      document.getElementById('resultFailed').textContent = data.failedCount;
      document.getElementById('resultDuplicate').textContent = data.duplicateCount;

      // Hide floating box after import
      hideFloatingBox();

      // New customers info
      if (data.newCustomersCreated > 0) {
        const info = document.getElementById('newCustomersInfo');
        document.getElementById('newCustomersText').textContent = `${data.newCustomersCreated} yeni müşteri kaydı oluşturuldu.`;
        info.style.display = 'flex';
      }

      // Show errors if any
      if (data.errors && data.errors.length > 0) {
        const errorsDiv = document.getElementById('resultErrors');
        const errorTbody = document.getElementById('errorTableBody');

        errorTbody.innerHTML = '';
        data.errors.forEach(err => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="font-mono">${err.rowNumber}</td>
            <td class="font-mono">${err.policeNo || '-'}</td>
            <td class="text-danger">${err.errorMessage}</td>
          `;
          errorTbody.appendChild(tr);
        });

        errorsDiv.style.display = 'block';
      }

      showToast(`${data.successCount} poliçe başarıyla eklendi`, 'success');

      // Populate import report
      populateImportReport();
    }

    // Populate import report section with statistics
    function populateImportReport() {
      const stats = calculateDetailStats();
      if (!stats) {
        document.getElementById('importReportSection').style.display = 'none';
        return;
      }

      document.getElementById('importReportSection').style.display = 'block';

      // Type Summary (Zeyil, Yeni İş, Toplam Poliçe)
      document.getElementById('reportTypeSummary').innerHTML = `
        <div class="report-summary-item zeyil">
          <div class="value">${stats.zeyilCount}</div>
          <div class="label">Zeyil</div>
        </div>
        <div class="report-summary-item yeni">
          <div class="value">${stats.yeniIsCount}</div>
          <div class="label">Yeni İş</div>
        </div>
        <div class="report-summary-item police">
          <div class="value">${stats.policeCount}</div>
          <div class="label">Toplam</div>
        </div>
      `;

      // Prim Section (Brüt, Net, Komisyon with positive/negative/total)
      document.getElementById('reportPrimSection').innerHTML = `
        <h4>Prim Özeti</h4>
        <div class="report-prim-grid">
          <div class="report-prim-card">
            <div class="prim-title">Brüt Prim</div>
            <div class="report-prim-row">
              <span class="label">Tahakkuk (+)</span>
              <span class="value positive">${formatCurrency(stats.brutPrim.positive)}</span>
            </div>
            <div class="report-prim-row">
              <span class="label">İptal (-)</span>
              <span class="value negative">${formatCurrency(stats.brutPrim.negative)}</span>
            </div>
            <div class="report-prim-row total">
              <span class="label">Toplam</span>
              <span class="value">${formatCurrency(stats.brutPrim.total)}</span>
            </div>
          </div>
          <div class="report-prim-card">
            <div class="prim-title">Net Prim</div>
            <div class="report-prim-row">
              <span class="label">Tahakkuk (+)</span>
              <span class="value positive">${formatCurrency(stats.netPrim.positive)}</span>
            </div>
            <div class="report-prim-row">
              <span class="label">İptal (-)</span>
              <span class="value negative">${formatCurrency(stats.netPrim.negative)}</span>
            </div>
            <div class="report-prim-row total">
              <span class="label">Toplam</span>
              <span class="value">${formatCurrency(stats.netPrim.total)}</span>
            </div>
          </div>
          <div class="report-prim-card">
            <div class="prim-title">Komisyon</div>
            <div class="report-prim-row">
              <span class="label">Tahakkuk (+)</span>
              <span class="value positive">${formatCurrency(stats.komisyon.positive)}</span>
            </div>
            <div class="report-prim-row">
              <span class="label">İptal (-)</span>
              <span class="value negative">${formatCurrency(stats.komisyon.negative)}</span>
            </div>
            <div class="report-prim-row total">
              <span class="label">Toplam</span>
              <span class="value">${formatCurrency(stats.komisyon.total)}</span>
            </div>
          </div>
        </div>
      `;

      // Branch Breakdown with Donut Chart and Accordion
      const sortedBranches = Object.entries(stats.byBranch)
        .sort((a, b) => b[1].count - a[1].count);

      // Prepare donut chart data
      const donutLabels = sortedBranches.slice(0, 6).map(([branch]) => branch);
      const donutValues = sortedBranches.slice(0, 6).map(([, data]) => data.brutPrim);

      // Build accordion rows
      let branchAccordion = sortedBranches.map(([branch, data], index) => `
        <div class="branch-accordion-item" data-index="${index}">
          <div class="branch-accordion-header" onclick="window.toggleBranchAccordion(${index})">
            <div class="branch-header-left">
              <span class="branch-expand-icon">▶</span>
              <span class="branch-badge">${branch}</span>
            </div>
            <div class="branch-header-stats">
              <span class="branch-stat"><strong>${data.count}</strong> Adet</span>
              <span class="branch-stat">${formatCurrency(data.brutPrim)}</span>
            </div>
          </div>
          <div class="branch-accordion-content">
            <div class="branch-accordion-inner">
              <div class="branch-breakdown-grid">
                <div class="branch-breakdown-item yeni">
                  <div class="breakdown-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="12" y1="18" x2="12" y2="12"/>
                      <line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                  </div>
                  <div class="breakdown-info">
                    <span class="breakdown-label">Yeni İş</span>
                    <span class="breakdown-value">${data.yeniIs.count} Adet</span>
                    <span class="breakdown-prim">${formatCurrency(data.yeniIs.brutPrim)}</span>
                  </div>
                </div>
                <div class="branch-breakdown-item zeyil">
                  <div class="breakdown-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <div class="breakdown-info">
                    <span class="breakdown-label">Zeyil</span>
                    <span class="breakdown-value">${data.zeyil.count} Adet</span>
                    <span class="breakdown-prim">${formatCurrency(data.zeyil.brutPrim)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `).join('');

      // Build legend items
      const chartColors = ['#00d4ff', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#06b6d4'];
      let legendItems = sortedBranches.slice(0, 6).map(([branch, data], i) => `
        <div class="branch-legend-item">
          <span class="branch-legend-color" style="background: ${chartColors[i]}"></span>
          <span class="branch-legend-name">${branch}</span>
          <span class="branch-legend-value">${formatCurrency(data.brutPrim)}</span>
        </div>
      `).join('');

      document.getElementById('reportBranchSection').innerHTML = `
        <h4>Branş Dağılımı</h4>
        <div class="branch-section-grid">
          <div class="branch-section-row">
            <div class="branch-chart-container">
              <div id="reportBranchDonutChart" style="height: 260px;"></div>
            </div>
            <div class="branch-legend">
              ${legendItems}
            </div>
          </div>
          <div class="branch-accordion-container">
            <h5 class="accordion-title">Detaylı Dağılım</h5>
            ${branchAccordion}
          </div>
        </div>
      `;

      // Render donut chart
      if (donutValues.length > 0 && typeof ApexCharts !== 'undefined') {
        const donutChart = new ApexCharts(document.getElementById('reportBranchDonutChart'), {
          chart: {
            type: 'donut',
            height: 280,
            background: 'transparent',
            fontFamily: "'Manrope', sans-serif"
          },
          series: donutValues,
          labels: donutLabels,
          colors: ['#00d4ff', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#06b6d4'],
          plotOptions: {
            pie: {
              donut: {
                size: '70%',
                labels: {
                  show: true,
                  name: { show: true, fontSize: '13px', color: '#94a3b8', offsetY: -5 },
                  value: {
                    show: true, fontSize: '18px', fontWeight: 700, color: '#f1f5f9', offsetY: 5,
                    formatter: (val) => formatCurrency(val)
                  },
                  total: {
                    show: true, label: 'Toplam', fontSize: '11px', color: '#64748b',
                    formatter: (w) => formatCurrency(w.globals.seriesTotals.reduce((a, b) => a + b, 0))
                  }
                }
              }
            }
          },
          stroke: { show: false },
          legend: { show: false },
          tooltip: {
            enabled: true, theme: 'dark',
            y: { formatter: (val) => formatCurrency(val) }
          },
          dataLabels: { enabled: false }
        });
        donutChart.render();
      }

      // Date Breakdown with Line Chart
      const sortedDates = Object.entries(stats.byDate)
        .sort((a, b) => a[0].localeCompare(b[0]));

      if (sortedDates.length > 0) {
        const dateLabels = sortedDates.map(([, data]) => data.label);
        const dateValues = sortedDates.map(([, data]) => data.brutPrim);
        const dateCounts = sortedDates.map(([, data]) => data.count);

        document.getElementById('reportDateSection').innerHTML = `
          <h4>Tarih Dağılımı</h4>
          <div class="date-chart-container">
            <div id="reportDateLineChart" style="height: 250px;"></div>
          </div>
          <div class="date-summary-row">
            ${sortedDates.map(([, data]) => `
              <div class="date-summary-item">
                <span class="date-label">${data.label}</span>
                <span class="date-count">${data.count} Adet</span>
                <span class="date-prim">${formatCurrency(data.brutPrim)}</span>
              </div>
            `).join('')}
          </div>
        `;
        document.getElementById('reportDateSection').style.display = 'block';

        // Render line chart
        if (typeof ApexCharts !== 'undefined') {
          // Calculate min value - only set to 0 if no negative values
          const hasNegative = dateValues.some(v => v < 0);
          const yAxisMin = hasNegative ? undefined : 0;

          const lineChart = new ApexCharts(document.getElementById('reportDateLineChart'), {
            chart: {
              type: 'area',
              height: 250,
              background: 'transparent',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              toolbar: { show: false },
              zoom: { enabled: false },
              animations: { enabled: true, easing: 'easeinout', speed: 600 }
            },
            series: [{
              name: 'Brüt Prim',
              data: dateValues
            }],
            colors: ['#6366f1'],
            fill: {
              type: 'gradient',
              gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] }
            },
            stroke: { curve: 'smooth', width: 3 },
            markers: { size: 5, colors: ['#6366f1'], strokeColors: '#fff', strokeWidth: 2, hover: { size: 7 } },
            grid: {
              borderColor: 'rgba(148, 163, 184, 0.2)',
              strokeDashArray: 4,
              xaxis: { lines: { show: false } },
              yaxis: { lines: { show: true } }
            },
            xaxis: {
              categories: dateLabels,
              labels: {
                style: { colors: '#64748b', fontSize: '12px', fontWeight: 500 },
                rotate: 0
              },
              axisBorder: { show: false },
              axisTicks: { show: false }
            },
            yaxis: {
              min: yAxisMin,
              labels: {
                style: { colors: '#64748b', fontSize: '11px' },
                formatter: (val) => {
                  const abs = Math.abs(val);
                  const sign = val < 0 ? '-' : '';
                  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1) + 'M';
                  if (abs >= 1000) return sign + (abs / 1000).toFixed(0) + 'K';
                  return Math.round(val);
                }
              }
            },
            tooltip: {
              enabled: true,
              cssClass: 'custom-apex-tooltip',
              custom: function({ series, seriesIndex, dataPointIndex, w }) {
                const value = series[seriesIndex][dataPointIndex];
                const label = w.globals.categoryLabels[dataPointIndex];
                return `<div class="apex-tooltip-custom">
                  <div class="tooltip-label">${label}</div>
                  <div class="tooltip-value">${formatCurrency(value)}</div>
                </div>`;
              }
            },
            dataLabels: { enabled: false }
          });
          lineChart.render();
        }
      } else {
        document.getElementById('reportDateSection').style.display = 'none';
      }
    }

    // Toggle branch accordion - global function
    window.toggleBranchAccordion = function(index) {
      const item = document.querySelector(`.branch-accordion-item[data-index="${index}"]`);
      if (!item) return;

      const isOpen = item.classList.contains('open');

      // Close all other accordions
      document.querySelectorAll('.branch-accordion-item.open').forEach(el => {
        el.classList.remove('open');
      });

      // Toggle current
      if (!isOpen) {
        item.classList.add('open');
      }
    };

    // Reset to upload
    function resetToUpload() {
      currentSessionId = null;
      currentPreviewData = null;
      currentPage = 1;

      uploadCard.style.display = 'block';
      loadingCard.style.display = 'none';
      previewCard.style.display = 'none';
      resultCard.style.display = 'none';

      // Hide floating action box
      hideFloatingBox();

      // Reset wizard steps
      wizardStep1.classList.add('active');
      wizardStep1.classList.remove('completed');
      wizardStep2.classList.remove('active', 'completed');
      wizardStep3.classList.remove('active', 'completed');

      // Reset form
      clearSelectedFile();
      sigortaSirketiSelect.value = ''; // Reset to "Otomatik Tespit"
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg> <span id="confirmBtnText">0 Geçerli Kaydı İçeri Aktar</span>';

      // Reset errors section
      document.getElementById('resultErrors').style.display = 'none';
      document.getElementById('newCustomersInfo').style.display = 'none';

      // Reset import report section
      document.getElementById('importReportSection').style.display = 'none';
      document.getElementById('reportTypeSummary').innerHTML = '';
      document.getElementById('reportPrimSection').innerHTML = '';
      document.getElementById('reportBranchSection').innerHTML = '';
      document.getElementById('reportDateSection').innerHTML = '';
    }

    // Helper functions
    function formatDate(dateStr) {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('tr-TR');
    }

    function formatCurrency(amount) {
      if (amount == null) return '-';
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    }

    // Show row detail modal (make it global for inline onclick)
    window.showRowDetail = function(rowIndex) {
      if (!currentPreviewData || !currentPreviewData.rows) return;

      const row = currentPreviewData.rows[rowIndex];
      if (!row) return;

      const modal = document.getElementById('rowDetailModal');
      const content = document.getElementById('rowDetailContent');

      // Build sigortalı display
      const sigortaliDisplay = row.sigortaliSoyadi
        ? `${row.sigortaliAdi || ''} ${row.sigortaliSoyadi}`.trim()
        : (row.sigortaliAdi || '-');

      // Determine zeyil status (ZeyilNo > 0 OR İptal kaydı)
      const zeyilNoValue = parseInt(row.zeyilNo) || 0;
      const isIptal = row.policeTipi === 'İPTAL' || row.policeTipi === 'IPTAL';
      const isZeyil = zeyilNoValue > 0 || isIptal;

      content.innerHTML = `
        <!-- Header Card with Key Info -->
        <div class="detail-header-card">
          <div class="detail-header-main">
            <div class="detail-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
            </div>
            <div class="detail-header-info">
              <span class="detail-header-no">${row.policeNo || '-'}</span>
              <span class="detail-header-brans">${row.brans || 'Branş Belirtilmemiş'}</span>
            </div>
          </div>
          <div class="detail-header-badges">
            ${isZeyil
              ? '<span class="badge badge-warning">Zeyil</span>'
              : '<span class="badge badge-success">Yeni Poliçe</span>'}
            ${row.policeTipi === 'İPTAL' ? '<span class="badge badge-danger">İPTAL</span>' : ''}
          </div>
        </div>

        <!-- Prim Highlight Cards -->
        <div class="detail-prim-cards">
          <div class="prim-card prim-brut">
            <span class="prim-label">Brüt Prim</span>
            <span class="prim-value">${formatCurrency(row.brutPrim)}</span>
          </div>
          <div class="prim-card prim-net">
            <span class="prim-label">Net Prim</span>
            <span class="prim-value">${formatCurrency(row.netPrim)}</span>
          </div>
          <div class="prim-card prim-komisyon">
            <span class="prim-label">Komisyon</span>
            <span class="prim-value">${formatCurrency(row.komisyon)}</span>
          </div>
        </div>

        <!-- Poliçe Bilgileri -->
        <div class="detail-section">
          <div class="detail-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            Poliçe Detayları
          </div>
          <div class="detail-grid">
            <div class="detail-group">
              <span class="detail-label">Yenileme No</span>
              <span class="detail-value mono">${row.yenilemeNo || '-'}</span>
            </div>
            <div class="detail-group">
              <span class="detail-label">Zeyil No</span>
              <span class="detail-value mono">${row.zeyilNo || '0'}</span>
            </div>
            <div class="detail-group">
              <span class="detail-label">Zeyil Tip Kodu</span>
              <span class="detail-value mono">${row.zeyilTipKodu || '-'}</span>
            </div>
            <div class="detail-group">
              <span class="detail-label">Branş ID</span>
              <span class="detail-value mono">${row.bransId ?? '-'}</span>
            </div>
          </div>
        </div>

        <!-- Tarih Bilgileri -->
        <div class="detail-section">
          <div class="detail-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Tarihler
          </div>
          <div class="detail-grid">
            <div class="detail-group">
              <span class="detail-label">Tanzim Tarihi</span>
              <span class="detail-value">${formatDate(row.tanzimTarihi)}</span>
            </div>
            <div class="detail-group">
              <span class="detail-label">Başlangıç</span>
              <span class="detail-value">${formatDate(row.baslangicTarihi)}</span>
            </div>
            <div class="detail-group">
              <span class="detail-label">Bitiş</span>
              <span class="detail-value">${formatDate(row.bitisTarihi)}</span>
            </div>
            <div class="detail-group">
              <span class="detail-label">Zeyil Onay</span>
              <span class="detail-value ${!row.zeyilOnayTarihi ? 'empty' : ''}">${formatDate(row.zeyilOnayTarihi) || '-'}</span>
            </div>
          </div>
        </div>

        <!-- Sigortalı Bilgileri -->
        <div class="detail-section">
          <div class="detail-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Sigortalı
          </div>
          <div class="detail-grid">
            <div class="detail-group">
              <span class="detail-label">Ad Soyad</span>
              <span class="detail-value ${!row.sigortaliAdi ? 'empty' : ''}">${row.sigortaliAdi || '-'} ${row.sigortaliSoyadi || ''}</span>
            </div>
            <div class="detail-group">
              <span class="detail-label">TC / VKN</span>
              <span class="detail-value mono ${!row.tckn && !row.vkn ? 'empty' : ''}">${row.tckn || row.vkn || '-'}</span>
            </div>
            <div class="detail-group full-width">
              <span class="detail-label">Adres</span>
              <span class="detail-value ${!row.adres ? 'empty' : ''}">${row.adres || '-'}</span>
            </div>
          </div>
        </div>

        <!-- Diğer Bilgiler -->
        <div class="detail-section">
          <div class="detail-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Diğer
          </div>
          <div class="detail-grid">
            <div class="detail-group">
              <span class="detail-label">Plaka</span>
              <span class="detail-value mono ${!row.plaka ? 'empty' : ''}">${row.plaka || '-'}</span>
            </div>
            <div class="detail-group">
              <span class="detail-label">Acente No</span>
              <span class="detail-value mono ${!row.acenteNo ? 'empty' : ''}">${row.acenteNo || '-'}</span>
            </div>
          </div>
        </div>

        ${row.validationErrors && row.validationErrors.length > 0 ? `
          <div class="detail-errors">
            <div class="detail-errors-title">Doğrulama Hataları</div>
            <ul class="detail-errors-list">
              ${row.validationErrors.map(err => `<li>${err}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      `;

      modal.classList.add('active');
      document.body.classList.add('modal-open');
    };

    // Close modal
    window.closeRowDetailModal = function() {
      document.getElementById('rowDetailModal').classList.remove('active');
      document.body.classList.remove('modal-open');
    };

    // Close modal when clicking overlay
    document.getElementById('rowDetailModal').addEventListener('click', (e) => {
      if (e.target.id === 'rowDetailModal') {
        closeRowDetailModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const rowModal = document.getElementById('rowDetailModal');
        const detailModal = document.getElementById('importDetailModal');
        if (rowModal.classList.contains('active')) {
          closeRowDetailModal();
        } else if (detailModal.classList.contains('active')) {
          closeDetailModal();
        }
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // FLOATING ACTION BOX FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function showFloatingBox(data) {
      const floatingBox = document.getElementById('floatingActionBox');
      const validCount = data.validRows || 0;

      // Calculate total premium from valid rows
      let totalPremium = 0;
      if (data.rows) {
        data.rows.forEach(row => {
          if (row.isValid && row.brutPrim) {
            totalPremium += row.brutPrim;
          }
        });
      }

      // Update floating box content
      document.getElementById('fabValidCount').textContent = validCount;
      document.getElementById('fabTotalPremium').textContent = formatCurrency(totalPremium);
      document.getElementById('fabImportBtnText').textContent = `${validCount} Kayıt İçeri Aktar`;

      // Enable/disable import button
      const importBtn = document.getElementById('fabImportBtn');
      importBtn.disabled = validCount === 0;

      // Show floating box
      floatingBox.classList.add('active');
    }

    function hideFloatingBox() {
      document.getElementById('floatingActionBox').classList.remove('active');
    }

    function scrollToPreview() {
      document.getElementById('previewCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function startImport() {
      // Trigger the confirm import button
      document.getElementById('confirmBtn').click();
    }

    // ═══════════════════════════════════════════════════════════════
    // IMPORT DETAIL MODAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function calculateDetailStats() {
      if (!currentPreviewData || !currentPreviewData.rows) return null;

      const rows = currentPreviewData.rows.filter(r => r.isValid);

      let stats = {
        zeyilCount: 0,
        policeCount: 0,
        yeniIsCount: 0,
        brutPrim: { positive: 0, negative: 0, total: 0 },
        netPrim: { positive: 0, negative: 0, total: 0 },
        komisyon: { positive: 0, negative: 0, total: 0 },
        byBranch: {},
        byDate: {}
      };

      rows.forEach(row => {
        const zeyilNo = parseInt(row.zeyilNo) || 0;
        const isIptal = row.policeTipi === 'İPTAL' || row.policeTipi === 'IPTAL';

        // Count by type
        // Zeyil: zeyilNo > 0 OR İptal kaydı
        // Yeni İş: zeyilNo == 0 AND Tahakkuk (yeni poliçeler)
        // Poliçe: Toplam (Zeyil + Yeni İş)
        if (zeyilNo > 0 || isIptal) {
          stats.zeyilCount++;
        } else {
          stats.yeniIsCount++;
        }
        stats.policeCount++; // Toplam poliçe sayısı

        // Prim calculations
        const brut = row.brutPrim || 0;
        const net = row.netPrim || 0;
        const kom = row.komisyon || 0;

        stats.brutPrim.total += brut;
        stats.netPrim.total += net;
        stats.komisyon.total += kom;

        if (brut >= 0) stats.brutPrim.positive += brut;
        else stats.brutPrim.negative += brut;

        if (net >= 0) stats.netPrim.positive += net;
        else stats.netPrim.negative += net;

        if (kom >= 0) stats.komisyon.positive += kom;
        else stats.komisyon.negative += kom;

        // By branch - with yeni iş / zeyil breakdown
        const branch = row.brans || 'Belirtilmemiş';
        if (!stats.byBranch[branch]) {
          stats.byBranch[branch] = {
            count: 0, brutPrim: 0, netPrim: 0,
            yeniIs: { count: 0, brutPrim: 0 },
            zeyil: { count: 0, brutPrim: 0 }
          };
        }
        stats.byBranch[branch].count++;
        stats.byBranch[branch].brutPrim += brut;
        stats.byBranch[branch].netPrim += net;

        // Track yeni iş vs zeyil per branch (İptal da Zeyil sayılır)
        if (zeyilNo > 0 || isIptal) {
          stats.byBranch[branch].zeyil.count++;
          stats.byBranch[branch].zeyil.brutPrim += brut;
        } else {
          stats.byBranch[branch].yeniIs.count++;
          stats.byBranch[branch].yeniIs.brutPrim += brut;
        }

        // By date (month)
        const dateStr = row.baslangicTarihi || row.tanzimTarihi;
        if (dateStr) {
          const date = new Date(dateStr);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const monthLabel = date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'short' });

          if (!stats.byDate[monthKey]) {
            stats.byDate[monthKey] = { label: monthLabel, count: 0, brutPrim: 0 };
          }
          stats.byDate[monthKey].count++;
          stats.byDate[monthKey].brutPrim += brut;
        }
      });

      return stats;
    }

    function showDetailModal() {
      const stats = calculateDetailStats();
      if (!stats) return;

      const content = document.getElementById('importDetailContent');

      // Sort branches by count
      const sortedBranches = Object.entries(stats.byBranch)
        .sort((a, b) => b[1].count - a[1].count);

      // Sort dates
      const sortedDates = Object.entries(stats.byDate)
        .sort((a, b) => a[0].localeCompare(b[0]));

      content.innerHTML = `
        <!-- Summary Cards -->
        <div class="detail-summary-grid">
          <div class="detail-summary-card zeyil">
            <div class="value">${stats.zeyilCount}</div>
            <div class="label">Zeyil</div>
          </div>
          <div class="detail-summary-card yeni">
            <div class="value">${stats.yeniIsCount}</div>
            <div class="label">Yeni İş</div>
          </div>
          <div class="detail-summary-card police">
            <div class="value">${stats.policeCount}</div>
            <div class="label">Toplam</div>
          </div>
        </div>

        <!-- Prim Details -->
        <div class="detail-section">
          <div class="detail-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
            Prim Detayları
          </div>
          <div class="prim-detail-grid">
            <div class="prim-detail-card">
              <div class="prim-type">Brüt Prim</div>
              <div class="prim-detail-row">
                <span class="label">Tahakkuk (+)</span>
                <span class="value positive">${formatCurrency(stats.brutPrim.positive)}</span>
              </div>
              <div class="prim-detail-row">
                <span class="label">İptal (-)</span>
                <span class="value negative">${formatCurrency(stats.brutPrim.negative)}</span>
              </div>
              <div class="prim-detail-row">
                <span class="label">Toplam</span>
                <span class="value total">${formatCurrency(stats.brutPrim.total)}</span>
              </div>
            </div>
            <div class="prim-detail-card">
              <div class="prim-type">Net Prim</div>
              <div class="prim-detail-row">
                <span class="label">Tahakkuk (+)</span>
                <span class="value positive">${formatCurrency(stats.netPrim.positive)}</span>
              </div>
              <div class="prim-detail-row">
                <span class="label">İptal (-)</span>
                <span class="value negative">${formatCurrency(stats.netPrim.negative)}</span>
              </div>
              <div class="prim-detail-row">
                <span class="label">Toplam</span>
                <span class="value total">${formatCurrency(stats.netPrim.total)}</span>
              </div>
            </div>
            <div class="prim-detail-card">
              <div class="prim-type">Komisyon</div>
              <div class="prim-detail-row">
                <span class="label">Tahakkuk (+)</span>
                <span class="value positive">${formatCurrency(stats.komisyon.positive)}</span>
              </div>
              <div class="prim-detail-row">
                <span class="label">İptal (-)</span>
                <span class="value negative">${formatCurrency(stats.komisyon.negative)}</span>
              </div>
              <div class="prim-detail-row">
                <span class="label">Toplam</span>
                <span class="value total">${formatCurrency(stats.komisyon.total)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- By Branch with Donut Chart -->
        <div class="detail-section">
          <div class="detail-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            Branş Dağılımı
          </div>
          <div class="modal-branch-layout">
            <div class="modal-chart-row">
              <div id="modalBranchDonutChart" style="height: 200px; width: 200px;"></div>
              <div class="modal-branch-legend">
                ${sortedBranches.slice(0, 6).map(([branch, data], i) => `
                  <div class="legend-item">
                    <span class="legend-color" style="background: ${['#00d4ff', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#06b6d4'][i]}"></span>
                    <span class="legend-text">${branch}</span>
                    <span class="legend-value">${formatCurrency(data.brutPrim)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            <table class="modal-branch-table">
              <thead>
                <tr>
                  <th>Branş</th>
                  <th>Yeni İş</th>
                  <th>Zeyil</th>
                  <th>Toplam</th>
                  <th>Brüt Prim</th>
                </tr>
              </thead>
              <tbody>
                ${sortedBranches.map(([branch, data]) => `
                  <tr>
                    <td><span class="branch-badge-sm">${branch}</span></td>
                    <td><span class="count-yeni">${data.yeniIs.count}</span></td>
                    <td><span class="count-zeyil">${data.zeyil.count}</span></td>
                    <td><strong>${data.count}</strong></td>
                    <td>${formatCurrency(data.brutPrim)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- By Date with Line Chart -->
        ${sortedDates.length > 0 ? `
        <div class="detail-section">
          <div class="detail-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Tarih Dağılımı
          </div>
          <div id="modalDateLineChart" style="height: 200px;"></div>
        </div>
        ` : ''}
      `;

      document.getElementById('importDetailModal').classList.add('active');
      document.body.classList.add('modal-open');

      // Render charts after DOM is updated
      setTimeout(() => {
        // Donut chart for branches
        const donutLabels = sortedBranches.slice(0, 6).map(([branch]) => branch);
        const donutValues = sortedBranches.slice(0, 6).map(([, data]) => data.brutPrim);

        if (donutValues.length > 0 && typeof ApexCharts !== 'undefined') {
          new ApexCharts(document.getElementById('modalBranchDonutChart'), {
            chart: { type: 'donut', height: 200, width: 200, background: 'transparent', fontFamily: "'Manrope', sans-serif" },
            series: donutValues,
            labels: donutLabels,
            colors: ['#00d4ff', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#06b6d4'],
            plotOptions: {
              pie: {
                donut: {
                  size: '65%',
                  labels: {
                    show: true,
                    name: { show: false },
                    value: { show: true, fontSize: '14px', fontWeight: 700, color: '#f1f5f9', offsetY: 5, formatter: (val) => '' },
                    total: { show: true, showAlways: true, label: 'Toplam', fontSize: '10px', color: '#64748b', formatter: (w) => formatCurrency(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) }
                  }
                }
              }
            },
            stroke: { show: false },
            legend: { show: false },
            tooltip: { enabled: true, theme: 'dark', y: { formatter: (val) => formatCurrency(val) } },
            dataLabels: { enabled: false }
          }).render();
        }

        // Line chart for dates
        if (sortedDates.length > 0 && typeof ApexCharts !== 'undefined') {
          const dateLabels = sortedDates.map(([, data]) => data.label);
          const dateValues = sortedDates.map(([, data]) => data.brutPrim);

          // Calculate min value - only set to 0 if no negative values
          const hasNegative = dateValues.some(v => v < 0);
          const yAxisMin = hasNegative ? undefined : 0;

          new ApexCharts(document.getElementById('modalDateLineChart'), {
            chart: {
              type: 'area',
              height: 220,
              background: 'transparent',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              toolbar: { show: false },
              zoom: { enabled: false }
            },
            series: [{ name: 'Brüt Prim', data: dateValues }],
            colors: ['#818cf8'],
            fill: {
              type: 'gradient',
              gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.05, stops: [0, 100] }
            },
            stroke: { curve: 'smooth', width: 3 },
            markers: {
              size: 6,
              colors: ['#818cf8'],
              strokeColors: '#1e2337',
              strokeWidth: 2,
              hover: { size: 8 }
            },
            grid: {
              borderColor: 'rgba(148, 163, 184, 0.15)',
              strokeDashArray: 4,
              xaxis: { lines: { show: false } },
              yaxis: { lines: { show: true } },
              padding: { left: 10, right: 10 }
            },
            xaxis: {
              categories: dateLabels,
              labels: {
                style: { colors: '#cbd5e1', fontSize: '12px', fontWeight: 500 },
                rotate: 0
              },
              axisBorder: { show: false },
              axisTicks: { show: false }
            },
            yaxis: {
              min: yAxisMin,
              labels: {
                style: { colors: '#94a3b8', fontSize: '11px' },
                formatter: (val) => {
                  const abs = Math.abs(val);
                  const sign = val < 0 ? '-' : '';
                  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1) + 'M';
                  if (abs >= 1000) return sign + (abs / 1000).toFixed(0) + 'K';
                  return Math.round(val);
                }
              }
            },
            tooltip: {
              enabled: true,
              cssClass: 'custom-apex-tooltip',
              custom: function({ series, seriesIndex, dataPointIndex, w }) {
                const value = series[seriesIndex][dataPointIndex];
                const label = w.globals.categoryLabels[dataPointIndex];
                return `<div class="apex-tooltip-modal">
                  <div class="tooltip-label">${label}</div>
                  <div class="tooltip-value">${formatCurrency(value)}</div>
                </div>`;
              }
            },
            dataLabels: { enabled: false }
          }).render();
        }
      }, 100);
    }

    function closeDetailModal() {
      document.getElementById('importDetailModal').classList.remove('active');
      document.body.classList.remove('modal-open');
    }

    // Close detail modal when clicking overlay
    document.getElementById('importDetailModal').addEventListener('click', (e) => {
      if (e.target.id === 'importDetailModal') {
        closeDetailModal();
      }
    });
