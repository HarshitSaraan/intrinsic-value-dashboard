(function () {
  var app = document.querySelector('.iv-market-valuation-index-page');
  if (!app) app = document.body;

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';
  var apiEndpoint = baseUrl + '/sector-valuation';

  var sectorValuationData = null;
  var sectorList = [];
  var currentSector = 'Nifty 50';
  var hoverPoint = null;

  // Formatting helpers
  function formatMetricValue(val, metric) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    if (metric === 'index') {
      return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (metric === 'div_yield') {
      return Number(val).toFixed(2) + '%';
    } else {
      return Number(val).toFixed(2);
    }
  }

  // Calculate and update the valuation status badge
  function updateValuationBadge(pbVal, divVal) {
    var badge = app.querySelector('#ivSectorValuationBadge');
    if (!badge) return;

    if (pbVal === null || pbVal === undefined || divVal === null || divVal === undefined) {
      badge.textContent = '—';
      badge.style.background = 'rgba(var(--iv-accent-rgb), 0.08)';
      badge.style.color = 'var(--iv-gold-2)';
      badge.style.borderColor = 'rgba(var(--iv-accent-rgb), 0.2)';
      return;
    }

    var canvas = app.querySelector('#ivSectorValuationCanvas');
    if (canvas && canvas._yAtPB && canvas._yAtDiv) {
      var yPB = canvas._yAtPB(pbVal);
      var yDiv = canvas._yAtDiv(divVal);

      // Canvas Y goes downwards, so yPB > yDiv means P/B is visually lower (under) Dividend Yield on the graph
      if (yPB > yDiv) {
        badge.textContent = 'Undervalued';
        badge.style.background = 'rgba(var(--iv-success-rgb), 0.12)';
        badge.style.color = 'var(--iv-success)';
        badge.style.borderColor = 'rgba(var(--iv-success-rgb), 0.3)';
      } else {
        badge.textContent = 'Overvalued';
        badge.style.background = 'rgba(var(--iv-danger-rgb), 0.12)';
        badge.style.color = 'var(--iv-danger)';
        badge.style.borderColor = 'rgba(var(--iv-danger-rgb), 0.3)';
      }
    } else {
      // Fallback to value-wise if canvas helpers are not loaded yet
      if (pbVal < divVal) {
        badge.textContent = 'Undervalued';
        badge.style.background = 'rgba(var(--iv-success-rgb), 0.12)';
        badge.style.color = 'var(--iv-success)';
        badge.style.borderColor = 'rgba(var(--iv-success-rgb), 0.3)';
      } else {
        badge.textContent = 'Overvalued';
        badge.style.background = 'rgba(var(--iv-danger-rgb), 0.12)';
        badge.style.color = 'var(--iv-danger)';
        badge.style.borderColor = 'rgba(var(--iv-danger-rgb), 0.3)';
      }
    }
  }


  // Draw chart on canvas with dual Y-axis
  function drawSectorChart(sectorName) {
    var canvas = app.querySelector('#ivSectorValuationCanvas');
    if (!canvas) return;

    var series = sectorValuationData[sectorName];
    if (!series || !series.length) return;

    // Find the first index where we have valid data for either P/B or Div Yield
    var firstValidIdx = 0;
    for (var i = 0; i < series.length; i++) {
      var item = series[i];
      if ((item.pb !== null && item.pb !== undefined && !isNaN(item.pb)) || 
          (item.div_yield !== null && item.div_yield !== undefined && !isNaN(item.div_yield))) {
        firstValidIdx = i;
        break;
      }
    }
    
    // Slice active series starting from that date
    var activeSeries = series.slice(firstValidIdx);

    // Map and filter out points where both pb and div_yield are invalid/null
    var points = activeSeries.map(function (item) {
      return {
        date: item.date,
        pb: item.pb,
        div_yield: item.div_yield
      };
    }).filter(function (p) {
      return (p.pb !== null && p.pb !== undefined && isFinite(p.pb)) || 
             (p.div_yield !== null && p.div_yield !== undefined && isFinite(p.div_yield));
    });

    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var width = Math.max(300, Math.floor(rect.width));
    var height = 260;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (points.length < 2) {
      ctx.fillStyle = 'rgba(203,213,232,0.6)';
      ctx.font = '13px Poppins, Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Insufficient historical data for this sector', width / 2, height / 2);
      return;
    }

    var padL = 55;
    var padR = 55;
    var padT = 24;
    var padB = 40;
    var plotW = width - padL - padR;
    var plotH = height - padT - padB;

    // Calculate Left Y-axis bounds (P/B Ratio)
    var pbValues = points.map(function (p) { return p.pb; }).filter(function (v) { return v !== null && isFinite(v); });
    var minPB = pbValues.length ? Math.min.apply(null, pbValues) : 0;
    var maxPB = pbValues.length ? Math.max.apply(null, pbValues) : 1;
    var pbRange = maxPB - minPB;
    var pbPad = pbRange * 0.1 || 0.2;
    minPB = Math.max(0, minPB - pbPad);
    maxPB += pbPad;

    // Calculate Right Y-axis bounds (Div Yield %)
    var divValues = points.map(function (p) { return p.div_yield; }).filter(function (v) { return v !== null && isFinite(v); });
    var minDiv = divValues.length ? Math.min.apply(null, divValues) : 0;
    var maxDiv = divValues.length ? Math.max.apply(null, divValues) : 1;
    var divRange = maxDiv - minDiv;
    var divPad = divRange * 0.1 || 0.5;
    minDiv = Math.max(0, minDiv - divPad);
    maxDiv += divPad;

    function xAt(i) {
      return padL + (i / (points.length - 1)) * plotW;
    }

    function yAtPB(v) {
      return padT + plotH - ((v - minPB) / (maxPB - minPB)) * plotH;
    }

    function yAtDiv(v) {
      return padT + plotH - ((v - minDiv) / (maxDiv - minDiv)) * plotH;
    }

    // Attach scaling helpers to canvas so other functions can translate coordinates
    canvas._yAtPB = yAtPB;
    canvas._yAtDiv = yAtDiv;

    // 1. Draw horizontal gridlines based on left Y-axis levels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    var gridCount = 4;
    for (var g = 0; g <= gridCount; g++) {
      var gy = padT + plotH * g / gridCount;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(width - padR, gy);
      ctx.stroke();
    }

    // 2. Draw Left Y-axis ticks and labels (P/B Ratio - Blue color)
    ctx.fillStyle = '#42A5F5'; // Blue text matching P/B line
    ctx.font = '10px Poppins, Arial';
    ctx.textAlign = 'right';
    for (var g = 0; g <= gridCount; g++) {
      var gy = padT + plotH * g / gridCount;
      var gv = minPB + (maxPB - minPB) * (1 - g / gridCount);
      ctx.fillText(gv.toFixed(2), padL - 10, gy + 3);
    }
    
    // Draw Left Y-axis title
    ctx.save();
    ctx.translate(14, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#42A5F5';
    ctx.font = '9px Poppins, Arial';
    ctx.fillText('P/B Ratio (Left)', 0, 0);
    ctx.restore();

    // 3. Draw Right Y-axis ticks and labels (Div Yield % - Gold color)
    ctx.fillStyle = '#BCA374'; // Gold text matching Div Yield line
    ctx.textAlign = 'left';
    for (var g = 0; g <= gridCount; g++) {
      var gy = padT + plotH * g / gridCount;
      var gv = minDiv + (maxDiv - minDiv) * (1 - g / gridCount);
      ctx.fillText(gv.toFixed(2) + '%', width - padR + 10, gy + 3);
    }

    // Draw Right Y-axis title
    ctx.save();
    ctx.translate(width - 12, padT + plotH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#BCA374';
    ctx.font = '9px Poppins, Arial';
    ctx.fillText('Dividend Yield % (Right)', 0, 0);
    ctx.restore();

    // 4. Draw Gold Area Gradient under P/B Line
    var pbPoints = points.filter(function (p) { return p.pb !== null && isFinite(p.pb); });
    if (pbPoints.length >= 2) {
      ctx.beginPath();
      points.forEach(function (p, i) {
        var x = xAt(i);
        var y = yAtPB(p.pb !== null ? p.pb : minPB);
        if (i === 0) ctx.moveTo(x, y);
        else {
          var px = xAt(i - 1);
          var py = yAtPB(points[i - 1].pb !== null ? points[i - 1].pb : minPB);
          var mx = (px + x) / 2;
          ctx.bezierCurveTo(mx, py, mx, y, x, y);
        }
      });
      ctx.lineTo(xAt(points.length - 1), height - padB);
      ctx.lineTo(xAt(0), height - padB);
      ctx.closePath();

      var fillPB = ctx.createLinearGradient(0, padT, 0, height - padB);
      fillPB.addColorStop(0, 'rgba(66, 165, 245, 0.08)');
      fillPB.addColorStop(1, 'rgba(66, 165, 245, 0.00)');
      ctx.fillStyle = fillPB;
      ctx.fill();
    }

    // 5. Draw Gold Area Gradient under Div Yield Line
    var divPoints = points.filter(function (p) { return p.div_yield !== null && isFinite(p.div_yield); });
    if (divPoints.length >= 2) {
      ctx.beginPath();
      points.forEach(function (p, i) {
        var x = xAt(i);
        var y = yAtDiv(p.div_yield !== null ? p.div_yield : minDiv);
        if (i === 0) ctx.moveTo(x, y);
        else {
          var px = xAt(i - 1);
          var py = yAtDiv(points[i - 1].div_yield !== null ? points[i - 1].div_yield : minDiv);
          var mx = (px + x) / 2;
          ctx.bezierCurveTo(mx, py, mx, y, x, y);
        }
      });
      ctx.lineTo(xAt(points.length - 1), height - padB);
      ctx.lineTo(xAt(0), height - padB);
      ctx.closePath();

      var fillDiv = ctx.createLinearGradient(0, padT, 0, height - padB);
      fillDiv.addColorStop(0, 'rgba(188, 163, 116, 0.06)');
      fillDiv.addColorStop(1, 'rgba(188, 163, 116, 0.00)');
      ctx.fillStyle = fillDiv;
      ctx.fill();
    }

    // 6. Draw P/B line (Blue Bezier curve)
    if (pbPoints.length >= 2) {
      ctx.beginPath();
      points.forEach(function (p, i) {
        var x = xAt(i);
        var y = yAtPB(p.pb !== null ? p.pb : minPB);
        if (i === 0) ctx.moveTo(x, y);
        else {
          var px = xAt(i - 1);
          var py = yAtPB(points[i - 1].pb !== null ? points[i - 1].pb : minPB);
          var mx = (px + x) / 2;
          ctx.bezierCurveTo(mx, py, mx, y, x, y);
        }
      });
      ctx.strokeStyle = '#42A5F5'; // Blue line color
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // 7. Draw Div Yield line (Gold Bezier curve)
    if (divPoints.length >= 2) {
      ctx.beginPath();
      points.forEach(function (p, i) {
        var x = xAt(i);
        var y = yAtDiv(p.div_yield !== null ? p.div_yield : minDiv);
        if (i === 0) ctx.moveTo(x, y);
        else {
          var px = xAt(i - 1);
          var py = yAtDiv(points[i - 1].div_yield !== null ? points[i - 1].div_yield : minDiv);
          var mx = (px + x) / 2;
          ctx.bezierCurveTo(mx, py, mx, y, x, y);
        }
      });
      ctx.strokeStyle = '#BCA374'; // Gold line color
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // 8. Draw X date labels (6 labels distributed evenly)
    ctx.fillStyle = 'rgba(203, 213, 232, 0.5)';
    ctx.textAlign = 'center';
    ctx.font = '9px Poppins, Arial';
    var labelCount = Math.min(6, points.length);
    var labelStep = Math.max(1, Math.floor(points.length / (labelCount - 1)));
    
    for (var l = 0; l < labelCount; l++) {
      var idx = Math.min(l * labelStep, points.length - 1);
      var p = points[idx];
      var x = xAt(idx);
      ctx.fillText(p.date, x, height - padB + 16);
    }

    // 9. Draw Hover indicator crosshair lines and dots
    if (hoverPoint) {
      var matchIdx = points.indexOf(hoverPoint);
      if (matchIdx >= 0) {
        var hx = xAt(matchIdx);

        // Vertical crosshair indicator
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(hx, padT);
        ctx.lineTo(hx, height - padB);
        ctx.stroke();
        ctx.setLineDash([]);

        // P/B highlight dot (Blue)
        if (hoverPoint.pb !== null) {
          var hyPB = yAtPB(hoverPoint.pb);
          ctx.beginPath();
          ctx.arc(hx, hyPB, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = 'rgba(66, 165, 245, 0.4)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(hx, hyPB, 8, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Div Yield highlight dot (Gold)
        if (hoverPoint.div_yield !== null) {
          var hyDiv = yAtDiv(hoverPoint.div_yield);
          ctx.beginPath();
          ctx.arc(hx, hyDiv, 4.0, 0, Math.PI * 2);
          ctx.fillStyle = '#E5D3B3'; // light gold center
          ctx.fill();
          ctx.strokeStyle = 'rgba(188, 163, 116, 0.4)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(hx, hyDiv, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    canvas._chartPoints = points;
    canvas._xAt = xAt;
  }

  // Setup interactive canvas events (hover, mousemove, mouseleave)
  function initCanvasEvents() {
    var canvas = app.querySelector('#ivSectorValuationCanvas');
    var tooltip = app.querySelector('#ivSectorValuationTooltip');
    if (!canvas || !tooltip) return;

    canvas.onmousemove = function (e) {
      var points = canvas._chartPoints;
      if (!points || !points.length) return;

      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;

      // Find closest horizontal point
      var closest = null;
      var minDist = Infinity;
      points.forEach(function (p, idx) {
        var px = canvas._xAt(idx);
        var dist = Math.abs(px - mx);
        if (dist < minDist) {
          minDist = dist;
          closest = p;
        }
      });

      if (closest && closest !== hoverPoint) {
        hoverPoint = closest;
        
        // Redraw with highlight dot
        drawSectorChart(currentSector);

        // Calculate dynamic valuation status for hovered point
        var statusHtml = '';
        if (closest.pb !== null && closest.div_yield !== null) {
          var pbVal = closest.pb;
          var divVal = closest.div_yield;
          
          var yPB = canvas._yAtPB(pbVal);
          var yDiv = canvas._yAtDiv(divVal);
          
          var statusText = 'Overvalued';
          var statusColor = 'var(--iv-danger)';
          if (yPB > yDiv) {
            statusText = 'Undervalued';
            statusColor = 'var(--iv-success)';
          }
          statusHtml = '<div style="margin-top:5px;border-top:1px solid rgba(255,255,255,0.08);padding-top:5px;display:flex;align-items:center;">' +
                       'Valuation: <b style="color:' + statusColor + ';margin-left:auto;">' + statusText + '</b>' +
                       '</div>';
        }

        // Show tooltip showing both parameters + status (Blue for PB, Gold for Div Yield)
        tooltip.style.display = 'block';
        tooltip.innerHTML = '<div style="font-weight:600;margin-bottom:4px;color:#fff;font-size:12px;">' + closest.date + '</div>' +
                            '<div style="margin-bottom:2px;display:flex;align-items:center;gap:6px;">' +
                            '<i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#42A5F5;"></i>' +
                            'P/B Ratio: <b style="color:#90CAF9;margin-left:auto;">' + formatMetricValue(closest.pb, 'pb') + '</b>' +
                            '</div>' +
                            '<div style="display:flex;align-items:center;gap:6px;">' +
                            '<i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#BCA374;"></i>' +
                            'Div Yield: <b style="color:#E5D3B3;margin-left:auto;">' + formatMetricValue(closest.div_yield, 'div_yield') + '</b>' +
                            '</div>' +
                            statusHtml;
        
        // Position tooltip near cursor
        var tooltipRect = tooltip.getBoundingClientRect();
        var tx = e.clientX + 15;
        var ty = e.clientY - 25;
        
        // Prevent going off screen
        if (tx + tooltipRect.width > window.innerWidth) {
          tx = e.clientX - tooltipRect.width - 15;
        }
        if (ty + tooltipRect.height > window.innerHeight) {
          ty = window.innerHeight - tooltipRect.height - 10;
        }

        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
      }
    };

    canvas.onmouseleave = function () {
      if (hoverPoint !== null) {
        hoverPoint = null;
        drawSectorChart(currentSector);
      }
      tooltip.style.display = 'none';
    };
  }

  // Update Statistics Box values
  function updateStatsBoxes(sectorName) {
    var series = sectorValuationData[sectorName];
    if (!series || !series.length) return;

    var latestIndex = '—';

    // Reverse iterate to find latest values
    for (var i = series.length - 1; i >= 0; i--) {
      var item = series[i];
      if (latestIndex === '—' && item.index !== null && item.index !== undefined) {
        latestIndex = formatMetricValue(item.index, 'index');
      }
    }

    var elIndex = app.querySelector('#ivSelectedSectorIndexValue');
    if (elIndex) elIndex.textContent = latestIndex;
  }

  // Update active states and redraw
  function selectSector(sectorName) {
    currentSector = sectorName;
    updateStatsBoxes(sectorName);

    // Update title
    var titleEl = app.querySelector('#ivSelectedSectorTitle');
    var subEl = app.querySelector('#ivSelectedSectorSubtitle');
    if (titleEl) titleEl.textContent = sectorName;
    if (subEl) subEl.textContent = 'P/B vs Dividend Yield trend from starting year';

    // Redraw graph
    drawSectorChart(sectorName);

    // Update the dynamic status badge (comparing latest valid points)
    var series = sectorValuationData[sectorName];
    var latestPB = null;
    var latestDiv = null;
    if (series) {
      for (var i = series.length - 1; i >= 0; i--) {
        if (latestPB === null && series[i].pb !== null && !isNaN(series[i].pb)) {
          latestPB = series[i].pb;
        }
        if (latestDiv === null && series[i].div_yield !== null && !isNaN(series[i].div_yield)) {
          latestDiv = series[i].div_yield;
        }
      }
    }
    updateValuationBadge(latestPB, latestDiv);

    // Highlight button in grid
    var buttons = app.querySelectorAll('.iv-sector-btn');
    buttons.forEach(function (btn) {
      if (btn.getAttribute('data-sector') === sectorName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Make sure section is visible
    var chartSection = app.querySelector('#ivSectorChartSection');
    if (chartSection) chartSection.style.display = 'block';
  }

  // Render Sector selection buttons
  function renderSectorButtons(sectors) {
    var grid = app.querySelector('#ivSectorButtonsGrid');
    if (!grid) return;

    if (!sectors || !sectors.length) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--iv-danger);">No sectors available.</div>';
      return;
    }

    grid.innerHTML = sectors.map(function (s) {
      return '<button class="iv-sector-btn" data-sector="' + s + '">' + s + '</button>';
    }).join('');

    // Bind click events to buttons
    var buttons = grid.querySelectorAll('.iv-sector-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var secName = btn.getAttribute('data-sector');
        selectSector(secName);
      });
    });
  }

  // Fetch data and initialize UI
  function initSectorValuationTool() {
    fetch(apiEndpoint, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('API request failed');
        return res.json();
      })
      .then(function (resData) {
        sectorValuationData = resData.data;
        sectorList = resData.sectors;

        // Render Selector Buttons
        renderSectorButtons(sectorList);

        // Setup Canvas hover trigger listeners
        initCanvasEvents();

        // Select Nifty 50 as default
        var defaultSec = sectorList.indexOf('Nifty 50') >= 0 ? 'Nifty 50' : sectorList[0];
        if (defaultSec) {
          selectSector(defaultSec);
        }
      })
      .catch(function (err) {
        console.error('Error loading sector valuation details:', err);
        var grid = app.querySelector('#ivSectorButtonsGrid');
        if (grid) {
          grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--iv-danger);">' +
                           'Failed to load sector data. Please ensure the backend server is running.' +
                           '</div>';
        }
      });
  }

  // Handle browser window resize to redraw canvas properly
  window.addEventListener('resize', function () {
    if (sectorValuationData && currentSector) {
      drawSectorChart(currentSector);
    }
  });

  // Kickstart on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function () {
    initSectorValuationTool();
  });
})();
