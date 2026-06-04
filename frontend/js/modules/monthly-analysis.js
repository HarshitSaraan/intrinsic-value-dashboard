(function () {
  var app = document.querySelector('.iv-monthly-analysis-page');
  if (!app) app = document.body;

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';
  var ivMonthlyAnalysisUrl = baseUrl + '/monthly-analysis';
  var ivAnalysisData = null;
  var ivDataLoaded = false;
  var ivDataLoading = false;

  function ivFormatRankValue(value, suffix) {
    if (value === null || value === undefined || !isFinite(value)) return '—';
    return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + (suffix || '');
  }

  function ivMonthlyRenderBarChart(id, rows, valueKey, labelSuffix) {
    var el = app.querySelector('#' + id);
    if (!el) return;
    if (!rows || !rows.length) {
      el.innerHTML = '<div class="iv-note">No data available.</div>';
      return;
    }
    var max = Math.max.apply(null, rows.map(function (r) { return Math.abs(r[valueKey] || 0); })) || 1;
    el.innerHTML = rows.map(function (row) {
      var val = row[valueKey] || 0;
      var pct = Math.max(2, Math.min(100, (Math.abs(val) / max) * 100));
      var label = row.name || row.zone || '—';
      return '<div class="iv-market-bar-row"><span>' + label + '</span><div class="iv-market-bar-track"><div class="iv-market-bar-fill" style="width:' + pct + '%"></div></div><span>' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 1 }) + (labelSuffix || '') + '</span></div>';
    }).join('');
  }

  function ivMonthlyRenderTopCompanies(companies, missingPcCount) {
    var body = app.querySelector('#ivMonthlyTopCompaniesBody');
    var pcNote = app.querySelector('#ivMonthlyPcNote');
    if (!body) return;
    if (!companies || !companies.length) {
      body.innerHTML = '<tr><td colspan="8">No qualifying companies found for top turnaround sectors.</td></tr>';
    } else {
      body.innerHTML = companies.map(function (row) {
        return '<tr>' +
          '<td>' + (row.industry || '—') + '</td>' +
          '<td><b>' + (row.name || '—') + '</b></td>' +
          '<td>' + (row.nseCode || '—') + '</td>' +
          '<td>' + (row.bseCode || '—') + '</td>' +
          '<td>' + ivFormatRankValue(row.promoterChange, '%') + '</td>' +
          '<td>' + ivFormatRankValue(row.pc) + '</td>' +
          '<td>₹' + ivFormatRankValue(row.marketCap) + ' Cr</td>' +
          '<td>₹' + ivFormatRankValue(row.currentPrice) + '</td>' +
          '</tr>';
      }).join('');
    }
    if (pcNote) pcNote.textContent = missingPcCount > 0 ? 'P/C ratio data unavailable for some companies.' : 'P/C ratio data available for displayed companies.';
  }

  function ivMonthlyRender() {
    var commentary = app.querySelector('#ivMonthlyCommentary');
    if (!ivDataLoaded || !ivAnalysisData) {
      if (commentary) commentary.textContent = 'Master data is loading. Please try again in a moment.';
      return;
    }
    var monthlyRowsLoaded = ivAnalysisData.totalRows;
    var monthlyRowsEl = app.querySelector('#ivMonthlyRowsLoaded');
    var monthlyDebugEl = app.querySelector('#ivMonthlyAdminDebug');
    if (monthlyRowsEl) monthlyRowsEl.textContent = monthlyRowsLoaded.toLocaleString('en-IN');
    if (monthlyRowsLoaded < 100) {
      if (monthlyDebugEl) monthlyDebugEl.textContent = 'Preview/sample data active. Market Pulse requires live master sheet.';
      if (commentary) commentary.textContent = 'Preview/sample data active. Market Pulse requires live master sheet.';
      return;
    }
    if (monthlyDebugEl) monthlyDebugEl.textContent = 'Live master data active. Market Pulse is ready.';

    var validCount = ivAnalysisData.validRows;
    var firstGraham = ivAnalysisData.firstGraham;
    var firstCurrentPrice = ivAnalysisData.firstCurrentPrice;

    console.log('Market Pulse Debug', {
      totalRows: monthlyRowsLoaded,
      validGrahamAndCurrentPriceRows: validCount,
      firstRowGrahamNumber: firstGraham,
      firstRowCurrentPrice: firstCurrentPrice
    });

    if (commentary) {
      commentary.innerHTML = ivAnalysisData.commentary;
    }

    if (!validCount) {
      if (commentary) commentary.textContent = 'Valuation analysis could not be generated because Graham Number or Current Price data is missing.';
      return;
    }

    var undervaluedCount = ivAnalysisData.undervaluedCount;
    var overvaluedCount = ivAnalysisData.overvaluedCount;
    var marketRatio = ivAnalysisData.marketRatio;
    if (marketRatio === "Infinity") marketRatio = Infinity;
    var status = ivAnalysisData.status;

    var underEl = app.querySelector('#ivMonthlyUndervaluedCount');
    var overEl = app.querySelector('#ivMonthlyOvervaluedCount');
    var ratioEl = app.querySelector('#ivMonthlyValuationRatio');
    var statusEl = app.querySelector('#ivMonthlyMarketStatus');
    var needle = app.querySelector('#ivMonthlyClockNeedle');
    if (underEl) underEl.textContent = undervaluedCount.toLocaleString('en-IN');
    if (overEl) overEl.textContent = overvaluedCount.toLocaleString('en-IN');
    if (ratioEl) ratioEl.textContent = marketRatio === Infinity ? '∞' : Number(marketRatio).toFixed(2);
    var statusColorMap = {
      'Extremely Undervalued': '#33cc33',
      'Undervalued': '#99ff33',
      'Fairly Valued': '#ffcc00',
      'Overvalued': '#ff9933',
      'Extremely Overvalued': '#ff4d4d'
    };
    var activeColor = statusColorMap[status] || 'var(--iv-accent-light)';

    if (statusEl) {
      statusEl.textContent = status;
      statusEl.style.color = activeColor;
    }
    if (needle) {
      var angleMap = {
        'Extremely Undervalued': -72,
        'Undervalued': -36,
        'Fairly Valued': 0,
        'Overvalued': 36,
        'Extremely Overvalued': 72
      };
      needle.style.transform = 'rotate(' + (angleMap[status] || 0) + 'deg)';
      needle.style.backgroundColor = activeColor;
      needle.style.boxShadow = '0 0 14px ' + activeColor;
    }
    var clockEl = app.querySelector('.iv-market-clock');
    if (clockEl) {
      var r = 197, g = 168, b = 128; // fallback
      if (activeColor === '#33cc33') { r = 51; g = 204; b = 51; }
      else if (activeColor === '#99ff33') { r = 153; g = 255; b = 51; }
      else if (activeColor === '#ffcc00') { r = 255; g = 204; b = 0; }
      else if (activeColor === '#ff9933') { r = 255; g = 153; b = 51; }
      else if (activeColor === '#ff4d4d') { r = 255; g = 77; b = 77; }
      clockEl.style.background = 'radial-gradient(circle at center, rgba(' + r + ',' + g + ',' + b + ', 0.16), rgba(' + r + ',' + g + ',' + b + ', 0.02) 72%, transparent 100%)';
    }

    ivMonthlyRenderBarChart('ivMonthlyDistributionChart', ivAnalysisData.distribution, 'count', '');

    ivMonthlyRenderBarChart('ivMonthlySectorUnderChart', ivAnalysisData.underSectors, 'value', '%');
    ivMonthlyRenderBarChart('ivMonthlySectorOverChart', ivAnalysisData.overSectors, 'value', '%');

    ivMonthlyRenderBarChart('ivMonthlySegmentUnderChart', ivAnalysisData.segmentUnder, 'value', '%');
    ivMonthlyRenderBarChart('ivMonthlySegmentOverChart', ivAnalysisData.segmentOver, 'value', '%');

    ivMonthlyRenderBarChart('ivMonthlyTurnaroundChart', ivAnalysisData.turnaround, 'count', '');
    ivMonthlyRenderBarChart('ivMonthlyNegativeTurnaroundChart', ivAnalysisData.negativeTurnaround, 'count', '');
    ivMonthlyRenderTopCompanies(ivAnalysisData.topCompanies, ivAnalysisData.missingPcCount);
  }

  function ivLoadAnalysisData() {
    if (ivDataLoaded || ivDataLoading) {
      return Promise.resolve(ivAnalysisData);
    }

    ivDataLoading = true;

    if (!window.fetch || !ivMonthlyAnalysisUrl) {
      ivDataLoading = false;
      return Promise.resolve(ivAnalysisData);
    }

    return fetch(ivMonthlyAnalysisUrl, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('API fetch failed');
        return response.json();
      })
      .then(function (data) {
        ivAnalysisData = data;
        ivDataLoaded = true;
        ivDataLoading = false;
        return ivAnalysisData;
      })
      .catch(function (err) {
        console.error('Error loading market pulse data:', err);
        ivDataLoading = false;
        return ivAnalysisData;
      });
  }

  function ivBindMonthlyMarketAnalysis() {
    ivLoadAnalysisData().then(function () {
      ivMonthlyRender();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    ivBindMonthlyMarketAnalysis();

    // Toggle collapsible cards
    var collapseCards = app.querySelectorAll(".iv-collapse-card");
    collapseCards.forEach(function (card) {
      var header = card.querySelector(".iv-collapse-header");
      if (header) {
        header.addEventListener("click", function () {
          card.classList.toggle("collapsed");
        });
      }
    });
  });
})();
