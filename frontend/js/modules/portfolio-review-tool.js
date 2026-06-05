document.addEventListener('DOMContentLoaded', function () {
  var app = document.querySelector('.iv-portfolio-page');
  if (!app) app = document.body;

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';

  // Local state for portfolio reviews
  var portfolio = [];

  // Helper: Escape HTML to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Load portfolio from localStorage and refresh dynamically from backend
  function loadPortfolio() {
    try {
      var saved = localStorage.getItem('iv_portfolio_stocks');
      if (saved) {
        portfolio = JSON.parse(saved);
        
        // Refresh each stock's details from backend to ensure up-to-date scoring
        portfolio.forEach(function (item, index) {
          var queryVal = item.stock.nseCode || item.stock.bseCode || item.stock.name;
          if (queryVal) {
            fetch(baseUrl + '/portfolio-evaluate?q=' + encodeURIComponent(queryVal))
              .then(function (res) {
                if (res.ok) return res.json();
              })
              .then(function (updatedData) {
                if (updatedData) {
                  portfolio[index] = updatedData;
                  savePortfolio();
                  renderTable();
                }
              })
              .catch(function (err) {
                console.error('Failed to auto-refresh stock:', queryVal, err);
              });
          }
        });
      } else {
        portfolio = [];
      }
    } catch (e) {
      console.error('Error loading portfolio from localStorage', e);
      portfolio = [];
    }
  }

  // Save portfolio to localStorage
  function savePortfolio() {
    try {
      localStorage.setItem('iv_portfolio_stocks', JSON.stringify(portfolio));
    } catch (e) {
      console.error('Error saving portfolio to localStorage', e);
    }
  }

  function getScoreClass(total, max) {
    var ratio = total / max;
    if (ratio >= 0.5) return 'score-green';
    if (ratio >= 0.0) return 'score-yellow';
    return 'score-red';
  }

  // Render portfolio table
  function renderTable() {
    var tbody = document.getElementById('ivPortfolioTableBody');
    if (!tbody) return;

    if (portfolio.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="8" style="text-align: center; color: #AAB6CC; padding: 30px;">
            No stocks added yet. Search for a stock above to add it to your portfolio review list.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    portfolio.forEach(function (item, index) {
      var tr = document.createElement('tr');
      
      var valScore = item.valuation ? item.valuation.score : '—';
      var valTotal = item.valuation ? item.valuation.total : 0;
      
      var totalScore = item.overall.totalScore !== undefined ? item.overall.totalScore : (item.quality.total + item.management.total + valTotal);
      var combinedScore = item.overall.combinedScore !== undefined ? item.overall.combinedScore : (item.quality.total + item.management.total);
      
      var rating = item.overall.finalRating;
      if (item.overall.totalScore === undefined) {
        if (totalScore >= 13) {
          rating = 'Excellent';
        } else if (totalScore >= 9) {
          rating = 'Good';
        } else if (totalScore >= 5) {
          rating = 'Average';
        } else {
          rating = 'Poor';
        }
      }
      
      var codeToDisplay = '';
      if (item.stock.nseCode && item.stock.nseCode.trim() !== '') {
        codeToDisplay = item.stock.nseCode.trim();
      } else if (item.stock.bseCode && item.stock.bseCode.trim() !== '') {
        var cleanBse = parseFloat(item.stock.bseCode).toString();
        if (cleanBse && cleanBse !== 'NaN' && cleanBse !== '0') {
          codeToDisplay = 'bse: ' + cleanBse;
        }
      }

      tr.innerHTML = `
        <td style="font-weight: 600;">
          <div>${escapeHtml(item.stock.name)}</div>
          ${codeToDisplay ? `<div class="nse-code-sub">${escapeHtml(codeToDisplay)}</div>` : ''}
        </td>
        <td>
          <span class="score-badge ${getScoreClass(item.quality.total, 6)}" data-index="${index}" data-type="quality">
            ${escapeHtml(item.quality.score)}
          </span>
        </td>
        <td>
          <span class="score-badge ${getScoreClass(item.management.total, 5)}" data-index="${index}" data-type="management">
            ${escapeHtml(item.management.score)}
          </span>
        </td>
        <td style="font-weight: 600; color: #fff;">${combinedScore} / 11</td>
        <td>
          <span class="score-badge ${getScoreClass(valTotal, 6)}" data-index="${index}" data-type="valuation">
            ${escapeHtml(valScore)}
          </span>
        </td>
        <td style="font-weight: 600; color: #fff;">${totalScore} / 17</td>
        <td style="font-weight: 600; color: ${rating === 'Excellent' || rating === 'Good' ? '#34D399' : (rating === 'Average' ? '#F4D676' : '#F87171')};">${escapeHtml(rating)}</td>
        <td>
          <button class="btn-delete" data-index="${index}" title="Remove Stock">
            <svg style="width:16px;height:16px" viewBox="0 0 24 24">
              <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
            </svg>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Bind event listeners for score clicks (to open drawer)
    tbody.querySelectorAll('.score-badge').forEach(function (badge) {
      badge.addEventListener('click', function () {
        var index = parseInt(badge.getAttribute('data-index'), 10);
        var type = badge.getAttribute('data-type');
        openDrawer(index, type);
      });
    });

    // Bind event listeners for delete buttons
    tbody.querySelectorAll('.btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var index = parseInt(btn.getAttribute('data-index'), 10);
        removeStock(index);
      });
    });
  }

  // Add stock to list
  function addStock(stockData) {
    // Check duplicate
    var exists = portfolio.some(function (item) {
      return item.stock.name.toLowerCase() === stockData.stock.name.toLowerCase();
    });

    if (exists) {
      showCustomAlert('Duplicate Stock', stockData.stock.name + ' is already in your portfolio list.');
      return;
    }

    portfolio.push(stockData);
    savePortfolio();
    renderTable();
  }

  // Remove stock
  function removeStock(index) {
    if (index >= 0 && index < portfolio.length) {
      portfolio.splice(index, 1);
      savePortfolio();
      renderTable();
    }
  }

  // Open Breakdown Drawer
  function openDrawer(index, type) {
    var item = portfolio[index];
    if (!item) return;

    var drawer = document.getElementById('ivPortfolioDrawer');
    var drawerTitle = document.getElementById('ivDrawerTitle');
    var stockNameEl = document.getElementById('ivDrawerStockName');
    var nseCodeEl = document.getElementById('ivDrawerNseCode');
    var bseCodeEl = document.getElementById('ivDrawerBseCode');
    var scoreLabelEl = document.getElementById('ivDrawerScoreLabel');
    var scoreValueEl = document.getElementById('ivDrawerScoreValue');
    var paramsListEl = document.getElementById('ivDrawerParamsList');

    if (!drawer || !stockNameEl || !paramsListEl) return;

    // Fill metadata
    stockNameEl.textContent = item.stock.name;
    nseCodeEl.textContent = 'NSE: ' + (item.stock.nseCode || '—');
    
    var cleanBse = item.stock.bseCode ? parseFloat(item.stock.bseCode).toString() : '—';
    bseCodeEl.textContent = 'BSE: ' + cleanBse;

    if (type === 'quality') {
      drawerTitle.textContent = 'Fundamental Parameters';
      scoreLabelEl.textContent = 'Fundamental Score';
      scoreValueEl.textContent = item.quality.score;
      scoreValueEl.className = 'iv-drawer-score-value ' + getScoreClass(item.quality.total, 6) + '-text';

      // Build parameters list
      var html = '';
      item.quality.parameters.forEach(function (param) {
        var badgeClass = 'neutral';
        var badgeText = '0';
        var scoreVal = Number(param.score);
        if (scoreVal > 0) {
          badgeClass = 'pass';
          badgeText = '+' + scoreVal;
        } else if (scoreVal < 0) {
          badgeClass = 'fail';
          badgeText = scoreVal.toString();
        }
        
        html += `
          <div class="iv-drawer-param-item">
            <div class="iv-param-meta">
              <div class="iv-param-name">${escapeHtml(param.name)}</div>
            </div>
            <div class="iv-param-status-wrapper">
              <span class="iv-param-badge ${badgeClass}">${badgeText}</span>
            </div>
          </div>
        `;
      });
      paramsListEl.innerHTML = html;
    } else if (type === 'management') {
      drawerTitle.textContent = 'Management Parameters';
      scoreLabelEl.textContent = 'Management Score';
      scoreValueEl.textContent = item.management.score;
      scoreValueEl.className = 'iv-drawer-score-value ' + getScoreClass(item.management.total, 5) + '-text';

      // Build parameters list
      var html = '';
      item.management.parameters.forEach(function (param) {
        var badgeClass = 'neutral';
        var badgeText = '0';
        var scoreVal = Number(param.score);
        if (scoreVal > 0) {
          badgeClass = 'pass';
          badgeText = '+' + scoreVal;
        } else if (scoreVal < 0) {
          badgeClass = 'fail';
          badgeText = scoreVal.toString();
        }

        html += `
          <div class="iv-drawer-param-item">
            <div class="iv-param-meta">
              <div class="iv-param-name">${escapeHtml(param.name)}</div>
            </div>
            <div class="iv-param-status-wrapper">
              <span class="iv-param-badge ${badgeClass}">${badgeText}</span>
            </div>
          </div>
        `;
      });
      paramsListEl.innerHTML = html;
    } else if (type === 'valuation') {
      drawerTitle.textContent = 'Valuation Parameters';
      scoreLabelEl.textContent = 'Valuation Score';
      var valScore = item.valuation ? item.valuation.score : '—';
      var valTotal = item.valuation ? item.valuation.total : 0;
      scoreValueEl.textContent = valScore;
      scoreValueEl.className = 'iv-drawer-score-value ' + getScoreClass(valTotal, 6) + '-text';

      // Build parameters list
      var html = '';
      if (item.valuation && item.valuation.parameters) {
        item.valuation.parameters.forEach(function (param) {
          var badgeClass = 'neutral';
          var badgeText = '0';
          var scoreVal = Number(param.score);
          if (scoreVal > 0) {
            badgeClass = 'pass';
            badgeText = '+' + scoreVal;
          } else if (scoreVal < 0) {
            badgeClass = 'fail';
            badgeText = scoreVal.toString();
          }

          html += `
            <div class="iv-drawer-param-item">
              <div class="iv-param-meta">
                <div class="iv-param-name">${escapeHtml(param.name)}</div>
              </div>
              <div class="iv-param-status-wrapper">
                <span class="iv-param-badge ${badgeClass}">${badgeText}</span>
              </div>
            </div>
          `;
        });
      }
      paramsListEl.innerHTML = html;
    }

    // Open drawer
    drawer.style.display = 'block';
    // Use timeout to let the display block resolve, then trigger transition
    setTimeout(function () {
      drawer.classList.add('is-open');
    }, 10);
  }

  // Close Breakdown Drawer
  function closeDrawer() {
    var drawer = document.getElementById('ivPortfolioDrawer');
    if (!drawer) return;

    drawer.classList.remove('is-open');
    // Hide display after transition completes
    setTimeout(function () {
      if (!drawer.classList.contains('is-open')) {
        drawer.style.display = 'none';
      }
    }, 300);
  }

  // Autocomplete Suggestions logic
  var searchInput = document.getElementById('ivPortfolioSearchInput');
  var autocompleteDropdown = document.getElementById('ivPortfolioAutocomplete');
  var addBtn = document.getElementById('ivPortfolioAddBtn');
  var debounceTimer = null;

  function handleAddAction() {
    var query = searchInput.value.trim();
    if (!query) return;

    searchInput.value = '';
    if (autocompleteDropdown) {
      autocompleteDropdown.style.display = 'none';
    }
    evaluateAndAddStock(query);
  }

  if (addBtn) {
    addBtn.addEventListener('click', handleAddAction);
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddAction();
      }
    });
  }

  if (searchInput && autocompleteDropdown) {
    searchInput.addEventListener('input', function () {
      var query = searchInput.value.trim();

      clearTimeout(debounceTimer);
      if (query.length < 2) {
        autocompleteDropdown.innerHTML = '';
        autocompleteDropdown.style.display = 'none';
        return;
      }

      debounceTimer = setTimeout(function () {
        fetch(baseUrl + '/portfolio-search?q=' + encodeURIComponent(query))
          .then(function (res) {
            if (!res.ok) throw new Error('Search failed');
            return res.json();
          })
          .then(function (data) {
            var results = data.results || [];
            if (results.length === 0) {
              autocompleteDropdown.innerHTML = '<div style="padding: 12px 16px; color: #aab6cc; font-style: italic;">No matches found</div>';
              autocompleteDropdown.style.display = 'block';
              return;
            }

            var html = '';
            results.forEach(function (resItem) {
              var cleanBse = resItem.bseCode ? parseFloat(resItem.bseCode).toString() : '';
              var codesText = '';
              if (resItem.nseCode && cleanBse) {
                codesText = resItem.nseCode + ' | ' + cleanBse;
              } else {
                codesText = resItem.nseCode || cleanBse || '';
              }

              html += `
                <div class="iv-autocomplete-item" data-query="${escapeHtml(resItem.nseCode || resItem.bseCode || resItem.name)}">
                  <span class="stock-name">${escapeHtml(resItem.name)}</span>
                  ${codesText ? `<span class="stock-codes">${escapeHtml(codesText)}</span>` : ''}
                </div>
              `;
            });
            autocompleteDropdown.innerHTML = html;
            autocompleteDropdown.style.display = 'block';

            // Bind click to suggestion items
            autocompleteDropdown.querySelectorAll('.iv-autocomplete-item').forEach(function (itemNode) {
              itemNode.addEventListener('click', function () {
                var searchQ = itemNode.getAttribute('data-query');
                searchInput.value = '';
                autocompleteDropdown.style.display = 'none';
                evaluateAndAddStock(searchQ);
              });
            });
          })
          .catch(function (err) {
            console.error(err);
          });
      }, 250);
    });
  }

  // Fetch score and add stock
  function evaluateAndAddStock(q) {
    if (!q) return;

    // Show loading indicator or state if needed
    fetch(baseUrl + '/portfolio-evaluate?q=' + encodeURIComponent(q))
      .then(function (res) {
        if (!res.ok) {
          if (res.status === 404) {
            showCustomAlert('Search Error', 'Stock details not found.');
          } else {
            showCustomAlert('Evaluation Error', 'Error evaluating stock.');
          }
          throw new Error('Evaluate failed');
        }
        return res.json();
      })
      .then(function (data) {
        addStock(data);
      })
      .catch(function (err) {
        console.error('Error in evaluateAndAddStock:', err);
      });
  }

  // Setup Drawer close event triggers
  var drawerClose = document.getElementById('ivDrawerClose');
  var drawerOverlay = document.getElementById('ivDrawerOverlay');

  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

  // Setup Clear Portfolio trigger with Custom Confirmation Modal
  var clearBtn = document.getElementById('ivClearPortfolio');
  var confirmModal = document.getElementById('ivConfirmModal');
  var confirmOverlay = document.getElementById('ivConfirmOverlay');
  var confirmCancel = document.getElementById('ivConfirmCancel');
  var confirmOk = document.getElementById('ivConfirmOk');

  function openConfirmModal() {
    if (confirmModal) confirmModal.style.display = 'flex';
  }

  function closeConfirmModal() {
    if (confirmModal) confirmModal.style.display = 'none';
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (portfolio.length > 0) {
        openConfirmModal();
      }
    });
  }

  if (confirmCancel) confirmCancel.addEventListener('click', closeConfirmModal);
  if (confirmOverlay) confirmOverlay.addEventListener('click', closeConfirmModal);

  if (confirmOk) {
    confirmOk.addEventListener('click', function () {
      portfolio = [];
      savePortfolio();
      renderTable();
      closeConfirmModal();
    });
  }

  // Setup Custom Alert Modal
  var alertModal = document.getElementById('ivAlertModal');
  var alertOverlay = document.getElementById('ivAlertOverlay');
  var alertOkBtn = document.getElementById('ivAlertOk');
  var alertTitleEl = document.getElementById('ivAlertTitle');
  var alertMsgEl = document.getElementById('ivAlertMessage');

  function showCustomAlert(title, message) {
    if (alertTitleEl) alertTitleEl.textContent = title;
    if (alertMsgEl) alertMsgEl.textContent = message;
    if (alertModal) alertModal.style.display = 'flex';
  }

  function closeCustomAlert() {
    if (alertModal) alertModal.style.display = 'none';
  }

  if (alertOkBtn) alertOkBtn.addEventListener('click', closeCustomAlert);
  if (alertOverlay) alertOverlay.addEventListener('click', closeCustomAlert);

  // Setup Click outside autocomplete dropdown
  document.addEventListener('click', function (e) {
    if (searchInput && !searchInput.contains(e.target) && autocompleteDropdown && !autocompleteDropdown.contains(e.target)) {
      autocompleteDropdown.style.display = 'none';
    }
  });

  // CSV Import Feature
  var fileInput = document.getElementById('ivPortfolioFileInput');
  var fileDropzone = document.getElementById('ivFileDropzone');
  var uploadStatus = document.getElementById('ivUploadStatus');
  var progressLabel = document.getElementById('ivUploadProgressLabel');
  var progressPct = document.getElementById('ivUploadProgressPct');
  var progressBar = document.getElementById('ivUploadProgressBar');
  var uploadLogs = document.getElementById('ivUploadLogs');

  // Trigger file browser on click
  if (fileDropzone && fileInput) {
    fileDropzone.addEventListener('click', function () {
      fileInput.click();
    });

    // Drag-and-drop event listeners
    ['dragenter', 'dragover'].forEach(function (eventName) {
      fileDropzone.addEventListener(eventName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        fileDropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(function (eventName) {
      fileDropzone.addEventListener(eventName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        fileDropzone.classList.remove('dragover');
      }, false);
    });

    fileDropzone.addEventListener('drop', function (e) {
      var dt = e.dataTransfer;
      var files = dt.files;
      if (files && files.length > 0) {
        handleCSVFile(files[0]);
      }
    }, false);

    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length > 0) {
        handleCSVFile(fileInput.files[0]);
      }
    });
  }

  // Handle uploaded CSV file
  function handleCSVFile(file) {
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      showCustomAlert('Invalid File Type', 'Please upload a valid .csv file.');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      var text = e.target.result;
      processCSVContent(text);
    };
    reader.onerror = function () {
      showCustomAlert('File Error', 'Error reading file.');
    };
    reader.readAsText(file);
  }

  // CSV line parser that respects double quotes and commas
  function parseCSV(text) {
    var lines = [];
    var row = [""];
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      var next = text[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') { i++; }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  }

  function addLog(message, type) {
    if (!uploadLogs) return;
    var row = document.createElement('div');
    row.className = 'iv-upload-log-row ' + (type || 'info');
    row.textContent = message;
    uploadLogs.appendChild(row);
    uploadLogs.scrollTop = uploadLogs.scrollHeight;
  }

  // Process CSV content
  function processCSVContent(text) {
    if (uploadLogs) {
      uploadLogs.innerHTML = '';
      uploadLogs.style.display = 'block';
    }
    if (uploadStatus) {
      uploadStatus.style.display = 'block';
      progressBar.style.width = '0%';
      progressPct.textContent = '0%';
      progressLabel.textContent = 'Parsing CSV file...';
    }

    addLog('Parsing uploaded file...', 'info');

    var rows = parseCSV(text);
    if (rows.length === 0) {
      addLog('Error: CSV file is empty.', 'error');
      return;
    }

    // Identify header row and matching columns
    var headers = rows[0];
    var nseColIndex = -1;
    var bseColIndex = -1;
    var isinColIndex = -1;
    var nameColIndex = -1;

    // Detect column indexes from header keywords
    for (var col = 0; col < headers.length; col++) {
      var h = headers[col].trim().toLowerCase();
      
      // Look for NSE
      if (nseColIndex === -1 && (h === 'nse' || h === 'symbol' || h === 'ticker' || h === 'nse code' || h === 'instrument' || h === 'tradingsymbol')) {
        nseColIndex = col;
        addLog('Found potential NSE column: "' + headers[col] + '"', 'success');
      }
      // Look for BSE
      else if (bseColIndex === -1 && (h === 'bse' || h === 'scrip' || h === 'bse code' || h === 'scrip code' || h === 'bse symbol')) {
        bseColIndex = col;
        addLog('Found potential BSE column: "' + headers[col] + '"', 'success');
      }
      // Look for ISIN
      else if (isinColIndex === -1 && (h === 'isin' || h === 'isin code' || h === 'isin_code' || h === 'isin number')) {
        isinColIndex = col;
        addLog('Found potential ISIN column: "' + headers[col] + '"', 'success');
      }
      // Look for Name
      else if (nameColIndex === -1 && (h === 'company' || h === 'name' || h === 'security' || h === 'company name' || h === 'holding' || h === 'security name')) {
        nameColIndex = col;
        addLog('Found potential Name column: "' + headers[col] + '"', 'success');
      }
    }

    // Heuristics for headerless CSVs or unmatched column headers
    if (nseColIndex === -1 && bseColIndex === -1 && isinColIndex === -1 && nameColIndex === -1) {
      addLog('Header labels not matched. Scanning columns for codes...', 'info');
      var sampleRows = rows.slice(1, Math.min(6, rows.length));
      for (var col = 0; col < headers.length; col++) {
        var allBseLike = true;
        var allNseLike = true;
        var allIsinLike = true;
        var hasText = false;
        var validSampleCount = 0;
        
        sampleRows.forEach(function(row) {
          if (!row || row.length <= col) return;
          var val = (row[col] || '').trim();
          if (!val) return;
          validSampleCount++;
          if (!/^\d{6}(\.0)?$/.test(val)) allBseLike = false;
          if (!/^[A-Za-z\-&]{2,10}$/.test(val)) allNseLike = false;
          if (!/^IN[A-Z0-9]{10}$/i.test(val)) allIsinLike = false;
          if (val.length > 5) hasText = true;
        });

        if (validSampleCount > 0) {
          if (allIsinLike) {
            isinColIndex = col;
            addLog('Mapped column ' + col + ' to ISIN (ISIN codes detected)', 'success');
          } else if (allBseLike) {
            bseColIndex = col;
            addLog('Mapped column ' + col + ' to BSE (numeric codes detected)', 'success');
          } else if (allNseLike) {
            nseColIndex = col;
            addLog('Mapped column ' + col + ' to NSE (uppercase symbols detected)', 'success');
          } else if (hasText && nameColIndex === -1) {
            nameColIndex = col;
            addLog('Mapped column ' + col + ' to Name (text descriptions detected)', 'success');
          }
        }
      }
    }

    if (nseColIndex === -1 && bseColIndex === -1 && isinColIndex === -1 && nameColIndex === -1) {
      addLog('Failed to auto-detect any Stock Name, ISIN, NSE, or BSE Code columns. Please ensure your CSV headers contain terms like "ISIN", "NSE", "BSE", or "Name".', 'error');
      return;
    }

    // Extracted keys
    var queries = [];
    var maxIndex = Math.max(nseColIndex, bseColIndex, isinColIndex, nameColIndex);
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || row.length <= maxIndex) continue;

      var isinVal = isinColIndex !== -1 ? row[isinColIndex].trim() : '';
      var nseVal = nseColIndex !== -1 ? row[nseColIndex].trim() : '';
      var bseVal = bseColIndex !== -1 ? row[bseColIndex].trim() : '';
      var nameVal = nameColIndex !== -1 ? row[nameColIndex].trim() : '';

      // Prefer ISIN Code, then NSE Code, then BSE Code, then Name
      var key = isinVal || nseVal || bseVal || nameVal;
      if (key && key !== '-' && key !== 'N/A' && key !== 'null' && key !== 'undefined') {
        queries.push(key);
      }
    }

    // De-duplicate import queries
    queries = queries.filter(function (value, index, self) {
      return self.indexOf(value) === index;
    });

    if (queries.length === 0) {
      addLog('No valid stocks found in the file to import.', 'error');
      return;
    }

    addLog('Found ' + queries.length + ' unique stock(s) to process. Beginning batch import...', 'info');
    progressBar.style.width = '0%';
    progressPct.textContent = '0%';
    progressLabel.textContent = 'Importing 0 of ' + queries.length + ' stocks...';

    // Batch evaluation with rate control (fetch sequentially)
    var successCount = 0;
    var failCount = 0;
    var index = 0;

    function processNext() {
      if (index >= queries.length) {
        progressLabel.textContent = 'Import Complete. ' + successCount + ' added, ' + failCount + ' failed.';
        progressBar.style.width = '100%';
        progressPct.textContent = '100%';
        addLog('Completed import! ' + successCount + ' successfully added, ' + failCount + ' failed.', 'info');
        
        savePortfolio();
        renderTable();
        return;
      }

      var q = queries[index];
      progressLabel.textContent = 'Importing ' + (index + 1) + ' of ' + queries.length + ' (' + q + ')...';
      var pct = Math.round((index / queries.length) * 100);
      progressBar.style.width = pct + '%';
      progressPct.textContent = pct + '%';

      // Check if duplicate in active list to skip network fetch
      var isDuplicate = portfolio.some(function (item) {
        return (item.stock.name && item.stock.name.toLowerCase() === q.toLowerCase()) ||
               (item.stock.nseCode && item.stock.nseCode.toLowerCase() === q.toLowerCase()) ||
               (item.stock.bseCode && item.stock.bseCode.toLowerCase() === q.toLowerCase());
      });

      if (isDuplicate) {
        addLog('Skipped "' + q + '" (already exists in portfolio review list)', 'info');
        successCount++;
        index++;
        processNext();
        return;
      }

      fetch(baseUrl + '/portfolio-evaluate?q=' + encodeURIComponent(q))
        .then(function (res) {
          if (!res.ok) {
            throw new Error('Stock not found');
          }
          return res.json();
        })
        .then(function (data) {
          var duplicateSec = portfolio.some(function (item) {
            return item.stock.name.toLowerCase() === data.stock.name.toLowerCase();
          });
          if (!duplicateSec) {
            portfolio.push(data);
            addLog('Successfully added: ' + data.stock.name + ' (' + (data.stock.nseCode || data.stock.bseCode || '') + ')', 'success');
            successCount++;
          } else {
            addLog('Skipped duplicate resolved stock: ' + data.stock.name, 'info');
            successCount++;
          }
        })
        .catch(function (err) {
          addLog('Failed to resolve stock: "' + q + '" (Not found in CSV)', 'error');
          failCount++;
        })
        .then(function () {
          index++;
          setTimeout(processNext, 50);
        });
    }

    processNext();
  }

  // Initialize
  loadPortfolio();
  renderTable();
});
