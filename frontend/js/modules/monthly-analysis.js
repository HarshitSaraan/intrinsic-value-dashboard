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
      if (monthlyDebugEl) monthlyDebugEl.textContent = 'Preview/sample data active. Monthly Market Analysis requires live master sheet.';
      if (commentary) commentary.textContent = 'Preview/sample data active. Monthly Market Analysis requires live master sheet.';
      return;
    }
    if (monthlyDebugEl) monthlyDebugEl.textContent = 'Live master data active. Monthly Market Analysis is ready.';

    var validCount = ivAnalysisData.validRows;
    var firstGraham = ivAnalysisData.firstGraham;
    var firstCurrentPrice = ivAnalysisData.firstCurrentPrice;

    console.log('Monthly Market Analysis Debug', {
      totalRows: monthlyRowsLoaded,
      validGrahamAndCurrentPriceRows: validCount,
      firstRowGrahamNumber: firstGraham,
      firstRowCurrentPrice: firstCurrentPrice
    });

    if (commentary) {
      commentary.innerHTML = 'Debug: total rows ' + monthlyRowsLoaded.toLocaleString('en-IN') + 
        ', valid Graham + Current Price rows ' + validCount.toLocaleString('en-IN') + 
        ', first Graham Number: ' + (firstGraham !== null && firstGraham !== undefined ? firstGraham : '—') + 
        ', first Current Price: ' + (firstCurrentPrice !== null && firstCurrentPrice !== undefined ? firstCurrentPrice : '—') + 
        '<br><br>' + ivAnalysisData.commentary;
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
    if (statusEl) statusEl.textContent = status;
    if (needle) {
      var angleMap = { 'Extremely Overvalued': -72, 'Overvalued': -36, 'Fairly Valued': 0, 'Undervalued': 36, 'Extremely Undervalued': 72 };
      needle.style.transform = 'rotate(' + (angleMap[status] || 0) + 'deg)';
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
        console.error('Error loading monthly market analysis data:', err);
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
  });
})();
