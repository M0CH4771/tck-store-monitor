(() => {
  "use strict";

  const button = document.getElementById("exportImageButton");
  if (!button) return;

  let exporting = false;
  let resetTimer = 0;
  button.dataset.exportReady = "true";
  button.dataset.exportStatus = "ready";

  function twoDigits(value) {
    return String(value).padStart(2, "0");
  }

  function fileName() {
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      twoDigits(now.getMonth() + 1),
      twoDigits(now.getDate()),
      "_",
      twoDigits(now.getHours()),
      twoDigits(now.getMinutes()),
      twoDigits(now.getSeconds())
    ].join("");
    return `店頭販売画面_${stamp}.png`;
  }

  function nextPaint() {
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  async function exportScreen() {
    if (exporting) return;
    exporting = true;
    window.clearTimeout(resetTimer);
    button.dataset.exportStatus = "working";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    const originalText = button.textContent;
    button.textContent = "保存中";

    try {
      if (typeof window.html2canvas !== "function") {
        throw new Error("画像出力ライブラリを読み込めませんでした");
      }

      const target = document.querySelector(".app");
      if (!target) throw new Error("出力対象の画面が見つかりません");

      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      document.body.classList.add("is-exporting");
      await nextPaint();

      const canvas = await window.html2canvas(target, {
        backgroundColor: "#e9eef2",
        scale: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        scrollX: 0,
        scrollY: 0,
        width: target.clientWidth,
        height: target.clientHeight,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight
      });

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(value => {
          if (value) resolve(value);
          else reject(new Error("PNGデータを生成できませんでした"));
        }, "image/png");
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      button.dataset.exportStatus = "complete";
    } catch (error) {
      console.error(error);
      button.dataset.exportStatus = "error";
      window.alert(`画像を保存できませんでした。\n${error.message || "ページを再読み込みしてお試しください。"}`);
    } finally {
      document.body.classList.remove("is-exporting");
      button.disabled = false;
      button.removeAttribute("aria-busy");
      const completed = button.dataset.exportStatus === "complete";
      button.textContent = completed ? "保存済" : originalText;
      if (completed) {
        resetTimer = window.setTimeout(() => {
          button.textContent = originalText;
          button.dataset.exportStatus = "ready";
        }, 1600);
      }
      exporting = false;
    }
  }

  button.addEventListener("click", exportScreen);
})();
