(function () {
  var app = document.querySelector('.iv-market-valuation-index-page');
  if (!app) app = document.body;

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';
  var apiEndpoint = baseUrl + '/sector-valuation';

  var sectorValuationData = null;
  var sectorList = [];
  var currentSector = null;
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

  // Check if a sector is a commodity valuation (e.g. Gold Valuation or Silver Valuation)
  function isCommoditySector(sectorName) {
    if (!sectorName) return false;
    var lower = sectorName.toLowerCase();
    return lower.indexOf('valuation') >= 0 && (lower.indexOf('gold') >= 0 || lower.indexOf('silver') >= 0);
  }

  // Calculate dynamic valuation status for a given point
  function getValuationStatus(pbVal, divVal, sectorName, canvas) {
    if (pbVal === null || pbVal === undefined || isNaN(pbVal)) {
      return { text: '—', color: 'var(--iv-text-muted)' };
    }

    if (sectorName && sectorName.toLowerCase().indexOf('gold') >= 0) {
      if (pbVal < 7) {
        return { text: 'Undervalued', color: 'var(--iv-success)' };
      } else if (pbVal > 14) {
        return { text: 'Overvalued', color: 'var(--iv-danger)' };
      } else {
        return { text: 'Fairly Valued', color: 'var(--iv-warning)' };
      }
    }

    if (sectorName && sectorName.toLowerCase().indexOf('silver') >= 0) {
      if (pbVal < 10) {
        return { text: 'Undervalued', color: 'var(--iv-success)' };
      } else if (pbVal > 20) {
        return { text: 'Overvalued', color: 'var(--iv-danger)' };
      } else {
        return { text: 'Fairly Valued', color: 'var(--iv-warning)' };
      }
    }

    // Default sector logic: P/B vs Div Yield
    if (divVal === null || divVal === undefined || isNaN(divVal)) {
      return { text: '—', color: 'var(--iv-text-muted)' };
    }

    if (canvas && canvas._yAtPB && canvas._yAtDiv) {
      var yPB = canvas._yAtPB(pbVal);
      var yDiv = canvas._yAtDiv(divVal);

      // Canvas Y goes downwards, so yPB > yDiv means P/B is visually lower (under) Dividend Yield on the graph
      if (yPB > yDiv) {
        return { text: 'Undervalued', color: 'var(--iv-success)' };
      } else {
        return { text: 'Overvalued', color: 'var(--iv-danger)' };
      }
    } else {
      // Fallback to value-wise if canvas helpers are not loaded yet
      if (pbVal < divVal) {
        return { text: 'Undervalued', color: 'var(--iv-success)' };
      } else {
        return { text: 'Overvalued', color: 'var(--iv-danger)' };
      }
    }
  }

  // Calculate and update the valuation status badge
  function updateValuationBadge(pbVal, divVal, sectorName) {
    var badge = app.querySelector('#ivSectorValuationBadge');
    if (!badge) return;

    var canvas = app.querySelector('#ivSectorValuationCanvas');
    var status = getValuationStatus(pbVal, divVal, sectorName, canvas);

    badge.textContent = status.text;
    if (status.text === 'Undervalued') {
      badge.style.background = 'rgba(var(--iv-success-rgb), 0.12)';
      badge.style.color = 'var(--iv-success)';
      badge.style.borderColor = 'rgba(var(--iv-success-rgb), 0.3)';
    } else if (status.text === 'Overvalued') {
      badge.style.background = 'rgba(var(--iv-danger-rgb), 0.12)';
      badge.style.color = 'var(--iv-danger)';
      badge.style.borderColor = 'rgba(var(--iv-danger-rgb), 0.3)';
    } else if (status.text === 'Fairly Valued') {
      badge.style.background = 'rgba(var(--iv-warning-rgb), 0.12)';
      badge.style.color = 'var(--iv-warning)';
      badge.style.borderColor = 'rgba(var(--iv-warning-rgb), 0.3)';
    } else {
      badge.style.background = 'rgba(var(--iv-accent-rgb), 0.08)';
      badge.style.color = 'var(--iv-gold-2)';
      badge.style.borderColor = 'rgba(var(--iv-accent-rgb), 0.2)';
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

    var isCommodity = isCommoditySector(sectorName);
    var padL = 25;
    var padR = 25;
    var padT = 24;
    var padB = 40;
    var plotW = width - padL - padR;
    var plotH = height - padT - padB;

    // Calculate Left Y-axis bounds (P/B Ratio or Valuation Ratio)
    var pbValues = points.map(function (p) { return p.pb; }).filter(function (v) { return v !== null && isFinite(v); });
    var minPB = pbValues.length ? Math.min.apply(null, pbValues) : 0;
    var maxPB = pbValues.length ? Math.max.apply(null, pbValues) : 1;

    // Adjust Y bounds for Gold/Silver to fit thresholds
    if (isCommodity) {
      if (sectorName.toLowerCase().indexOf('gold') >= 0) {
        minPB = Math.min(minPB, 5);
        maxPB = Math.max(maxPB, 16);
      } else if (sectorName.toLowerCase().indexOf('silver') >= 0) {
        minPB = Math.min(minPB, 7);
        maxPB = Math.max(maxPB, 23);
      }
    }

    var pbRange = maxPB - minPB;
    var pbPad = pbRange * 0.1 || 0.2;
    minPB = Math.max(0, minPB - pbPad);
    maxPB += pbPad;

    // Calculate Right Y-axis bounds (Div Yield %)
    var minDiv = 0, maxDiv = 1;
    if (!isCommodity) {
      var divValues = points.map(function (p) { return p.div_yield; }).filter(function (v) { return v !== null && isFinite(v); });
      minDiv = divValues.length ? Math.min.apply(null, divValues) : 0;
      maxDiv = divValues.length ? Math.max.apply(null, divValues) : 1;
      var divRange = maxDiv - minDiv;
      var divPad = divRange * 0.1 || 0.5;
      minDiv = Math.max(0, minDiv - divPad);
      maxDiv += divPad;
    }

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

    // 2. Left and Right Y-axis values/titles hidden per requirements (P/B and Div Yield are not displayed directly)

    // 4. Draw Area Gradient under Valuation/PB Line
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
      if (isCommodity) {
        if (sectorName.toLowerCase().indexOf('gold') >= 0) {
          fillPB.addColorStop(0, 'rgba(212, 175, 55, 0.08)');
          fillPB.addColorStop(1, 'rgba(212, 175, 55, 0.00)');
        } else {
          fillPB.addColorStop(0, 'rgba(192, 192, 192, 0.08)');
          fillPB.addColorStop(1, 'rgba(192, 192, 192, 0.00)');
        }
      } else {
        fillPB.addColorStop(0, 'rgba(66, 165, 245, 0.08)');
        fillPB.addColorStop(1, 'rgba(66, 165, 245, 0.00)');
      }
      ctx.fillStyle = fillPB;
      ctx.fill();
    }

    // 5. Draw Area Gradient under Div Yield Line (Only if not a commodity)
    var divPoints = points.filter(function (p) { return p.div_yield !== null && isFinite(p.div_yield); });
    if (!isCommodity && divPoints.length >= 2) {
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

    // 6. Draw Valuation/PB line
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
      var strokeColor = '#42A5F5';
      if (isCommodity) {
        if (sectorName.toLowerCase().indexOf('gold') >= 0) strokeColor = '#D4AF37';
        else strokeColor = '#C0C0C0';
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // 7. Draw Div Yield line (Only if not a commodity)
    if (!isCommodity && divPoints.length >= 2) {
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

    // 7.5 Draw live indicator dots at the end of the lines
    var lastIdx = points.length - 1;
    if (lastIdx >= 0) {
      var endX = xAt(lastIdx);

      // Valuation / PB end dot
      if (points[lastIdx].pb !== null && points[lastIdx].pb !== undefined) {
        var endY_PB = yAtPB(points[lastIdx].pb);
        var dotColor = '#42A5F5';
        if (isCommodity) {
          if (sectorName.toLowerCase().indexOf('gold') >= 0) dotColor = '#D4AF37';
          else dotColor = '#C0C0C0';
        }

        // Outer glow (large translucent circle)
        ctx.beginPath();
        ctx.arc(endX, endY_PB, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = dotColor === '#42A5F5' ? 'rgba(66, 165, 245, 0.35)' :
                        dotColor === '#D4AF37' ? 'rgba(212, 175, 55, 0.35)' : 'rgba(192, 192, 192, 0.35)';
        ctx.fill();

        // Inner solid circle with white border
        ctx.beginPath();
        ctx.arc(endX, endY_PB, 4, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Div Yield end dot (if not commodity)
      if (!isCommodity && points[lastIdx].div_yield !== null && points[lastIdx].div_yield !== undefined) {
        var endY_Div = yAtDiv(points[lastIdx].div_yield);

        // Outer glow
        ctx.beginPath();
        ctx.arc(endX, endY_Div, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(188, 163, 116, 0.3)';
        ctx.fill();

        // Inner solid circle with white border
        ctx.beginPath();
        ctx.arc(endX, endY_Div, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#BCA374';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 8. Draw horizontal threshold lines for Gold and Silver
    if (isCommodity) {
      var isGold = sectorName.toLowerCase().indexOf('gold') >= 0;
      var lowLimit = isGold ? 7 : 10;
      var highLimit = isGold ? 14 : 20;

      // Draw lower limit (Undervalued)
      var yLow = yAtPB(lowLimit);
      ctx.strokeStyle = 'rgba(46, 125, 50, 0.4)'; // green
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padL, yLow);
      ctx.lineTo(width - padR, yLow);
      ctx.stroke();

      // Label lower limit
      ctx.fillStyle = 'rgba(102, 187, 106, 0.8)';
      ctx.font = '9px Poppins, Arial';
      ctx.textAlign = 'right';
      ctx.fillText('Undervalued', width - padR - 5, yLow - 4);

      // Draw upper limit (Overvalued)
      var yHigh = yAtPB(highLimit);
      ctx.strokeStyle = 'rgba(198, 40, 40, 0.4)'; // red
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padL, yHigh);
      ctx.lineTo(width - padR, yHigh);
      ctx.stroke();

      // Label upper limit
      ctx.fillStyle = 'rgba(239, 83, 80, 0.8)';
      ctx.font = '9px Poppins, Arial';
      ctx.textAlign = 'right';
      ctx.fillText('Overvalued', width - padR - 5, yHigh - 4);

      // Reset line dash
      ctx.setLineDash([]);
    }

    // 9. Draw X date labels (6 labels distributed evenly)
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

    // 10. Draw Hover indicator crosshair lines and dots
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

        // Valuation highlight dot
        if (hoverPoint.pb !== null) {
          var hyPB = yAtPB(hoverPoint.pb);
          ctx.beginPath();
          ctx.arc(hx, hyPB, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          
          var strokeStyle = 'rgba(66, 165, 245, 0.4)';
          if (isCommodity) {
            if (sectorName.toLowerCase().indexOf('gold') >= 0) {
              strokeStyle = 'rgba(212, 175, 55, 0.4)';
            } else {
              strokeStyle = 'rgba(192, 192, 192, 0.4)';
            }
          }
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(hx, hyPB, 8, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Div Yield highlight dot (Only if not a commodity)
        if (!isCommodity && hoverPoint.div_yield !== null) {
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

    function handleHover(clientX, clientY) {
      var points = canvas._chartPoints;
      if (!points || !points.length) return;

      var rect = canvas.getBoundingClientRect();
      var mx = clientX - rect.left;
      var my = clientY - rect.top;

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
        var status = getValuationStatus(closest.pb, closest.div_yield, currentSector, canvas);
        var statusHtml = '';
        if (status.text !== '—') {
          var bg = 'rgba(255, 255, 255, 0.1)';
          if (status.text === 'Undervalued') bg = 'rgba(46, 125, 50, 0.15)';
          else if (status.text === 'Overvalued') bg = 'rgba(198, 40, 40, 0.15)';
          else if (status.text === 'Fairly Valued') bg = 'rgba(239, 108, 0, 0.15)';

          statusHtml = '<div style="display:flex;align-items:center;margin-top:5px;">' +
                       '<span style="background:' + bg + ';color:' + status.color + ';padding:3px 8px;border-radius:6px;font-weight:600;font-size:11px;border:1px solid rgba(255,255,255,0.05);">' + status.text + '</span>' +
                       '</div>';
        }

        tooltip.style.display = 'block';
        tooltip.innerHTML = '<div style="font-weight:600;margin-bottom:2px;color:#fff;font-size:12px;">' + closest.date + '</div>' +
                            statusHtml;
        
        // Position tooltip near cursor
        var tooltipRect = tooltip.getBoundingClientRect();
        var tx = clientX + 15;
        var ty = clientY - 25;
        
        // Prevent going off screen
        if (tx + tooltipRect.width > window.innerWidth) {
          tx = clientX - tooltipRect.width - 15;
        }
        if (ty + tooltipRect.height > window.innerHeight) {
          ty = window.innerHeight - tooltipRect.height - 10;
        }

        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
      }
    }

    function handleLeave() {
      if (hoverPoint !== null) {
        hoverPoint = null;
        drawSectorChart(currentSector);
      }
      tooltip.style.display = 'none';
    }

    canvas.onmousemove = function (e) {
      handleHover(e.clientX, e.clientY);
    };

    canvas.onmouseleave = handleLeave;

    // Mobile touch events for smooth crosshair gliding
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length) {
        var t = e.touches[0];
        handleHover(t.clientX, t.clientY);
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', function (e) {
      if (e.touches.length) {
        if (e.cancelable) e.preventDefault(); // Prevent scrolling while interacting with chart
        var t = e.touches[0];
        handleHover(t.clientX, t.clientY);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', function () {
      handleLeave();
    });
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
    if (titleEl) titleEl.textContent = sectorName;

    // Make sure section is visible FIRST so canvas layout width is calculated correctly
    var chartSection = app.querySelector('#ivSectorChartSection');
    if (chartSection) chartSection.style.display = 'block';

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
    updateValuationBadge(latestPB, latestDiv, sectorName);

    // Highlight button in grid
    var buttons = app.querySelectorAll('.iv-sector-btn');
    buttons.forEach(function (btn) {
      if (btn.getAttribute('data-sector') === sectorName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
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
