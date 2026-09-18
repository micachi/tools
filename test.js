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
const pages = ["index.html", "qr/index.html", "mojicount/index.html", "color/index.html"];
for (const p of pages) {
  const f = path.join(DIST, p);
  ok(p + " が存在し 5KB 超", fs.existsSync(f) && fs.statSync(f).size > 5000,
    fs.existsSync(f) ? (fs.statSync(f).size / 1024).toFixed(1) + "KB" : "なし");
}

console.log("\n=== 2. 相互リンク構造（全ページが他全ページへ参照） ===");
const targets = ["pwgen", "travel-budget", "qr/", "mojicount/", "color/"];
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

console.log(`\n---- ${pass} passed, ${fail} failed ----\n`);
process.exit(fail ? 1 : 0);
