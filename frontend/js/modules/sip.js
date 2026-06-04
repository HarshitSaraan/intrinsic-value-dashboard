(function () {
  function q(id) {
    return document.getElementById(id);
  }

  function formatINR(value) {
    if (!isFinite(value)) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  }

  function formatCompactINR(value) {
    if (!isFinite(value)) return "—";
    var abs = Math.abs(value);
    if (abs >= 10000000) return "₹" + (value / 10000000).toFixed(value >= 100000000 ? 0 : 1) + " Cr";
    if (abs >= 100000) return "₹" + (value / 100000).toFixed(value >= 1000000 ? 0 : 1) + " L";
    return formatINR(value);
  }

  function setupCanvas(canvas) {
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var width = Math.max(280, Math.floor(rect.width));
    var height = Math.max(220, Math.floor(rect.height || 260));
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, width: width, height: height };
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
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

  function validateInputs(amount, cagr, years, stepup) {
    if (!amount || amount <= 0) return "Please enter a valid monthly SIP amount greater than 0.";
    if (!isFinite(cagr) || cagr < 0) return "Please enter a valid expected CAGR. It cannot be negative.";
    if (!years || years <= 0 || years > 60 || Math.floor(years) !== years) {
      return "Please enter a valid investment period in whole years between 1 and 60.";
    }
    if (!isFinite(stepup) || stepup < 0) return "Please enter a valid annual SIP step-up. It cannot be negative.";
    return "";
  }

  // SIP Calculator Version 1 formula preserved from legacy implementation.
  function calculateSipData(amount, cagr, years, stepup) {
    var monthlyRate = Math.pow(1 + cagr / 100, 1 / 12) - 1;
    var portfolioValue = 0;
    var totalInvested = 0;
    var annualSip = amount;
    var rows = [];

    for (var year = 1; year <= years; year++) {
      var investedThisYear = 0;
      for (var month = 1; month <= 12; month++) {
        portfolioValue = (portfolioValue + annualSip) * (1 + monthlyRate);
        totalInvested += annualSip;
        investedThisYear += annualSip;
      }
      rows.push({
        year: year,
        annualSip: investedThisYear,
        invested: totalInvested,
        value: portfolioValue,
        gain: portfolioValue - totalInvested,
        multiple: totalInvested > 0 ? portfolioValue / totalInvested : 0,
      });
      annualSip = annualSip * (1 + stepup / 100);
    }

    return rows;
  }

  function drawLineChart(lineCanvas, rows) {
    var canvasData = setupCanvas(lineCanvas);
    if (!canvasData || !rows.length) return;
    var ctx = canvasData.ctx, width = canvasData.width, height = canvasData.height;
    ctx.clearRect(0, 0, width, height);

    var padL = width < 420 ? 44 : 58, padR = 14, padT = 18, padB = 36;
    var plotW = width - padL - padR, plotH = height - padT - padB;
    var maxValue = Math.max.apply(null, rows.map(function (r) { return Math.max(r.invested, r.value); })) * 1.08;

    function xAt(index) { return padL + (rows.length === 1 ? 0 : index * plotW / (rows.length - 1)); }
    function yAt(value) { return padT + plotH - (value / maxValue) * plotH; }

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(203,213,232,0.72)";
    ctx.font = "10px Inter, Arial";
    for (var g = 0; g <= 4; g++) {
      var y = padT + (plotH * g / 4);
      var val = maxValue * (1 - g / 4);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(width - padR, y); ctx.stroke();
      ctx.fillText(formatCompactINR(val), 4, y + 3);
    }

    function drawSeries(key, color, widthLine) {
      ctx.beginPath();
      rows.forEach(function (row, index) {
        var x = xAt(index), y = yAt(row[key]);
        if (index === 0) ctx.moveTo(x, y);
        else {
          var prevX = xAt(index - 1), prevY = yAt(rows[index - 1][key]), midX = (prevX + x) / 2;
          ctx.bezierCurveTo(midX, prevY, midX, y, x, y);
        }
      });
      ctx.strokeStyle = color; ctx.lineWidth = widthLine; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    }

    drawSeries("invested", "#4C8DFF", 2.2);
    drawSeries("value", "#D4AF37", 3);

    lineCanvas._ivSipPoints = rows.map(function (row, index) {
      return { x: xAt(index), year: row.year, invested: row.invested, value: row.value, gain: row.gain, multiple: row.multiple };
    });
  }

  function drawStackedChart(stackedCanvas, rows) {
    var canvasData = setupCanvas(stackedCanvas);
    if (!canvasData || !rows.length) return;
    var ctx = canvasData.ctx, width = canvasData.width, height = canvasData.height;
    ctx.clearRect(0, 0, width, height);
    var padL = width < 420 ? 44 : 58, padR = 14, padT = 18, padB = 36;
    var plotW = width - padL - padR, plotH = height - padT - padB;
    var maxValue = Math.max.apply(null, rows.map(function (r) { return r.value; })) * 1.08;
    var visibleStep = Math.max(1, Math.ceil(rows.length / (width < 420 ? 8 : 14)));
    var visibleRows = rows.filter(function (row, index) { return index === 0 || index === rows.length - 1 || index % visibleStep === 0; });
    var gap = 6, barW = Math.max(8, (plotW - gap * (visibleRows.length - 1)) / visibleRows.length);

    visibleRows.forEach(function (row, index) {
      var x = padL + index * (barW + gap);
      var investedH = (row.invested / maxValue) * plotH;
      var gainH = (Math.max(row.gain, 0) / maxValue) * plotH;
      var baseY = padT + plotH;
      ctx.fillStyle = "#4C8DFF"; drawRoundedRect(ctx, x, baseY - investedH, barW, investedH, 5); ctx.fill();
      ctx.fillStyle = "#D4AF37"; drawRoundedRect(ctx, x, baseY - investedH - gainH, barW, gainH, 5); ctx.fill();
    });

    stackedCanvas._ivSipBars = visibleRows.map(function (row, index) {
      return { x: padL + index * (barW + gap), w: barW, year: row.year, invested: row.invested, gain: row.gain, value: row.value, multiple: row.multiple };
    });
  }

  function bindTooltip(tooltip, canvas, mode) {
    if (!tooltip || !canvas) return;
    canvas.addEventListener("mousemove", function (event) {
      var rect = canvas.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var data = null;
      if (mode === "line" && canvas._ivSipPoints) {
        canvas._ivSipPoints.forEach(function (point) {
          if (!data || Math.abs(point.x - x) < Math.abs(data.x - x)) data = point;
        });
      } else if (mode === "bar" && canvas._ivSipBars) {
        canvas._ivSipBars.forEach(function (bar) { if (x >= bar.x && x <= bar.x + bar.w) data = bar; });
      }
      if (!data) { tooltip.style.display = "none"; return; }
      tooltip.innerHTML = "<b>Year " + data.year + "</b><br>Invested: " + formatINR(data.invested) + "<br>Value: " + formatINR(data.value) + "<br>Gain: " + formatINR(data.gain) + "<br>Multiple: " + data.multiple.toFixed(2) + "x";
      tooltip.style.display = "block";
      tooltip.style.left = Math.min(event.clientX + 12, window.innerWidth - 230) + "px";
      tooltip.style.top = Math.max(event.clientY - 18, 10) + "px";
    });
    canvas.addEventListener("mouseleave", function () { tooltip.style.display = "none"; });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var amount = q("ivSipAmount"), cagr = q("ivSipCagr"), years = q("ivSipYears"), stepup = q("ivSipStepup");
    var amountSlider = q("ivSipAmountSlider"), cagrSlider = q("ivSipCagrSlider"), yearsSlider = q("ivSipYearsSlider"), stepupSlider = q("ivSipStepupSlider");
    var calculate = q("ivSipCalculate"), reset = q("ivSipReset"), error = q("ivSipError");
    var invested = q("ivSipInvested"), futureValue = q("ivSipFutureValue"), gain = q("ivSipGain"), multiple = q("ivSipMultiple");
    var tableBody = q("ivSipTableBody"), lineCanvas = q("ivSipLineChart"), stackedCanvas = q("ivSipStackedChart"), tooltip = q("ivSipTooltip");
    
    // Layout and reveal elements
    var layoutWrapper = q("ivSipLayoutWrapper");
    var summaryReveal = q("ivSipSummaryReveal");
    var chartsReveal = q("ivSipChartsReveal");
    var tableReveal = q("ivSipTableReveal");
    var tableCard = q("ivSipTableCard");

    if (!calculate) return;

    function showError(message) { error.textContent = message; error.style.display = message ? "block" : "none"; }

    function resetView() {
      if (amount && amountSlider) { amount.value = "20000"; amountSlider.value = "20000"; }
      if (cagr && cagrSlider) { cagr.value = "15"; cagrSlider.value = "15"; }
      if (years && yearsSlider) { years.value = "15"; yearsSlider.value = "15"; }
      if (stepup && stepupSlider) { stepup.value = "0"; stepupSlider.value = "0"; }
      
      showError("");
      invested.textContent = "—"; futureValue.textContent = "—"; gain.textContent = "—"; multiple.textContent = "—";
      tableBody.innerHTML = "<tr><td colspan=\"6\">Enter SIP details and click Calculate SIP.</td></tr>";
      [lineCanvas, stackedCanvas].forEach(function (canvas) { var data = setupCanvas(canvas); if (data) data.ctx.clearRect(0, 0, data.width, data.height); });
      if (tooltip) tooltip.style.display = "none";

      // Revert layout styles
      if (layoutWrapper) layoutWrapper.classList.remove("calculated");
      [summaryReveal, chartsReveal, tableReveal].forEach(function (el) {
        if (el) {
          el.classList.remove("show");
          el.style.display = "none";
        }
      });
      if (tableCard) tableCard.classList.add("collapsed");
    }

    function runCalculation() {
      var amountValue = Number(amount && amount.value);
      var cagrValue = Number(cagr && cagr.value);
      var yearsValue = Number(years && years.value);
      var stepRaw = stepup ? stepup.value : "";
      var stepValue = stepRaw === "" ? 0 : Number(stepRaw);
      var err = validateInputs(amountValue, cagrValue, yearsValue, stepValue);
      if (err) { showError(err); return; }
      showError("");
      
      var rows = calculateSipData(amountValue, cagrValue, yearsValue, stepValue);
      var last = rows[rows.length - 1];
      invested.textContent = formatINR(last.invested);
      futureValue.textContent = formatINR(last.value);
      gain.textContent = formatINR(last.gain);
      multiple.textContent = last.multiple.toFixed(2) + "x";
      tableBody.innerHTML = rows.map(function (row) {
        return "<tr><td>" + row.year + "</td><td>" + formatINR(row.annualSip) + "</td><td>" + formatINR(row.invested) + "</td><td>" + formatINR(row.value) + "</td><td>" + formatINR(row.gain) + "</td><td>" + row.multiple.toFixed(2) + "x</td></tr>";
      }).join("");

      // Adjust layout grid
      if (layoutWrapper) layoutWrapper.classList.add("calculated");

      // Show results containers so their width can be read by chart scripts
      if (summaryReveal) summaryReveal.style.display = "block";
      if (chartsReveal) chartsReveal.style.display = "block";
      if (tableReveal) tableReveal.style.display = "block";

      // Draw the charts using correct active widths
      drawLineChart(lineCanvas, rows);
      drawStackedChart(stackedCanvas, rows);

      // Trigger animations on next frame
      requestAnimationFrame(function () {
        [summaryReveal, chartsReveal, tableReveal].forEach(function (el) {
          if (el) el.classList.add("show");
        });
      });
    }

    // Set default values from sliders on load
    if (amount && amountSlider) amount.value = amountSlider.value;
    if (cagr && cagrSlider) cagr.value = cagrSlider.value;
    if (years && yearsSlider) years.value = yearsSlider.value;
    if (stepup && stepupSlider) stepup.value = stepupSlider.value;

    // Sync input box and slider changes
    function setupSync(inputEl, sliderEl) {
      if (!inputEl || !sliderEl) return;
      
      inputEl.addEventListener("input", function () {
        var val = Number(inputEl.value);
        var min = Number(sliderEl.min);
        var max = Number(sliderEl.max);
        if (isFinite(val) && val >= min && val <= max) {
          sliderEl.value = val;
        }
        // If already calculated, update results in real-time!
        if (layoutWrapper && layoutWrapper.classList.contains("calculated")) {
          runCalculation();
        }
      });

      sliderEl.addEventListener("input", function () {
        inputEl.value = sliderEl.value;
        // If already calculated, update results in real-time!
        if (layoutWrapper && layoutWrapper.classList.contains("calculated")) {
          runCalculation();
        }
      });
    }

    setupSync(amount, amountSlider);
    setupSync(cagr, cagrSlider);
    setupSync(years, yearsSlider);
    setupSync(stepup, stepupSlider);

    // Setup collapsible table toggle
    if (tableCard) {
      var tableHeader = tableCard.querySelector(".iv-collapse-header");
      if (tableHeader) {
        tableHeader.addEventListener("click", function () {
          tableCard.classList.toggle("collapsed");
        });
      }
    }

    calculate.addEventListener("click", runCalculation);
    if (reset) reset.addEventListener("click", resetView);
    [amount, cagr, years, stepup].forEach(function (input) {
      if (input) input.addEventListener("keydown", function (event) { if (event.key === "Enter") runCalculation(); });
    });
    bindTooltip(tooltip, lineCanvas, "line");
    bindTooltip(tooltip, stackedCanvas, "bar");
  });
})();
