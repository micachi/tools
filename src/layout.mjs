/**
 * 単一のレイアウト定義。全ページ・全ロケールがここを共有する。
 * ナビ・広告・フッターの同期問題はこれが単一ソースになることで解消される。
 */

// ── ロケール定義 ──────────────────────────────────────────
export const LANGS = ["ja", "en"];

export const UI = {
  ja: {
    htmlLang: "ja",
    brand: "🧰 便利ツール",
    menuLabel: "ツールメニュー",
    listLabel: "一覧",
    home: "/",
    adLabel: "広告",
    footHome: "🧰 ツール一覧",
    footPrivacy: "ツールへ入力した内容はサーバーに送信されず、すべてブラウザ内で処理されます。ページを保存すればオフラインでも動作します。",
    footTrademark: "QR Code は DENSO WAVE INCORPORATED の登録商標です。QRコード生成に MIT ライセンスの qrcode-generator を使用しています。",
    footAds: "<b>本サイトは Google AdSense を利用しています。</b>ページ閲覧・広告表示の際にページURL・リファラ・User-Agent・Cookie 等が Google へ送信され、サイト横断の広告配信に使われる可能性があります。非追跡を望む場合はブラウザの追跡防止機能をご利用ください。",
    langSwitch: "English",
  },
  en: {
    htmlLang: "en",
    brand: "🧰 Web Tools",
    menuLabel: "Tool menu",
    listLabel: "All tools",
    home: "/en/",
    adLabel: "Advertisement",
    footHome: "🧰 All tools",
    footPrivacy: "Everything you type stays in your browser — your input is never sent to a server. Save the page and it keeps working offline.",
    footTrademark: "QR Code is a registered trademark of DENSO WAVE INCORPORATED. QR generation uses the MIT-licensed qrcode-generator.",
    footAds: "<b>This site uses Google AdSense.</b> When you view a page, Google may receive the page URL, referrer, user agent and cookies, which may be used for cross-site ad targeting. Use your browser's tracking-protection feature if you prefer not to be tracked.",
    langSwitch: "日本語",
  },
};

// ── サイトマップ（ナビの単一ソース） ──────────────────────
export const SITE = [
  { cat: { ja: "作成・生成", en: "Create & generate" }, items: [
    { slug: "qr",             title: { ja: "QRコード生成", en: "QR Code Generator" } },
    { slug: "intunestart",    title: { ja: "Intune スタートレイアウト", en: "Intune Start Layout" } },
    { slug: "edge-favorites", title: { ja: "Edge マネージドお気に入り", en: "Edge Managed Favorites" } },
    { slug: "password",       title: { ja: "パスワード一括生成", en: "Bulk Password Generator" } },
  ]},
  { cat: { ja: "検査・整形", en: "Inspect & format" }, items: [
    { slug: "mojicount", title: { ja: "文字数カウンター", en: "Character Counter" } },
    { slug: "color",     title: { ja: "色・コントラスト検査", en: "Color & Contrast Checker" } },
    { slug: "json",      title: { ja: "JSON 整形・検証", en: "JSON Formatter & Validator" } },
  ]},
  { cat: { ja: "計算", en: "Calculators" }, items: [
    { slug: "unit",     title: { ja: "単位変換", en: "Unit Converter" } },
    { slug: "datecalc", title: { ja: "日付計算", en: "Date Calculator" } },
  ]},
];

export const ALL = SITE.flatMap((g) => g.items);

const pick = (v, lang) => (v && typeof v === "object" ? (v[lang] ?? v.ja) : v);
export const titleOf = (slug, lang = "ja") => {
  const it = ALL.find((i) => i.slug === slug);
  return it ? pick(it.title, lang) : slug;
};

/** 対象 slug の「指定ロケール」の絶対パス（言語切替・hreflang 用） */
export function altPath(slug, lang) {
  const dir = slug === "index" ? "" : `${slug}/`;
  return lang === "en" ? `/en/${dir}` : `/${dir}`;
}

// ── AdSense ───────────────────────────────────────────────
export const ADSENSE_CLIENT = "ca-pub-2675858646142277";
export const ADSENSE_SLOT = "5777667714";

export const AD_LOADER =
  `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;

/**
 * 広告ユニット。Google ポリシーにより「広告」である旨の明示が必須。
 * 操作ボタンの直近に置くと誤クリック誘発でポリシー違反リスクになるため、
 * 必ずコンテンツブロックの間に配置する。
 */
export function adUnit(label = "広告") {
  return `<div class="adwrap">
  <p class="adlabel">${label}</p>
  <ins class="adsbygoogle" style="display:block"
       data-ad-client="${ADSENSE_CLIENT}"
       data-ad-slot="${ADSENSE_SLOT}"
       data-ad-format="auto"
       data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;
}

// ── ナビ（ドロップダウン＋カテゴリ分组＋言語切替） ─────────
export function nav(active, base = "./", lang = "ja") {
  const u = UI[lang];
  const cur = active === "index" ? u.listLabel : titleOf(active, lang);
  const groups = SITE.map((g) => {
    const items = g.items.map((it) => {
      const on = it.slug === active ? ' class="on" aria-current="page"' : "";
      return `          <a href="${base}${it.slug}/"${on}>${pick(it.title, lang)}</a>`;
    }).join("\n");
    return `        <div class="dd-group"><span class="dd-cat">${pick(g.cat, lang)}</span>\n${items}\n        </div>`;
  }).join("\n");

  const alt = altPath(active, lang === "ja" ? "en" : "ja");

  return `<nav class="nav"><div class="nav-in">
  <a class="nav-brand" href="${base}">${u.brand}</a>
  <div class="dd">
    <button type="button" class="dd-btn" id="ddBtn" aria-expanded="false" aria-controls="ddMenu">${u.menuLabel} <span class="caret">▾</span></button>
    <div class="dd-menu" id="ddMenu" role="menu" hidden>
${groups}
    </div>
  </div>
  <span class="nav-cur">${cur}</span>
  <a class="langbtn" href="${alt}" hreflang="${lang === "ja" ? "en" : "ja"}">${u.langSwitch}</a>
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

// ── フッター ────────────────────────────────────────────────
export function footer(base = "./", lang = "ja") {
  const u = UI[lang];
  return `<footer class="foot">
  <div class="foot-links">
    <a href="${base}">${u.footHome}</a>
${ALL.map((i) => `    <a href="${base}${i.slug}/">${pick(i.title, lang)}</a>`).join("\n")}
  </div>
  <p>${u.footPrivacy}</p>
  <p class="sub">${u.footTrademark}</p>
  <p class="sub">${u.footAds}</p>
</footer>`;
}

// ── SEO: hreflang / x-default / canonical ─────────────────
function seoHead(slug, lang, canonicalBase) {
  const ja = altPath(slug, "ja");
  const en = altPath(slug, "en");
  const abs = (p) => canonicalBase + p;
  return `<link rel="canonical" href="${abs(lang === "en" ? en : ja)}">
<link rel="alternate" hreflang="ja" href="${abs(ja)}">
<link rel="alternate" hreflang="en" href="${abs(en)}">
<link rel="alternate" hreflang="x-default" href="${abs(ja)}">`;
}

// ── ページ全体 ──────────────────────────────────────────────
export function renderPage({ title, desc, body, css, js = "", active = "index", base = "./", ad = true, lang = "ja", canonicalBase = "https://tools.wicachi.com" }) {
  const u = UI[lang];
  const adHtml = ad ? adUnit(u.adLabel) : "";
  // プレースホルダがあればその位置に、無ければ本文末尾（フッター直前）に広告を置く。
  // 配置忘れで広告が1つも出ない、という事故を防ぐ。
  let bodyHtml = body;
  if (bodyHtml.includes("<!--@AD@-->")) {
    bodyHtml = bodyHtml.replace("<!--@AD@-->", () => adHtml);
  } else {
    bodyHtml = bodyHtml.replace(/\s*$/, "") + "\n\n" + adHtml + "\n";
  }
  return `<!doctype html>
<html lang="${u.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${lang === "ja" ? "ja_JP" : "en_US"}">
${seoHead(active, lang, canonicalBase)}
${AD_LOADER}
<style>
${css}
</style>
</head>
<body>
${nav(active, base, lang)}
<div class="wrap">
${bodyHtml}
${footer(base, lang)}
</div>
${js ? `<script>${js}</script>` : ""}
</body>
</html>`;
}
