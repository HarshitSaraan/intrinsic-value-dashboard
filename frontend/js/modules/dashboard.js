(function () {
  document.addEventListener("DOMContentLoaded", function () {
    // Quick Tools Redirections
    var quickTools = document.querySelectorAll("[data-quick-view]");
    quickTools.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var view = btn.getAttribute("data-quick-view");
        if (!view) return;

        var route = "/" + view;
        if (view === "ranking") {
          route = "/ranking-tool";
        } else if (view === "monthly-analysis") {
          route = "/monthly-market-analysis";
        }

        window.location.href = route;
      });
    });

    // Fetch and render dynamic ticker data from backend rankings & cycles
    var tickerEl = document.querySelector(".iv-ticker");
    if (tickerEl) {
      var baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '';
      fetch(baseUrl + '/ticker-data', { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('API error ' + res.status);
          return res.json();
        })
        .then(function (data) {
          if (!data || !data.items || !data.items.length) return;
          
          var itemsHtml = data.items.map(function (item) {
            return '<div class="iv-ticker-item">' +
              '<span class="ticker-label">' + item.label + '</span>' +
              '<span class="ticker-val">' + item.value + '</span>' +
              '<span class="ticker-change ' + item.changeClass + '">' + item.change + '</span>' +
              '<span class="ticker-badge ' + item.badgeClass + '">' + item.badge + '</span>' +
              '</div>';
          }).join('');
          
          // Duplicate items to ensure smooth infinite loop scroll
          tickerEl.innerHTML = itemsHtml + itemsHtml;
        })
        .catch(function (err) {
          console.warn('Failed to load ticker data, using static fallback:', err);
        });
    }

    // Scroll Reveal Intersection Observer
    var revealItems = document.querySelectorAll(".iv-micro-card, .iv-stacked-card, .iv-discipline-card");
    
    // Add structural reveal classes
    revealItems.forEach(function (item) {
      item.classList.add("iv-reveal-item");
    });

    var observerOptions = {
      root: null, // viewport
      threshold: 0.08, // trigger when 8% is visible
      rootMargin: "0px 0px -40px 0px" // offset to trigger slightly early
    };

    var observer = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target); // trigger only once
        }
      });
    }, observerOptions);

    revealItems.forEach(function (item) {
      observer.observe(item);
    });
  });
})();

