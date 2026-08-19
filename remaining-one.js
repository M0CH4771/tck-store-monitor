(() => {
  "use strict";

  function applyLastOne(root = document) {
    const stocks = root.querySelectorAll ? root.querySelectorAll(".stock") : [];
    stocks.forEach(stock => {
      if (stock.dataset.tckLastOneChecked === "1") return;
      const count = stock.querySelector(".stock-count");
      if (!count) return;
      if (count.textContent.replace(/\s/g, "") === "1点") {
        stock.classList.add("is-last-one");
        stock.textContent = "残り1点";
      }
      stock.dataset.tckLastOneChecked = "1";
    });
  }

  function start() {
    applyLastOne();
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) applyLastOne(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
