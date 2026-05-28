(function () {
  document.addEventListener("DOMContentLoaded", function () {
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
  });
})();
