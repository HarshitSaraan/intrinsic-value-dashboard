(function () {
  function getLogoSrc() {
    var isFile = window.location.protocol === 'file:';
    if (isFile) {
      return '../../logo.png';
    } else {
      return '/static/logo.png';
    }
  }

  function getLink(path) {
    var isFile = window.location.protocol === 'file:';
    if (isFile) {
      if (path === '/') return 'dashboard.html';
      if (path === '/dashboard') return 'dashboard.html';
      if (path === '/ranking-tool') return 'ranking-tool.html';
      if (path === '/monthly-market-analysis') return 'monthly-market-analysis.html';
      if (path === '/monthly-market-dashboard') return 'monthly-market-dashboard.html';
      if (path === '/market-valuation-index') return 'market-valuation-index.html';
      if (path === '/headwind-tailwind-indicator') return 'headwind-tailwind-indicator.html';
      if (path === '/portfolio-review-tool') return 'portfolio-review-tool.html';
      if (path === '/turnaround') return 'turnaround.html';
      if (path.startsWith('/')) return path.substring(1) + '.html';
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
    else if (path.indexOf("monthly-market-dashboard") >= 0) activeView = "monthly";
    else if (path.indexOf("monthly-market-analysis") >= 0) activeView = "monthly-analysis";
    else if (path.indexOf("market-valuation-index") >= 0) activeView = "valuation";
    else if (path.indexOf("headwind-tailwind-indicator") >= 0) activeView = "headwind";
    else if (path.indexOf("portfolio-review-tool") >= 0) activeView = "portfolio";
    else if (path.indexOf("ranking-tool") >= 0) activeView = "ranking";
    else if (path.indexOf("turnaround") >= 0) activeView = "turnaround";

    // Create iv-shell wrapper
    var shell = document.createElement("div");
    shell.className = "iv-shell";
    
    // Create sidebar
    var sidebar = document.createElement("aside");
    sidebar.className = "iv-sidebar";
    sidebar.setAttribute("aria-label", "Intrinsic Value Wealth Dashboard Navigation");
    
    var brandLink = document.createElement("a");
    brandLink.href = getLink("/dashboard");
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

    // Nav Groups matching original monolith sidebar
    var groups = [
      {
        name: "Core Index",
        items: [
          { view: "home", label: "Dashboard Home", icon: "◆", path: "/dashboard" },
          { view: "gawp", label: "GAWP Index", icon: "◎", path: "/gawp" }
        ]
      },
      {
        name: "Personal Finance",
        items: [
          { view: "sip", label: "SIP Calculator", icon: "↗", path: "/sip" },
          { view: "swp", label: "SWP Calculator", icon: "↘", path: "/swp" },
          { view: "lumpsum", label: "Lumpsum Calculator", icon: "◆", path: "/lumpsum" },
          { view: "xirr", label: "XIRR Calculator", icon: "%", path: "/xirr" }
        ]
      },
      {
        name: "Market Analysis",
        items: [
          { view: "monthly", label: "Monthly Market Dashboard", icon: "▣", path: "/monthly-market-dashboard" },
          { view: "monthly-analysis", label: "Monthly Market Analysis", icon: "◌", path: "/monthly-market-analysis" },
          { view: "valuation", label: "Market Valuation Index", icon: "∑", path: "/market-valuation-index" },
          { view: "headwind", label: "Headwind / Tailwind Indicator", icon: "⇄", path: "/headwind-tailwind-indicator" }
        ]
      },
      {
        name: "Portfolio Tools",
        items: [
          { view: "portfolio", label: "Portfolio Review Tool", icon: "◈", path: "/portfolio-review-tool" },
          { view: "ranking", label: "Intrinsic Value Ranking Tool", icon: "★", path: "/ranking-tool" }
        ]
      }
    ];

    groups.forEach(function (g) {
      var groupDiv = document.createElement("div");
      groupDiv.className = "iv-nav-group";
      
      var isGroupActive = g.items.some(function (item) { return item.view === activeView; });
      // Keep dropdown collapsed on page load. Trigger button active highlight is handled via iv-nav-btn active.

      var btn = document.createElement("button");
      btn.className = "iv-nav-group-btn";
      btn.innerHTML = `
        <span>${g.name}</span>
        <span class="iv-nav-arrow">▾</span>
      `;
      groupDiv.appendChild(btn);

      var dropdown = document.createElement("div");
      dropdown.className = "iv-nav-dropdown";

      g.items.forEach(function (item) {
        var a = document.createElement("a");
        a.className = "iv-nav-btn";
        if (item.view === activeView) a.classList.add("active");
        a.href = getLink(item.path);
        a.innerHTML = `
          <span class="iv-nav-icon">${item.icon}</span>${item.label}
        `;
        a.addEventListener("click", function () {
          setGroupState(groupDiv, false);
          shell.classList.remove("iv-sidebar-open");
        });
        dropdown.appendChild(a);
      });

      groupDiv.appendChild(dropdown);
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
    // Create menu button for mobile (since topbar is removed)
    var menuBtn = document.createElement("button");
    menuBtn.className = "iv-menu-btn";
    menuBtn.id = "ivMenuBtn";
    menuBtn.innerHTML = "☰";
    menuBtn.style.position = "fixed";
    menuBtn.style.top = "16px";
    menuBtn.style.left = "16px";
    menuBtn.style.zIndex = "100";
    menuBtn.style.display = "none"; // Hide by default on desktop
    // On mobile, main.css will show it via media query for .iv-menu-btn
    ivMain.appendChild(menuBtn);
    
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
