(() => {
  "use strict";

  const SETTINGS_KEY = "tck-store-monitor-settings-v1";

  function readPageSize() {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      const size = Number(settings.pageSize);
      return [6, 12, 18, 24].includes(size) ? size : 24;
    } catch (_) {
      return 24;
    }
  }

  function applyFixedLayout() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;

    const pageSize = readPageSize();
    let columns;
    let rows;

    if (window.innerWidth < 760) {
      columns = 1;
      rows = Math.min(pageSize, 4);
    } else if (window.innerWidth < 1180) {
      columns = 1;
      rows = Math.min(pageSize, 8);
    } else if (grid.classList.contains("is-name-hidden")) {
      columns = 6;
      rows = Math.max(1, Math.ceil(pageSize / 6));
    } else {
      columns = 2;
      rows = Math.max(1, Math.ceil(pageSize / 2));
    }

    document.documentElement.style.setProperty("--columns", String(columns));
    document.documentElement.style.setProperty("--rows", String(rows));
  }

  function scheduleApply() {
    requestAnimationFrame(applyFixedLayout);
  }

  function start() {
    applyFixedLayout();

    const grid = document.getElementById("productGrid");
    if (grid) {
      const observer = new MutationObserver(scheduleApply);
      observer.observe(grid, {
        childList: true,
        subtree: false,
        attributes: true,
        attributeFilter: ["class"]
      });
    }

    window.addEventListener("resize", scheduleApply, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
