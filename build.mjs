#!/usr/bin/env node
/**
 * 共通レイアウト（ナビ + フッター = 相互リンク構造）で各ページを生成し、
 * CSS / ベンダー / ツールJS を1ファイルにインライン化する。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "dist");

// ── 相互リンクの定義（ここを編集すれば全ページに反映） ─────────────
const TOOLS = [
  { slug: "qr",        title: "QRコード生成",        desc: "テキスト・URL・日本語対応のQRコードをブラウザ内で即生成。復元レベルやサイズを指定でき、PNGでダウンロードできます。サーバー送信なし。" },
  { slug: "mojicount", title: "文字数カウンター",  desc: "書記素・コードポイント・バイト数・行数をリアルタイム集計。X(Twitter)280字判定と全角→半角一括変換つき。" },
  { slug: "color",     title: "色・コントラスト検査", desc: "HEX/RGB/HSLの相互変換と、WCAG AA/AAAに準拠したテキストのコントラスト比を自動判定します。" },
  { slug: "json",      title: "JSON 整形・検証",     desc: "JSONの整形・圧縮・バリデーション。エラーは行と列を指し示し、\\uエスケープされた日本語も可読化できます。" },
  { slug: "unit",      title: "単位変換",           desc: "長さ・重さ・面積・容量・温度・データ容量・速さ・時間の8カテゴリを全単位へ同時変換。匁・坪・升など和単位にも対応。" },
  { slug: "datecalc",  title: "日付計算",           desc: "日付の加算・2日付の差・営業日数・満年齢をUTC基準で正確に計算。タイムゾーンと夏時間のズレを排除しています。" },
  { slug: "intunestart", title: "Intune スタートメニュー レイアウト生成", desc: "Windows 11 の LayoutModification.json を生成。Intune 設定カタログにそのまま投入でき、applyOnce のバージョン制限や AUMID 形式を検証します。", files: ["intunestart-core", "intunestart"] },
];
// 外部（別リポジトリ）への相互リンク
const EXTERNAL = [
  { url: "https://micachi.github.io/pwgen/",         title: "パスワード一括生成" },
  { url: "https://micachi.github.io/travel-budget/", title: "旅行予算シミュレーター" },
];
const HUB = "tools";

// カテゴリ分组（3×3）
const CATEGORIES = [
  { cat: "作成・生成", slugs: ["qr", "intunestart", "pwgen"] },
  { cat: "検査・整形", slugs: ["mojicount", "color", "json"] },
  { cat: "計算",     slugs: ["unit", "datecalc", "travel-budget"] },
];
const TITLE = {
  qr: "QRコード生成", mojicount: "文字数カウンター", color: "色・コントラスト検査",
  json: "JSON 整形・検証", unit: "単位変換", datecalc: "日付計算",
  intunestart: "Intune スタートレイアウト",
  pwgen: "パスワード一括生成", "travel-budget": "旅行予算シミュレーター",
};

// depth からの相対ベースを算出（GitHub Pages プロジェクトサイト対応）
const baseFor = (depth) => "../".repeat(depth);

function nav(active, depth) {
  const b = baseFor(depth);
  const hrefOf = (slug) => {
    if (slug === "pwgen") return "https://micachi.github.io/pwgen/";
    if (slug === "travel-budget") return "https://micachi.github.io/travel-budget/";
    return `${b}${slug}/`;
  };
  const cur = active === "index" ? "一覧" : (TITLE[active] || active);

  const groups = CATEGORIES.map((g) => {
    const items = g.slugs.map((s) => {
      const on = s === active ? ' class="on" aria-current="page"' : "";
      return `<a href="${hrefOf(s)}"${on}>${TITLE[s]}</a>`;
    }).join("\n          ");
    return `        <div class="dd-group"><span class="dd-cat">${g.cat}</span>
          ${items}
        </div>`;
  }).join("\n");

  return `<nav class="nav"><div class="nav-in">
  <a class="nav-brand" href="${b || "./"}">🧰 便利ツール</a>
  <div class="dd">
    <button type="button" class="dd-btn" id="ddBtn" aria-expanded="false" aria-controls="ddMenu">ツールメニュー <span class="caret">▾</span></button>
    <div class="dd-menu" id="ddMenu" role="menu" hidden>
${groups}
    </div>
  </div>
  <span class="nav-cur">${cur}</span>
</div></nav>
<script>
(function(){
  var btn=document.getElementById("ddBtn"), menu=document.getElementById("ddMenu");
  if(!btn||!menu)return;
  var open=function(){menu.hidden=false;btn.setAttribute("aria-expanded","true");};
  var close=function(){menu.hidden=true;btn.setAttribute("aria-expanded","false");};
  btn.addEventListener("click",function(e){e.stopPropagation();menu.hidden?open():close();});
  document.addEventListener("click",function(e){if(!menu.contains(e.target)&&e.target!==btn)close();});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"){close();btn.focus();}});
})();
</script>`;
}

function footer(depth) {
  const b = baseFor(depth) || "./";
  return `<footer class="foot">
  <div class="foot-links">
    <a href="${b}">🧰 ツール一覧</a>
    ${TOOLS.map((t) => `<a href="${b}${t.slug}/">${t.title}</a>`).join("\n    ")}
    ${EXTERNAL.map((e) => `<a href="${e.url}" rel="noopener">${e.title}</a>`).join("\n    ")}
  </div>
  <p>すべてのツールはブラウザ内で完結し、入力内容や結果がサーバーに送信されることはありません。
  ページを保存すればオフラインでも動作します。</p>
  <p class="sub">QR Code は DENSO WAVE INCORPORATED の登録商標です。QRコード生成に MIT ライセンスの qrcode-generator を使用しています。</p>
</footer>`;
}

function layout({ slug, title, desc, body, depth, js }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<style>
${css}
</style>
</head>
<body>
${nav(slug, depth)}
<div class="wrap">
${body}
${footer(depth)}
</div>
${js ? `<script>${js}</script>` : ""}
</body>
</html>`;
}

// ── ベンダー（ES module → グローバル化） ────────────────────────
function vendorQr() {
  let s = readFileSync(join(ROOT, "vendor", "qrcode.mjs"), "utf8");
  s = s.replace(/^export const qrcode = function/m, "const qrcode = function");
  s = s.replace(/^export default qrcode;?$/m, "");
  s = s.replace(/^export const stringToBytes = .*$/m, "");
  const u = readFileSync(join(ROOT, "vendor", "qrcode_UTF8.mjs"), "utf8")
    .replace(/^export const stringToBytes = toUTF8Array;?$/m, "");
  // 日本語・絵文字を UTF-8 バイトとして符号化させる
  return s + "\n" + u + "\nqrcode.stringToBytes = toUTF8Array;\n";
}

const css = readFileSync(join(SRC, "style.css"), "utf8");
const safe = (s) => s.replace(/<\/script>/gi, "<\\/script>");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const made = [];

// ハブ
writeFileSync(join(OUT, "index.html"), layout({
  slug: "index",
  title: "便利ツール集｜ブラウザ内で完結する小ツール",
  desc: "QRコード生成・文字数カウント・色コントラスト検査・パスワード生成など、サーバー送信なしで使える無料ツール集。",
  body: readFileSync(join(SRC, "pages", "index.html"), "utf8"),
  depth: 0,
  js: "",
}));
made.push("index.html");

// 各ツール
for (const t of TOOLS) {
  mkdirSync(join(OUT, t.slug), { recursive: true });
  const body = readFileSync(join(SRC, "pages", `${t.slug}.html`), "utf8");
  let js = "";
  if (t.slug === "qr") {
    js = safe(vendorQr() + "\n" + readFileSync(join(SRC, "js", "qr.js"), "utf8"));
  } else {
    const files = t.files || [t.slug];
    js = safe(files.map((f) => readFileSync(join(SRC, "js", `${f}.js`), "utf8")).join("\n"));
  }

  writeFileSync(join(OUT, t.slug, "index.html"), layout({
    slug: t.slug,
    title: `${t.title}｜便利ツール`,
    desc: t.desc,
    body, depth: 1, js,
  }));
  made.push(`${t.slug}/index.html`);
}

const total = made.reduce((a, f) => a + readFileSync(join(OUT, f), "utf8").length, 0);
console.log(`OK  ${made.length} ページ生成 → dist/  (合計 ${(total / 1024).toFixed(1)} KB)`);
made.forEach((f) => console.log("    " + f));
