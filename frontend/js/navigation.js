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
    else if (path.indexOf("strategies") >= 0) {
      var query = window.location.search;
      if (query.indexOf("undervalued-growth") >= 0) activeView = "strategies-ug";
      else if (query.indexOf("aggressive-smallcaps") >= 0) activeView = "strategies-as";
      else if (query.indexOf("undervalued-largecaps") >= 0) activeView = "strategies-ul";
      else if (query.indexOf("growth-tech") >= 0) activeView = "strategies-gt";
      else if (query.indexOf("portfolio-anchors") >= 0) activeView = "strategies-pa";
      else if (query.indexOf("solid-large-growth") >= 0) activeView = "strategies-sl";
      else activeView = "strategies-directory";
    }

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

    // Nav Items: supports standalone links and grouped dropdowns
    var navItems = [
      {
        type: "standalone",
        view: "home",
        label: "Dashboard Home",
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
          { view: "monthly", label: "Monthly Market Dashboard", icon: "▣", path: "/monthly-market-dashboard" },
          { view: "monthly-analysis", label: "Monthly Market Analysis", icon: "◌", path: "/monthly-market-analysis" },
          { view: "valuation", label: "Market Valuation Index", icon: "∑", path: "/market-valuation-index" },
          { view: "headwind", label: "Headwind / Tailwind Indicator", icon: "⇄", path: "/headwind-tailwind-indicator" }
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
        name: "Value & Growth Strategies",
        items: [
          { view: "strategies-ug", label: "Undervalued Growth", icon: "📈", path: "/strategies?type=undervalued-growth" },
          { view: "aggressive-smallcaps", label: "Aggressive Small Caps", icon: "⚡", path: "/strategies?type=aggressive-smallcaps" },
          { view: "undervalued-largecaps", label: "Undervalued Large Caps", icon: "🏢", path: "/strategies?type=undervalued-largecaps" },
          { view: "growth-tech", label: "Growth Technology", icon: "💻", path: "/strategies?type=growth-tech" },
          { view: "portfolio-anchors", label: "Portfolio Anchors", icon: "⚓", path: "/strategies?type=portfolio-anchors" },
          { view: "solid-large-growth", label: "Solid Large Growth", icon: "🚀", path: "/strategies?type=solid-large-growth" }
        ]
      }
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
    
    var logoWrap = document.createElement("div");
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
    updateToggleIcon();

    toggleBtn.onclick = function () {
      var currentTheme = document.documentElement.getAttribute("data-theme") || "";
      var newTheme = currentTheme === "dark" ? "" : "dark";
      if (newTheme) {
        document.documentElement.setAttribute("data-theme", newTheme);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      localStorage.setItem("iv-theme", newTheme);
      updateToggleIcon();
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
