#!/usr/bin/env node
/**
 * 統合ビルド。全サイト（ハブ + 各ツール × ja/en）を dist/ に生成する。
 * レイアウト・ナビ・広告定義は src/layout.mjs に一本化してある。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPage } from "./src/layout.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "dist");

const css = readFileSync(join(SRC, "style.css"), "utf8");
const safe = (s) => s.replace(/<\/script>/gi, "<\\/script>");

// 各ツール JS の先頭に注入する共通 i18n ヘルパ。
// 言語は <html lang> から判定する（ビルド時に確定しているが、実行時判定にしておくと
// ページ差し替え・テストが容易になる）。
const I18N_PRELUDE = `const __LANG = (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ja";\nconst __loc = (d) => d[__LANG] || d.ja;\n`;
const readJs = (...names) => I18N_PRELUDE + names.map((n) => readFileSync(join(SRC, "js", `${n}.js`), "utf8")).join("\n");

// ベンダー（ES module → グローバル化）
function vendorQr() {
  let s = readFileSync(join(ROOT, "vendor", "qrcode.mjs"), "utf8")
    .replace(/^export const qrcode = function/m, "const qrcode = function")
    .replace(/^export default qrcode;?$/m, "")
    .replace(/^export const stringToBytes = .*$/m, "");
  const u = readFileSync(join(ROOT, "vendor", "qrcode_UTF8.mjs"), "utf8")
    .replace(/^export const stringToBytes = toUTF8Array;?$/m, "");
  // 日本語・絵文字を UTF-8 バイトとして符号化させる
  return s + "\n" + u + "\nqrcode.stringToBytes = toUTF8Array;\n";
}

// slug → { meta: {ja,en}, js: [file...], vendor? }
const TOOLS = [
  { slug: "qr", files: ["qr"], vendor: true, meta: {
      ja: { title: "QRコード生成｜便利ツール", desc: "テキスト・URL・日本語対応のQRコードをブラウザ内で即生成。復元レベルやサイズを指定でき、PNGでダウンロードできます。" },
      en: { title: "QR Code Generator", desc: "Instant QR codes from text or URLs with full Unicode support. Set the error-correction level and size, then download a PNG." } } },
  { slug: "mojicount", meta: {
      ja: { title: "文字数カウンター｜便利ツール", desc: "書記素・コードポイント・バイト数・行数をリアルタイム集計。X(Twitter)280字判定と全角→半角一括変換つき。" },
      en: { title: "Character Counter", desc: "Live grapheme, code-point, byte and line counts, with X (Twitter) 280-character weighting and full-width to half-width conversion." } } },
  { slug: "color", meta: {
      ja: { title: "色・コントラスト検査｜便利ツール", desc: "HEX/RGB/HSLの相互変換と、WCAG AA/AAAに準拠したテキストのコントラスト比を自動判定します。" },
      en: { title: "Color & Contrast Checker", desc: "Convert HEX/RGB/HSL and automatically judge text contrast against WCAG AA/AAA thresholds." } } },
  { slug: "json", meta: {
      ja: { title: "JSON 整形・検証｜便利ツール", desc: "JSONの整形・圧縮・バリデーション。エラーは行と列を指し示し、\\uエスケープされた日本語も可読化できます。" },
      en: { title: "JSON Formatter & Validator", desc: "Format, minify and validate JSON. Errors report the exact line and column, and escaped Unicode can be made readable." } } },
  { slug: "unit", meta: {
      ja: { title: "単位変換｜便利ツール", desc: "長さ・重さ・面積・容量・温度・データ容量・速さ・時間の8カテゴリを全単位へ同時変換。匁・坪・升など和単位にも対応。" },
      en: { title: "Unit Converter", desc: "Eight categories — length, mass, area, volume, temperature, data, speed and time — converted to every unit at once." } } },
  { slug: "datecalc", meta: {
      ja: { title: "日付計算｜便利ツール", desc: "日付の加算・2日付の差・営業日数・満年齢をUTC基準で正確に計算。タイムゾーンと夏時間のズレを排除しています。" },
      en: { title: "Date Calculator", desc: "Add days, compare two dates, count business days and compute exact age on a UTC basis, free of timezone and DST drift." } } },
  { slug: "intunestart", files: ["intunestart-core", "intunestart"], meta: {
      ja: { title: "Intune スタートメニュー レイアウト生成｜便利ツール", desc: "Windows 11 の LayoutModification.json を生成。Intune 設定カタログにそのまま投入でき、applyOnce のバージョン制限や AUMID 形式を検証します。" },
      en: { title: "Intune Start Layout Generator", desc: "Generate Windows 11 LayoutModification.json, ready for the Intune settings catalog, with applyOnce and AUMID validation." } } },
  { slug: "intune-filter", files: ["intune-filter-core", "intune-filter"], meta: {
      ja: { title: "Intune 割り当てフィルター 生成｜便利ツール", desc: "Intune の割り当てフィルター ルール構文をプロパティと演算子を選ぶだけで生成。公式リファレンス準拠で不正な組み合わせを検出します。" },
      en: { title: "Intune Assignment Filter Generator", desc: "Build Intune assignment filter rule syntax by picking properties and operators, validated against the official reference." } } },
  { slug: "win32-detect", files: ["win32-detect-core", "win32-detect"], meta: {
      ja: { title: "Intune Win32 検出ルール生成｜便利ツール", desc: "Win32 アプリの検出ルール（MSI / ファイル / レジストリ）を検証し、全条件 AND のカスタム検出 PowerShell を生成します。" },
      en: { title: "Intune Win32 Detection Rule Builder", desc: "Validate MSI, file and registry detection rules and generate an all-conditions-AND custom detection PowerShell script." } } },
  { slug: "intune-csp", files: ["intune-csp-core", "intune-csp"], data: "csp-map.json", meta: {
      ja: { title: "Intune OMA-URI / Windows CSP 検索｜便利ツール", desc: "公式の Graph ↔ Windows CSP 対応表 732 件から OMA-URI を検索・合成。先頭 ./ や Vendor/MSFT の形式検証つき。" },
      en: { title: "Intune OMA-URI / Windows CSP Lookup", desc: "Search and compose OMA-URIs from the official 732-entry Graph-to-Windows-CSP mapping, with format validation." } } },
  { slug: "intune-graph", files: ["intune-graph-core", "intune-graph"], meta: {
      ja: { title: "Microsoft Graph（Intune）照会スニペット生成｜便利ツール", desc: "deviceManagement 系リソースの Graph URL を組み立て、PowerShell SDK と curl の両方で出力。必要アプリ権限も表示。" },
      en: { title: "Microsoft Graph (Intune) Query Snippet Builder", desc: "Compose Graph URLs for deviceManagement resources and get both PowerShell SDK and curl snippets with required app permissions." } } },
  { slug: "password", files: ["password-core", "password-app"], meta: {
      ja: { title: "パスワード一括生成｜便利ツール", desc: "暗号学的乱数で複数パスワードを一括生成。個数・文字数・文字種を指定でき、生成処理はブラウザ内で完結します。" },
      en: { title: "Bulk Password Generator", desc: "Generate many passwords from a cryptographic RNG. Set count, length and character classes; generation completes in your browser." } } },
  { slug: "managed-bookmarks", files: ["managed-bookmarks-core", "managed-bookmarks"], meta: {
      ja: { title: "管理対象ブックマーク生成（Edge / Chrome）｜便利ツール", desc: "Edge の ManagedFavorites と Chrome の ManagedBookmarks 用 JSON をフォルダツリー編集で生成。両者同一スキーマなのでターゲット切替だけで使えます。" },
      en: { title: "Managed Bookmarks Generator (Edge / Chrome)", desc: "Build Edge ManagedFavorites and Chrome ManagedBookmarks policy JSON with a folder-tree editor. Identical schema, so switching target is all it takes." } } },
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const made = [];

const HUB = {
  ja: { title: "便利ツール集｜ブラウザ内で完結する小ツール",
        desc: "QRコード生成・文字数カウント・色コントラスト検査・JSON整形・単位変換・日付計算・Intuneレイアウト生成・パスワード生成。" },
  en: { title: "Web Tools — free browser-based utilities",
        desc: "QR code generator, character counter, color contrast checker, JSON formatter, unit converter, date calculator, Intune layout and password generator." },
};

/** 1ロケールのサイトを生成 */
function buildLocale(lang) {
  const p = (rel) => (lang === "ja" ? join(SRC, "pages", rel) : join(SRC, "pages", "en", rel));
  const o = (rel) => (lang === "ja" ? join(OUT, rel) : join(OUT, "en", rel));
  const tag = (s) => (lang === "ja" ? s : s);

  // ハブ
  mkdirSync(o(""), { recursive: true });
  writeFileSync(o("index.html"), renderPage({
    title: HUB[lang].title, desc: HUB[lang].desc,
    body: readFileSync(p("index.html"), "utf8"),
    css, active: "index", base: "./", ad: true, lang,
  }));
  made.push(`${lang === "ja" ? "" : "en/"}index.html`);

  // 各ツール
  for (const t of TOOLS) {
    mkdirSync(o(t.slug), { recursive: true });
    const body = readFileSync(p(`${t.slug}.html`), "utf8");
    const files = t.files || [t.slug];
    let js = "";
    // ビルド時に注入するデータ（自己完結の JS にせず JSON で持つ）
    const prelude = t.data
      ? `const CSP_MAP = ${readFileSync(join(SRC, t.data), "utf8")};\n`
      : "";
    if (t.vendor) js = safe(prelude + vendorQr() + "\n" + readJs(...files));
    else js = safe(prelude + readJs(...files));

    writeFileSync(o(`${t.slug}/index.html`), renderPage({
      title: t.meta[lang].title, desc: t.meta[lang].desc, body, css, js,
      active: t.slug, base: "../", ad: true, lang,
    }));
    made.push(`${lang === "ja" ? "" : "en/"}${t.slug}/index.html`);
  }
}

buildLocale("ja");
buildLocale("en");

// ── 旧 travel URL のリダイレクト（削除済み。検索エンジン・既存ブックマーク対策） ──
const TRAVEL_OLD = ["", "bali/", "bangkok/", "honolulu/", "london/", "newyork/", "paris/", "rome/", "seoul/", "sydney/", "taipei/"];
for (const c of TRAVEL_OLD) {
  mkdirSync(join(OUT, "travel", c), { recursive: true });
  writeFileSync(join(OUT, "travel", c, "index.html"), `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=/">
<link rel="canonical" href="https://tools.wicachi.com/">
<meta name="robots" content="noindex">
<title>このツールは削除されました</title>
</head>
<body>
<p>旅行予算シミュレーターは削除されました。<a href="/">ツール一覧へ移動</a></p>
</body>
</html>
`);
}
made.push("travel/ → / へリダイレクト ×11");

// ── 旧 edge-favorites URL → 統合ページへリダイレクト ──
// 旧: /edge-favorites/ , /en/edge-favorites/
// 新: /managed-bookmarks/ , /managed-bookmarks/
for (const [from, to] of [["edge-favorites/", "/managed-bookmarks/"], ["en/edge-favorites/", "/managed-bookmarks/"]]) {
  mkdirSync(join(OUT, from), { recursive: true });
  const isEn = from.startsWith("en/");
  writeFileSync(join(OUT, from, "index.html"), `<!doctype html>
<html lang="${isEn ? "en" : "ja"}">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${to}">
<link rel="canonical" href="https://tools.wicachi.com${to}">
<link rel="alternate" hreflang="${isEn ? "ja" : "en"}" href="https://tools.wicachi.com/managed-bookmarks/">
<link rel="alternate" hreflang="${isEn ? "en" : "ja"}" href="https://tools.wicachi.com/managed-bookmarks/">
<meta name="robots" content="noindex">
<title>${isEn ? "Moved: Managed Bookmarks (Edge / Chrome)" : "移動しました：管理対象ブックマーク（Edge / Chrome）"}</title>
</head>
<body>
<p>${isEn
  ? `This tool now covers Edge and Chrome together. <a href="${to}">Go to Managed Bookmarks</a>`
  : `このツールは Edge / Chrome を統合して扱います。<a href="${to}">管理対象ブックマークへ移動</a>`}</p>
</body>
</html>
`);
}
made.push("edge-favorites/ → managed-bookmarks/ へリダイレクト ×2");

const total = made.reduce((a, f) => {
  const p = join(OUT, f.replace(/.*\+.*$/, "index.html"));
  try { return a + readFileSync(p, "utf8").length; } catch { return a; }
}, 0);
console.log(`OK  ${made.length} 系統生成 → dist/`);
made.forEach((f) => console.log("    " + f));
