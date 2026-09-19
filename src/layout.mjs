/**
 * 単一のレイアウト定義。全ページ・全サイトモジュールがここを共有する。
 * ナビの同期問題はこれが単一ソースになることで解消される。
 */

// ── サイトマップ（ナビの単一ソース） ──────────────────────────
export const SITE = [
  { cat: "作成・生成", items: [
    { slug: "qr",          title: "QRコード生成" },
    { slug: "intunestart", title: "Intune スタートレイアウト" },
    { slug: "edge-favorites", title: "Edge マネージドお気に入り" },
    { slug: "password",    title: "パスワード一括生成" },
  ]},
  { cat: "検査・整形", items: [
    { slug: "mojicount", title: "文字数カウンター" },
    { slug: "color",     title: "色・コントラスト検査" },
    { slug: "json",      title: "JSON 整形・検証" },
  ]},
  { cat: "計算", items: [
    { slug: "unit",   title: "単位変換" },
    { slug: "datecalc", title: "日付計算" },
    { slug: "travel", title: "旅行予算シミュレーター" },
  ]},
];

export const ALL = SITE.flatMap((g) => g.items);
export const titleOf = (slug) => (ALL.find((i) => i.slug === slug) || {}).title || slug;

// ── AdSense ─────────────────────────────────────────────────
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

// ── ナビ（ドロップダウン＋カテゴリ分组） ──────────────────────
export function nav(active, base = "./") {
  const cur = active === "index" ? "一覧" : titleOf(active);
  const groups = SITE.map((g) => {
    const items = g.items.map((it) => {
      const on = it.slug === active ? ' class="on" aria-current="page"' : "";
      return `          <a href="${base}${it.slug}/"${on}>${it.title}</a>`;
    }).join("\n");
    return `        <div class="dd-group"><span class="dd-cat">${g.cat}</span>\n${items}\n        </div>`;
  }).join("\n");

  return `<nav class="nav"><div class="nav-in">
  <a class="nav-brand" href="${base}">🧰 便利ツール</a>
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

// ── フッター ────────────────────────────────────────────────
export function footer(base = "./") {
  return `<footer class="foot">
  <div class="foot-links">
    <a href="${base}">🧰 ツール一覧</a>
${ALL.map((i) => `    <a href="${base}${i.slug}/">${i.title}</a>`).join("\n")}
  </div>
  <p>ツールへ入力した内容はサーバーに送信されず、すべてブラウザ内で処理されます。
  ページを保存すればオフラインでも動作します。</p>
  <p class="sub">QR Code は DENSO WAVE INCORPORATED の登録商標です。QRコード生成に MIT ライセンスの qrcode-generator を使用しています。</p>
  <p class="sub"><b>本サイトは Google AdSense を利用しています。</b>ページ閲覧・広告表示の際に
  ページURL・リファラ・User-Agent・Cookie 等が Google へ送信され、サイト横断の広告配信に使われる可能性があります。
  非追跡を望む場合はブラウザの追跡防止機能をご利用ください。</p>
</footer>`;
}

// ── ページ全体 ──────────────────────────────────────────────
export function renderPage({ title, desc, body, css, js = "", active = "index", base = "./", ad = true }) {
  const adHtml = ad ? adUnit() : "";
  // プレースホルダがあればその位置に、無ければ本文末尾（フッター直前）に広告を置く。
  // 配置忘れで広告が1つも出ない、という事故を防ぐ。
  let bodyHtml = body;
  if (bodyHtml.includes("<!--@AD@-->")) {
    bodyHtml = bodyHtml.replace("<!--@AD@-->", () => adHtml);
  } else {
    bodyHtml = bodyHtml.replace(/\s*$/, "") + "\n\n" + adHtml + "\n";
  }
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
${AD_LOADER}
<style>
${css}
</style>
</head>
<body>
${nav(active, base)}
<div class="wrap">
${bodyHtml}
${footer(base)}
</div>
${js ? `<script>${js}</script>` : ""}
</body>
</html>`;
}
