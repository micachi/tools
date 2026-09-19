/**
 * 旅行予算シミュレーター（tools 統合版）
 * ECB 公式為替をビルド時に取得し、dist/travel/ に静的生成する。
 * ※ クライアント描画ではなくビルド時描画にしてある — 初期 HTML に数値が乗るため
 *    SEO・AdSense 審査上有利。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPage } from "./layout.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FX_API = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=JPY,EUR,KRW,CNY,TWD,AUD,THB,GBP";

async function fetchRates() {
  const res = await fetch(FX_API, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`FX API ${res.status}`);
  const json = await res.json();
  if (!json.rates?.JPY) throw new Error("JPY rate missing");
  return json;
}

const yen = (n) => Math.round(n).toLocaleString("ja-JP");

export async function buildTravel({ OUT, css }) {
  const cfg = JSON.parse(readFileSync(join(ROOT, "src", "countries.json"), "utf8"));
  const { rates, date } = await fetchRates();
  const generated = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
  const jpy = rates.JPY;

  const dir = join(OUT, "travel");
  mkdirSync(dir, { recursive: true });

  const rows = cfg.countries.map((c) => {
    const daily = c.dailyUSD * jpy;
    const min = daily * c.days[0];
    const max = daily * c.days[1];
    return `      <tr>
        <td><a href="./${c.id}/">${c.name}</a></td>
        <td>${c.region}</td>
        <td class="num">${yen(daily)}</td>
        <td class="num">${yen(min)} 〜 ${yen(max)}</td>
        <td class="num">${c.days[0]}〜${c.days[1]}日</td>
      </tr>`;
  }).join("\n");

  const body = `
<h1>海外旅行 予算シミュレーター</h1>
<p class="lead">${date} 時点の ECB（欧州中央銀行）公式為替で自動計算 ・ 毎日自動更新</p>

<div class="fx">
  <span>1 USD = <b>${jpy.toFixed(2)}</b> JPY</span>
  <span class="sub">出典: European Central Bank（APIキー不要・毎日自動取得）</span>
</div>

<div class="panel">
  <label class="field"><span>行き先</span>
    <select id="dest">${cfg.countries.map((c) => `<option value="${c.dailyUSD}">${c.name}</option>`).join("")}</select>
  </label>
  <div class="grid">
    <label class="field"><span>日数 <b id="dVal">7</b></span>
      <input type="range" id="days" min="1" max="30" value="7"></label>
    <label class="field"><span>人数 <b id="pVal">2</b></span>
      <input type="range" id="ppl" min="1" max="8" value="2"></label>
  </div>
  <div class="total">合計: <b id="out">—</b></div>
  <p class="sub" style="margin:10px 0 0">※ 中間グレード（ホテル3つ星相当・食事・市内交通・観光込み）の目安です。航空券は含みません。</p>
</div>

<table>
  <thead><tr><th>都市</th><th>地域</th><th class="num">1日/人</th><th class="num">推奨期間の総額(1人)</th><th class="num">目安</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>

<p class="sub" style="margin-top:16px">最終更新: ${generated} JST ・ データ: ECB Frankfurter API<br>
本サイトは概算です。実際の料金は時期・為替変動により大きく変わります。</p>
`;

  const js = `
(function(){
  var FX = ${jpy.toFixed(2)};
  function calc(){
    var usd = +document.getElementById("dest").value;
    var d = +document.getElementById("days").value;
    var p = +document.getElementById("ppl").value;
    document.getElementById("dVal").textContent = d;
    document.getElementById("pVal").textContent = p;
    document.getElementById("out").textContent =
      Math.round(usd*FX*d*p).toLocaleString("ja-JP") + " 円（1人 " + Math.round(usd*FX*d).toLocaleString("ja-JP") + " 円）";
  }
  ["dest","days","ppl"].forEach(function(id){ document.getElementById(id).addEventListener("input", calc); });
  calc();
})();`;

  writeFileSync(join(dir, "index.html"), renderPage({
    title: "海外旅行 予算シミュレーター｜今日の為替で自動計算",
    desc: `${date} 時点のECB公式為替で、主要都市の1日あたり旅行予算と総額を自動計算します。毎日自動更新。`,
    body, css, js, active: "travel", base: "../", ad: true,
  }));

  // 都市別ページ
  for (const c of cfg.countries) {
    const d2 = join(dir, c.id);
    mkdirSync(d2, { recursive: true });
    const daily = c.dailyUSD * jpy;
    const cbody = `
<h1>${c.name} 旅行 予算の目安</h1>
<p>${date} 時点の ECB 公式為替（1ドル = ${rates.JPY.toFixed(2)}円）で算出しています。</p>
<p class="big">1日あたり 約${yen(daily)}円</p>
<table>
<tr><th>推奨日数</th><td>${c.days[0]}〜${c.days[1]}日</td></tr>
<tr><th>1人の総額目安</th><td>${yen(daily * c.days[0])}〜${yen(daily * c.days[1])}円</td></tr>
<tr><th>2人の総額目安</th><td>${yen(daily * c.days[0] * 2)}〜${yen(daily * c.days[1] * 2)}円</td></tr>
<tr><th>地域</th><td>${c.region}</td></tr>
</table>
<p><a href="../">← 他の都市と比較する</a></p>
<p class="sub">※ 中間グレード（ホテル3つ星相当・食事・市内交通・観光込み）の概算です。航空券は含みません。為替により変動します。</p>
`;
    writeFileSync(join(d2, "index.html"), renderPage({
      title: `${c.name} 旅行 予算の目安｜${c.days[0]}〜${c.days[1]}日`,
      desc: `${date} 時点の為替で算出。${c.name}の1日あたり予算は約${yen(daily)}円、${c.days[0]}〜${c.days[1]}日なら約${yen(daily * c.days[0])}〜${yen(daily * c.days[1])}円。`,
      body: cbody, css, active: "travel", base: "../../", ad: true,
    }));
  }

  return cfg.countries.length;
}
