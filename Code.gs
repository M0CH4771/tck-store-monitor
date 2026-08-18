// ==================================================
// 店内在庫モニター用 Apps Script
// 対象スプレッドシートの「拡張機能 → Apps Script」へ貼り付けます。
// ==================================================

const MONITOR_SETTINGS = {
  // 空欄なら、このスプレッドシートの先頭シートを使用します。
  // 指定する場合はタブ名を完全一致で入力してください。
  sheetName: "",

  headerRow: 1,
  cacheSeconds: 20
};


// ==================================================
// ウェブアプリ入口
// JSONとJSONPの両方に対応しています。
// ==================================================
function doGet(e) {
  const callback = sanitizeCallback_(
    e && e.parameter ? e.parameter.callback : ""
  );

  let payload;

  try {
    payload = getMonitorPayload_();
  } catch (error) {
    console.error(error);

    payload = {
      ok: false,
      error: error && error.message
        ? error.message
        : "商品データの取得に失敗しました",
      updatedAt: new Date().toISOString(),
      items: []
    };
  }

  const json = JSON.stringify(payload);

  if (callback) {
    return ContentService
      .createTextOutput(
        callback + "(" + json + ");"
      )
      .setMimeType(
        ContentService.MimeType.JAVASCRIPT
      );
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


// ==================================================
// A～H列を読み込み、FまたはHが1以上の商品だけ返します。
// A: カード名
// C: 画像リンク
// E: 販売価格
// F: 通常在庫数
// G: 状態特価
// H: 特価在庫数
// ==================================================
function getMonitorPayload_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = "store-monitor-payload-v1";
  const cached = cache.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const spreadsheet = SpreadsheetApp
    .getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      "対象スプレッドシートを取得できませんでした"
    );
  }

  const sheet = getTargetSheet_(spreadsheet);
  const lastRow = sheet.getLastRow();
  const firstDataRow = MONITOR_SETTINGS.headerRow + 1;

  if (lastRow < firstDataRow) {
    return createPayload_(sheet, []);
  }

  const rowCount = lastRow - firstDataRow + 1;
  const range = sheet.getRange(
    firstDataRow,
    1,
    rowCount,
    8
  );

  const rawValues = range.getValues();
  const displayValues = range.getDisplayValues();
  const formulas = range.getFormulas();
  const items = [];

  for (let index = 0; index < rowCount; index += 1) {
    const raw = rawValues[index];
    const display = displayValues[index];
    const formula = formulas[index];

    const name = String(
      display[0] || raw[0] || ""
    ).trim();

    const normalStock = toNumber_(raw[5]);
    const specialStock = toNumber_(raw[7]);

    if (
      !name ||
      (normalStock < 1 && specialStock < 1)
    ) {
      continue;
    }

    items.push({
      row: firstDataRow + index,
      name: name,
      imageUrl: extractImageUrl_(
        raw[2],
        display[2],
        formula[2]
      ),
      normalPrice: toPriceNumber_(raw[4]),
      normalPriceText: String(
        display[4] || raw[4] || ""
      ).trim(),
      normalStock: normalStock,
      specialPrice: toPriceNumber_(raw[6]),
      specialPriceText: String(
        display[6] || raw[6] || ""
      ).trim(),
      specialStock: specialStock
    });
  }

  const payload = createPayload_(sheet, items);
  const serialized = JSON.stringify(payload);

  // CacheServiceの1件あたり上限を超えない場合だけ保存します。
  if (serialized.length < 95000) {
    cache.put(
      cacheKey,
      serialized,
      MONITOR_SETTINGS.cacheSeconds
    );
  }

  return payload;
}


function getTargetSheet_(spreadsheet) {
  if (MONITOR_SETTINGS.sheetName) {
    const namedSheet = spreadsheet.getSheetByName(
      MONITOR_SETTINGS.sheetName
    );

    if (!namedSheet) {
      throw new Error(
        "指定シート「" +
        MONITOR_SETTINGS.sheetName +
        "」が見つかりません"
      );
    }

    return namedSheet;
  }

  const sheets = spreadsheet.getSheets();

  if (!sheets.length) {
    throw new Error(
      "スプレッドシート内にシートがありません"
    );
  }

  return sheets[0];
}


function createPayload_(sheet, items) {
  return {
    ok: true,
    sheetName: sheet.getName(),
    updatedAt: new Date().toISOString(),
    count: items.length,
    items: items
  };
}


function sanitizeCallback_(value) {
  const callback = String(value || "").trim();

  return /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(
    callback
  )
    ? callback
    : "";
}


function toNumber_(value) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  const normalized = toHalfWidth_(
    String(value || "")
  ).replace(/[,，\s]/g, "");

  const number = Number(normalized);

  return Number.isFinite(number)
    ? number
    : 0;
}


function toPriceNumber_(value) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  const normalized = toHalfWidth_(
    String(value || "")
  ).replace(/[,，\s¥￥円]/g, "");

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}


function toHalfWidth_(value) {
  return value.replace(
    /[０-９．－]/g,
    function(character) {
      return String.fromCharCode(
        character.charCodeAt(0) - 0xfee0
      );
    }
  );
}


function extractImageUrl_(
  rawValue,
  displayValue,
  formula
) {
  if (
    rawValue &&
    typeof rawValue.getContentUrl === "function"
  ) {
    try {
      return rawValue.getContentUrl();
    } catch (error) {
      console.warn(
        "セル画像URLを取得できませんでした",
        error
      );
    }
  }

  const formulaText = String(formula || "");
  const imageFormula = formulaText.match(
    /^=IMAGE\(\s*["']([^"']+)["']/i
  );

  if (imageFormula) {
    return normalizeImageUrl_(imageFormula[1]);
  }

  const value = String(
    rawValue || displayValue || ""
  ).trim();

  return normalizeImageUrl_(value);
}


function normalizeImageUrl_(url) {
  if (!url) {
    return "";
  }

  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/
  ];

  for (let index = 0; index < patterns.length; index += 1) {
    const match = url.match(patterns[index]);

    if (match) {
      return (
        "https://drive.google.com/thumbnail?id=" +
        match[1] +
        "&sz=w1000"
      );
    }
  }

  return url;
}


// Apps Scriptエディタから実行すると、抽出結果をログで確認できます。
function testMonitorData() {
  const payload = getMonitorPayload_();
  console.log(
    JSON.stringify(payload, null, 2)
  );
}
