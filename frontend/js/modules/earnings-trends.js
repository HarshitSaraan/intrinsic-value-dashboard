(function () {
  function q(id) { return document.getElementById(id); }

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';
  var searchApi = baseUrl + '/search-stocks';

  var allStocks = [];
  var filteredStocks = [];
  var activeStockSymbol = null;
  var activeFinancialsData = null;
  var activeViewType = "quarterly";

  var layout = q("ivTrendsLayout");
  var searchInput = q("ivStockSearchInput");
  var searchSpinner = q("ivSearchSpinner");
  var resultsList = q("ivSearchResultsList");
  var chartArea = q("ivTrendsChartArea");
  var backBtn = q("ivTrendsBackButton");
  
  var modalStockName = q("ivModalStockName");
  var toggleQuarterly = q("ivToggleQuarterly");
  var toggleAnnual = q("ivToggleAnnual");
  var modalLegendPeriod = q("ivModalLegendPeriod");
  var modalLegendRevenue = q("ivModalLegendRevenue");
  var modalLegendEarnings = q("ivModalLegendEarnings");
  var financialsChart = q("ivFinancialsChart");

  // Load stocks on init
  function initPage() {
    bindEvents();
    
    // Fetch all stock names
    fetch(searchApi)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load stock list");
        return res.json();
      })
      .then(function (data) {
        allStocks = data.stocks || [];
        filteredStocks = allStocks.slice();
        renderStockList();
      })
      .catch(function (err) {
        console.error("Error fetching stocks list:", err);
        if (resultsList) {
          resultsList.innerHTML = '<div style="text-align:center;padding:24px;color:var(--iv-danger);font-size:13px;">' +
            'Failed to load stocks list: ' + err.message + '</div>';
        }
      });
  }

  function renderStockList() {
    if (!resultsList) return;
    
    if (!filteredStocks || !filteredStocks.length) {
      resultsList.innerHTML = '<div style="text-align:center;padding:24px;color:var(--iv-text-muted);font-size:13px;">No stocks match search.</div>';
      return;
    }

    resultsList.innerHTML = filteredStocks.map(function (stock) {
      var isActive = (stock.symbol === activeStockSymbol);
      var activeClass = isActive ? " active" : "";
      return '<div class="iv-stock-item-row' + activeClass + '" data-symbol="' + stock.symbol + '">' +
        '<span class="iv-stock-item-symbol">' + stock.symbol + '</span>' +
        '<span class="iv-stock-item-name">' + stock.name + '</span>' +
        '</div>';
    }).join('');

    // Bind row clicks
    var rows = resultsList.querySelectorAll('.iv-stock-item-row');
    rows.forEach(function (row) {
      row.addEventListener('click', function () {
        var symbol = row.getAttribute('data-symbol');
        var stock = allStocks.find(function (s) { return s.symbol === symbol; });
        if (stock) {
          selectStock(stock);
        }
      });
    });
  }

  function selectStock(stock) {
    activeStockSymbol = stock.symbol;
    
    // Mark row active in list
    var rows = resultsList.querySelectorAll('.iv-stock-item-row');
    rows.forEach(function (row) {
      var sym = row.getAttribute('data-symbol');
      row.classList.toggle('active', sym === activeStockSymbol);
    });

    // Set view type and title
    activeViewType = "quarterly";
    if (toggleQuarterly) toggleQuarterly.classList.add("active");
    if (toggleAnnual) toggleAnnual.classList.remove("active");
    if (modalStockName) modalStockName.textContent = stock.name + " (" + stock.symbol + ".NS)";

    // Shift layout and reveal chart area
    if (layout) layout.classList.add("calculated");
    if (chartArea) {
      chartArea.style.display = "block";
      requestAnimationFrame(function () {
        chartArea.classList.add("show");
      });
    }

    // Reset chart & show loading state in legend
    var ctx = financialsChart.getContext("2d");
    ctx.clearRect(0, 0, financialsChart.width, financialsChart.height);
    updateLegend(null);
    if (modalLegendPeriod) modalLegendPeriod.textContent = "Loading financials...";

    // Fetch financials
    if (searchSpinner) searchSpinner.style.display = "block";
    
    var fetchUrl = "/frontend/data/financials/" + encodeURIComponent(stock.symbol.toUpperCase()) + ".json";
    fetch(fetchUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load financials");
        return res.json();
      })
      .then(function (data) {
        if (searchSpinner) searchSpinner.style.display = "none";
        activeFinancialsData = data;
        renderFinancials();
        if (data.error && data.message) {
          if (modalLegendPeriod) modalLegendPeriod.textContent = "Error: " + data.message;
        }
      })
      .catch(function (err) {
        if (searchSpinner) searchSpinner.style.display = "none";
        console.error(err);
        if (modalLegendPeriod) modalLegendPeriod.textContent = "Error: " + err.message;
      });
  }

  function bindEvents() {
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (layout) layout.classList.remove("calculated");
        if (chartArea) {
          chartArea.classList.remove("show");
          setTimeout(function () {
            chartArea.style.display = "none";
          }, 300);
        }
        activeStockSymbol = null;
        renderStockList();
      });
    }

    // Search input keyup filtering
    if (searchInput) {
      searchInput.addEventListener('keyup', function () {
        var q = searchInput.value.toLowerCase().trim();
        if (!q) {
          filteredStocks = allStocks.slice();
        } else {
          filteredStocks = allStocks.filter(function (s) {
            var sym = (s.symbol || '').toLowerCase();
            var name = (s.name || '').toLowerCase();
            return sym.indexOf(q) >= 0 || name.indexOf(q) >= 0;
          });
        }
        renderStockList();
      });
    }

    // Toggle events
    if (toggleQuarterly) {
      toggleQuarterly.addEventListener("click", function () {
        if (activeViewType === "quarterly") return;
        activeViewType = "quarterly";
        toggleQuarterly.classList.add("active");
        toggleAnnual.classList.remove("active");
        renderFinancials();
      });
    }

    if (toggleAnnual) {
      toggleAnnual.addEventListener("click", function () {
        if (activeViewType === "annual") return;
        activeViewType = "annual";
        toggleAnnual.classList.add("active");
        toggleQuarterly.classList.remove("active");
        renderFinancials();
      });
    }

    // Chart hover listeners
    if (financialsChart) {
      financialsChart.addEventListener("mousemove", function (e) {
        if (!financialsChart._bars) return;
        var rect = financialsChart.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var hovered = null;
        financialsChart._bars.forEach(function (b) {
          if (x >= b.x && x <= b.x + b.w) {
            hovered = b;
          }
        });
        if (hovered) {
          updateLegend(hovered.item);
        }
      });

      financialsChart.addEventListener("mouseleave", function () {
        if (activeFinancialsData) {
          var dataset = activeViewType === "quarterly" ? activeFinancialsData.quarterly : activeFinancialsData.annual;
          if (dataset && dataset.length) {
            updateLegend(dataset[dataset.length - 1]);
          }
        }
      });
    }
  }

  function updateLegend(item) {
    if (!item) {
      if (modalLegendPeriod) modalLegendPeriod.textContent = "—";
      if (modalLegendRevenue) modalLegendRevenue.textContent = "—";
      if (modalLegendEarnings) modalLegendEarnings.textContent = "—";
      updateMetricsPanel(null);
      return;
    }
    var period = activeViewType === "annual" ? item.annualLabel : item.quarterLabel;
    if (modalLegendPeriod) modalLegendPeriod.textContent = period;
    if (modalLegendRevenue) modalLegendRevenue.textContent = formatFinancial(item.revenue);
    if (modalLegendEarnings) modalLegendEarnings.textContent = formatFinancial(item.earnings);
    updateMetricsPanel(item);
  }

  function formatPercentage(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    var sign = v >= 0 ? '+' : '';
    return sign + v.toFixed(2) + '%';
  }

  function updateMetricsPanel(item) {
    var periodSpan = q("ivMetricsPeriod");
    var revYoYSpan = q("ivMetricRevenueYoY");
    var earnYoYSpan = q("ivMetricEarningsYoY");
    var ebitdaSpan = q("ivMetricEbitda");
    var marginSpan = q("ivMetricProfitMargin");
    
    if (!item) {
      if (periodSpan) periodSpan.textContent = "—";
      if (revYoYSpan) { revYoYSpan.textContent = "—"; revYoYSpan.style.color = ""; }
      if (earnYoYSpan) { earnYoYSpan.textContent = "—"; earnYoYSpan.style.color = ""; }
      if (ebitdaSpan) ebitdaSpan.textContent = "—";
      if (marginSpan) marginSpan.textContent = "—";
      return;
    }
    
    var period = activeViewType === "annual" ? item.annualLabel : item.quarterLabel;
    if (periodSpan) periodSpan.textContent = period;
    
    if (revYoYSpan) {
      revYoYSpan.textContent = formatPercentage(item.revenueYoY);
      if (item.revenueYoY !== null && item.revenueYoY !== undefined) {
        revYoYSpan.style.color = item.revenueYoY >= 0 ? "#28a745" : "#dc3545";
      } else {
        revYoYSpan.style.color = "";
      }
    }
    
    if (earnYoYSpan) {
      earnYoYSpan.textContent = formatPercentage(item.earningsYoY);
      if (item.earningsYoY !== null && item.earningsYoY !== undefined) {
        earnYoYSpan.style.color = item.earningsYoY >= 0 ? "#28a745" : "#dc3545";
      } else {
        earnYoYSpan.style.color = "";
      }
    }
    
    if (ebitdaSpan) {
      ebitdaSpan.textContent = formatFinancial(item.ebitda);
    }
    
    if (marginSpan) {
      marginSpan.textContent = item.profitMargin !== null && item.profitMargin !== undefined ? item.profitMargin.toFixed(2) + '%' : '—';
    }
  }

  function formatFinancial(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    var abs = Math.abs(v);
    var suffix = 'B';
    var formattedVal = abs / 1e9;
    if (abs >= 1e12) {
      formattedVal = abs / 1e12;
      suffix = 'T';
    } else if (abs < 1e9) {
      formattedVal = abs / 1e6;
      suffix = 'M';
    }
    var resultStr = formattedVal.toFixed(2);
    if (resultStr.endsWith(".00")) resultStr = resultStr.substring(0, resultStr.length - 3);
    return "₹" + resultStr + suffix;
  }

  function setupModalCanvas(c) {
    if (!c) return null;
    var rect = c.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(280, Math.floor(rect.width || c.width || 550));
    var h = Math.max(200, Math.floor(rect.height || c.height || 320));
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = w + "px";
    c.style.height = h + "px";
    var ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, width: w, height: h };
  }

  function renderFinancials() {
    if (!activeFinancialsData) return;
    var dataset = activeViewType === "quarterly" ? activeFinancialsData.quarterly : activeFinancialsData.annual;
    drawFinancialsChart(financialsChart, dataset);
    if (dataset && dataset.length) {
      updateLegend(dataset[dataset.length - 1]);
    } else {
      updateLegend(null);
      if (modalLegendPeriod) modalLegendPeriod.textContent = "No data available";
    }
  }

  function drawFinancialsChart(canvas, dataset) {
    var d = setupModalCanvas(canvas);
    if (!d) return;
    var ctx = d.ctx;
    var w = d.width;
    var h = d.height;
    ctx.clearRect(0, 0, w, h);

    if (!dataset || !dataset.length) {
      ctx.fillStyle = "rgba(203, 213, 232, 0.5)";
      ctx.font = "12px Inter, Arial";
      ctx.textAlign = "center";
      ctx.fillText("No financial data found", w / 2, h / 2);
      return;
    }

    var padL = w < 420 ? 45 : 55;
    var padR = 15;
    var padT = 20;
    var padB = 30;
    var chartW = w - padL - padR;
    var chartH = h - padT - padB;

    var maxVal = 0;
    dataset.forEach(function (item) {
      if (item.revenue > maxVal) maxVal = item.revenue;
      if (item.earnings > maxVal) maxVal = item.earnings;
    });
    maxVal = maxVal * 1.15;
    if (maxVal <= 0) maxVal = 1;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(203, 213, 232, 0.72)";
    ctx.font = "10px Inter, Arial";
    ctx.textAlign = "right";

    for (var g = 0; g <= 3; g++) {
      var yy = padT + (chartH * g / 3);
      var val = maxVal * (1 - g / 3);
      ctx.beginPath();
      if (ctx.setLineDash) ctx.setLineDash([4, 4]);
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.fillText(formatFinancial(val), padL - 8, yy + 3);
    }

    var numPeriods = dataset.length;
    var groupWidth = chartW / numPeriods;
    var barGap = 4;
    var sideMargin = w < 480 ? 12 : 24;
    var barWidth = (groupWidth - sideMargin * 2 - barGap) / 2;

    dataset.forEach(function (item, idx) {
      var groupCenterX = padL + (idx * groupWidth) + (groupWidth / 2);
      var revX = groupCenterX - barWidth - (barGap / 2);
      var earnX = groupCenterX + (barGap / 2);

      var revH = (item.revenue / maxVal) * chartH;
      var earnH = (item.earnings / maxVal) * chartH;

      var revY = padT + chartH - revH;
      var earnY = padT + chartH - earnH;

      ctx.fillStyle = "#3a9ad9";
      drawRoundedRect(ctx, revX, revY, barWidth, revH, 4);
      ctx.fill();

      ctx.fillStyle = "#f1bf6c";
      drawRoundedRect(ctx, earnX, earnY, barWidth, earnH, 4);
      ctx.fill();

      ctx.fillStyle = "rgba(203, 213, 232, 0.72)";
      ctx.font = "10px Inter, Arial";
      ctx.textAlign = "center";
      var xLabel = activeViewType === "quarterly" ? item.quarterLabel : item.annualLabel;
      ctx.fillText(xLabel, groupCenterX, padT + chartH + 16);
    });

    canvas._bars = dataset.map(function (item, idx) {
      var groupCenterX = padL + (idx * groupWidth) + (groupWidth / 2);
      return {
        x: groupCenterX - groupWidth / 2,
        w: groupWidth,
        item: item
      };
    });
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    if (height < radius) radius = height;
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
  }

  document.addEventListener("DOMContentLoaded", initPage);
})();
