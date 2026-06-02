(function () {
  var app = document.querySelector('.iv-strategies-page');
  if (!app) app = document.body;

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';
  var apiEndpoint = baseUrl + '/strategies-data';

  var allStrategiesData = null;
  var filteredStocks = [];
  var currentType = '';
  var currentPage = 1;
  var pageSize = 10;

  // Strategy Meta Details
  var strategyMeta = {
    'undervalued-growth': {
      title: 'Undervalued Growth Stocks',
      desc: 'High growth companies trading at reasonable valuations.',
      note: 'Screening criteria: Sales Growth 3Years > 20% | Price to Earning between 0 and 25 | Price to book value < 4.5.'
    },
    'aggressive-smallcaps': {
      title: 'Aggressive Small Caps',
      desc: 'Small cap opportunities with massive sales and ROCE momentum.',
      note: 'Screening criteria: Market Cap < 2000 Cr | Sales Growth 3Years > 25% | ROCE 3Years > 12%.'
    },
    'undervalued-largecaps': {
      title: 'Undervalued Large Caps',
      desc: 'Stable market leaders trading at discounted valuations.',
      note: 'Screening criteria: Market Cap > 15000 Cr | Price to Earning < 18 | Price to book value < 3.0.'
    },
    'growth-tech': {
      title: 'Growth Technology Stocks',
      desc: 'Technology, software, and telecom businesses with strong growth.',
      note: 'Screening criteria: Industry Group contains software/IT/tech/telecom | Sales Growth 3Years > 20%.'
    },
    'portfolio-anchors': {
      title: 'Portfolio Anchors',
      desc: 'High-quality bluechip stocks with robust Piotroski scores and low debt.',
      note: 'Screening criteria: Market Cap > 25000 Cr | Piotroski Score >= 7 | Debt to Equity < 0.8 | ROCE 3Years > 15%.'
    },
    'solid-large-growth': {
      title: 'Solid Large Growth Funds',
      desc: 'High efficiency large-cap companies with robust growth parameters.',
      note: 'Screening criteria: Market Cap > 20000 Cr | Sales Growth 3Years > 15% | ROCE 3Years > 18% | Debt to Equity < 1.0.'
    }
  };

  function getQueryParam(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
  }

  function formatNumber(val, decimals) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Number(val).toLocaleString('en-IN', {
      minimumFractionDigits: decimals || 0,
      maximumFractionDigits: decimals || 0
    });
  }

  // Display details of a selected strategy
  function showStrategyDetails(type) {
    currentType = type;
    var meta = strategyMeta[type];
    if (!meta) {
      showDirectory();
      return;
    }

    // Toggle layouts
    var gridView = app.querySelector('#ivStratDirectoryGrid');
    var detailsView = app.querySelector('#ivStratDetailsView');
    if (gridView) gridView.style.display = 'none';
    if (detailsView) detailsView.style.display = 'block';

    // Update Headings
    var kicker = app.querySelector('#ivStratKicker');
    var heading = app.querySelector('#ivStratHeading');
    var sub = app.querySelector('#ivStratSubheading');
    if (kicker) kicker.textContent = 'Growth & Value Strategy';
    if (heading) heading.textContent = meta.title;
    if (sub) sub.textContent = meta.desc;

    // Card Details
    var dTitle = app.querySelector('#ivDetailsCardTitle');
    var dDesc = app.querySelector('#ivDetailsCardDesc');
    var dNote = app.querySelector('#ivDetailsCardNote');
    if (dTitle) dTitle.textContent = meta.title;
    if (dDesc) dDesc.textContent = meta.desc;
    if (dNote) dNote.textContent = meta.note;

    // Load data from global cache
    if (!allStrategiesData || !allStrategiesData[type]) {
      renderTable([]);
      updateSummaryStats([]);
      return;
    }

    var rawStocks = allStrategiesData[type];
    filteredStocks = rawStocks.slice(); // copy
    currentPage = 1;

    // Filter based on input search
    var searchInput = app.querySelector('#ivStratTableSearch');
    if (searchInput) searchInput.value = ''; // reset search input

    updateSummaryStats(filteredStocks);
    renderTablePage();
  }

  // Display the directory of all six cards
  function showDirectory() {
    currentType = '';
    var gridView = app.querySelector('#ivStratDirectoryGrid');
    var detailsView = app.querySelector('#ivStratDetailsView');
    if (gridView) gridView.style.display = 'grid';
    if (detailsView) detailsView.style.display = 'none';

    // Update Headings
    var kicker = app.querySelector('#ivStratKicker');
    var heading = app.querySelector('#ivStratHeading');
    var sub = app.querySelector('#ivStratSubheading');
    if (kicker) kicker.textContent = 'Strategies Directory';
    if (heading) heading.textContent = 'Value and Growth Strategies';
    if (sub) sub.textContent = 'Target stocks based on fundamental value and growth metrics';
  }

  // Calculate and update stats box summaries
  function updateSummaryStats(stocks) {
    var countStat = app.querySelector('#ivStratCountStat');
    var peStat = app.querySelector('#ivStratPeStat');
    var roceStat = app.querySelector('#ivStratRoceStat');
    var minCapStat = app.querySelector('#ivStratMinCapStat');

    if (!stocks || !stocks.length) {
      if (countStat) countStat.textContent = '0';
      if (peStat) peStat.textContent = '—';
      if (roceStat) roceStat.textContent = '—';
      if (minCapStat) minCapStat.textContent = '—';
      return;
    }

    if (countStat) countStat.textContent = stocks.length.toString();

    // PE average
    var peList = stocks.map(function(s){ return s.pe; }).filter(function(v){ return v > 0; });
    var avgPE = peList.length ? (peList.reduce(function(a,b){return a+b;}, 0) / peList.length) : NaN;
    if (peStat) peStat.textContent = isFinite(avgPE) ? avgPE.toFixed(1) : '—';

    // ROCE average
    var roceList = stocks.map(function(s){ return s.roce3Y; }).filter(function(v){ return isFinite(v); });
    var avgROCE = roceList.length ? (roceList.reduce(function(a,b){return a+b;}, 0) / roceList.length) : NaN;
    if (roceStat) roceStat.textContent = isFinite(avgROCE) ? avgROCE.toFixed(1) + '%' : '—';

    // Min Market cap
    var mcaps = stocks.map(function(s){ return s.mcap; }).filter(function(v){ return v > 0; });
    var minCap = mcaps.length ? Math.min.apply(null, mcaps) : NaN;
    if (minCapStat) minCapStat.textContent = isFinite(minCap) ? '₹' + formatNumber(minCap, 0) + ' Cr' : '—';
  }

  // Render current paginated table view
  function renderTablePage() {
    var body = app.querySelector('#ivStratTableBody');
    var pageInfo = app.querySelector('#ivStratPageInfo');
    if (!body) return;

    if (!filteredStocks || !filteredStocks.length) {
      body.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--iv-text-muted);">No stocks match search.</td></tr>';
      if (pageInfo) pageInfo.textContent = 'Page 1 of 1';
      return;
    }

    var totalPages = Math.ceil(filteredStocks.length / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * pageSize;
    var end = Math.min(start + pageSize, filteredStocks.length);
    var pageItems = filteredStocks.slice(start, end);

    body.innerHTML = pageItems.map(function (s) {
      var nse = s.nseCode ? s.nseCode : (s.bseCode ? s.bseCode : '—');
      return '<tr>' +
        '<td><b>' + s.name + '</b></td>' +
        '<td>' + nse + '</td>' +
        '<td>' + s.industry + '</td>' +
        '<td>₹' + formatNumber(s.mcap, 0) + ' Cr</td>' +
        '<td>' + formatNumber(s.pe, 1) + '</td>' +
        '<td>' + formatNumber(s.pb, 1) + '</td>' +
        '<td>' + formatNumber(s.salesGrowth3Y, 1) + '%</td>' +
        '<td>' + formatNumber(s.roce3Y, 1) + '%</td>' +
        '<td>' + formatNumber(s.debtEquity, 2) + '</td>' +
        '<td>' + s.piotroski + '</td>' +
        '</tr>';
    }).join('');

    if (pageInfo) pageInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages + ' (Showing ' + (start+1) + '–' + end + ' of ' + filteredStocks.length + ')';
  }

  // Bind directory click and filters
  function bindUIEvents() {
    // Directory Card clicks
    var cards = app.querySelectorAll('.iv-strat-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        var type = card.getAttribute('data-strat-type');
        if (type) {
          // Set query string and reload so navigation links reflect active state properly
          window.location.href = '/strategies?type=' + type;
        }
      });
    });

    // Back button
    var backBtn = app.querySelector('#ivStratBackButton');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.location.href = '/strategies';
      });
    }

    // Search filter
    var searchInput = app.querySelector('#ivStratTableSearch');
    if (searchInput) {
      searchInput.addEventListener('keyup', function () {
        var q = searchInput.value.toLowerCase().trim();
        var raw = allStrategiesData[currentType] || [];
        if (!q) {
          filteredStocks = raw.slice();
        } else {
          filteredStocks = raw.filter(function (s) {
            return s.name.toLowerCase().indexOf(q) >= 0 || 
                   s.nseCode.toLowerCase().indexOf(q) >= 0 ||
                   s.bseCode.toLowerCase().indexOf(q) >= 0 ||
                   s.industry.toLowerCase().indexOf(q) >= 0;
          });
        }
        currentPage = 1;
        updateSummaryStats(filteredStocks);
        renderTablePage();
      });
    }

    // Pagination
    var prev = app.querySelector('#ivStratPrevPage');
    var next = app.querySelector('#ivStratNextPage');
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

  // Initial fetch and routing
  function initStrategiesPage() {
    fetch(apiEndpoint, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('API fetch error');
        return res.json();
      })
      .then(function (data) {
        allStrategiesData = data;
        
        bindUIEvents();

        // Check query route
        var selectedType = getQueryParam('type');
        if (selectedType && strategyMeta[selectedType]) {
          showStrategyDetails(selectedType);
        } else {
          showDirectory();
        }
      })
      .catch(function (err) {
        console.error('Error loading strategies details:', err);
        var body = app.querySelector('#ivStratTableBody');
        if (body) {
          body.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--iv-danger);">Failed to load master dataset: ' + err.message + '</td></tr>';
        }
      });
  }

  // Kickoff on load
  document.addEventListener('DOMContentLoaded', function () {
    initStrategiesPage();
  });
})();
