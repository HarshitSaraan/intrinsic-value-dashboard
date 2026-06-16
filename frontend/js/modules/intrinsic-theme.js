(function () {
  var app = document.querySelector('.iv-intrinsic-theme-page');
  if (!app) app = document.body;

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';
  var apiEndpoint = baseUrl + '/intrinsic-theme-data';

  var allStocksData = [];
  var filteredStocks = [];
  var currentType = '';
  var currentPage = 1;
  var pageSize = 15;

  // Theme metadata rules/details
  var themeMeta = {
    'growth-at-value': {
      title: 'Growth at Value',
      desc: 'High growth Indian companies trading at attractive valuations.',
      note: 'Screener Criteria: Sales Growth 3Years > 20% | Price to Earning (P/E) between 0 and 25 | Price to Book value (P/B) < 4.5'
    },
    'aggressive-smallcaps': {
      title: 'High Growth Small Cap',
      desc: 'Small cap opportunities with massive growth and ROCE momentum.',
      note: 'Screener Criteria: Market Cap < 2000 Cr | Sales Growth 3Years > 25% | ROCE 3Years > 12%'
    },
    'undervalued-largecaps': {
      title: 'Value Large Cap',
      desc: 'Discounted large-cap leaders trading at attractive P/E and P/B multiples.',
      note: 'Screener Criteria: Market Cap > 15000 Cr | Price to Earning (P/E) between 0 and 18 | Price to Book value (P/B) < 3.0'
    },
    'growth-tech': {
      title: 'Technology Leaders',
      desc: 'Technology innovators, IT providers, and software anchors with solid growth.',
      note: 'Screener Criteria: Industry Group contains Software/IT/Telecom/Tech | Sales Growth 3Years > 20%'
    },
    'portfolio-anchors': {
      title: 'Core Compounders',
      desc: 'Premium compounders with clean leverage, high Piotroski health, and strong ROCE.',
      note: 'Screener Criteria: Market Cap > 25000 Cr | Piotroski Score >= 7 | Debt to equity < 0.8 | ROCE 3Years > 15%'
    },
    'solid-large-growth': {
      title: 'Large Compounders',
      desc: 'Mega-cap growth anchors displaying robust capital returns and financial strength.',
      note: 'Screener Criteria: Market Cap > 20000 Cr | Sales Growth 3Years > 15% | ROCE 3Years > 18% | Debt to Equity < 1.0'
    }
  };

  function getQueryParam(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
  }

  // Follow symbols persistence
  function getFollowedSymbols() {
    var stored = localStorage.getItem('followed_symbols');
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch (e) {
      return [];
    }
  }

  function isSymbolFollowed(symbol) {
    var list = getFollowedSymbols();
    return list.indexOf(symbol) >= 0;
  }

  function toggleFollowSymbol(symbol) {
    var list = getFollowedSymbols();
    var idx = list.indexOf(symbol);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(symbol);
    }
    localStorage.setItem('followed_symbols', JSON.stringify(list));
    return idx < 0; // returns true if now followed
  }

  // Format helper for Indian Rupee Crores
  function formatMarketCap(val) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    var num = Number(val);
    return '₹' + num.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + ' Cr';
  }

  // Display strategy/theme details UI
  function showThemeDetails(type) {
    currentType = type;
    var meta = themeMeta[type];
    if (!meta) {
      showDirectory();
      return;
    }

    var gridView = app.querySelector('#ivIntDirectoryGrid');
    var detailsView = app.querySelector('#ivIntDetailsView');
    if (gridView) gridView.style.display = 'none';
    if (detailsView) detailsView.style.display = 'block';

    // Update Headings
    var kicker = app.querySelector('#ivIntKicker');
    var heading = app.querySelector('#ivIntHeading');
    var sub = app.querySelector('#ivIntSubheading');
    if (kicker) kicker.textContent = 'Fundamental Strategy';
    if (heading) heading.textContent = meta.title;
    if (sub) sub.textContent = meta.desc;

    // Card details
    var dTitle = app.querySelector('#ivIntDetailsCardTitle');
    var dDesc = app.querySelector('#ivIntDetailsCardDesc');
    var dNote = app.querySelector('#ivIntDetailsCardNote');
    if (dTitle) dTitle.textContent = meta.title;
    if (dDesc) dDesc.textContent = meta.desc;
    if (dNote) dNote.textContent = meta.note;

    currentPage = 1;

    // Reset search
    var searchInput = app.querySelector('#ivIntTableSearch');
    if (searchInput) searchInput.value = '';
  }

  // Show directory view
  function showDirectory() {
    currentType = '';
    var gridView = app.querySelector('#ivIntDirectoryGrid');
    var detailsView = app.querySelector('#ivIntDetailsView');
    if (gridView) gridView.style.display = 'grid';
    if (detailsView) detailsView.style.display = 'none';

    var kicker = app.querySelector('#ivIntKicker');
    var heading = app.querySelector('#ivIntHeading');
    var sub = app.querySelector('#ivIntSubheading');
    if (kicker) kicker.textContent = 'Themes Directory';
    if (heading) heading.textContent = 'Intrinsic Themes';
    if (sub) sub.textContent = 'Fundamental investment strategies executed purely on the local stock master database.';
  }

  // Update summary averages
  function updateSummaryAverages(dataSummary) {
    var countStat = app.querySelector('#ivIntCountStat');
    var peStat = app.querySelector('#ivIntPeStat');
    var salesStat = app.querySelector('#ivIntSalesStat');
    var pbStat = app.querySelector('#ivIntPbStat');

    if (!dataSummary) {
      if (countStat) countStat.textContent = '0';
      if (peStat) peStat.textContent = '—';
      if (salesStat) salesStat.textContent = '—';
      if (pbStat) pbStat.textContent = '—';
      return;
    }

    if (countStat) countStat.textContent = dataSummary.count !== undefined ? dataSummary.count.toString() : '0';
    if (peStat) peStat.textContent = dataSummary.avgPe ? dataSummary.avgPe.toFixed(1) : '—';
    if (salesStat) salesStat.textContent = dataSummary.avgSalesGrowth ? dataSummary.avgSalesGrowth.toFixed(1) + '%' : '—';
    if (pbStat) pbStat.textContent = dataSummary.avgPb ? dataSummary.avgPb.toFixed(2) : '—';
  }


  // Render matching stocks table
  function renderTablePage() {
    var body = app.querySelector('#ivIntTableBody');
    var pageInfo = app.querySelector('#ivIntPageInfo');
    if (!body) return;

    if (!filteredStocks || !filteredStocks.length) {
      body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--iv-text-muted);">No stocks match search.</td></tr>';
      if (pageInfo) pageInfo.textContent = 'Page 1 of 1';
      return;
    }

    var totalPages = Math.ceil(filteredStocks.length / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * pageSize;
    var end = Math.min(start + pageSize, filteredStocks.length);
    var pageItems = filteredStocks.slice(start, end);

    body.innerHTML = pageItems.map(function (s, index) {
      var name = s.name || '—';
      var sector = s.industry || '—';
      var mcap = formatMarketCap(s.marketCap);
      var sales = (s.sales3Y !== null && s.sales3Y !== undefined) ? s.sales3Y.toFixed(1) + '%' : '—';
      var roce = (s.roce3Y !== null && s.roce3Y !== undefined) ? s.roce3Y.toFixed(1) + '%' : '—';
      var pb = (s.pb !== null && s.pb !== undefined) ? s.pb.toFixed(2) : '—';

      return '<tr class="iv-int-table-row" style="cursor: default;">' +
        '<td style="text-align: center; color: var(--iv-text-muted); font-size: 13px; font-weight: 500;">' + s.rank + '</td>' +
        '<td style="text-align: left; font-weight: 500; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + name + '">' + name + '</td>' +
        '<td style="text-align: left; font-size: 12.5px; color: var(--iv-text-secondary);">' + sector + '</td>' +
        '<td style="text-align: right; font-weight: 500;">' + mcap + '</td>' +
        '<td style="text-align: right; font-weight: 500;">' + sales + '</td>' +
        '<td style="text-align: right; font-weight: 500;">' + roce + '</td>' +
        '<td style="text-align: right; font-weight: 500;">' + pb + '</td>' +
        '</tr>';
    }).join('');

    if (pageInfo) {
      pageInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages + ' (Showing ' + (start + 1) + '–' + end + ' of ' + filteredStocks.length + ')';
    }
  }
  // Bind UI Events
  function bindUIEvents() {
    var cards = app.querySelectorAll('.iv-int-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        var type = card.getAttribute('data-theme-type');
        if (type) {
          window.location.href = '/intrinsic-theme?type=' + type;
        }
      });
    });

    var backBtn = app.querySelector('#ivIntBackButton');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.location.href = '/intrinsic-theme';
      });
    }

    var searchInput = app.querySelector('#ivIntTableSearch');
    if (searchInput) {
      searchInput.addEventListener('keyup', function () {
        var q = searchInput.value.toLowerCase().trim();
        var raw = allStocksData || [];
        if (!q) {
          filteredStocks = raw.slice();
        } else {
          filteredStocks = raw.filter(function (s) {
            var name = (s.name || '').toLowerCase();
            var ind = (s.industry || '').toLowerCase();
            return name.indexOf(q) >= 0 || ind.indexOf(q) >= 0;
          });
        }
        currentPage = 1;
        renderTablePage();
      });
    }

    var prev = app.querySelector('#ivIntPrevPage');
    var next = app.querySelector('#ivIntNextPage');
    if (prev) {
      prev.addEventListener('click', function () {
        if (currentPage > 1) {
          currentPage--;
          renderTablePage();
        }
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        var totalPages = Math.ceil(filteredStocks.length / pageSize);
        if (currentPage < totalPages) {
          currentPage++;
          renderTablePage();
        }
      });
    }
  }

  // Page Init
  function initPage() {
    bindUIEvents();

    var selectedType = getQueryParam('type');
    if (selectedType && themeMeta[selectedType]) {
      showThemeDetails(selectedType);

      var body = app.querySelector('#ivIntTableBody');
      if (body) {
        body.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 48px; color: var(--iv-text-secondary);">' +
          '<div style="width:24px; height:24px; border:3px solid rgba(255,140,0,0.2); border-top-color:var(--iv-accent); border-radius:50%; animation:spin 1s linear infinite; margin: 0 auto 12px auto;"></div>' +
          'Running database filters and ranking stocks...' +
          '</td></tr>';
      }

      fetch(apiEndpoint + '?type=' + selectedType, { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('API fetch error');
          return res.json();
        })
        .then(function (data) {
          allStocksData = data.quotes || [];
          filteredStocks = allStocksData.slice();
          updateSummaryAverages(data.summary);
          renderTablePage();
        })
        .catch(function (err) {
          console.error('Error loading theme details:', err);
          if (body) {
            body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--iv-danger);">Failed to load database data: ' + err.message + '</td></tr>';
          }
        });
    } else {
      showDirectory();
    }
  }

  // CSS spin helper
  var style = document.createElement('style');
  style.innerHTML = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
  document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded', function () {
    initPage();
  });
})();
