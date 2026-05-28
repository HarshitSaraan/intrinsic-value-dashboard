(function () {
  var app = document.querySelector('.iv-monthly-analysis-page');
  if (!app) app = document.body;

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';
  var IV_USE_REMOTE_DATA = true;
  var ivRankingMasterCsvUrl = baseUrl + '/static/stock_master.csv';
  var ivMasterStockData = [];
  var ivDataLoaded = false;
  var ivDataLoading = false;
  var ivSampleStockData = [
    { companyName: 'Alpha Engineering Ltd', industry: 'Capital Goods', sector: 'Engineering', bseCode: '500001', nseCode: 'ALPHAENG', currentPrice: 420, marketCapitalization: 8500, promoterHolding: 58.4, salesGrowth3Years: 18.2, averageRoce3Years: 22.5, priceToBookValue: 2.1 },
    { companyName: 'Bharat Components Ltd', industry: 'Auto Ancillaries', sector: 'Auto', bseCode: '500002', nseCode: 'BHCOMP', currentPrice: 185, marketCapitalization: 3200, promoterHolding: 64.1, salesGrowth3Years: 24.6, averageRoce3Years: 19.8, priceToBookValue: 1.7 },
    { companyName: 'Crescent Chemicals Ltd', industry: 'Specialty Chemicals', sector: 'Chemicals', bseCode: '500003', nseCode: 'CRESCHEM', currentPrice: 760, marketCapitalization: 12400, promoterHolding: 51.9, salesGrowth3Years: 11.4, averageRoce3Years: 17.2, priceToBookValue: 3.4 },
    { companyName: 'Dhan Infra Products Ltd', industry: 'Building Materials', sector: 'Infrastructure', bseCode: '500004', nseCode: 'DHANINFRA', currentPrice: 92, marketCapitalization: 1450, promoterHolding: 70.3, salesGrowth3Years: 29.8, averageRoce3Years: 15.6, priceToBookValue: 1.2 },
    { companyName: 'Eminent Foods Ltd', industry: 'FMCG', sector: 'Consumer', bseCode: '500005', nseCode: 'EMIFOODS', currentPrice: 1330, marketCapitalization: 22100, promoterHolding: 47.5, salesGrowth3Years: 9.1, averageRoce3Years: 31.4, priceToBookValue: 6.8 },
    { companyName: 'Frontier Textiles Ltd', industry: 'Textiles', sector: 'Textiles', bseCode: '500006', nseCode: 'FRONTEX', currentPrice: 68, marketCapitalization: 980, promoterHolding: 62.7, salesGrowth3Years: 16.7, averageRoce3Years: 13.9, priceToBookValue: 0.9 },
    { companyName: 'Galaxy Pumps Ltd', industry: 'Industrial Products', sector: 'Industrials', bseCode: '500007', nseCode: 'GALPUMP', currentPrice: 510, marketCapitalization: 5400, promoterHolding: 55.2, salesGrowth3Years: 21.5, averageRoce3Years: 26.8, priceToBookValue: 2.6 },
    { companyName: 'Heritage Finance Ltd', industry: 'NBFC', sector: 'Financials', bseCode: '500008', nseCode: 'HERFIN', currentPrice: 275, marketCapitalization: 7600, promoterHolding: 43.6, salesGrowth3Years: 14.3, averageRoce3Years: 12.4, priceToBookValue: 1.4 },
    { companyName: 'Indus Ceramics Ltd', industry: 'Ceramics', sector: 'Building Materials', bseCode: '500009', nseCode: 'INDCER', currentPrice: 315, marketCapitalization: 2850, promoterHolding: 66.8, salesGrowth3Years: 27.1, averageRoce3Years: 18.7, priceToBookValue: 1.9 },
    { companyName: 'Jupiter Logistics Ltd', industry: 'Logistics', sector: 'Services', bseCode: '500010', nseCode: 'JUPLOG', currentPrice: 148, marketCapitalization: 2100, promoterHolding: 49.2, salesGrowth3Years: 31.2, averageRoce3Years: 16.2, priceToBookValue: 1.5 },
    { companyName: 'Kaveri Metals Ltd', industry: 'Metals', sector: 'Metals', bseCode: '500011', nseCode: 'KAVMET', currentPrice: 640, marketCapitalization: 9100, promoterHolding: 53.8, salesGrowth3Years: 12.9, averageRoce3Years: 20.1, priceToBookValue: 1.1 },
    { companyName: 'Lotus Healthcare Ltd', industry: 'Pharmaceuticals', sector: 'Healthcare', bseCode: '500012', nseCode: 'LOTUSHEAL', currentPrice: 890, marketCapitalization: 16200, promoterHolding: 57.1, salesGrowth3Years: 19.6, averageRoce3Years: 24.3, priceToBookValue: 4.2 }
  ];

function ivFormatINR(value) {
      if (!isFinite(value)) return '—';
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(Math.round(value));
    }

function ivFormatCompactINR(value) {
      if (!isFinite(value)) return '—';
      var abs = Math.abs(value);
      if (abs >= 10000000) return '₹' + (value / 10000000).toFixed(value >= 100000000 ? 0 : 1) + ' Cr';
      if (abs >= 100000) return '₹' + (value / 100000).toFixed(value >= 1000000 ? 0 : 1) + ' L';
      return ivFormatINR(value);
    }

function ivSetupCanvas(canvas) {
      if (!canvas) return null;
      var rect = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      var width = Math.max(280, Math.floor(rect.width));
      var height = Math.max(220, Math.floor(rect.height || 260));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx: ctx, width: width, height: height };
    }

function ivDrawRoundedRect(ctx, x, y, w, h, r) {
      var radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }


    function ivEscapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
    }


    function ivGetMonthlyField(row, fieldName) {
      if (!row) return null;
      if (row[fieldName] !== undefined) return row[fieldName];

      var keys = Object.keys(row);
      var target = String(fieldName).trim().toLowerCase();

      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i]).trim().toLowerCase() === target) {
          return row[keys[i]];
        }
      }

      return null;
    }

    function ivToNumber(value) {
      if (value === null || value === undefined) return NaN;
      var cleaned = String(value)
        .replace(/₹/g, '')
        .replace(/,/g, '')
        .replace(/%/g, '')
        .trim();

      if (cleaned === '' || cleaned === '-' || cleaned.toLowerCase() === 'nan') return NaN;

      return Number(cleaned);
    }

    function ivMonthlyNumber(value) {
      var number = ivToNumber(value);
      return isFinite(number) ? number : null;
    }

    function ivMonthlyField(row, names) {
      for (var i = 0; i < names.length; i++) {
        var value = ivGetMonthlyField(row, names[i]);
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return '';
    }

    function ivMonthlyNormalizeData() {
      return getMasterData().map(function (row) {
        return {
          name: ivMonthlyField(row, ['Name', 'Company Name', 'companyName']),
          bseCode: ivMonthlyField(row, ['BSE Code', 'bseCode']),
          nseCode: ivMonthlyField(row, ['NSE Code', 'nseCode']),
          industryGroup: ivMonthlyField(row, ['Industry Group', 'industryGroup']),
          industry: ivMonthlyField(row, ['Industry', 'industry']),
          currentPrice: ivToNumber(ivGetMonthlyField(row, 'Current Price')),
          marketCap: ivMonthlyNumber(ivMonthlyField(row, ['Market Capitalization', 'marketCapitalization', 'Market Cap', 'MCap'])),
          promoterHolding: ivMonthlyNumber(ivMonthlyField(row, ['Promoter holding', 'Promoter Holding', 'promoterHolding'])),
          promoterChange: ivMonthlyNumber(ivMonthlyField(row, ['Change in promoter holding', 'Change in promoter holding %', 'Change in promoter holding 3Years'])),
          grahamNumber: ivToNumber(ivGetMonthlyField(row, 'Graham Number')),
          pb: ivMonthlyNumber(ivMonthlyField(row, ['Price to book value', 'Price to Book Value', 'P/B'])),
          pc: ivMonthlyNumber(ivMonthlyField(row, ['P/C ratio', 'PC ratio', 'P/C', 'PC Ratio', 'Price to Cash Flow', 'Price to Cashflow']))
        };
      });
    }

    function ivMonthlyClassify(row) {
      if (!(isFinite(row.grahamNumber) && row.grahamNumber > 0 && isFinite(row.currentPrice) && row.currentPrice > 0)) return null;
      var ratio = row.grahamNumber / row.currentPrice;
      var zone = 'Fairly Valued';
      if (ratio > 2) zone = 'Extremely Undervalued';
      else if (ratio > 1.2) zone = 'Undervalued';
      else if (ratio >= 0.8) zone = 'Fairly Valued';
      else if (ratio >= 0.5) zone = 'Overvalued';
      else zone = 'Extremely Overvalued';
      return Object.assign({}, row, { valuationRatio: ratio, valuationZone: zone });
    }

    function ivMonthlyStatus(ratio) {
      if (ratio === Infinity) return 'Extremely Undervalued';
      if (ratio > 2) return 'Extremely Undervalued';
      if (ratio > 1.2) return 'Undervalued';
      if (ratio >= 0.8) return 'Fairly Valued';
      if (ratio >= 0.5) return 'Overvalued';
      return 'Extremely Overvalued';
    }

    function ivMonthlyCommentary(status) {
      if (status === 'Extremely Overvalued') return 'The current valuation breadth suggests limited margin of safety across the market. Investors should be selective and avoid chasing momentum.';
      if (status === 'Overvalued') return 'Market breadth appears valuation-stretched. Selective stock picking and cash discipline may be important.';
      if (status === 'Fairly Valued') return 'The market appears broadly balanced between undervalued and overvalued opportunities.';
      if (status === 'Undervalued') return 'Valuation breadth is improving, suggesting a better opportunity set for long-term investors.';
      return 'The market shows unusually high valuation comfort based on the available Graham Number framework.';
    }

    function ivMonthlyGroupStats(validRows, key) {
      var map = {};
      validRows.forEach(function (row) {
        var group = row[key] || 'Unclassified';
        if (!map[group]) map[group] = { name: group, total: 0, undervalued: 0, overvalued: 0 };
        map[group].total++;
        if (row.valuationZone === 'Extremely Undervalued' || row.valuationZone === 'Undervalued') map[group].undervalued++;
        if (row.valuationZone === 'Overvalued' || row.valuationZone === 'Extremely Overvalued') map[group].overvalued++;
      });
      return Object.keys(map).map(function (name) {
        var item = map[name];
        item.underPct = item.total ? (item.undervalued / item.total) * 100 : 0;
        item.overPct = item.total ? (item.overvalued / item.total) * 100 : 0;
        return item;
      });
    }

    function ivMonthlySegmentName(mcap) {
      if (mcap === null || mcap === undefined || !isFinite(mcap)) return 'Unclassified';
      if (mcap < 100) return '0–100 Cr';
      if (mcap < 300) return '100–300 Cr';
      if (mcap < 1000) return '300–1000 Cr';
      if (mcap < 5000) return '1000–5000 Cr';
      if (mcap < 20000) return '5000–20000 Cr';
      if (mcap < 50000) return '20000–50000 Cr';
      return 'Above 50000 Cr';
    }

    function ivMonthlyCountByIndustry(rows, predicate) {
      var map = {};
      rows.forEach(function (row) {
        if (!predicate(row)) return;
        var industry = row.industry || 'Unclassified';
        map[industry] = (map[industry] || 0) + 1;
      });
      return Object.keys(map).map(function (name) { return { name: name, count: map[name] }; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 15);
    }

    function ivMonthlyRenderBarChart(id, rows, valueKey, labelSuffix) {
      var el = app.querySelector('#' + id);
      if (!el) return;
      if (!rows.length) {
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

    function ivMonthlyRenderTopCompanies(rows, topTurnaround) {
      var body = app.querySelector('#ivMonthlyTopCompaniesBody');
      var pcNote = app.querySelector('#ivMonthlyPcNote');
      if (!body) return;
      var topSectors = topTurnaround.slice(0, 5).map(function (x) { return x.name; });
      var missingPcCount = 0;
      var output = [];
      topSectors.forEach(function (sector) {
        var companies = rows.filter(function (row) {
          if (row.industry !== sector || !(row.promoterChange > 0)) return false;
          if (!(row.pc !== null && row.pc > 0)) {
            missingPcCount++;
            return false;
          }
          return true;
        }).sort(function (a, b) { return a.pc - b.pc; }).slice(0, 3);
        companies.forEach(function (company) { output.push(company); });
      });
      if (!output.length) {
        body.innerHTML = '<tr><td colspan="8">No qualifying companies found for top turnaround sectors.</td></tr>';
      } else {
        body.innerHTML = output.map(function (row) {
          return '<tr><td>' + (row.industry || '—') + '</td><td><b>' + (row.name || '—') + '</b></td><td>' + (row.nseCode || '—') + '</td><td>' + (row.bseCode || '—') + '</td><td>' + ivFormatRankValue(row.promoterChange, '%') + '</td><td>' + ivFormatRankValue(row.pc) + '</td><td>₹' + ivFormatRankValue(row.marketCap) + ' Cr</td><td>₹' + ivFormatRankValue(row.currentPrice) + '</td></tr>';
        }).join('');
      }
      if (pcNote) pcNote.textContent = missingPcCount > 0 ? 'P/C ratio data unavailable for some companies.' : 'P/C ratio data available for displayed companies.';
    }

    function ivMonthlyRender() {
      var commentary = app.querySelector('#ivMonthlyCommentary');
      if (!ivDataLoaded || !getMasterData().length) {
        if (commentary) commentary.textContent = 'Master data is loading. Please try again in a moment.';
        return;
      }
      var monthlyRowsLoaded = getMasterData().length;
      var monthlyRowsEl = app.querySelector('#ivMonthlyRowsLoaded');
      var monthlyDebugEl = app.querySelector('#ivMonthlyAdminDebug');
      if (monthlyRowsEl) monthlyRowsEl.textContent = monthlyRowsLoaded.toLocaleString('en-IN');
      if (monthlyRowsLoaded < 100) {
        if (monthlyDebugEl) monthlyDebugEl.textContent = 'Preview/sample data active. Monthly Market Analysis requires live master sheet.';
        if (commentary) commentary.textContent = 'Preview/sample data active. Monthly Market Analysis requires live master sheet.';
        return;
      }
      if (monthlyDebugEl) monthlyDebugEl.textContent = 'Live master data active. Monthly Market Analysis is ready.';
      var masterRows = getMasterData();
      var firstRow = masterRows && masterRows.length ? masterRows[0] : null;
      var firstGraham = firstRow ? ivGetMonthlyField(firstRow, 'Graham Number') : null;
      var firstCurrentPrice = firstRow ? ivGetMonthlyField(firstRow, 'Current Price') : null;
      var rows = ivMonthlyNormalizeData();
      var valid = rows.map(ivMonthlyClassify).filter(Boolean);
      console.log('Monthly Market Analysis Debug', {
        totalRows: masterRows.length,
        validGrahamAndCurrentPriceRows: valid.length,
        firstRowGrahamNumber: firstGraham,
        firstRowCurrentPrice: firstCurrentPrice
      });
      if (commentary) commentary.innerHTML = 'Debug: total rows ' + masterRows.length.toLocaleString('en-IN') + ', valid Graham + Current Price rows ' + valid.length.toLocaleString('en-IN') + ', first Graham Number: ' + (firstGraham !== null && firstGraham !== undefined ? firstGraham : '—') + ', first Current Price: ' + (firstCurrentPrice !== null && firstCurrentPrice !== undefined ? firstCurrentPrice : '—') + '<br><br>' + commentary.textContent;
      if (!valid.length) {
        if (commentary) commentary.textContent = 'Valuation analysis could not be generated because Graham Number or Current Price data is missing.';
        return;
      }

      var zones = ['Extremely Undervalued', 'Undervalued', 'Fairly Valued', 'Overvalued', 'Extremely Overvalued'];
      var distribution = zones.map(function (zone) {
        var count = valid.filter(function (row) { return row.valuationZone === zone; }).length;
        return { name: zone, count: count, pct: (count / valid.length) * 100 };
      });
      var undervaluedCount = distribution[0].count + distribution[1].count;
      var overvaluedCount = distribution[3].count + distribution[4].count;
      var marketRatio = overvaluedCount === 0 ? Infinity : undervaluedCount / overvaluedCount;
      var status = ivMonthlyStatus(marketRatio);

      var underEl = app.querySelector('#ivMonthlyUndervaluedCount');
      var overEl = app.querySelector('#ivMonthlyOvervaluedCount');
      var ratioEl = app.querySelector('#ivMonthlyValuationRatio');
      var statusEl = app.querySelector('#ivMonthlyMarketStatus');
      var needle = app.querySelector('#ivMonthlyClockNeedle');
      if (underEl) underEl.textContent = undervaluedCount.toLocaleString('en-IN');
      if (overEl) overEl.textContent = overvaluedCount.toLocaleString('en-IN');
      if (ratioEl) ratioEl.textContent = marketRatio === Infinity ? '∞' : marketRatio.toFixed(2);
      if (statusEl) statusEl.textContent = status;
      if (commentary) commentary.textContent = ivMonthlyCommentary(status);
      if (needle) {
        var angleMap = { 'Extremely Overvalued': -72, 'Overvalued': -36, 'Fairly Valued': 0, 'Undervalued': 36, 'Extremely Undervalued': 72 };
        needle.style.transform = 'rotate(' + (angleMap[status] || 0) + 'deg)';
      }

      ivMonthlyRenderBarChart('ivMonthlyDistributionChart', distribution.map(function (x) { return { name: x.name, count: x.count }; }), 'count', '');

      var sectorStats = ivMonthlyGroupStats(valid, 'industry');
      var underSectors = sectorStats.filter(function (x) { return x.underPct > 50; }).sort(function (a, b) { return b.underPct - a.underPct; }).slice(0, 15).map(function (x) { return { name: x.name, value: x.underPct }; });
      var overSectors = sectorStats.filter(function (x) { return x.overPct > 50; }).sort(function (a, b) { return b.overPct - a.overPct; }).slice(0, 15).map(function (x) { return { name: x.name, value: x.overPct }; });
      ivMonthlyRenderBarChart('ivMonthlySectorUnderChart', underSectors, 'value', '%');
      ivMonthlyRenderBarChart('ivMonthlySectorOverChart', overSectors, 'value', '%');

      var segmentedRows = valid.map(function (row) { return Object.assign({}, row, { segment: ivMonthlySegmentName(row.marketCap) }); });
      var segmentStats = ivMonthlyGroupStats(segmentedRows, 'segment');
      var segmentOrder = ['0–100 Cr', '100–300 Cr', '300–1000 Cr', '1000–5000 Cr', '5000–20000 Cr', '20000–50000 Cr', 'Above 50000 Cr'];
      var segmentUnder = segmentOrder.map(function (name) { var found = segmentStats.find(function (x) { return x.name === name; }); return { name: name, value: found ? found.underPct : 0 }; });
      var segmentOver = segmentOrder.map(function (name) { var found = segmentStats.find(function (x) { return x.name === name; }); return { name: name, value: found ? found.overPct : 0 }; });
      ivMonthlyRenderBarChart('ivMonthlySegmentUnderChart', segmentUnder, 'value', '%');
      ivMonthlyRenderBarChart('ivMonthlySegmentOverChart', segmentOver, 'value', '%');

      var turnaround = ivMonthlyCountByIndustry(rows, function (row) { return row.promoterChange !== null && row.promoterChange > 0; });
      var negativeTurnaround = ivMonthlyCountByIndustry(rows, function (row) { return row.promoterChange !== null && row.promoterChange < 0; });
      ivMonthlyRenderBarChart('ivMonthlyTurnaroundChart', turnaround, 'count', '');
      ivMonthlyRenderBarChart('ivMonthlyNegativeTurnaroundChart', negativeTurnaround, 'count', '');
      ivMonthlyRenderTopCompanies(rows, turnaround);
    }

    function ivBindMonthlyMarketAnalysis() {
      ivLoadMasterStockData().then(function () {
        ivMonthlyRender();
      });
    }

    function getMasterData() {
      return ivMasterStockData.slice();
    }

    function ivParseMasterCsvLine(line) {
      var columns = [];
      var current = '';
      var inQuotes = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line.charAt(i);
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          columns.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      columns.push(current.trim());
      return columns;
    }

    function ivParseMasterCsv(text) {
      var cleaned = String(text || '').split(String.fromCharCode(13)).join('');
      var lines = cleaned.split(String.fromCharCode(10)).filter(function (line) { return line.trim() !== ''; });
      if (lines.length < 2) return [];

      var headers = ivParseMasterCsvLine(lines[0]).map(function (header) { return header.trim(); });
      var rows = [];
      for (var i = 1; i < lines.length; i++) {
        var values = ivParseMasterCsvLine(lines[i]);
        var item = {};
        headers.forEach(function (header, index) {
          item[header] = values[index] !== undefined ? values[index] : '';
        });
        rows.push(item);
      }
      return rows;
    }

    function ivReplaceMasterData(newRows) {
      if (!Array.isArray(newRows) || !newRows.length) return false;
      ivMasterStockData = newRows.slice();
      return true;
    }

    function ivLoadMasterStockData() {
      if (ivDataLoaded || ivDataLoading) {
        return Promise.resolve(ivMasterStockData);
      }

      ivDataLoading = true;

      if (IV_USE_REMOTE_DATA === false) {
        if (ivMasterStockData && ivMasterStockData.length > 12) {
          ivDataLoaded = true;
          ivDataLoading = false;
          return Promise.resolve(ivMasterStockData);
        }
        ivMasterStockData = ivSampleStockData.slice();
        ivDataLoaded = true;
        ivDataLoading = false;
        return Promise.resolve(ivMasterStockData);
      }

      if (!window.fetch || !ivRankingMasterCsvUrl) {
        ivDataLoading = false;
        return Promise.resolve(ivMasterStockData);
      }

      return fetch(ivRankingMasterCsvUrl, { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) throw new Error('Master CSV fetch failed');
          return response.text();
        })
        .then(function (csvText) {
          var parsedRows = ivParseMasterCsv(csvText);
          if (Array.isArray(parsedRows) && parsedRows.length) {
            ivMasterStockData = parsedRows;
            ivDataLoaded = true;
          } else {
            throw new Error('Master CSV has no rows');
          }
          ivDataLoading = false;
          return ivMasterStockData;
        })
        .catch(function () {
          ivDataLoading = false;
          return ivMasterStockData;
        });
    }


  document.addEventListener('DOMContentLoaded', function () {
    ivBindMonthlyMarketAnalysis();
  });
})();
