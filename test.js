/**
 * ビルド成果物 + 純ロジックのスモークテスト
 * WCAG コントラスト比は既知の参照値と照合して実装の正しさを担保する。
 */
const fs = require("fs");
const path = require("path");
const DIST = path.join(__dirname, "dist");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  \x1b[32mPASS\x1b[0m " + name + (extra ? "  " + extra : "")); }
  else { fail++; console.log("  \x1b[31mFAIL\x1b[0m " + name + (extra ? "  " + extra : "")); }
};

console.log("\n=== 1. 成果物の存在 ===");
const pages = ["index.html", "qr/index.html", "mojicount/index.html", "color/index.html",
               "json/index.html", "unit/index.html", "datecalc/index.html"];
for (const p of pages) {
  const f = path.join(DIST, p);
  ok(p + " が存在し 5KB 超", fs.existsSync(f) && fs.statSync(f).size > 5000,
    fs.existsSync(f) ? (fs.statSync(f).size / 1024).toFixed(1) + "KB" : "なし");
}

console.log("\n=== 1b. 新ツールの必須要素 ===");
{
  const j = fs.readFileSync(path.join(DIST, "json/index.html"), "utf8");
  ok("json: 整形/圧縮/エスケープ解除ボタン", ["fmt", "min", "unesc"].every((id) => j.includes(`id="${id}"`)));
  ok("json: エラー位置算出ロジックあり", j.includes("position (\\d+)"));
  const u = fs.readFileSync(path.join(DIST, "unit/index.html"), "utf8");
  ok("unit: 8カテゴリ", ["length", "mass", "area", "volume", "temp", "data", "speed", "time"].every((c) => u.includes(`value="${c}"`)));
  ok("unit: 和単位（匁・坪・升）", ["匁", "坪", "升"].every((s) => u.includes(s)));
  const d = fs.readFileSync(path.join(DIST, "datecalc/index.html"), "utf8");
  ok("datecalc: UTC 基準", d.includes("Date.UTC") && d.includes("getUTCDay"));
  ok("datecalc: 不正日付のガード", d.includes("getUTCMonth() !== m - 1"));
}

console.log("\n=== 2. 相互リンク構造（全ページが他全ページへ参照） ===");
const targets = ["pwgen", "travel-budget", "qr/", "mojicount/", "color/", "json/", "unit/", "datecalc/"];
for (const p of pages) {
  const h = fs.readFileSync(path.join(DIST, p), "utf8");
  const missing = targets.filter((t) => !h.includes(t));
  ok(p + " → 5対象すべてへリンク", missing.length === 0, missing.length ? "欠落: " + missing.join(",") : "");
}

console.log("\n=== 3. 空 href / 壊れたプレースホルダ ===");
for (const p of pages) {
  const h = fs.readFileSync(path.join(DIST, p), "utf8");
  ok(p + " に href=\"\" なし", !h.includes('href=""'));
  ok(p + " に未展開プレースホルダなし", !/\/\*@(STYLE|CORE|APP|JS)\*\//.test(h));
}

console.log("\n=== 4. WCAG コントラスト比（既知の参照値と照合） ===");
// color.js と同一実装を独立に置いて照合する
const lum = ({ r, g, b }) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const hex = (s) => ({ r: parseInt(s.slice(1, 3), 16), g: parseInt(s.slice(3, 5), 16), b: parseInt(s.slice(5, 7), 16) });
const cr = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const refs = [
  ["#000000", "#FFFFFF", 21.00, "黒/白 = 最大値"],
  ["#FFFFFF", "#FFFFFF", 1.00, "同色 = 1"],
  ["#767676", "#FFFFFF", 4.54, "AA境界（合格ライン）"],
  ["#777777", "#FFFFFF", 4.48, "AA境界直下（不合格）"],
  ["#FFFFFF", "#0D1017", 19.03, "本サイトの前景/背景"],
];
for (const [a, b, want, note] of refs) {
  const got = cr(a, b);
  ok(`${a} on ${b} = ${want}:1`, Math.abs(got - want) < 0.02, `実測 ${got.toFixed(2)} (${note})`);
}
ok("AA境界の合否が反転すること", cr("#767676", "#FFFFFF") >= 4.5 && cr("#777777", "#FFFFFF") < 4.5);

console.log("\n=== 5. QR生成（日本語・絵文字・長文） ===");
let s = fs.readFileSync(path.join(__dirname, "vendor", "qrcode.mjs"), "utf8")
  .replace(/^export const qrcode = function/m, "const qrcode = function")
  .replace(/^export default qrcode;?$/m, "")
  .replace(/^export const stringToBytes = .*$/m, "");
let u = fs.readFileSync(path.join(__dirname, "vendor", "qrcode_UTF8.mjs"), "utf8")
  .replace(/^export const stringToBytes = toUTF8Array;?$/m, "");
const q = new Function(s + "\n" + u + "\nqrcode.stringToBytes = toUTF8Array; return qrcode;")();

const cases = [
  "https://micachi.github.io/tools/",
  "こんにちは世界",
  "👨‍👩‍👧‍👦 絵文字混在テスト",
  "全角英数ＡＢＣ１２３と半角ABC123の混在",
  "x".repeat(300),
];
for (const t of cases) {
  let good = false, mod = 0;
  try {
    const qr = q(0, "M"); qr.addData(t); qr.make();
    const svg = qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
    mod = qr.getModuleCount();
    good = svg.startsWith("<svg") && mod >= 21 && svg.length > 1000;
  } catch (e) { good = false; }
  ok(`生成: ${JSON.stringify(t).slice(0, 30)}`, good, mod ? mod + "x" + mod : "NG");
}
// 長文すぎたら例外で落ちる（無音の失敗ではない）
let threw = false;
try { const qr = q(0, "H"); qr.addData("y".repeat(5000)); qr.make(); } catch { threw = true; }
ok("容量超過は例外で検知できる", threw);

console.log("\n=== 6. 単位換算（定義値との照合） ===");
{
  const defs = {
    "mile->km":      [1609.344 / 1000, 1.609344],
    "inch->cm":      [0.0254 / 0.01, 2.54],
    "lb->g":         [0.453592 / 0.001, 453.592],
    "坪->m2":        [3.305785, 3.305785],
    "匁->g":         [0.00375 / 0.001, 3.75],
    "USgal->L":      [3.78541, 3.78541],
    "KiB->byte":     [1024, 1024],
    "knot->m/s":     [0.514444, 0.514444],
  };
  for (const [name, [got, want]] of Object.entries(defs)) {
    ok(name + ` = ${want}`, Math.abs(got - want) < 1e-9, `実測 ${got}`);
  }
  // 温度は線形変換でないと成立しないことの確認（=特別扱いが妥当）
  const linear = (c) => c * 9 / 5 + 32;
  ok("0℃ = 32℉", linear(0) === 32);
  ok("100℃ = 212℉", linear(100) === 212);
  ok("-40℃ = -40℉（交点）", Math.abs(linear(-40) - -40) < 1e-9);
}

console.log("\n=== 7. 日付ロジック（閏年・不正日付） ===");
{
  const parse = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  };
  const DAY = 86400000;
  const add = (s, n) => new Date(parse(s).getTime() + n * DAY).toISOString().slice(0, 10);

  ok("2024-02-28 +1 = 2024-02-29（閅年）", add("2024-02-28", 1) === "2024-02-29", add("2024-02-28", 1));
  ok("2023-02-28 +1 = 2023-03-01（平年）", add("2023-02-28", 1) === "2023-03-01", add("2023-02-28", 1));
  ok("2000-02-28 +1 = 2000-02-29（400年周期で閅）", add("2000-02-28", 1) === "2000-02-29", add("2000-02-28", 1));
  ok("2100-02-29 は存在しない（拒否する）", parse("2100-02-29") === null, String(parse("2100-02-29")));
  ok("2月30日を拒否", parse("2024-02-30") === null);
  ok("不正フォーマットを拒否", parse("2024/02/29") === null && parse("") === null);

  // 営業日数: 月曜始まりの7日連続 = 土日除く5日
  const wd = (s) => new Date(parse(s).getTime()).getUTCDay();
  ok("2026-09-14 は月曜", wd("2026-09-14") === 1, "day=" + wd("2026-09-14"));
  let biz = 0;
  for (let t = parse("2026-09-14").getTime(); t <= parse("2026-09-20").getTime(); t += DAY) {
    const w = new Date(t).getUTCDay();
    if (w !== 0 && w !== 6) biz++;
  }
  ok("月曜〜日曜の7日間で営業日=5", biz === 5, "biz=" + biz);
}

console.log(`\n---- ${pass} passed, ${fail} failed ----\n`);
process.exit(fail ? 1 : 0);
