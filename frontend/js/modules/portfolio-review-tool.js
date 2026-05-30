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

  // Load portfolio from localStorage
  function loadPortfolio() {
    try {
      var saved = localStorage.getItem('iv_portfolio_stocks');
      if (saved) {
        portfolio = JSON.parse(saved);
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

  // Helper: Get color class for score badge
  function getScoreClass(total, max) {
    var ratio = total / max;
    if (ratio >= 0.7) return 'score-green';
    if (ratio >= 0.4) return 'score-yellow';
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
      
      // Clean codes for display
      var nseCode = item.stock.nseCode || '—';
      var bseCode = item.stock.bseCode ? parseFloat(item.stock.bseCode).toString() : '—'; // Clean float decimals (e.g. 532540.0 -> 532540)
      
      tr.innerHTML = `
        <td style="font-weight: 600;">${escapeHtml(item.stock.name)}</td>
        <td><span style="font-family: monospace; color: #aab6cc;">${escapeHtml(nseCode)}</span></td>
        <td><span style="font-family: monospace; color: #aab6cc;">${escapeHtml(bseCode)}</span></td>
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
        <td style="color: #aab6cc; font-style: italic;">—</td>
        <td style="color: #aab6cc; font-style: italic;">—</td>
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
      alert(stockData.stock.name + ' is already in your portfolio list.');
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
      drawerTitle.textContent = 'Quality Parameters';
      scoreLabelEl.textContent = 'Quality Score';
      scoreValueEl.textContent = item.quality.score;
      scoreValueEl.className = 'iv-drawer-score-value ' + getScoreClass(item.quality.total, 6) + '-text';

      // Build parameters list
      var html = '';
      item.quality.parameters.forEach(function (param) {
        var badgeClass = param.passed ? 'pass' : 'fail';
        var badgeText = param.passed ? '+1 Pass' : '0 Fail';
        
        html += `
          <div class="iv-drawer-param-item">
            <div class="iv-param-meta">
              <div class="iv-param-name">${escapeHtml(param.name)}</div>
              <div class="iv-param-threshold">Target: ${escapeHtml(param.threshold)}</div>
            </div>
            <div class="iv-param-status-wrapper">
              <div class="iv-param-value">${escapeHtml(param.displayValue)}</div>
              <span class="iv-param-badge ${badgeClass}">${badgeText}</span>
            </div>
          </div>
        `;
      });
      paramsListEl.innerHTML = html;
    } else {
      drawerTitle.textContent = 'Management Parameters';
      scoreLabelEl.textContent = 'Management Score';
      scoreValueEl.textContent = item.management.score;
      scoreValueEl.className = 'iv-drawer-score-value ' + getScoreClass(item.management.total, 5) + '-text';

      // Build parameters list
      var html = '';
      item.management.parameters.forEach(function (param) {
        var badgeClass = 'neutral';
        var badgeText = '0 Neutral';

        if (param.score === 1) {
          badgeClass = 'pass';
          badgeText = '+1 Pass';
        } else if (param.score === -1) {
          badgeClass = 'fail';
          badgeText = '-1 Fail';
        }

        html += `
          <div class="iv-drawer-param-item">
            <div class="iv-param-meta">
              <div class="iv-param-name">${escapeHtml(param.name)}</div>
              <div class="iv-param-threshold">Target: ${escapeHtml(param.threshold)}</div>
            </div>
            <div class="iv-param-status-wrapper">
              <div class="iv-param-value">${escapeHtml(param.displayValue)}</div>
              <span class="iv-param-badge ${badgeClass}">${badgeText}</span>
            </div>
          </div>
        `;
      });
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
            alert('Stock details not found.');
          } else {
            alert('Error evaluating stock.');
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

  // Setup Clear Portfolio trigger
  var clearBtn = document.getElementById('ivClearPortfolio');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (portfolio.length > 0 && confirm('Are you sure you want to clear your portfolio list?')) {
        portfolio = [];
        savePortfolio();
        renderTable();
      }
    });
  }

  // Setup Click outside autocomplete dropdown
  document.addEventListener('click', function (e) {
    if (searchInput && !searchInput.contains(e.target) && autocompleteDropdown && !autocompleteDropdown.contains(e.target)) {
      autocompleteDropdown.style.display = 'none';
    }
  });

  // Initialize
  loadPortfolio();
  renderTable();
});
