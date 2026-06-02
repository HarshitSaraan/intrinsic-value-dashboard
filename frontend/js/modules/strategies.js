(function () {
  var app = document.querySelector('.iv-strategies-page');
  if (!app) app = document.body;

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';
  var apiEndpoint = baseUrl + '/strategies-data';

  var allStrategiesData = [];
  var filteredStocks = [];
  var currentType = '';
  var currentPage = 1;
  var pageSize = 10;

  // Strategy Meta Details (Mapped to Indian Stock screening rules)
  var strategyMeta = {
    'undervalued-growth': {
      title: 'Undervalued Growth Stocks',
      desc: 'High growth Indian companies trading at attractive valuations.',
      note: 'Indian Market Screener: Sales Growth 3Years > 20% | Price to Earning between 0 and 25 | Price to Book value < 4.5'
    },
    'aggressive-smallcaps': {
      title: 'Aggressive Small Caps',
      desc: 'Small cap opportunities with massive growth and ROCE momentum.',
      note: 'Indian Market Screener: Market Cap < 2000 Cr | Sales Growth 3Years > 25% | ROCE 3Years > 12%'
    },
    'undervalued-largecaps': {
      title: 'Undervalued Large Caps',
      desc: 'Stable large-cap market leaders trading at discounted valuations.',
      note: 'Indian Market Screener: Market Cap > 15000 Cr | Price to Earning between 0 and 18 | Price to Book value < 3.0'
    },
    'growth-tech': {
      title: 'Growth Technology Stocks',
      desc: 'High-growth technology innovators, software leaders, and telecom companies.',
      note: 'Indian Market Screener: Industry Group contains Software/IT/Telecom/Tech | Sales Growth 3Years > 20%'
    },
    'portfolio-anchors': {
      title: 'Portfolio Anchors',
      desc: 'Mega-cap anchors with clean balance sheets, high Piotroski scores, and low debt.',
      note: 'Indian Market Screener: Market Cap > 25000 Cr | Piotroski Score >= 7 | Debt to Equity < 0.8 | ROCE 3Years > 15%'
    },
    'solid-large-growth': {
      title: 'Solid Large Growth Funds',
      desc: 'Large cap growth leaders with top-tier efficiency and market momentum.',
      note: 'Indian Market Screener: Market Cap > 20000 Cr | Sales Growth 3Years > 15% | ROCE 3Years > 18% | Debt to Equity < 1.0'
    }
  };

  function getQueryParam(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
  }

  // Local Storage Follow Persistence
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
    return idx < 0; // returns true if now followed, false if unfollowed
  }

  // Formatter for Volumes (matches Yahoo's Million/Billion displays)
  function formatVolume(val) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    var num = Number(val);
    if (num >= 1e9) {
      return (num / 1e9).toFixed(3) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(3) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Formatter for Market Cap in Indian Rupees (₹ Crores)
  function formatMarketCap(val) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    var num = Number(val);
    var crores = num / 10000000;
    return '₹' + crores.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + ' Cr';
  }

  // Generate Yahoo-style SVG sparkline using actual close prices
  function generateSparkline(q) {
    var prices = q.closePrices || [];
    var currentPrice = q.price;
    var prevClose = q.prevClose;
    
    // Fallback if data is missing
    if (!prices || prices.length < 2) {
      if (currentPrice !== null && currentPrice !== undefined) {
        var base = (prevClose !== null && prevClose !== undefined) ? prevClose : currentPrice;
        prices = [base, currentPrice];
      } else {
        return '';
      }
    }
    
    var minVal = Math.min.apply(null, prices);
    var maxVal = Math.max.apply(null, prices);
    
    var width = 100;
    var height = 28;
    var padding = 2;
    
    var range = maxVal - minVal;
    if (range === 0) range = 1; // avoid divide by zero
    
    var svgPoints = [];
    for (var i = 0; i < prices.length; i++) {
      var x = (i / (prices.length - 1)) * width;
      var y = height - padding - ((prices[i] - minVal) / range) * (height - 2 * padding);
      svgPoints.push({ x: x, y: y });
    }
    
    // Construct path string using Cubic Bezier interpolation for smooth wave
    var pathData = "M " + svgPoints[0].x + " " + svgPoints[0].y;
    for (var i = 1; i < svgPoints.length; i++) {
      var p0 = svgPoints[i - 1];
      var p1 = svgPoints[i];
      var cpX1 = p0.x + (p1.x - p0.x) / 2;
      var cpY1 = p0.y;
      var cpX2 = p0.x + (p1.x - p0.x) / 2;
      var cpY2 = p1.y;
      pathData += " C " + cpX1 + " " + cpY1 + ", " + cpX2 + " " + cpY2 + ", " + p1.x + " " + p1.y;
    }
    
    var isPositive = (currentPrice >= prevClose);
    var color = isPositive ? '#66BB6A' : '#EF5350';
    var fillGradientId = 'grad-' + Math.random().toString(36).substr(2, 9);
    
    // Construct Area Fill Path
    var fillPathData = pathData + 
      " L " + width + " " + height + 
      " L 0 " + height + " Z";
      
    var svg = '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" style="display:block; overflow:visible;">' +
      '<defs>' +
        '<linearGradient id="' + fillGradientId + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.2"/>' +
          '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.0"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="' + fillPathData + '" fill="url(#' + fillGradientId + ')" />' +
      '<path d="' + pathData + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" />' +
      '<circle cx="' + svgPoints[svgPoints.length - 1].x + '" cy="' + svgPoints[svgPoints.length - 1].y + '" r="2" fill="' + color + '" />' +
      '</svg>';
      
    return svg;
  }

  // Display details layout UI
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

    currentPage = 1;

    // Filter based on input search
    var searchInput = app.querySelector('#ivStratTableSearch');
    if (searchInput) searchInput.value = ''; // reset search input
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
    var peList = stocks.map(function(s){ return s.pe; }).filter(function(v){ return v !== null && v !== undefined && v > 0; });
    var avgPE = peList.length ? (peList.reduce(function(a,b){return a+b;}, 0) / peList.length) : NaN;
    if (peStat) peStat.textContent = isFinite(avgPE) ? avgPE.toFixed(1) : '—';

    // Avg Vol (3M) average
    var volList = stocks.map(function(s){ return s.volume; }).filter(function(v){ return v !== null && v !== undefined && v > 0; });
    var avgVol = volList.length ? (volList.reduce(function(a,b){return a+b;}, 0) / volList.length) : NaN;
    if (roceStat) roceStat.textContent = isFinite(avgVol) ? formatVolume(avgVol) : '—';

    // Avg Market Cap
    var mcaps = stocks.map(function(s){ return s.marketCap; }).filter(function(v){ return v !== null && v !== undefined && v > 0; });
    var avgMcap = mcaps.length ? (mcaps.reduce(function(a,b){return a+b;}, 0) / mcaps.length) : NaN;
    if (minCapStat) minCapStat.textContent = isFinite(avgMcap) ? formatMarketCap(avgMcap) : '—';
  }

  // Render current paginated table view
  function renderTablePage() {
    var body = app.querySelector('#ivStratTableBody');
    var pageInfo = app.querySelector('#ivStratPageInfo');
    if (!body) return;

    if (!filteredStocks || !filteredStocks.length) {
      body.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--iv-text-muted);">No stocks match search.</td></tr>';
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
      var globalIdx = start + index + 1;
      var symbol = s.symbol || '—';
      var avatarChar = symbol.charAt(0);
      var name = s.name || '—';
      
      var priceVal = (s.price !== null && s.price !== undefined) ? '₹' + Number(s.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
      
      // Change styling
      var changeVal = s.change;
      var changeText = '—';
      var changeClass = '';
      if (changeVal !== null && changeVal !== undefined) {
        var numChange = Number(changeVal);
        if (numChange > 0) {
          changeText = '+' + numChange.toFixed(2);
          changeClass = 'iv-strat-green';
        } else if (numChange < 0) {
          changeText = numChange.toFixed(2);
          changeClass = 'iv-strat-red';
        } else {
          changeText = '0.00';
        }
      }
      
      // Change Percent styling
      var pctVal = s.changePercent;
      var pctText = '—';
      var pctClass = '';
      if (pctVal !== null && pctVal !== undefined) {
        var numPct = Number(pctVal);
        if (numPct > 0) {
          pctText = '+' + numPct.toFixed(2) + '%';
          pctClass = 'iv-strat-green';
        } else if (numPct < 0) {
          pctText = numPct.toFixed(2) + '%';
          pctClass = 'iv-strat-red';
        } else {
          pctText = '0.00%';
        }
      }
      
      var volume = formatVolume(s.volume);
      var avgVolume = s.avgVolume > 0 ? formatVolume(s.avgVolume) : '—';
      var marketCap = formatMarketCap(s.marketCap);
      var pe = (s.pe !== null && s.pe !== undefined) ? Number(s.pe).toFixed(1) : '—';
      
      var sparklineHtml = generateSparkline(s);
      
      // Star follow logic
      var followed = isSymbolFollowed(symbol);
      var starIcon = followed ? '★' : '☆';
      var starClass = followed ? 'iv-strat-star-active' : 'iv-strat-star-inactive';
      
      return '<tr class="iv-strat-table-row">' +
        '<td style="text-align: left; padding-left: 10px; color: var(--iv-text-muted); font-size: 11px;">' + globalIdx + '</td>' +
        '<td style="text-align: left;">' +
          '<div class="iv-strat-symbol-cell">' +
            '<span class="iv-strat-symbol-avatar">' + avatarChar + '</span>' +
            '<span class="iv-strat-symbol-ticker">' + symbol + '</span>' +
          '</div>' +
        '</td>' +
        '<td style="text-align: left; font-weight: 500; font-size: 13px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + name + '">' + name + '</td>' +
        '<td style="text-align: left; vertical-align: middle;">' + sparklineHtml + '</td>' +
        '<td style="text-align: right; font-weight: 600;">' + priceVal + '</td>' +
        '<td style="text-align: right; font-weight: 600;" class="' + changeClass + '">' + changeText + '</td>' +
        '<td style="text-align: right; font-weight: 600;" class="' + pctClass + '">' + pctText + '</td>' +
        '<td style="text-align: right;">' + volume + '</td>' +
        '<td style="text-align: right;">' + avgVolume + '</td>' +
        '<td style="text-align: right;">' + marketCap + '</td>' +
        '<td style="text-align: right;">' + pe + '</td>' +
        '<td style="text-align: center;">' +
          '<span class="iv-strat-star-btn ' + starClass + '" data-symbol="' + symbol + '">' + starIcon + '</span>' +
        '</td>' +
        '</tr>';
    }).join('');

    // Bind star clicks after rendering
    var starBtns = body.querySelectorAll('.iv-strat-star-btn');
    starBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var sym = btn.getAttribute('data-symbol');
        var nowFollowed = toggleFollowSymbol(sym);
        btn.textContent = nowFollowed ? '★' : '☆';
        if (nowFollowed) {
          btn.classList.remove('iv-strat-star-inactive');
          btn.classList.add('iv-strat-star-active');
        } else {
          btn.classList.remove('iv-strat-star-active');
          btn.classList.add('iv-strat-star-inactive');
        }
      });
    });

    if (pageInfo) {
      pageInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages + ' (Showing ' + (start + 1) + '–' + end + ' of ' + filteredStocks.length + ')';
    }
  }

  // Bind directory click and filters
  function bindUIEvents() {
    // Directory Card clicks
    var cards = app.querySelectorAll('.iv-strat-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        var type = card.getAttribute('data-strat-type');
        if (type) {
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
        var raw = allStrategiesData || [];
        if (!q) {
          filteredStocks = raw.slice();
        } else {
          filteredStocks = raw.filter(function (s) {
            var sym = (s.symbol || '').toLowerCase();
            var name = (s.name || '').toLowerCase();
            return sym.indexOf(q) >= 0 || name.indexOf(q) >= 0;
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
    bindUIEvents();

    // Check query route
    var selectedType = getQueryParam('type');
    if (selectedType && strategyMeta[selectedType]) {
      // Display details template & layout
      showStrategyDetails(selectedType);

      // Loading state spinner
      var body = app.querySelector('#ivStratTableBody');
      if (body) {
        body.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 48px; color: var(--iv-text-secondary);">' +
          '<div class="iv-strat-loading-spinner"></div> Loading Indian NSE stocks and real-time quotes...' +
          '</td></tr>';
      }

      // Fetch details for this strategy type
      fetch(apiEndpoint + '?type=' + selectedType, { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('API fetch error');
          return res.json();
        })
        .then(function (data) {
          allStrategiesData = data.quotes || [];
          filteredStocks = allStrategiesData.slice();
          updateSummaryStats(filteredStocks);
          renderTablePage();
        })
        .catch(function (err) {
          console.error('Error loading strategies details:', err);
          if (body) {
            body.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--iv-danger);">Failed to load live data: ' + err.message + '</td></tr>';
          }
        });
    } else {
      showDirectory();
    }
  }

  // Kickoff on load
  document.addEventListener('DOMContentLoaded', function () {
    initStrategiesPage();
  });
})();
