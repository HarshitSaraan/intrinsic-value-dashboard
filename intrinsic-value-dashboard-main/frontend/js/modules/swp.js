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

  function validate(corpus, withdrawal, annualReturn, years, increase) {
    if (!corpus || corpus <= 0) return "Please enter a valid starting corpus greater than 0.";
    if (!withdrawal || withdrawal <= 0) return "Please enter a valid monthly withdrawal greater than 0.";
    if (!isFinite(annualReturn) || annualReturn < 0) return "Please enter a valid expected annual return. It cannot be negative.";
    if (!years || years <= 0 || years > 80 || Math.floor(years) !== years) return "Please enter a valid withdrawal period in whole years between 1 and 80.";
    if (!isFinite(increase) || increase < 0) return "Please enter a valid annual withdrawal increase. It cannot be negative.";
    return "";
  }

  function formatSwpLasts(months, requestedMonths, depleted) {
    if (!depleted && months >= requestedMonths) return Math.floor(requestedMonths / 12) + " years";
    var years = Math.floor(months / 12);
    var remMonths = months % 12;
    if (years <= 0) return remMonths + " months";
    if (remMonths <= 0) return years + " years";
    return years + " years " + remMonths + " months";
  }

  // SWP Calculator Version 1 logic preserved from legacy implementation.
  function calculateSwpData(corpus, withdrawal, annualReturn, years, increase) {
    var monthlyRate = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
    var currentCorpus = corpus;
    var monthlyWithdrawal = withdrawal;
    var totalWithdrawn = 0;
    var monthsCompleted = 0;
    var depleted = false;
    var rows = [];

    for (var year = 1; year <= years; year++) {
      if (currentCorpus <= 0) break;
      var openingCorpus = currentCorpus;
      var yearWithdrawal = 0;
      var yearGrowth = 0;

      for (var month = 1; month <= 12; month++) {
        if (currentCorpus <= 0) {
          depleted = true;
          break;
        }

        var actualWithdrawal = Math.min(monthlyWithdrawal, currentCorpus);
        currentCorpus -= actualWithdrawal;
        totalWithdrawn += actualWithdrawal;
        yearWithdrawal += actualWithdrawal;

        if (actualWithdrawal < monthlyWithdrawal || currentCorpus <= 0) {
          currentCorpus = 0;
          monthsCompleted += 1;
          depleted = true;
          break;
        }

        var growth = currentCorpus * monthlyRate;
        currentCorpus += growth;
        yearGrowth += growth;
        monthsCompleted += 1;
      }

      rows.push({
        year: year,
        opening: openingCorpus,
        withdrawal: yearWithdrawal,
        growth: yearGrowth,
        closing: currentCorpus,
      });

      if (depleted) break;
      monthlyWithdrawal = monthlyWithdrawal * (1 + increase / 100);
    }

    return {
      rows: rows,
      totalWithdrawn: totalWithdrawn,
      finalCorpus: currentCorpus,
      monthsCompleted: monthsCompleted,
      requestedMonths: years * 12,
      depleted: depleted,
    };
  }

  function drawLineChart(lineCanvas, rows) {
    var canvasData = setupCanvas(lineCanvas);
    if (!canvasData || !rows.length) return;
    var ctx = canvasData.ctx, width = canvasData.width, height = canvasData.height;
    ctx.clearRect(0, 0, width, height);
    var padL = width < 420 ? 44 : 58, padR = 14, padT = 18, padB = 36;
    var plotW = width - padL - padR, plotH = height - padT - padB;
    var maxValue = Math.max.apply(null, rows.map(function (r) { return Math.max(r.opening, r.closing); })) * 1.08;
    if (maxValue <= 0) maxValue = 1;
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

    ctx.beginPath();
    rows.forEach(function (row, index) {
      var x = xAt(index), y = yAt(row.closing);
      if (index === 0) ctx.moveTo(x, y);
      else {
        var prevX = xAt(index - 1), prevY = yAt(rows[index - 1].closing), midX = (prevX + x) / 2;
        ctx.bezierCurveTo(midX, prevY, midX, y, x, y);
      }
    });
    ctx.strokeStyle = "#D4AF37";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lineCanvas._ivSwpPoints = rows.map(function (row, index) {
      return { x: xAt(index), year: row.year, opening: row.opening, withdrawal: row.withdrawal, growth: row.growth, closing: row.closing };
    });
  }

  function drawBarChart(barCanvas, rows) {
    var canvasData = setupCanvas(barCanvas);
    if (!canvasData || !rows.length) return;
    var ctx = canvasData.ctx, width = canvasData.width, height = canvasData.height;
    ctx.clearRect(0, 0, width, height);
    var padL = width < 420 ? 44 : 58, padR = 14, padT = 18, padB = 36;
    var plotW = width - padL - padR, plotH = height - padT - padB;
    var maxValue = Math.max.apply(null, rows.map(function (r) { return Math.max(r.withdrawal, r.closing); })) * 1.08;
    if (maxValue <= 0) maxValue = 1;
    var visibleStep = Math.max(1, Math.ceil(rows.length / (width < 420 ? 8 : 14)));
    var visibleRows = rows.filter(function (row, index) { return index === 0 || index === rows.length - 1 || index % visibleStep === 0; });
    var gap = 6;
    var groupW = Math.max(14, (plotW - gap * (visibleRows.length - 1)) / visibleRows.length);
    var barW = Math.max(5, (groupW - 3) / 2);

    visibleRows.forEach(function (row, index) {
      var x = padL + index * (groupW + gap);
      var withdrawalH = (row.withdrawal / maxValue) * plotH;
      var corpusH = (row.closing / maxValue) * plotH;
      var baseY = padT + plotH;
      ctx.fillStyle = "#4C8DFF"; drawRoundedRect(ctx, x, baseY - withdrawalH, barW, withdrawalH, 4); ctx.fill();
      ctx.fillStyle = "#D4AF37"; drawRoundedRect(ctx, x + barW + 3, baseY - corpusH, barW, corpusH, 4); ctx.fill();
    });

    barCanvas._ivSwpBars = visibleRows.map(function (row, index) {
      return { x: padL + index * (groupW + gap), w: groupW, year: row.year, opening: row.opening, withdrawal: row.withdrawal, growth: row.growth, closing: row.closing };
    });
  }

  function bindTooltip(tooltip, canvas, mode) {
    if (!tooltip || !canvas) return;
    canvas.addEventListener("mousemove", function (event) {
      var rect = canvas.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var data = null;
      if (mode === "line" && canvas._ivSwpPoints) {
        canvas._ivSwpPoints.forEach(function (point) {
          if (!data || Math.abs(point.x - x) < Math.abs(data.x - x)) data = point;
        });
      } else if (mode === "bar" && canvas._ivSwpBars) {
        canvas._ivSwpBars.forEach(function (bar) { if (x >= bar.x && x <= bar.x + bar.w) data = bar; });
      }
      if (!data) { tooltip.style.display = "none"; return; }
      tooltip.innerHTML = "<b>Year " + data.year + "</b><br>Opening: " + formatINR(data.opening) + "<br>Withdrawal: " + formatINR(data.withdrawal) + "<br>Growth: " + formatINR(data.growth) + "<br>Closing: " + formatINR(data.closing);
      tooltip.style.display = "block";
      tooltip.style.left = Math.min(event.clientX + 12, window.innerWidth - 250) + "px";
      tooltip.style.top = Math.max(event.clientY - 18, 10) + "px";
    });
    canvas.addEventListener("mouseleave", function () { tooltip.style.display = "none"; });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var corpus = q("ivSwpCorpus"), withdrawal = q("ivSwpWithdrawal"), annualReturn = q("ivSwpReturn"), years = q("ivSwpYears"), increase = q("ivSwpIncrease");
    var calculate = q("ivSwpCalculate"), reset = q("ivSwpReset"), error = q("ivSwpError");
    var totalWithdrawn = q("ivSwpTotalWithdrawn"), finalCorpus = q("ivSwpFinalCorpus"), lasts = q("ivSwpLasts"), status = q("ivSwpStatus");
    var tableBody = q("ivSwpTableBody"), lineCanvas = q("ivSwpLineChart"), barCanvas = q("ivSwpBarChart"), tooltip = q("ivSwpTooltip");
    if (!calculate) return;

    function showError(message) { error.textContent = message; error.style.display = message ? "block" : "none"; }
    function resetView() {
      [corpus, withdrawal, annualReturn, years, increase].forEach(function (el) { if (el) el.value = ""; });
      showError("");
      totalWithdrawn.textContent = "—"; finalCorpus.textContent = "—"; lasts.textContent = "—"; status.textContent = "—";
      tableBody.innerHTML = "<tr><td colspan=\"5\">Enter SWP details and click Calculate SWP.</td></tr>";
      [lineCanvas, barCanvas].forEach(function (canvas) { var data = setupCanvas(canvas); if (data) data.ctx.clearRect(0, 0, data.width, data.height); });
      if (tooltip) tooltip.style.display = "none";
    }

    function runCalculation() {
      var corpusValue = Number(corpus && corpus.value);
      var withdrawalValue = Number(withdrawal && withdrawal.value);
      var annualReturnValue = Number(annualReturn && annualReturn.value);
      var yearsValue = Number(years && years.value);
      var increaseRaw = increase ? increase.value : "";
      var increaseValue = increaseRaw === "" ? 0 : Number(increaseRaw);
      var err = validate(corpusValue, withdrawalValue, annualReturnValue, yearsValue, increaseValue);
      if (err) { showError(err); return; }
      showError("");

      var result = calculateSwpData(corpusValue, withdrawalValue, annualReturnValue, yearsValue, increaseValue);
      totalWithdrawn.textContent = formatINR(result.totalWithdrawn);
      finalCorpus.textContent = formatINR(result.finalCorpus);
      lasts.textContent = formatSwpLasts(result.monthsCompleted, result.requestedMonths, result.depleted);
      status.textContent = result.depleted ? "Corpus depleted" : "Sustainable";

      tableBody.innerHTML = result.rows.map(function (row) {
        return "<tr><td>" + row.year + "</td><td>" + formatINR(row.opening) + "</td><td>" + formatINR(row.withdrawal) + "</td><td>" + formatINR(row.growth) + "</td><td>" + formatINR(row.closing) + "</td></tr>";
      }).join("");

      drawLineChart(lineCanvas, result.rows);
      drawBarChart(barCanvas, result.rows);
    }

    calculate.addEventListener("click", runCalculation);
    if (reset) reset.addEventListener("click", resetView);
    [corpus, withdrawal, annualReturn, years, increase].forEach(function (input) {
      if (input) input.addEventListener("keydown", function (event) { if (event.key === "Enter") runCalculation(); });
    });
    bindTooltip(tooltip, lineCanvas, "line");
    bindTooltip(tooltip, barCanvas, "bar");
  });
})();
