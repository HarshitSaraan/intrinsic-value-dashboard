(function () {
  var app = document.querySelector('.iv-admin-page');
  if (!app) app = document.body;

  var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';
  var loginEndpoint = baseUrl + '/admin/login';
  var uploadEndpoint = baseUrl + '/admin/upload-csv';

  var SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes of inactivity in milliseconds

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
    } else {
      if (loginSection) loginSection.style.display = 'block';
      if (dashSection) dashSection.style.display = 'none';
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

    // Listen to user interactions for inactivity resets
    var activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(function (evt) {
      document.addEventListener(evt, resetInactivityTimer, { passive: true });
    });

    // Run background check every 10 seconds
    setInterval(checkSessionTimeout, 10000);
  });
})();
