/* Phase 2 migration loader:
   Each modular page loads legacy dashboard markup/scripts safely, then opens target view. */

(function () {
  function parseLegacy(htmlText) {
    var parser = new DOMParser();
    return parser.parseFromString(htmlText, "text/html");
  }

  function copyStyles(doc) {
    var styles = Array.prototype.slice.call(doc.querySelectorAll("style"));
    styles.forEach(function (styleTag) {
      var node = document.createElement("style");
      node.textContent = styleTag.textContent || "";
      document.head.appendChild(node);
    });
  }

  function copyScripts(doc, mountDone) {
    var scripts = Array.prototype.slice.call(doc.querySelectorAll("script"));
    var index = 0;

    function next() {
      if (index >= scripts.length) {
        mountDone();
        return;
      }
      var source = scripts[index++];
      var node = document.createElement("script");
      node.text = source.textContent || "";
      node.onload = next;
      node.onerror = next;
      document.body.appendChild(node);
      if (!node.src) {
        next();
      }
    }

    next();
  }

  function openInitialView(view) {
    var app = document.getElementById("iv-dashboard-app");
    if (!app || !view) return;
    var btn = app.querySelector('.iv-nav-btn[data-view="' + view + '"]');
    if (btn) {
      btn.click();
    }
  }

  function mountLegacyView(initialView) {
    fetch("/dashboard_master.html", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("Unable to load dashboard template");
        return res.text();
      })
      .then(function (htmlText) {
        var parsed = parseLegacy(htmlText);
        var fragmentRoot = parsed.querySelector("#iv-dashboard-app");
        var mount = document.getElementById("ivPageMount");
        if (!fragmentRoot || !mount) throw new Error("Dashboard root not found");

        copyStyles(parsed);
        mount.innerHTML = "";
        mount.appendChild(fragmentRoot);

        copyScripts(parsed, function () {
          window.setTimeout(function () {
            openInitialView(initialView);
          }, 30);
        });
      })
      .catch(function (err) {
        var fallback = document.getElementById("ivPageFallback");
        if (fallback) {
          fallback.style.display = "block";
          fallback.querySelector("p").textContent = "Could not load dashboard UI: " + err.message;
        }
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var initialView = window.IV_INITIAL_VIEW || "home";
    mountLegacyView(initialView);
  });
})();
