#!/usr/bin/env node
/**
 * 統合ビルド。全サイト（ハブ + 8ツール + 旅行予算）を dist/ に生成する。
 * レイアウト・ナビ・広告定義は src/layout.mjs に一本化してある。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPage } from "./src/layout.mjs";
import { buildTravel } from "./src/travel.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "dist");

const css = readFileSync(join(SRC, "style.css"), "utf8");
const safe = (s) => s.replace(/<\/script>/gi, "<\\/script>");
const readJs = (...names) => names.map((n) => readFileSync(join(SRC, "js", `${n}.js`), "utf8")).join("\n");

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

// slug → { js: [file...], vendor? }
const TOOLS = [
  { slug: "qr",          title: "QRコード生成｜便利ツール",              desc: "テキスト・URL・日本語対応のQRコードをブラウザ内で即生成。復元レベルやサイズを指定でき、PNGでダウンロードできます。", files: ["qr"], vendor: true },
  { slug: "mojicount",   title: "文字数カウンター｜便利ツール",        desc: "書記素・コードポイント・バイト数・行数をリアルタイム集計。X(Twitter)280字判定と全角→半角一括変換つき。" },
  { slug: "color",       title: "色・コントラスト検査｜便利ツール",      desc: "HEX/RGB/HSLの相互変換と、WCAG AA/AAAに準拠したテキストのコントラスト比を自動判定します。" },
  { slug: "json",        title: "JSON 整形・検証｜便利ツール",           desc: "JSONの整形・圧縮・バリデーション。エラーは行と列を指し示し、\\uエスケープされた日本語も可読化できます。" },
  { slug: "unit",        title: "単位変換｜便利ツール",                  desc: "長さ・重さ・面積・容量・温度・データ容量・速さ・時間の8カテゴリを全単位へ同時変換。匁・坪・升など和単位にも対応。" },
  { slug: "datecalc",    title: "日付計算｜便利ツール",                  desc: "日付の加算・2日付の差・営業日数・満年齢をUTC基準で正確に計算。タイムゾーンと夏時間のズレを排除しています。" },
  { slug: "intunestart", title: "Intune スタートメニュー レイアウト生成｜便利ツール", desc: "Windows 11 の LayoutModification.json を生成。Intune 設定カタログにそのまま投入でき、applyOnce のバージョン制限や AUMID 形式を検証します。", files: ["intunestart-core", "intunestart"] },
  { slug: "password",    title: "パスワード一括生成｜便利ツール",         desc: "暗号学的乱数で複数パスワードを一括生成。個数・文字数・文字種を指定でき、生成処理はブラウザ内で完結します。", files: ["password-core", "password-app"] },
  { slug: "edge-favorites", title: "Edge マネージドお気に入り生成｜便利ツール", desc: "Microsoft Edge の ManagedFavorites ポリシー用 JSON をフォルダツリー編集で生成。Intune 設定カタログにそのまま投入できます。", files: ["edge-favorites-core", "edge-favorites"] },
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const made = [];

// ハブ
writeFileSync(join(OUT, "index.html"), renderPage({
  title: "便利ツール集｜ブラウザ内で完結する小ツール",
  desc: "QRコード生成・文字数カウント・色コントラスト検査・JSON整形・単位変換・日付計算・Intuneレイアウト生成・パスワード生成。",
  body: readFileSync(join(SRC, "pages", "index.html"), "utf8"),
  css, active: "index", base: "./", ad: true,
}));
made.push("index.html");

// 各ツール
for (const t of TOOLS) {
  mkdirSync(join(OUT, t.slug), { recursive: true });
  const body = readFileSync(join(SRC, "pages", `${t.slug}.html`), "utf8");
  let js = "";
  if (t.vendor) js = safe(vendorQr() + "\n" + readJs(...(t.files || [t.slug])));
  else js = safe(readJs(...(t.files || [t.slug])));

  writeFileSync(join(OUT, t.slug, "index.html"), renderPage({
    title: t.title, desc: t.desc, body, css, js,
    active: t.slug, base: "../", ad: true,
  }));
  made.push(`${t.slug}/index.html`);
}

// 旅行予算（為替取得が必要なため別モジュール）
try {
  const n = await buildTravel({ OUT, css });
  made.push(`travel/index.html +${n}都市`);
} catch (e) {
  console.error("⚠ 旅行予算の生成に失敗:", e.message);
  process.exitCode = 1;
}

const total = made.reduce((a, f) => {
  const p = join(OUT, f.replace(/.*\+.*$/, "index.html"));
  try { return a + readFileSync(p, "utf8").length; } catch { return a; }
}, 0);
console.log(`OK  ${made.length} 系統生成 → dist/`);
made.forEach((f) => console.log("    " + f));
