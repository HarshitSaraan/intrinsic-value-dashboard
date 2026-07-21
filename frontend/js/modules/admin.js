(function () {
  var app = document.querySelector('.iv-admin-page');
  if (!app) app = document.body;

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';
  var loginEndpoint = baseUrl + '/admin/login';
  var uploadEndpoint = baseUrl + '/admin/upload-csv';
  var statsEndpoint = baseUrl + '/admin/traffic/stats';
  var liveEndpoint = baseUrl + '/admin/traffic/live';

  var SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes of inactivity in milliseconds
  var livePollInterval = null;

  // Check if session has expired
  function checkSessionTimeout() {
    var token = sessionStorage.getItem('admin_token');
    if (!token) return;

    var lastActivity = sessionStorage.getItem('admin_last_activity');
    if (!lastActivity) {
      resetInactivityTimer();
      return;
    }

    var elapsed = Date.now() - parseInt(lastActivity, 10);
    if (elapsed > SESSION_TIMEOUT) {
      logoutAdmin(true);
    }
  }

  // Reset inactivity timer on activity
  function resetInactivityTimer() {
    var token = sessionStorage.getItem('admin_token');
    if (token) {
      sessionStorage.setItem('admin_last_activity', Date.now().toString());
    }
  }

  // Clear session and update UI
  function logoutAdmin(isExpired) {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_last_activity');
    if (livePollInterval) clearInterval(livePollInterval);
    
    // Reset status bars and file inputs
    var types = ['stock_master', 'sector_data', 'headwind_tailwind_history'];
    types.forEach(function (type) {
      resetCardUI(type);
    });
    
    updateAuthState();

    if (isExpired) {
      var errBox = app.querySelector('#loginErrorMessage');
      if (errBox) {
        errBox.textContent = 'Session expired due to inactivity. Please log in again.';
        errBox.style.display = 'block';
        // Style as a subtle alert
        errBox.style.borderColor = 'rgba(var(--iv-accent-rgb), 0.2)';
        errBox.style.background = 'rgba(var(--iv-accent-rgb), 0.08)';
        errBox.style.color = 'var(--iv-text)';
      }
    }
  }

  // Toggle visible sections depending on auth state
  function updateAuthState() {
    var token = sessionStorage.getItem('admin_token');
    var loginSection = app.querySelector('#adminLoginSection');
    var dashSection = app.querySelector('#adminDashboardSection');
    
    if (token === 'admin-session-token') {
      if (loginSection) loginSection.style.display = 'none';
      if (dashSection) dashSection.style.display = 'block';
      loadTrafficStats(30);
      startLivePolling();
    } else {
      if (loginSection) loginSection.style.display = 'block';
      if (dashSection) dashSection.style.display = 'none';
      if (livePollInterval) clearInterval(livePollInterval);
    }
  }

  // Bind Login Form submits
  function bindLoginEvents() {
    var form = app.querySelector('#adminLoginForm');
    var errBox = app.querySelector('#loginErrorMessage');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (errBox) errBox.style.display = 'none';

      var user = app.querySelector('#adminUsername').value.trim();
      var pass = app.querySelector('#adminPassword').value.trim();

      fetch(loginEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (err) {
            throw new Error(err.detail || 'Access denied');
          });
        }
        return res.json();
      })
      .then(function (data) {
        sessionStorage.setItem('admin_token', data.token);
        resetInactivityTimer();
        updateAuthState();
        // Clear login fields
        app.querySelector('#adminUsername').value = '';
        app.querySelector('#adminPassword').value = '';
      })
      .catch(function (err) {
        console.error('Login error:', err);
        if (errBox) {
          errBox.textContent = err.message || 'Incorrect username or password';
          errBox.style.display = 'block';
          // Restore default error style
          errBox.style.borderColor = '';
          errBox.style.background = '';
          errBox.style.color = '';
        }
      });
    });
  }

  // Bind Logout Button clicks
  function bindLogoutEvents() {
    var logoutBtn = app.querySelector('#adminLogoutButton');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', function () {
      logoutAdmin(false);
    });
  }

  // Helper to reset card selectors and status bars
  function resetCardUI(type) {
    var card = app.querySelector('#card-' + type);
    if (!card) return;
    
    var fileInput = card.querySelector('#file-' + type);
    if (fileInput) fileInput.value = '';

    var promptText = card.querySelector('.zone-prompt');
    if (promptText) promptText.textContent = 'Drag & drop or click to choose file';
    
    var nameText = card.querySelector('.iv-admin-file-name');
    if (nameText) {
      nameText.textContent = '';
      nameText.style.display = 'none';
    }

    var uploadBtn = card.querySelector('#btn-' + type);
    if (uploadBtn) uploadBtn.disabled = true;

    var statusBar = card.querySelector('#status-' + type);
    if (statusBar) {
      statusBar.textContent = '';
      statusBar.className = 'iv-admin-status-bar';
    }
  }

  // Bind Upload inputs and buttons for all three files
  function bindUploadEvents() {
    var fileTypes = ['stock_master', 'sector_data', 'headwind_tailwind_history'];

    fileTypes.forEach(function (type) {
      var card = app.querySelector('#card-' + type);
      if (!card) return;

      var fileInput = card.querySelector('#file-' + type);
      var uploadBtn = card.querySelector('#btn-' + type);
      var statusBar = card.querySelector('#status-' + type);
      var promptText = card.querySelector('.zone-prompt');
      var nameText = card.querySelector('.iv-admin-file-name');

      if (!fileInput || !uploadBtn) return;

      // When file is selected
      fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        if (file) {
          if (promptText) promptText.textContent = 'Selected File:';
          if (nameText) {
            nameText.textContent = file.name;
            nameText.style.display = 'block';
          }
          uploadBtn.disabled = false;
          if (statusBar) {
            statusBar.textContent = 'File ready to upload';
            statusBar.className = 'iv-admin-status-bar';
          }
        } else {
          resetCardUI(type);
        }
      });

      // Drag and drop events for the upload zone box
      var uploadZone = card.querySelector('.iv-admin-upload-zone');
      if (uploadZone) {
        ['dragenter', 'dragover'].forEach(function (eventName) {
          uploadZone.addEventListener(eventName, function (e) {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.style.borderColor = 'var(--iv-accent-light)';
            uploadZone.style.background = 'rgba(var(--iv-accent-rgb), 0.12)';
          }, false);
        });

        ['dragleave', 'drop'].forEach(function (eventName) {
          uploadZone.addEventListener(eventName, function (e) {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.style.borderColor = '';
            uploadZone.style.background = '';
          }, false);
        });

        uploadZone.addEventListener('drop', function (e) {
          var dt = e.dataTransfer;
          var files = dt.files;
          if (files && files.length > 0) {
            fileInput.files = files;
            var event = new Event('change');
            fileInput.dispatchEvent(event);
          }
        }, false);
      }

      // Click upload trigger
      uploadBtn.addEventListener('click', function () {
        var file = fileInput.files[0];
        if (!file) return;

        var token = sessionStorage.getItem('admin_token');
        if (!token) {
          updateAuthState();
          return;
        }

        var formData = new FormData();
        formData.append('file', file);
        formData.append('file_type', type);

        if (statusBar) {
          statusBar.textContent = 'Uploading files...';
          statusBar.className = 'iv-admin-status-bar';
        }
        uploadBtn.disabled = true;

        fetch(uploadEndpoint, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
          body: formData
        })
        .then(function (res) {
          if (!res.ok) {
            if (res.status === 401) {
              logoutAdmin(false);
              throw new Error('Unauthorized admin session. Please log in again.');
            }
            return res.json().then(function (err) {
              throw new Error(err.detail || 'Upload failed');
            });
          }
          return res.json();
        })
        .then(function (data) {
          if (statusBar) {
            statusBar.textContent = 'Success! File updated.';
            statusBar.className = 'iv-admin-status-bar iv-admin-status-success';
          }
          fileInput.value = '';
          if (promptText) promptText.textContent = 'Drag & drop or click to choose file';
          if (nameText) {
            nameText.textContent = '';
            nameText.style.display = 'none';
          }
          resetInactivityTimer(); // Reset inactivity timer on successful action
        })
        .catch(function (err) {
          console.error('Upload error:', err);
          if (statusBar) {
            statusBar.textContent = err.message || 'Error occurred during upload';
            statusBar.className = 'iv-admin-status-bar iv-admin-status-error';
          }
          uploadBtn.disabled = false;
        });
      });
    });
  }

  // Initial checks
  document.addEventListener('DOMContentLoaded', function () {
    checkSessionTimeout();
    updateAuthState();
    bindLoginEvents();
    bindLogoutEvents();
    bindUploadEvents();
    bindTabEvents();

    // Listen to user interactions for inactivity resets
    var activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(function (evt) {
      document.addEventListener(evt, resetInactivityTimer, { passive: true });
    });

    // Run background check every 10 seconds
    setInterval(checkSessionTimeout, 10000);
  });

  var lastLoadedStats = null;
  var currentDaysFilter = 30;

  // --- TRAFFIC ANALYTICS & TAB LOGIC ---
  function bindTabEvents() {
    var tabTraffic = app.querySelector('#tabBtnTraffic');
    var tabDatasets = app.querySelector('#tabBtnDatasets');
    var secTraffic = app.querySelector('#adminTrafficSection');
    var secDatasets = app.querySelector('#adminDatasetsSection');
    var tabTitle = app.querySelector('#adminTabTitle');
    var tabDesc = app.querySelector('#adminTabDesc');

    if (tabTraffic && tabDatasets) {
      tabTraffic.addEventListener('click', function () {
        tabTraffic.classList.add('active');
        tabDatasets.classList.remove('active');
        if (secTraffic) secTraffic.classList.add('active');
        if (secDatasets) secDatasets.classList.remove('active');
        if (tabTitle) tabTitle.textContent = 'Traffic Analytics & Live Pulse';
        if (tabDesc) tabDesc.textContent = 'Real-time visitor monitoring, iframe embed insights, and traffic analytics.';
      });

      tabDatasets.addEventListener('click', function () {
        tabDatasets.classList.add('active');
        tabTraffic.classList.remove('active');
        if (secDatasets) secDatasets.classList.add('active');
        if (secTraffic) secTraffic.classList.remove('active');
        if (tabTitle) tabTitle.textContent = 'Upload CSV Datasets';
        if (tabDesc) tabDesc.textContent = 'Overwrites the active datasets on disk to update calculations globally.';
      });
    }

    var rangeSelect = app.querySelector('#trafficRangeSelect');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', function () {
        var days = parseInt(rangeSelect.value, 10);
        if (isNaN(days)) days = 30;
        currentDaysFilter = days;
        loadTrafficStats(days);
      });
    }

    var refreshBtn = app.querySelector('#refreshTrafficBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        var rangeVal = app.querySelector('#trafficRangeSelect').value;
        var days = parseInt(rangeVal, 10);
        if (isNaN(days)) days = 30;
        currentDaysFilter = days;
        loadTrafficStats(days);
        pollLiveUsers();
      });
    }

    var downloadBtn = app.querySelector('#downloadStatsBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        if (!lastLoadedStats) {
          alert('No traffic stats loaded to download.');
          return;
        }
        downloadTrafficCSV(lastLoadedStats, currentDaysFilter);
      });
    }

    // Bind Pie Chart View Toggles
    bindCardToggle('#togglePagesViewBtn', '#topPagesTableContainer', '#topPagesPieContainer');
    bindCardToggle('#toggleEmbedsViewBtn', '#topEmbedsTableContainer', '#topEmbedsPieContainer');
    bindCardToggle('#toggleDevicesViewBtn', '#deviceBreakdownBox', '#devicePieContainer');

    // Bind Modal Close
    var modalClose = app.querySelector('#ivPieModalClose');
    var modalOverlay = app.querySelector('#ivPieOverlay');
    if (modalClose) modalClose.addEventListener('click', closePieModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closePieModal);
  }

  function bindCardToggle(btnId, containerA, containerB) {
    var btn = app.querySelector(btnId);
    var boxA = app.querySelector(containerA);
    var boxB = app.querySelector(containerB);

    if (!btn || !boxA || !boxB) return;

    btn.addEventListener('click', function () {
      var isShowingB = boxB.style.display !== 'none';
      if (isShowingB) {
        boxB.style.display = 'none';
        boxA.style.display = 'block';
        btn.querySelector('.btn-lbl').textContent = 'Pie Chart';
        btn.querySelector('.btn-icon').textContent = '📊';
      } else {
        boxA.style.display = 'none';
        boxB.style.display = 'flex';
        btn.querySelector('.btn-lbl').textContent = 'List View';
        btn.querySelector('.btn-icon').textContent = '📋';
      }
    });
  }

  function openPieModal(title, items) {
    var modal = app.querySelector('#ivPieModal');
    var modalTitle = app.querySelector('#ivPieModalTitle');
    var modalBody = app.querySelector('#ivPieModalBody');

    if (!modal || !modalBody) return;
    if (modalTitle) modalTitle.textContent = title;

    modalBody.innerHTML = '';
    renderPieChartSVG(items, modalBody, true);
    modal.style.display = 'flex';
  }

  function closePieModal() {
    var modal = app.querySelector('#ivPieModal');
    if (modal) modal.style.display = 'none';
  }

  function startLivePolling() {
    pollLiveUsers();
    if (livePollInterval) clearInterval(livePollInterval);
    livePollInterval = setInterval(pollLiveUsers, 5000);
  }

  function pollLiveUsers() {
    var token = sessionStorage.getItem('admin_token');
    if (!token) return;

    fetch(liveEndpoint, {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function (res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      var liveText = app.querySelector('#ivLiveCountText');
      if (liveText) {
        var count = data.total_live || 0;
        liveText.textContent = count + ' LIVE';
      }
    })
    .catch(function () {});
  }

  function loadTrafficStats(days) {
    var token = sessionStorage.getItem('admin_token');
    if (!token) return;

    fetch(statsEndpoint + '?days=' + days, {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function (res) {
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    })
    .then(function (data) {
      lastLoadedStats = data;
      renderTrafficDashboard(data, days);
    })
    .catch(function (err) {
      console.error('Traffic stats error:', err);
    });
  }

  function renderTrafficDashboard(data, days) {
    var periodData = data.selected_period || { views: 0, uniques: 0 };
    var labelMap = { 1: 'Today', 7: 'Last 7 Days', 30: 'Last 30 Days', 90: 'Last 3 Months', 365: 'Last 1 Year', 0: 'All Time' };
    var periodLabel = labelMap[days] || (days + ' Days');

    // Update KPI Cards
    var elUniques = app.querySelector('#kpiUniqueVisitors');
    var elViews = app.querySelector('#kpiTotalViews');
    var elUniqueSub = app.querySelector('#kpiUniqueSub');
    var elViewsSub = app.querySelector('#kpiViewsSub');
    var elTopEmbed = app.querySelector('#kpiTopEmbed');
    var elTopTool = app.querySelector('#kpiTopTool');

    if (elUniques) elUniques.textContent = Number(periodData.uniques || 0).toLocaleString();
    if (elViews) elViews.textContent = Number(periodData.views || 0).toLocaleString();
    if (elUniqueSub) elUniqueSub.textContent = periodLabel;
    if (elViewsSub) elViewsSub.textContent = periodLabel;

    var topEmbedHost = (data.top_embeds && data.top_embeds.length > 0) ? data.top_embeds[0].host : 'Direct / Main Site';
    if (elTopEmbed) elTopEmbed.textContent = topEmbedHost;

    var topToolName = (data.top_pages && data.top_pages.length > 0) ? data.top_pages[0].page : 'dashboard.html';
    if (elTopTool) elTopTool.textContent = topToolName;

    // Render SVG Chart
    renderTrafficChart(data.daily_trends || []);

    // Render Top Pages Table
    var pagesTbody = app.querySelector('#topPagesTableBody');
    if (pagesTbody) {
      var pages = data.top_pages || [];
      if (pages.length === 0) {
        pagesTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--iv-text-muted);">No traffic recorded yet</td></tr>';
      } else {
        pagesTbody.innerHTML = pages.map(function (p) {
          return '<tr><td><code>' + escapeHtml(p.page) + '</code></td><td><strong>' + p.views + '</strong></td><td>' + p.uniques + '</td></tr>';
        }).join('');
      }
    }

    // Render Top Embed Hosts Table
    var embedsTbody = app.querySelector('#topEmbedsTableBody');
    if (embedsTbody) {
      var embeds = data.top_embeds || [];
      if (embeds.length === 0) {
        embedsTbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color: var(--iv-text-muted);">No external iframe hosts yet</td></tr>';
      } else {
        embedsTbody.innerHTML = embeds.map(function (e) {
          return '<tr><td><code>' + escapeHtml(e.host) + '</code></td><td><strong>' + e.views + '</strong></td></tr>';
        }).join('');
      }
    }

    // Render Device Breakdown
    var devs = data.devices || { Desktop: 0, Mobile: 0, Tablet: 0 };
    setDeviceBar('Desktop', devs.Desktop || 0);
    setDeviceBar('Mobile', devs.Mobile || 0);
    setDeviceBar('Tablet', devs.Tablet || 0);

    // Render Pie Charts for all 3 breakdown cards
    var COLOR_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#a855f7'];

    // 1. Pages Pie Chart
    var pagesItems = (data.top_pages || []).map(function (p, idx) {
      return { label: p.page, value: p.views, color: COLOR_PALETTE[idx % COLOR_PALETTE.length] };
    });
    renderPieChartSVG(pagesItems, app.querySelector('#topPagesPieContainer'));

    // 2. Embed Hosts Pie Chart
    var embedsItems = (data.top_embeds || []).map(function (e, idx) {
      return { label: e.host, value: e.views, color: COLOR_PALETTE[idx % COLOR_PALETTE.length] };
    });
    renderPieChartSVG(embedsItems, app.querySelector('#topEmbedsPieContainer'));

    // 3. Devices Pie Chart
    var deviceItems = [
      { label: 'Desktop', value: devs.Desktop || 0, color: '#3b82f6' },
      { label: 'Mobile', value: devs.Mobile || 0, color: '#10b981' },
      { label: 'Tablet', value: devs.Tablet || 0, color: '#a855f7' }
    ].filter(function (d) { return d.value > 0; });
    renderPieChartSVG(deviceItems, app.querySelector('#devicePieContainer'));
  }

  function setDeviceBar(type, val) {
    var pctEl = app.querySelector('#pct' + type);
    var barEl = app.querySelector('#bar' + type);
    if (pctEl) pctEl.textContent = val + '%';
    if (barEl) barEl.style.width = val + '%';
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Render SVG Line Chart for daily trends
  function renderTrafficChart(trends) {
    var container = app.querySelector('#trafficChartContainer');
    if (!container) return;

    if (!trends || trends.length === 0) {
      container.innerHTML = '<div class="iv-chart-placeholder">No traffic trend data yet</div>';
      return;
    }

    var w = container.clientWidth || 700;
    var h = 240;
    var padding = { top: 20, right: 20, bottom: 40, left: 40 };

    var maxViews = Math.max.apply(null, trends.map(function (t) { return t.views; }).concat([10]));
    var maxVal = Math.ceil(maxViews * 1.15);

    var pointsViews = [];
    var pointsUniques = [];

    var stepX = (w - padding.left - padding.right) / Math.max(1, trends.length - 1);

    trends.forEach(function (t, i) {
      var x = padding.left + i * stepX;
      var yViews = h - padding.bottom - ((t.views / maxVal) * (h - padding.top - padding.bottom));
      var yUniques = h - padding.bottom - ((t.uniques / maxVal) * (h - padding.top - padding.bottom));

      pointsViews.push(x.toFixed(1) + ',' + yViews.toFixed(1));
      pointsUniques.push(x.toFixed(1) + ',' + yUniques.toFixed(1));
    });

    var svgHtml = '<svg width="100%" height="100%" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">';

    // Horizontal Grid Lines
    for (var g = 0; g <= 4; g++) {
      var gy = padding.top + (g * (h - padding.top - padding.bottom) / 4);
      var gVal = Math.round(maxVal - (g * maxVal / 4));
      svgHtml += '<line x1="' + padding.left + '" y1="' + gy + '" x2="' + (w - padding.right) + '" y2="' + gy + '" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4"/>';
      svgHtml += '<text x="' + (padding.left - 8) + '" y="' + (gy + 4) + '" fill="var(--iv-text-muted)" font-size="10" text-anchor="end">' + gVal + '</text>';
    }

    // X Axis Labels
    var stepLabel = Math.max(1, Math.floor(trends.length / 7));
    trends.forEach(function (t, i) {
      if (i % stepLabel === 0 || i === trends.length - 1) {
        var lx = padding.left + i * stepX;
        svgHtml += '<text x="' + lx + '" y="' + (h - 10) + '" fill="var(--iv-text-muted)" font-size="10" text-anchor="middle">' + escapeHtml(t.label) + '</text>';
      }
    });

    // Draw Line 1: Page Views (Blue)
    svgHtml += '<polyline fill="none" stroke="#3b82f6" stroke-width="2.5" points="' + pointsViews.join(' ') + '"/>';

    // Draw Line 2: Unique Visitors (Green)
    svgHtml += '<polyline fill="none" stroke="#10b981" stroke-width="2.5" stroke-dasharray="3 3" points="' + pointsUniques.join(' ') + '"/>';

    // Draw Dots
    trends.forEach(function (t, i) {
      var pV = pointsViews[i].split(',');
      var pU = pointsUniques[i].split(',');
      svgHtml += '<circle cx="' + pV[0] + '" cy="' + pV[1] + '" r="3.5" fill="#3b82f6"><title>' + escapeHtml(t.label) + ': ' + t.views + ' Views</title></circle>';
      svgHtml += '<circle cx="' + pU[0] + '" cy="' + pU[1] + '" r="3" fill="#10b981"><title>' + escapeHtml(t.label) + ': ' + t.uniques + ' Uniques</title></circle>';
    });

    svgHtml += '</svg>';
    container.innerHTML = svgHtml;
  }

  function downloadTrafficCSV(stats, days) {
    var labelMap = { 1: 'Today', 7: 'Last 7 Days', 30: 'Last 30 Days', 90: 'Last 3 Months', 365: 'Last 1 Year', 0: 'All Time' };
    var label = labelMap[days] || (days + ' Days');
    var exportDate = new Date().toISOString().split('T')[0];

    var lines = [];
    lines.push('Intrinsic Value Traffic Analytics Report');
    lines.push('Export Date,' + exportDate);
    lines.push('Selected Time Period,' + label);
    lines.push('');

    // Summary KPIs
    var periodData = stats.selected_period || {};
    lines.push('--- SUMMARY KPIS ---');
    lines.push('Metric,Value');
    lines.push('Total Page Views,' + (periodData.views || 0));
    lines.push('Unique Visitors,' + (periodData.uniques || 0));
    lines.push('Top Embed Host,' + ((stats.top_embeds && stats.top_embeds.length > 0) ? '"' + stats.top_embeds[0].host + '"' : 'Direct / Main Site'));
    lines.push('Top Tool / Page,' + ((stats.top_pages && stats.top_pages.length > 0) ? '"' + stats.top_pages[0].page + '"' : 'None'));
    lines.push('');

    // Daily Trends
    lines.push('--- DAILY TRENDS ---');
    lines.push('Date,Page Views,Unique Visitors');
    var trends = stats.daily_trends || [];
    trends.forEach(function (t) {
      lines.push(t.date + ',' + t.views + ',' + t.uniques);
    });
    lines.push('');

    // Top Pages
    lines.push('--- TOP PAGES AND TOOLS ---');
    lines.push('Page / Tool,Views,Unique Visitors');
    var pages = stats.top_pages || [];
    pages.forEach(function (p) {
      lines.push('"' + (p.page || '') + '",' + p.views + ',' + p.uniques);
    });
    lines.push('');

    // Top Embed Hosts
    lines.push('--- TOP IFRAME EMBED HOSTS ---');
    lines.push('Host Domain,Views');
    var embeds = stats.top_embeds || [];
    embeds.forEach(function (e) {
      lines.push('"' + (e.host || '') + '",' + e.views);
    });
    lines.push('');

    // Devices
    lines.push('--- DEVICE BREAKDOWN ---');
    lines.push('Device Type,Percentage');
    var devs = stats.devices || {};
    lines.push('Desktop,' + (devs.Desktop || 0) + '%');
    lines.push('Mobile,' + (devs.Mobile || 0) + '%');
    lines.push('Tablet,' + (devs.Tablet || 0) + '%');

    var csvContent = lines.join('\n');
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);

    var link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'traffic_analytics_' + label.toLowerCase().replace(/\s+/g, '_') + '_' + exportDate + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function renderPieChartSVG(items, containerEl, isLarge) {
    if (!containerEl) return;
    if (!items || items.length === 0) {
      containerEl.innerHTML = '<div style="color:var(--iv-text-muted); font-size:12px; padding:20px; text-align:center;">No data recorded for this period</div>';
      return;
    }

    var total = items.reduce(function (sum, it) { return sum + (it.value || 0); }, 0);
    if (total === 0) {
      containerEl.innerHTML = '<div style="color:var(--iv-text-muted); font-size:12px; padding:20px; text-align:center;">No views recorded yet</div>';
      return;
    }

    var cx = isLarge ? 120 : 80;
    var cy = isLarge ? 110 : 75;
    var r = isLarge ? 85 : 55;
    var innerR = isLarge ? 45 : 30;
    var viewBoxWidth = isLarge ? 240 : 160;
    var viewBoxHeight = isLarge ? 220 : 150;

    var currentAngle = -Math.PI / 2;
    var pathsHtml = '';
    var legendHtml = '<div class="pie-legend">';

    items.forEach(function (it) {
      var val = it.value || 0;
      var pct = ((val / total) * 100).toFixed(1);
      var sliceAngle = (val / total) * (2 * Math.PI);
      var nextAngle = currentAngle + sliceAngle;

      if (items.length === 1) {
        // Full donut ring
        pathsHtml += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + it.color + '" class="pie-slice"><title>' + escapeHtml(it.label) + ': ' + val + ' (' + pct + '%)</title></circle>';
      } else if (sliceAngle > 0) {
        var x1 = cx + r * Math.cos(currentAngle);
        var y1 = cy + r * Math.sin(currentAngle);
        var x2 = cx + r * Math.cos(nextAngle);
        var y2 = cy + r * Math.sin(nextAngle);

        var ix1 = cx + innerR * Math.cos(nextAngle);
        var iy1 = cy + innerR * Math.sin(nextAngle);
        var ix2 = cx + innerR * Math.cos(currentAngle);
        var iy2 = cy + innerR * Math.sin(currentAngle);

        var largeArc = sliceAngle > Math.PI ? 1 : 0;

        var d = 'M ' + x1.toFixed(2) + ' ' + y1.toFixed(2) +
                ' A ' + r + ' ' + r + ' 0 ' + largeArc + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) +
                ' L ' + ix1.toFixed(2) + ' ' + iy1.toFixed(2) +
                ' A ' + innerR + ' ' + innerR + ' 0 ' + largeArc + ' 0 ' + ix2.toFixed(2) + ' ' + iy2.toFixed(2) +
                ' Z';

        pathsHtml += '<path d="' + d + '" fill="' + it.color + '" class="pie-slice"><title>' + escapeHtml(it.label) + ': ' + val + ' (' + pct + '%)</title></path>';
      }

      legendHtml += '<div class="pie-legend-item"><span class="pie-legend-dot" style="background:' + it.color + '"></span>' + escapeHtml(it.label) + ' <strong>' + pct + '%</strong></div>';
      currentAngle = nextAngle;
    });

    legendHtml += '</div>';

    var svgHtml = '<svg viewBox="0 0 ' + viewBoxWidth + ' ' + viewBoxHeight + '" class="pie-chart-svg">' + pathsHtml + '</svg>' + legendHtml;
    containerEl.innerHTML = svgHtml;
  }

})();
