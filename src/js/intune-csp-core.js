/* Intune OMA-URI / Windows CSP ビルダー — 検索・合成ロジック（テスト可能）

   データ出典（公式）:
     MicrosoftDocs/memdocs /intune/device-configuration/ref-graph-api-csp-windows.md
     "Graph API properties to CSP mapping"  … 732 件を機械抽出
   各エントリ: { name, entity, prop, csp, offsets[] }
     - csp    : CSP ルート（./Device/Vendor/MSFT/... など）
     - offsets: Offset URI（1項目とは限らない）
   カスタム設定の OMA-URI は  <CSP><Offset URI>  の連結。

   注意: ブラウザ（ビルド済み）と Node テストの両方で単独ロードされるため、
        データはビルド時に CSP_MAP として注入する（自己完結の言語判定のみ持つ）。 */
const ICS = (() => {
  "use strict";

  const LANG = (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ja";
  const EN = LANG === "en";

  const MAP = (typeof CSP_MAP !== "undefined" && Array.isArray(CSP_MAP)) ? CSP_MAP : [];

  /** CSP ルートごとの件数（一覧用） */
  function cspNodes() {
    const m = new Map();
    for (const e of MAP) m.set(e.csp, (m.get(e.csp) || 0) + 1);
    return [...m.entries()].map(([csp, count]) => ({ csp, count }))
      .sort((a, b) => b.count - a.count || a.csp.localeCompare(b.csp));
  }

  /** 適用スコープ（./Device/ ./User/ ./Vendor/MSFT/） */
  function scopeOf(csp) {
    if (csp.startsWith("./Device/")) return "Device";
    if (csp.startsWith("./User/")) return "User";
    if (csp.startsWith("./Vendor/MSFT/")) return "Vendor (User/Device 両対応)";
    return "?";
  }

  /** 全文検索（entity / prop / csp / offset） */
  function search(q, limit = 200) {
    const s = (q || "").trim().toLowerCase();
    if (!s) return MAP.slice(0, limit);
    const words = s.split(/\s+/);
    return MAP.filter((e) => {
      const hay = `${e.name} ${e.entity} ${e.prop} ${e.csp} ${e.offsets.join(" ")}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, limit);
  }

  /** OMA-URI 合成: CSP + Offset（先頭スラッシュの重複を整形） */
  function omaUri(csp, offset) {
    const a = String(csp || "").replace(/\/+$/, "");
    let b = String(offset || "").trim();
    if (!b) return a;
    if (!b.startsWith("/")) b = "/" + b;
    return a + b;
  }

  /** 1エントリの全 OMA-URI */
  function urisOf(entry) {
    return (entry.offsets || []).map((o) => omaUri(entry.csp, o));
  }

  /** 生成 OMA-URI の妥当性チェック */
  function validateUri(uri) {
    const errs = [];
    if (!uri) { errs.push(EN ? "Empty OMA-URI" : "OMA-URI が空です"); return errs; }
    if (!/^\.\//.test(uri)) {
      errs.push(EN ? 'Must start with "./" (e.g. ./Device/Vendor/MSFT/...)'
                  : '先頭は "./" である必要があります（例: ./Device/Vendor/MSFT/...）');
    }
    if (!/Vendor\/MSFT\//.test(uri)) {
      errs.push(EN ? 'Must contain "Vendor/MSFT/"' : '"Vendor/MSFT/" を含む必要があります');
    }
    if (/\s/.test(uri)) errs.push(EN ? "Must not contain whitespace" : "空白を含めません");
    if (/\/\//.test(uri.replace(/^\.\//, ""))) {
      errs.push(EN ? "Double slash in the middle (CSP + offset join problem)"
                  : "途中に連続スラッシュ（CSP と Offset の連結が不正）");
    }
    if (uri.length > 1024) errs.push(EN ? "Too long" : "長すぎます");
    return errs;
  }

  /** データの健全性（ビルド確認用） */
  function stats() {
    const badShape = MAP.filter((e) => !e.csp || !Array.isArray(e.offsets) || !e.offsets.length);
    const badUri = MAP.filter((e) => validateUri(omaUri(e.csp, e.offsets[0])).length > 0);
    return { total: MAP.length, badShape: badShape.length, badUri: badUri.length, nodes: cspNodes().length };
  }

  return { MAP, cspNodes, scopeOf, search, omaUri, urisOf, validateUri, stats };
})();

if (typeof module !== "undefined" && module.exports) module.exports = ICS;
if (typeof window !== "undefined") window.ICS = ICS;
