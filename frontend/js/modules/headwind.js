(function () {
  var app = document.querySelector('.iv-headwind-page');
  if (!app) app = document.body; // Fallback

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';

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


    function ivGetHeadwindElements() {
      return {
        rowsUsed: app.querySelector('#ivHeadwindRowsUsed'),
        score: app.querySelector('#ivHeadwindScore'),
        status: app.querySelector('#ivHeadwindStatus'),
        note: app.querySelector('#ivHeadwindNote'),
        tailwindBody: app.querySelector('#ivHeadwindTailwindBody'),
        headwindBody: app.querySelector('#ivHeadwindHeadwindBody'),
        historyChart: app.querySelector('#ivHeadwindHistoryChart')
      };
    }

    function ivHeadwindGetField(row, names) {
      if (!row) return null;
      var candidates = Array.isArray(names) ? names : [names];
      for (var i = 0; i < candidates.length; i++) {
        if (row[candidates[i]] !== undefined) return row[candidates[i]];
      }
      var keys = Object.keys(row);
      for (var j = 0; j < candidates.length; j++) {
        var target = String(candidates[j]).trim().toLowerCase();
        for (var k = 0; k < keys.length; k++) {
          if (String(keys[k]).trim().toLowerCase() === target) return row[keys[k]];
        }
      }
      return null;
    }

    function ivHeadwindToNumber(value) {
      if (value === null || value === undefined) return NaN;
      var cleaned = String(value).replace(/₹/g, '').replace(/,/g, '').replace(/%/g, '').trim();
      if (cleaned === '' || cleaned === '-' || cleaned.toLowerCase() === 'na' || cleaned.toLowerCase() === 'n/a') return NaN;
      return Number(cleaned);
    }

    function ivHeadwindScoreLabel(score) {
      if (!isFinite(score)) return 'Neutral';
      if (score < 1) return 'Headwind';
      if (score > 1) return 'Tailwind';
      return 'Neutral';
    }

    function ivHeadwindFormatScore(score) {
      if (score === Infinity) return '∞';
      if (!isFinite(score)) return '—';
      return score.toFixed(2);
    }

    function ivHeadwindCalculateScore(increase, decrease) {
      if (decrease === 0 && increase > 0) return Infinity;
      if (decrease === 0 && increase === 0) return NaN;
      return increase / decrease;
    }

    function ivHeadwindBuildSectorRows(rows) {
      var sectorMap = {};
      rows.forEach(function (row) {
        var industry = ivHeadwindGetField(row, ['Industry', 'industry']) || 'Unclassified';
        var change = ivHeadwindToNumber(ivHeadwindGetField(row, 'Change in promoter holding'));
        if (!isFinite(change) || change === 0) return;
        if (!sectorMap[industry]) sectorMap[industry] = { industry: industry, increase: 0, decrease: 0, score: NaN };
        if (change > 0) sectorMap[industry].increase += 1;
        if (change < 0) sectorMap[industry].decrease += 1;
      });
      return Object.keys(sectorMap).map(function (key) {
        var item = sectorMap[key];
        item.score = ivHeadwindCalculateScore(item.increase, item.decrease);
        return item;
      });
    }

    function ivHeadwindRenderSectorTable(body, rows) {
      if (!body) return;
      if (!rows.length) {
        body.innerHTML = '<tr><td colspan="4">No sector data available.</td></tr>';
        return;
      }
      body.innerHTML = rows.map(function (row) {
        return '<tr>' +
          '<td>' + row.industry + '</td>' +
          '<td>' + row.increase + '</td>' +
          '<td>' + row.decrease + '</td>' +
          '<td>' + ivHeadwindFormatScore(row.score) + '</td>' +
          '</tr>';
      }).join('');
    }

    function ivHeadwindDrawHistoryChart(elements, history) {
      var canvasData = ivSetupCanvas(elements.historyChart);
      if (!canvasData || !history || !history.length) return;
      var ctx = canvasData.ctx, width = canvasData.width, height = canvasData.height;
      ctx.clearRect(0, 0, width, height);

      var padL = width < 420 ? 42 : 56;
      var padR = 16;
      var padT = 18;
      var padB = 38;
      var plotW = width - padL - padR;
      var plotH = height - padT - padB;
      var scores = history.map(function (item) { return item.score; }).filter(function (value) { return isFinite(value); });
      var maxScore = Math.max.apply(null, scores.concat([1])) * 1.18;
      var minScore = Math.min.apply(null, scores.concat([1, 0]));
      if (maxScore <= minScore) maxScore = minScore + 1;

      function xAt(index) { return padL + (history.length === 1 ? 0 : index * plotW / (history.length - 1)); }
      function yAt(value) { return padT + plotH - ((value - minScore) / (maxScore - minScore)) * plotH; }

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(203,213,232,0.72)';
      ctx.font = '10px Inter, Arial';
      for (var g = 0; g <= 4; g++) {
        var y = padT + plotH * g / 4;
        var val = maxScore - (maxScore - minScore) * g / 4;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(width - padR, y);
        ctx.stroke();
        ctx.fillText(val.toFixed(1), 8, y + 3);
      }

      var referenceY = yAt(1);
      ctx.strokeStyle = 'rgba(244, 214, 118, 0.55)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padL, referenceY);
      ctx.lineTo(width - padR, referenceY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#F4D676';
      ctx.fillText('1.0', width - padR - 22, referenceY - 6);

      ctx.beginPath();
      history.forEach(function (point, index) {
        var x = xAt(index), y = yAt(point.score);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      history.forEach(function (point, index) {
        var x = xAt(index), y = yAt(point.score);
        ctx.fillStyle = '#D4AF37';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        if (index === 0 || index === history.length - 1 || index % 2 === 0) {
          ctx.fillStyle = 'rgba(203,213,232,0.82)';
          ctx.fillText(point.month, x - 14, height - 14);
        }
      });
    }

    function ivRenderHeadwindTable(data) {
      var tbody = app.querySelector('#ivHeadwindTableBody');
      if (!tbody) return;

      var market = data.market;
      var sectors = data.sectorBreakdown || [];

      // ── helpers ──────────────────────────────────────────────────────────────
      // New formula: score = (inc − dec) / total  →  range [−1, +1], neutral = 0
      // Positive = Tailwind (green), Negative = Headwind (red), 0 = Neutral (gold)

      function colorFor(signal) {
        if (signal === 'Tailwind') return '#34D399';   // green
        if (signal === 'Headwind') return '#F87171';   // red
        return '#F4D676';                               // gold / neutral
      }

      function badgeHtml(signal) {
        if (signal === 'Tailwind')
          return '<span class="iv-hw-badge tailwind">▲ Tailwind</span>';
        if (signal === 'Headwind')
          return '<span class="iv-hw-badge headwind">▼ Headwind</span>';
        return '<span class="iv-hw-badge neutral">● Neutral</span>';
      }

      function barHtml(s) {
        // score lives in [−1, +1].
        // We split the bar at the centre:
        //   positive score → green bar grows rightward from centre
        //   negative score → red bar grows leftward from centre
        // The bar track is split 50/50 with a centre divider.

        var score = (s.score !== null && s.score !== undefined) ? s.score : 0;
        // Cap at ±1 just in case of floating-point edge cases
        var clamped = Math.max(-1, Math.min(1, score));
        var pct = Math.abs(clamped) * 50;   // max 50% of track width per side
        var color = colorFor(s.signal);
        var label = (s.scoreDisplay !== undefined && s.scoreDisplay !== null)
          ? s.scoreDisplay : '—';
        // Show +/− prefix for clarity
        if (s.score !== null && isFinite(s.score) && s.score > 0) label = '+' + label;

        // Two-sided bar: negative side (left) | centre | positive side (right)
        if (clamped >= 0) {
          // Tailwind — bar grows right from centre
          return '<div class="iv-hw-bar-wrap">' +
            '<div class="iv-hw-bar-bg" style="display:flex;align-items:center;">' +
            '<div style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:99px 0 0 99px;overflow:hidden;">' +
            '<div style="height:100%;width:0%;background:transparent"></div>' +
            '</div>' +
            '<div style="width:2px;height:10px;background:rgba(255,255,255,0.25);flex-shrink:0;"></div>' +
            '<div style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:0 99px 99px 0;overflow:hidden;">' +
            '<div style="height:100%;width:' + (pct * 2).toFixed(1) + '%;background:' + color + ';border-radius:0 99px 99px 0;"></div>' +
            '</div>' +
            '</div>' +
            '<span class="iv-hw-score-val" style="color:' + color + '">' + label + '</span>' +
            '</div>';
        } else {
          // Headwind — bar grows left from centre
          return '<div class="iv-hw-bar-wrap">' +
            '<div class="iv-hw-bar-bg" style="display:flex;align-items:center;">' +
            '<div style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:99px 0 0 99px;overflow:hidden;direction:rtl;">' +
            '<div style="height:100%;width:' + (pct * 2).toFixed(1) + '%;background:' + color + ';border-radius:99px 0 0 99px;"></div>' +
            '</div>' +
            '<div style="width:2px;height:10px;background:rgba(255,255,255,0.25);flex-shrink:0;"></div>' +
            '<div style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:0 99px 99px 0;overflow:hidden;">' +
            '<div style="height:100%;width:0%;background:transparent"></div>' +
            '</div>' +
            '</div>' +
            '<span class="iv-hw-score-val" style="color:' + color + '">' + label + '</span>' +
            '</div>';
        }
      }

      // ── render ────────────────────────────────────────────────────────────────
      var mVal = { score: market.score, signal: market.signal, scoreDisplay: market.scoreDisplay };

      var html = '<tr class="market-row" style="cursor:pointer;" title="Click to view history">' +
        '<td>🌐 Full Market</td>' +
        '<td class="right">' + barHtml(mVal) + '</td>' +
        '<td class="center">' + badgeHtml(market.signal) + '</td>' +
        '</tr>';

      if (!sectors.length) {
        html += '<tr><td colspan="3" style="color:#AAB6CC;text-align:center;padding:20px">No sector data available.</td></tr>';
      } else {
        html += sectors.map(function (s) {
          return '<tr class="iv-hw-sector-row" data-industry="' + s.industry + '" style="cursor:pointer;" title="Click to view companies in ranking tool">' +
            '<td>' + s.industry + ' <span style="font-size:10px;color:#AAB6CC;margin-left:4px;">↗</span></td>' +
            '<td class="right">' + barHtml(s) + '</td>' +
            '<td class="center">' + badgeHtml(s.signal) + '</td>' +
            '</tr>';
        }).join('');
      }

      tbody.innerHTML = html;
    }

    function ivBindHeadwindTailwind() {
      var tbody = app.querySelector('#ivHeadwindTableBody');
      if (!tbody) return;

      tbody.innerHTML = '<tr><td colspan="3" style="color:#AAB6CC;text-align:center;padding:24px">Loading…</td></tr>';

      fetch(baseUrl + '/headwind-tailwind', { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('API error ' + res.status);
          return res.json();
        })
        .then(function (data) {
          ivRenderHeadwindTable(data);
          ivBindHeadwindMarketClick(data.market.score);  // ← this line must be here
        })
        .catch(function (err) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="3" style="color:#F87171;text-align:center;padding:24px">Failed to load data: ' + err.message + '</td></tr>';
        });
    }
    function ivBindHeadwindMarketClick(currentScore) {
      var marketRow = app.querySelector('#ivHeadwindTableBody .market-row');
      if (!marketRow) return;

      var newRow = marketRow.cloneNode(true);
      marketRow.parentNode.replaceChild(newRow, marketRow);
      newRow.style.cursor = 'pointer';

      newRow.addEventListener('click', function () {
        var existing = app.querySelector('#ivHeadwindChartRow');
        if (existing) { existing.remove(); return; }

        var chartRow = document.createElement('tr');
        chartRow.id = 'ivHeadwindChartRow';
        chartRow.innerHTML = '<td colspan="3" style="padding:16px 10px;">' +
          '<div style="position:relative;">' +
          '<canvas id="ivHeadwindHistoryCanvas" style="width:100%;height:220px;display:block;border-radius:14px;background:rgba(6,17,36,0.38);border:1px solid rgba(255,255,255,0.07);"></canvas>' +
          '<div id="ivHeadwindChartTooltip" style="position:fixed;display:none;pointer-events:none;z-index:80;padding:9px 10px;border-radius:12px;background:rgba(6,17,36,0.96);border:1px solid rgba(212,175,55,0.28);color:#fff;font-size:11px;line-height:1.5;"></div>' +
          '</div>' +
          '<div style="display:flex;gap:8px 12px;flex-wrap:wrap;margin-top:8px;font-size:11px;color:#CBD5E8;">' +
          '<span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#D4AF37;margin-right:5px;"></i>Historical Score</span>' +
          '<span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#4C8DFF;margin-right:5px;"></i>Current Score</span>' +
          '<span><i style="display:inline-block;width:22px;height:2px;background:rgba(255,255,255,0.3);margin-right:5px;vertical-align:middle;"></i>Neutral (1.0)</span>' +
          '</div>' +
          '</td>';

        newRow.after(chartRow);

        fetch(baseUrl + '/headwind-history', { cache: 'no-store' })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            ivDrawHeadwindHistoryChart(data.data, currentScore);
          })
          .catch(function (err) {
            var canvas = app.querySelector('#ivHeadwindHistoryCanvas');
            if (canvas) {
              canvas.insertAdjacentHTML('afterend',
                '<div style="color:#F87171;font-size:12px;margin-top:8px;">Failed to load history: ' + err.message + '</div>'
              );
            }
          });
      });
      // Sector row click → redirect to ranking tool with industry filter query parameter
      var sectorRows = app.querySelectorAll('.iv-hw-sector-row');
      sectorRows.forEach(function (row) {
        row.addEventListener('click', function () {
          var industry = row.getAttribute('data-industry');
          if (!industry) return;

          var isFile = window.location.protocol === 'file:';
          var targetUrl = isFile ? 'ranking-tool.html' : '/ranking-tool';
          targetUrl += '?industry=' + encodeURIComponent(industry);
          window.location.href = targetUrl;
        });
      });
    }

    function ivDrawHeadwindHistoryChart(historyRows, currentScore) {
      var canvas = app.querySelector('#ivHeadwindHistoryCanvas');
      if (!canvas) return;

      var rect = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      var width = Math.max(240, Math.floor(rect.width));
      var height = 220;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var points = [];
      historyRows.forEach(function (row) {
        var keys = Object.keys(row);
        var dateStr = row[keys[0]] || '';
        var scoreRaw = row[keys[3]];
        var score = parseFloat(scoreRaw);
        if (dateStr && isFinite(score)) {
          points.push({ label: dateStr, score: score });
        }
      });

      points.push({ label: 'Current', score: currentScore, isCurrent: true });

      if (points.length < 2) return;

      var padL = 52, padR = 20, padT = 20, padB = 44;
      var plotW = width - padL - padR;
      var plotH = height - padT - padB;

      var allScores = points.map(function (p) { return p.score; });
      var minScore = Math.min.apply(null, allScores.concat([0.8]));
      var maxScore = Math.max.apply(null, allScores.concat([1.2]));
      var pad = (maxScore - minScore) * 0.15 || 0.1;
      minScore -= pad;
      maxScore += pad;

      function xAt(i) { return padL + (i / (points.length - 1)) * plotW; }
      function yAt(v) { return padT + plotH - ((v - minScore) / (maxScore - minScore)) * plotH; }

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(203,213,232,0.7)';
      ctx.font = '10px Inter, Arial';
      for (var g = 0; g <= 4; g++) {
        var gv = minScore + (maxScore - minScore) * (1 - g / 4);
        var gy = padT + plotH * g / 4;
        ctx.beginPath();
        ctx.moveTo(padL, gy);
        ctx.lineTo(width - padR, gy);
        ctx.stroke();
        ctx.fillText(gv.toFixed(2), 4, gy + 3);
      }

      // about line
      var zeroY = yAt(1);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padL, zeroY);
      ctx.lineTo(width - padR, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('1.0', padL - 22, zeroY + 3);

      // Line
      ctx.beginPath();
      points.forEach(function (p, i) {
        var x = xAt(i), y = yAt(p.score);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          var px = xAt(i - 1), py = yAt(points[i - 1].score);
          var mx = (px + x) / 2;
          ctx.bezierCurveTo(mx, py, mx, y, x, y);
        }
      });
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Dots
      points.forEach(function (p, i) {
        var x = xAt(i), y = yAt(p.score);
        ctx.beginPath();
        ctx.arc(x, y, p.isCurrent ? 6 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = p.isCurrent ? '#4C8DFF' : '#D4AF37';
        ctx.fill();
        if (p.isCurrent) {
          ctx.strokeStyle = 'rgba(76,141,255,0.4)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // X labels
      var step = Math.max(1, Math.ceil(points.length / 8));
      ctx.fillStyle = 'rgba(203,213,232,0.75)';
      ctx.font = '9px Inter, Arial';
      points.forEach(function (p, i) {
        if (i === 0 || i === points.length - 1 || i % step === 0) {
          var x = xAt(i);
          var lbl = p.label;
          ctx.save();
          ctx.translate(x, height - 10);
          ctx.rotate(-0.5);
          ctx.fillText(lbl, -16, 0);
          ctx.restore();
        }
      });

      // Tooltip
      canvas._ivHwPoints = points.map(function (p, i) {
        return { x: xAt(i), score: p.score, label: p.label, isCurrent: p.isCurrent };
      });

      canvas.onmousemove = function (e) {
        var tooltip = app.querySelector('#ivHeadwindChartTooltip');
        if (!tooltip || !canvas._ivHwPoints) return;
        var cr = canvas.getBoundingClientRect();
        var mx = e.clientX - cr.left;
        var closest = null;
        canvas._ivHwPoints.forEach(function (p) {
          if (!closest || Math.abs(p.x - mx) < Math.abs(closest.x - mx)) closest = p;
        });
        if (!closest) return;
        var scoreColor = closest.score > 0 ? '#34D399' : closest.score < 0 ? '#F87171' : '#F4D676';
        tooltip.innerHTML = '<b>' + closest.label + '</b><br>Score: <span style="color:' + scoreColor + '">' +
          (closest.score > 0 ? '+' : '') + closest.score.toFixed(4) + '</span>' +
          (closest.isCurrent ? '<br><span style="color:#4C8DFF">● Current</span>' : '');
        tooltip.style.display = 'block';
        var tooltipRect = tooltip.getBoundingClientRect();
        var ttW = tooltipRect.width || 120;
        var ttH = tooltipRect.height || 48;
        var tx = Math.max(10, Math.min(e.clientX - ttW / 2, window.innerWidth - ttW - 10));
        var ty = e.clientY - ttH - 24;
        if (ty < 10) {
          ty = e.clientY + 20;
        }

        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
      };

      canvas.onmouseleave = function () {
        var tooltip = app.querySelector('#ivHeadwindChartTooltip');
        if (tooltip) tooltip.style.display = 'none';
      };
    }



    var ivTurnaroundState = window.ivTurnaroundState || { rows: [], lastSignature: '', pollMs: 60000, timer: null, page: 1, pageSize: 10, selectedSectorKey: '' };
    window.ivTurnaroundState = ivTurnaroundState;


  document.addEventListener('DOMContentLoaded', function () {
    ivBindHeadwindTailwind();
  });
})();
