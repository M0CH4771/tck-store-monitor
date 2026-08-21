(() => {
  "use strict";

  const SETTINGS_KEY = "tck-store-monitor-settings-v1";
  const button = document.getElementById("exportImageButton");
  if (!button) return;

  const imageDataCache = new Map();
  let exporting = false;
  let resetTimer = 0;
  let jsonpSequence = 0;

  button.dataset.exportReady = "true";
  button.dataset.exportStatus = "ready";

  function twoDigits(value) {
    return String(value).padStart(2, "0");
  }

  function timestamp() {
    const now = new Date();
    return [
      now.getFullYear(),
      twoDigits(now.getMonth() + 1),
      twoDigits(now.getDate()),
      "_",
      twoDigits(now.getHours()),
      twoDigits(now.getMinutes()),
      twoDigits(now.getSeconds())
    ].join("");
  }

  function nextPaint() {
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function withTimeout(promise, milliseconds, message) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error(message)),
        milliseconds
      );
      promise.then(
        value => {
          window.clearTimeout(timer);
          resolve(value);
        },
        error => {
          window.clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  async function waitForImage(image) {
    if (!image.getAttribute("src")) return;

    if (!image.complete) {
      await withTimeout(
        new Promise((resolve, reject) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener(
            "error",
            () => reject(new Error("商品画像を読み込めませんでした")),
            { once: true }
          );
        }),
        20000,
        "商品画像の読み込みがタイムアウトしました"
      );
    }

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("商品画像を読み込めませんでした");
    }

    if (typeof image.decode === "function") {
      await image.decode().catch(() => {
        if (!image.naturalWidth) {
          throw new Error("商品画像を展開できませんでした");
        }
      });
    }
  }

  function isExternalImage(source) {
    if (!source || /^(?:data|blob):/i.test(source)) return false;

    try {
      return new URL(source, location.href).origin !== location.origin;
    } catch (_) {
      return false;
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
      reader.addEventListener("error", () => reject(new Error("画像データを変換できませんでした")), { once: true });
      reader.readAsDataURL(blob);
    });
  }

  async function fetchImageDirectly(source) {
    const cacheKey = `url:${source}`;
    if (imageDataCache.has(cacheKey)) return imageDataCache.get(cacheKey);

    const response = await fetch(source, {
      cache: "force-cache",
      credentials: "omit",
      mode: "cors"
    });

    if (!response.ok) {
      throw new Error(`画像配信元からHTTP ${response.status}が返されました`);
    }

    const blob = await response.blob();
    if (!String(blob.type || "").toLowerCase().startsWith("image/")) {
      throw new Error("画像配信元が画像以外のデータを返しました");
    }

    const imageData = await blobToDataUrl(blob);
    imageDataCache.set(cacheKey, imageData);
    return imageData;
  }

  function appsScriptEndpoint() {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      const endpoint = String(settings.endpoint || "").trim();
      const url = new URL(endpoint);
      if (url.protocol === "https:" && /\/exec\/?$/.test(url.pathname)) return endpoint;
    } catch (_) {
      // 下の案内用エラーへ進む。
    }

    throw new Error("設定画面のApps Script URLを確認してください");
  }

  function fetchImageThroughAppsScript(row) {
    const numericRow = Number(row);
    if (!Number.isInteger(numericRow) || numericRow < 1) {
      return Promise.reject(new Error("商品の行番号を確認できませんでした"));
    }

    const cacheKey = `row:${numericRow}`;
    if (imageDataCache.has(cacheKey)) {
      return Promise.resolve(imageDataCache.get(cacheKey));
    }

    const endpoint = appsScriptEndpoint();
    const callback = `__tckExportImage_${Date.now()}_${jsonpSequence += 1}`;

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const separator = endpoint.includes("?") ? "&" : "?";
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Apps Scriptからの画像取得がタイムアウトしました"));
      }, 45000);

      function cleanup() {
        window.clearTimeout(timer);
        script.remove();
        try {
          delete window[callback];
        } catch (_) {
          window[callback] = undefined;
        }
      }

      window[callback] = payload => {
        cleanup();
        const imageData = payload && typeof payload.imageData === "string"
          ? payload.imageData
          : "";

        if (payload && payload.ok && /^data:image\//i.test(imageData)) {
          imageDataCache.set(cacheKey, imageData);
          resolve(imageData);
          return;
        }

        reject(new Error(
          payload && payload.error
            ? payload.error
            : "Apps Scriptに画像出力機能が反映されていません"
        ));
      };

      script.addEventListener("error", () => {
        cleanup();
        reject(new Error("Apps Scriptへ接続できませんでした"));
      }, { once: true });
      script.src =
        `${endpoint}${separator}imageRow=${encodeURIComponent(numericRow)}` +
        `&callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  async function embeddedImageSource(image) {
    const source = image.currentSrc || image.src;

    try {
      return await fetchImageDirectly(source);
    } catch (directError) {
      const row = image.closest(".card")?.dataset.row;

      try {
        return await fetchImageThroughAppsScript(row);
      } catch (proxyError) {
        const product = image.alt || `スプレッドシート${row || "?"}行目`;
        throw new Error(
          `「${product}」の画像をPNGへ取り込めません。` +
          "Apps ScriptのCode.gsを最新版へ置き換え、新しいバージョンとして再デプロイしてください。" +
          `（${proxyError.message || directError.message}）`
        );
      }
    }
  }

  async function prepareOneImage(image) {
    const wrapper = image.closest(".image-wrap");
    const snapshot = {
      image,
      source: image.getAttribute("src"),
      wrapper,
      wrapperHadError: Boolean(wrapper?.classList.contains("is-error"))
    };
    const source = image.currentSrc || image.src;

    try {
      if (isExternalImage(source)) {
        image.src = await embeddedImageSource(image);
        if (wrapper) wrapper.classList.remove("is-error");
      }

      await waitForImage(image);
      return snapshot;
    } catch (error) {
      restorePageImages([snapshot]);
      throw error;
    }
  }

  async function preparePageImages() {
    const images = Array.from(document.querySelectorAll(".card img.card-image"));
    const snapshots = new Array(images.length);
    const errors = [];
    let cursor = 0;

    async function worker() {
      while (cursor < images.length) {
        const index = cursor;
        cursor += 1;
        try {
          snapshots[index] = await prepareOneImage(images[index]);
        } catch (error) {
          errors.push(error);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(3, Math.max(1, images.length)) }, worker)
    );

    if (errors.length) {
      restorePageImages(snapshots.filter(Boolean));
      throw errors[0];
    }
    return snapshots.filter(Boolean);
  }

  function restorePageImages(snapshots) {
    snapshots.forEach(snapshot => {
      if (snapshot.source == null) snapshot.image.removeAttribute("src");
      else snapshot.image.setAttribute("src", snapshot.source);

      if (snapshot.wrapper) {
        snapshot.wrapper.classList.toggle("is-error", snapshot.wrapperHadError);
      }
    });
  }

  function pageInfo() {
    const text = document.getElementById("pageNumber")?.textContent || "";
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return { current: 0, total: 0 };
    return { current: Number(match[1]), total: Number(match[2]) };
  }

  async function waitForPage(page, timeout = 5000) {
    const startedAt = performance.now();

    while (performance.now() - startedAt < timeout) {
      if (pageInfo().current === page) {
        await nextPaint();
        return;
      }
      await nextPaint();
    }

    throw new Error(`${page}ページ目へ切り替えられませんでした`);
  }

  async function navigateToPage(targetPage) {
    const total = pageInfo().total;
    if (targetPage < 1 || targetPage > total) {
      throw new Error("出力対象のページ番号が正しくありません");
    }

    for (let attempts = 0; attempts <= total; attempts += 1) {
      const current = pageInfo().current;
      if (current === targetPage) {
        await nextPaint();
        return;
      }

      const movingForward = current < targetPage;
      const control = document.getElementById(movingForward ? "nextButton" : "previousButton");
      if (!control) throw new Error("ページ切替ボタンが見つかりません");
      const expected = current + (movingForward ? 1 : -1);
      control.click();
      await waitForPage(expected);
    }

    throw new Error(`${targetPage}ページ目へ移動できませんでした`);
  }

  function canvasToPng(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(value => {
        if (value) resolve(value);
        else reject(new Error("PNGデータを生成できませんでした"));
      }, "image/png");
    });
  }

  function drawPreparedImages(canvas, target) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("商品画像をPNGへ描画できませんでした");

    const targetRect = target.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, target.clientWidth);
    const scaleY = canvas.height / Math.max(1, target.clientHeight);
    const images = Array.from(target.querySelectorAll(".card img.card-image")).filter(
      image => image.getAttribute("src") && !image.closest(".image-wrap")?.classList.contains("is-error")
    );
    let drawnImages = 0;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    images.forEach(image => {
      if (!image.naturalWidth || !image.naturalHeight) return;

      const style = getComputedStyle(image);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0
      ) {
        return;
      }

      const imageRect = image.getBoundingClientRect();
      const boxWidth = Math.max(0, imageRect.width * scaleX);
      const boxHeight = Math.max(0, imageRect.height * scaleY);
      if (!boxWidth || !boxHeight) return;

      const originX = (imageRect.left - targetRect.left) * scaleX;
      const originY = (imageRect.top - targetRect.top) * scaleY;
      const imageRatio = image.naturalWidth / image.naturalHeight;
      const boxRatio = boxWidth / boxHeight;
      let drawWidth;
      let drawHeight;

      if (imageRatio > boxRatio) {
        drawWidth = boxWidth;
        drawHeight = drawWidth / imageRatio;
      } else {
        drawHeight = boxHeight;
        drawWidth = drawHeight * imageRatio;
      }

      const drawX = originX + (boxWidth - drawWidth) / 2;
      const drawY = originY + (boxHeight - drawHeight) / 2;

      context.save();
      context.beginPath();
      context.rect(originX, originY, boxWidth, boxHeight);
      context.clip();
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      context.restore();
      drawnImages += 1;
    });

    if (images.length && drawnImages !== images.length) {
      throw new Error(
        `商品画像をPNGへ描画できませんでした（${drawnImages}/${images.length}枚）`
      );
    }

    return drawnImages;
  }

  async function captureCurrentPage(target) {
    const snapshots = await preparePageImages();

    try {
      await nextPaint();
      const canvas = await window.html2canvas(target, {
        backgroundColor: "#e9eef2",
        scale: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 45000,
        scrollX: 0,
        scrollY: 0,
        width: target.clientWidth,
        height: target.clientHeight,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight
      });
      // html2canvasは大きなdata URL画像をまれに描画しないため、
      // 読み込み済みの商品画像を最後にCanvasへ直接重ねる。
      drawPreparedImages(canvas, target);
      return await canvasToPng(canvas);
    } finally {
      restorePageImages(snapshots);
    }
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
      crc ^= bytes[index];
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return {
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
    };
  }

  function littleEndianHeader(length) {
    const bytes = new Uint8Array(length);
    return { bytes, view: new DataView(bytes.buffer) };
  }

  async function createZip(files) {
    const encoder = new TextEncoder();
    const createdAt = new Date();
    const dos = zipDateTime(createdAt);
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    let centralSize = 0;

    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = new Uint8Array(await file.blob.arrayBuffer());
      const checksum = crc32(data);
      const local = littleEndianHeader(30);
      local.view.setUint32(0, 0x04034b50, true);
      local.view.setUint16(4, 20, true);
      local.view.setUint16(6, 0x0800, true);
      local.view.setUint16(8, 0, true);
      local.view.setUint16(10, dos.time, true);
      local.view.setUint16(12, dos.date, true);
      local.view.setUint32(14, checksum, true);
      local.view.setUint32(18, data.length, true);
      local.view.setUint32(22, data.length, true);
      local.view.setUint16(26, name.length, true);
      local.view.setUint16(28, 0, true);
      localParts.push(local.bytes, name, data);

      const central = littleEndianHeader(46);
      central.view.setUint32(0, 0x02014b50, true);
      central.view.setUint16(4, 20, true);
      central.view.setUint16(6, 20, true);
      central.view.setUint16(8, 0x0800, true);
      central.view.setUint16(10, 0, true);
      central.view.setUint16(12, dos.time, true);
      central.view.setUint16(14, dos.date, true);
      central.view.setUint32(16, checksum, true);
      central.view.setUint32(20, data.length, true);
      central.view.setUint32(24, data.length, true);
      central.view.setUint16(28, name.length, true);
      central.view.setUint16(30, 0, true);
      central.view.setUint16(32, 0, true);
      central.view.setUint16(34, 0, true);
      central.view.setUint16(36, 0, true);
      central.view.setUint32(38, 0, true);
      central.view.setUint32(42, localOffset, true);
      centralParts.push(central.bytes, name);

      localOffset += local.bytes.length + name.length + data.length;
      centralSize += central.bytes.length + name.length;
    }

    const end = littleEndianHeader(22);
    end.view.setUint32(0, 0x06054b50, true);
    end.view.setUint16(4, 0, true);
    end.view.setUint16(6, 0, true);
    end.view.setUint16(8, files.length, true);
    end.view.setUint16(10, files.length, true);
    end.view.setUint32(12, centralSize, true);
    end.view.setUint32(16, localOffset, true);
    end.view.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, end.bytes], {
      type: "application/zip"
    });
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function exportScreen() {
    if (exporting) return;
    exporting = true;
    window.clearTimeout(resetTimer);
    button.dataset.exportStatus = "working";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    const originalText = button.textContent;
    const initialPage = pageInfo();
    const pauseButton = document.getElementById("pauseButton");
    const wasRunning = pauseButton?.getAttribute("aria-label") === "自動切替を停止";
    let shouldRestoreRunning = false;

    try {
      if (typeof window.html2canvas !== "function") {
        throw new Error("画像出力ライブラリを読み込めませんでした");
      }

      const target = document.querySelector(".app");
      if (!target) throw new Error("出力対象の画面が見つかりません");
      if (!initialPage.total) throw new Error("出力できる商品ページがありません");

      button.dataset.exportPages = String(initialPage.total);
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      document.body.classList.add("is-exporting");

      if (wasRunning && pauseButton) {
        pauseButton.click();
        shouldRestoreRunning = true;
      }

      await navigateToPage(1);
      const stamp = timestamp();
      const files = [];

      for (let page = 1; page <= initialPage.total; page += 1) {
        if (pageInfo().total !== initialPage.total) {
          throw new Error("保存中に商品ページ数が変わりました。もう一度お試しください");
        }

        button.dataset.exportPage = String(page);
        button.textContent = `${page}/${initialPage.total}`;
        const blob = await captureCurrentPage(target);
        files.push({
          name: `店頭販売画面_${stamp}_${twoDigits(page)}.png`,
          blob
        });

        if (page < initialPage.total) await navigateToPage(page + 1);
      }

      if (files.length === 1) {
        button.dataset.exportFileType = "png";
        download(files[0].blob, `店頭販売画面_${stamp}.png`);
      } else {
        button.dataset.exportFileType = "zip";
        const zip = await createZip(files);
        download(zip, `店頭販売画面_${stamp}_${files.length}ページ.zip`);
      }

      button.dataset.exportStatus = "complete";
    } catch (error) {
      console.error(error);
      button.dataset.exportStatus = "error";
      window.alert(`画像を保存できませんでした。\n${error.message || "ページを再読み込みしてお試しください。"}`);
    } finally {
      try {
        if (initialPage.current && pageInfo().total === initialPage.total) {
          await navigateToPage(initialPage.current);
        }
      } catch (restoreError) {
        console.error("元のページへ戻せませんでした", restoreError);
      }

      if (
        shouldRestoreRunning &&
        pauseButton?.getAttribute("aria-label") === "自動切替を再開"
      ) {
        pauseButton.click();
      }

      imageDataCache.clear();
      document.body.classList.remove("is-exporting");
      button.disabled = false;
      button.removeAttribute("aria-busy");
      delete button.dataset.exportPage;
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
