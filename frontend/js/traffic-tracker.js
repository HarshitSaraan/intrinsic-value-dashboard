(function () {
  // Prevent duplicate tracker initialization
  if (window.__IV_TRACKER_INITIALIZED__) return;
  window.__IV_TRACKER_INITIALIZED__ = true;

  var API_ENDPOINT = (function () {
    if (window.location.protocol === 'file:') return 'http://127.0.0.1:8080/traffic/track';
    return '/traffic/track';
  })();

  // 1. Get or generate persistent Visitor ID
  function getVisitorId() {
    var key = 'iv_visitor_id';
    var id = '';
    try {
      id = localStorage.getItem(key);
      if (!id) {
        id = 'iv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem(key, id);
      }
    } catch (e) {
      id = 'iv_anon_' + Math.random().toString(36).substring(2, 9);
    }
    return id;
  }

  // 2. Detect Device Type
  function getDeviceType() {
    var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    var ua = navigator.userAgent || '';
    if (/Mobi|Android|iPhone|iPod/i.test(ua) || width <= 768) {
      return 'Mobile';
    }
    if (/iPad|Tablet/i.test(ua) || (width > 768 && width <= 1024)) {
      return 'Tablet';
    }
    return 'Desktop';
  }

  // 3. Detect Browser Name
  function getBrowserName() {
    var ua = navigator.userAgent || '';
    if (ua.indexOf('Edge') > -1 || ua.indexOf('Edg') > -1) return 'Edge';
    if (ua.indexOf('Chrome') > -1) return 'Chrome';
    if (ua.indexOf('Safari') > -1) return 'Safari';
    if (ua.indexOf('Firefox') > -1) return 'Firefox';
    return 'Other';
  }

  // 4. Extract Parent Host if inside Iframe
  function getParentHost() {
    var parentHost = '';
    try {
      if (window.location !== window.parent.location) {
        var ref = document.referrer;
        if (ref) {
          var url = new URL(ref);
          parentHost = url.hostname;
        } else {
          parentHost = 'Embedded Iframe';
        }
      }
    } catch (e) {
      if (document.referrer) {
        try {
          parentHost = new URL(document.referrer).hostname;
        } catch (err) {}
      }
    }
    return parentHost;
  }

  // Clean & normalize page path name
  function getPagePath() {
    var path = (window.location.pathname || '').split('?')[0].split('#')[0];
    if (!path || path === '/' || path === '/dashboard' || path === '/dashboard.html') {
      return 'dashboard.html';
    }
    var parts = path.split('/');
    var filename = parts[parts.length - 1] || parts[parts.length - 2] || '';
    if (!filename || filename === 'dashboard' || filename === 'index') {
      return 'dashboard.html';
    }
    if (filename.indexOf('.') === -1) {
      filename += '.html';
    }
    return filename;
  }

  var visitorId = getVisitorId();
  var pagePath = getPagePath();

  // Exclude admin page from tracking
  if (pagePath === 'admin.html' || pagePath === 'admin' || window.location.pathname.indexOf('/admin') !== -1) {
    return;
  }

  var pageTitle = document.title || 'Intrinsic Value';
  var referrer = document.referrer || '';
  var parentHost = getParentHost();
  var deviceType = getDeviceType();
  var browserName = getBrowserName();

  // 5. Send Tracking Request
  function sendEvent(isHeartbeat) {
    var payload = {
      visitor_id: visitorId,
      page_path: pagePath,
      page_title: pageTitle,
      referrer: referrer,
      parent_host: parentHost,
      device_type: deviceType,
      browser: browserName,
      is_heartbeat: !!isHeartbeat
    };

    if (navigator.sendBeacon && isHeartbeat) {
      try {
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(API_ENDPOINT, blob);
        return;
      } catch (e) {}
    }

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () {});
  }

  // Initial Pageview Track
  sendEvent(false);

  // Send Heartbeat Ping every 25 seconds while tab active
  setInterval(function () {
    if (!document.hidden) {
      sendEvent(true);
    }
  }, 25000);
})();
