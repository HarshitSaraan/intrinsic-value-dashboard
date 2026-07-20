// Global canvas drawing hook to align chart colors dynamically in Light Mode
(function() {
  var originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, contextAttributes) {
    var ctx = originalGetContext.call(this, type, contextAttributes);
    if (type === '2d' && ctx && !ctx._ivHooked) {
      ctx._ivHooked = true;
      
      var isDark = function() {
        return document.documentElement.getAttribute("data-theme") === "dark";
      };
      
      // Override strokeStyle
      var strokeDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'strokeStyle') ||
                       Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'strokeStyle');
      if (strokeDesc && strokeDesc.set) {
        var origStrokeSet = strokeDesc.set;
        Object.defineProperty(ctx, 'strokeStyle', {
          set: function(val) {
            if (!isDark() && typeof val === 'string') {
              var clean = val.replace(/\s+/g, '').toLowerCase();
              if (clean.indexOf('rgba(255,255,255,0.0') >= 0 || clean.indexOf('rgba(255,255,255,0.1') >= 0) {
                val = '#E4E7EC'; // Design system border color for gridlines
              } else if (clean.indexOf('rgba(255,255,255,') >= 0) {
                val = 'rgba(16, 24, 40, 0.15)';
              } else if (clean === '#4c8dff' || clean === '#3a9ad9') {
                val = '#1D2939'; // Navy stroke line for primary series
              } else if (clean === '#d4af37' || clean === '#f1bf6c') {
                val = '#125B54'; // Teal stroke line for secondary series
              }
            }
            origStrokeSet.call(this, val);
          },
          get: strokeDesc.get,
          configurable: true
        });
      }
      
      // Override fillStyle
      var fillDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle') ||
                     Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'fillStyle');
      if (fillDesc && fillDesc.set) {
        var origFillSet = fillDesc.set;
        Object.defineProperty(ctx, 'fillStyle', {
          set: function(val) {
            if (!isDark() && typeof val === 'string') {
              var clean = val.replace(/\s+/g, '').toLowerCase();
              if (clean.indexOf('rgba(203,213,232,') >= 0) {
                val = '#667085'; // Secondary text/muted for labels
              } else if (clean === '#4c8dff' || clean === '#3a9ad9') {
                val = '#1D2939'; // Navy fill bar / dot
              } else if (clean === '#d4af37' || clean === '#f1bf6c') {
                val = '#125B54'; // Teal fill bar / dot
              }
            }
            origFillSet.call(this, val);
          },
          get: fillDesc.get,
          configurable: true
        });
      }
      
      // Override font
      var fontDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font') ||
                     Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'font');
      if (fontDesc && fontDesc.set) {
        var origFontSet = fontDesc.set;
        Object.defineProperty(ctx, 'font', {
          set: function(val) {
            if (typeof val === 'string') {
              val = val.replace(/Poppins/g, 'Manrope').replace(/Inter/g, 'Manrope');
            }
            origFontSet.call(this, val);
          },
          get: fontDesc.get,
          configurable: true
        });
      }
    }
    return ctx;
  };
})();

(function () {
  function getLogoSrc() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var logoName = isDark ? 'logo.png' : 'logo 2.png';
    var isFile = window.location.protocol === 'file:';
    if (isFile) {
      return '../../' + logoName;
    } else {
      return '/static/' + logoName;
    }
  }

  function getLink(path) {
    var isFile = window.location.protocol === 'file:';
    if (isFile) {
      if (path === '/') return 'dashboard.html';
      var parts = path.split('?');
      var base = parts[0];
      var query = parts[1] ? '?' + parts[1] : '';
      if (base === '/dashboard') return 'dashboard.html' + query;
      if (base === '/ranking-tool') return 'ranking-tool.html' + query;
      if (base === '/monthly-market-analysis') return 'monthly-market-analysis.html' + query;
      if (base === '/market-valuation-index') return 'market-valuation-index.html' + query;
      if (base === '/headwind-tailwind-indicator') return 'headwind-tailwind-indicator.html' + query;
      if (base === '/portfolio-review-tool') return 'portfolio-review-tool.html' + query;
      if (base === '/turnaround') return 'turnaround.html' + query;
      if (base.startsWith('/')) return base.substring(1) + '.html' + query;
      return path;
    } else {
      return path;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector("main");
    if (!main) return;

    // Check if the sidebar navigation already exists (to prevent duplicate injections)
    if (document.querySelector(".iv-sidebar")) return;

    // Determine active view based on current filename or pathname
    var path = window.location.pathname;
    var activeView = "home";
    if (path.indexOf("sip") >= 0) activeView = "sip";
    else if (path.indexOf("swp") >= 0) activeView = "swp";
    else if (path.indexOf("lumpsum") >= 0) activeView = "lumpsum";
    else if (path.indexOf("xirr") >= 0) activeView = "xirr";
    else if (path.indexOf("gawp") >= 0) activeView = "gawp";
    else if (path.indexOf("monthly-market-analysis") >= 0) activeView = "monthly-analysis";
    else if (path.indexOf("earnings-trends") >= 0) activeView = "earnings-trends";
    else if (path.indexOf("market-valuation-index") >= 0) activeView = "valuation";
    else if (path.indexOf("headwind-tailwind-indicator") >= 0) activeView = "headwind";
    else if (path.indexOf("portfolio-review-tool") >= 0) activeView = "portfolio";
    else if (path.indexOf("ranking-tool") >= 0) activeView = "ranking";
    else if (path.indexOf("turnaround") >= 0) activeView = "turnaround";
    else if (path.indexOf("admin") >= 0) activeView = "admin";

    else if (path.indexOf("intrinsic-theme") >= 0) {
      var query = window.location.search;
      if (query.indexOf("growth-at-value") >= 0) activeView = "intrinsic-theme-gv";
      else if (query.indexOf("aggressive-smallcaps") >= 0) activeView = "intrinsic-theme-as";
      else if (query.indexOf("undervalued-largecaps") >= 0) activeView = "intrinsic-theme-ul";
      else if (query.indexOf("growth-tech") >= 0) activeView = "intrinsic-theme-gt";
      else if (query.indexOf("portfolio-anchors") >= 0) activeView = "intrinsic-theme-pa";
      else if (query.indexOf("solid-large-growth") >= 0) activeView = "intrinsic-theme-sl";
      else activeView = "intrinsic-theme-directory";
    }

    // Create iv-shell wrapper
    var shell = document.createElement("div");
    shell.className = "iv-shell";
    
    // Create sidebar
    var sidebar = document.createElement("aside");
    sidebar.className = "iv-sidebar";
    sidebar.setAttribute("aria-label", "Intrinsic Value Wealth Dashboard Navigation");
    
    var brandLink = document.createElement("a");
    brandLink.href = "https://intrinsicvalueequity.in/";
    brandLink.className = "iv-brand-link";
    brandLink.innerHTML = `
      <div class="iv-brand">
        <div class="iv-brand-mark animate-logo">
          <img src="${getLogoSrc()}" alt="IV" width="100px" height="100px">
        </div>
      </div>
    `;
    sidebar.appendChild(brandLink);

    var nav = document.createElement("nav");
    nav.className = "iv-nav";
    nav.id = "ivNav";

    // Nav Items: supports standalone links and grouped dropdowns
    var navItems = [
      {
        type: "standalone",
        view: "home",
        label: "Home",
        icon: "◆",
        path: "/dashboard"
      },
      {
        type: "group",
        name: "Personal Finance",
        items: [
          { view: "gawp", label: "GAWP Index", icon: "◎", path: "/gawp" },
          { view: "sip", label: "SIP Calculator", icon: "↗", path: "/sip" },
          { view: "swp", label: "SWP Calculator", icon: "↘", path: "/swp" },
          { view: "lumpsum", label: "Lumpsum Calculator", icon: "◆", path: "/lumpsum" },
          { view: "xirr", label: "XIRR Calculator", icon: "%", path: "/xirr" }
        ]
      },
      {
        type: "group",
        name: "Market Analysis",
        items: [
          { view: "monthly-analysis", label: "Market Pulse", icon: "◌", path: "/monthly-market-analysis" },
          { view: "earnings-trends", label: "Earnings Trends", icon: "\u22bf", path: "/earnings-trends" },
          { view: "valuation", label: "Market Valuation Tracker", icon: "∑", path: "/market-valuation-index" },
          { view: "headwind", label: "Upcycle / Down cycle Indicator", icon: "⇄", path: "/headwind-tailwind-indicator" }
        ]
      },
      {
        type: "group",
        name: "Portfolio Tools",
        items: [
          { view: "portfolio", label: "Portfolio Review Tool", icon: "◈", path: "/portfolio-review-tool" },
          { view: "ranking", label: "Intrinsic Value Ranking Tool", icon: "★", path: "/ranking-tool" }
        ]
      },
      {
        type: "group",
        name: "Thematic portfolios",
        items: [
          { view: "intrinsic-theme-gv", label: "Growth at Value", icon: "📈", path: "/intrinsic-theme?type=growth-at-value" },
          { view: "intrinsic-theme-as", label: "High Growth Small Cap", icon: "⚡", path: "/intrinsic-theme?type=aggressive-smallcaps" },
          { view: "intrinsic-theme-ul", label: "Value Large Cap", icon: "🏢", path: "/intrinsic-theme?type=undervalued-largecaps" },
          { view: "intrinsic-theme-gt", label: "Technology Leaders", icon: "💻", path: "/intrinsic-theme?type=growth-tech" },
          { view: "intrinsic-theme-pa", label: "Core Compounders", icon: "⚓", path: "/intrinsic-theme?type=portfolio-anchors" },
          { view: "intrinsic-theme-sl", label: "Large Compounders", icon: "🚀", path: "/intrinsic-theme?type=solid-large-growth" }
        ]
      },

    ];

    navItems.forEach(function (item) {
      var groupDiv = document.createElement("div");
      groupDiv.className = "iv-nav-group";

      if (item.type === "standalone") {
        var a = document.createElement("a");
        a.className = "iv-nav-group-btn";
        if (item.view === activeView) a.classList.add("active");
        a.href = getLink(item.path);
        a.innerHTML = `
          <span>${item.label}</span>
        `;
        a.addEventListener("click", function () {
          shell.classList.remove("iv-sidebar-open");
        });
        groupDiv.appendChild(a);
      } else {
        var isGroupActive = item.items.some(function (sub) { return sub.view === activeView; });
        
        var btn = document.createElement("button");
        btn.className = "iv-nav-group-btn";
        if (isGroupActive) btn.classList.add("active");
        btn.innerHTML = `
          <span>${item.name}</span>
          <span class="iv-nav-arrow">▾</span>
        `;
        groupDiv.appendChild(btn);

        var dropdown = document.createElement("div");
        dropdown.className = "iv-nav-dropdown";

        item.items.forEach(function (sub) {
          var a = document.createElement("a");
          a.className = "iv-nav-btn";
          if (sub.view === activeView) a.classList.add("active");
          a.href = getLink(sub.path);
          a.innerHTML = `
            <span class="iv-nav-icon">${sub.icon}</span>${sub.label}
          `;
          a.addEventListener("click", function () {
            setGroupState(groupDiv, false);
            shell.classList.remove("iv-sidebar-open");
          });
          dropdown.appendChild(a);
        });

        groupDiv.appendChild(dropdown);
      }

      nav.appendChild(groupDiv);
    });

    sidebar.appendChild(nav);
    shell.appendChild(sidebar);

    // Create overlay
    var overlay = document.createElement("div");
    overlay.className = "iv-overlay";
    overlay.id = "ivOverlay";
    shell.appendChild(overlay);

    // Create iv-main wrapper and wrap the current main element inside it
    var ivMain = document.createElement("div");
    ivMain.className = "iv-main";
    // Create mobile header (logo + hamburger)
    var mobileHeader = document.createElement("div");
    mobileHeader.className = "iv-mobile-header";
    
    if (activeView !== "home") {
      var backBtn = document.createElement("button");
      backBtn.className = "iv-mobile-back-btn";
      backBtn.id = "ivMobileBackBtn";
      backBtn.setAttribute("aria-label", "Go Back");
      backBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      `;
      backBtn.addEventListener("click", function () {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = getLink("/dashboard");
        }
      });
      mobileHeader.appendChild(backBtn);
    }
    
    var logoWrap = document.createElement("a");
    logoWrap.href = "https://intrinsicvalueequity.in/";
    logoWrap.className = "iv-mobile-logo";
    logoWrap.innerHTML = '<img src="' + getLogoSrc() + '" alt="IV" style="height:44px;width:auto;margin-left:-4px;">';
    
    var menuBtn = document.createElement("button");
    menuBtn.className = "iv-menu-btn";
    menuBtn.id = "ivMenuBtn";
    menuBtn.innerHTML = "☰";
    
    mobileHeader.appendChild(logoWrap);
    mobileHeader.appendChild(menuBtn);
    ivMain.appendChild(mobileHeader);
    
    var ivContent = document.createElement("section");
    ivContent.className = "iv-content";
    
    var parent = main.parentNode;
    parent.replaceChild(shell, main);
    
    ivContent.appendChild(main);
    ivMain.appendChild(ivContent);
    shell.appendChild(ivMain);

    // Bind mobile menu trigger and overlay click listeners
    menuBtn.addEventListener("click", function () {
      shell.classList.add("iv-sidebar-open");
    });
    
    overlay.addEventListener("click", function () {
      shell.classList.remove("iv-sidebar-open");
    });

    // Setup scroll listener for sticky nav bar blending
    function handleNavbarScroll() {
      if (window.scrollY > 15) {
        sidebar.classList.add("scrolled");
      } else {
        sidebar.classList.remove("scrolled");
      }
    }
    window.addEventListener("scroll", handleNavbarScroll);
    handleNavbarScroll(); // Initial check

    // Inject and setup theme toggle button dynamically
    var toggleBtn = document.getElementById("ivThemeToggle");
    if (!toggleBtn) {
      toggleBtn = document.createElement("button");
      toggleBtn.className = "iv-theme-toggle";
      toggleBtn.id = "ivThemeToggle";
      toggleBtn.title = "Switch theme";
      toggleBtn.setAttribute("aria-label", "Toggle theme");
      toggleBtn.innerHTML = '<span class="iv-theme-icon">☀️</span>';
      sidebar.appendChild(toggleBtn);
    }

    var themeIcon = toggleBtn.querySelector(".iv-theme-icon");
    function updateToggleIcon() {
      var currentTheme = document.documentElement.getAttribute("data-theme") || "";
      if (currentTheme === "dark") {
        themeIcon.textContent = "🌙";
      } else {
        themeIcon.textContent = "☀️";
      }
    }

    function updateLogoImages() {
      var logoSrc = getLogoSrc();
      var desktopLogo = document.querySelector(".iv-brand-mark img");
      var mobileLogo = document.querySelector(".iv-mobile-logo img");
      if (desktopLogo) desktopLogo.src = logoSrc;
      if (mobileLogo) mobileLogo.src = logoSrc;
    }

    updateToggleIcon();
    updateLogoImages();

    toggleBtn.onclick = function () {
      var currentTheme = document.documentElement.getAttribute("data-theme") || "";
      var newTheme = currentTheme === "dark" ? "" : "dark";
      if (newTheme) {
        document.documentElement.setAttribute("data-theme", newTheme);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      try {
        localStorage.setItem("iv-theme", newTheme);
      } catch (e) {}
      updateToggleIcon();
      updateLogoImages();
    };

    // Setup navigation dropdown click logic
    var navGroups = Array.from(shell.querySelectorAll(".iv-nav-group"));
    
    function setGroupState(group, open) {
      if (!group) return;
      var dropdown = group.querySelector(".iv-nav-dropdown");
      group.classList.toggle("active", open);
      if (dropdown) dropdown.classList.toggle("open", open);
    }

    navGroups.forEach(function (group) {
      var button = group.querySelector(".iv-nav-group-btn");
      if (!button) return;
      if (button.tagName === "A") return;

      button.addEventListener("click", function (e) {
        e.stopPropagation();
        var shouldOpen = !group.classList.contains("active");
        navGroups.forEach(function (other) {
          if (other !== group) setGroupState(other, false);
        });
        setGroupState(group, shouldOpen);
      });
    });

    document.addEventListener("click", function (event) {
      if (event.target.closest(".iv-nav-group")) return;
      navGroups.forEach(function (group) {
        setGroupState(group, false);
      });
    });
  });
})();
