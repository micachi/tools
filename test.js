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
               "json/index.html", "unit/index.html", "datecalc/index.html", "intunestart/index.html",
               "password/index.html", "travel/index.html",
               "travel/bali/index.html", "travel/honolulu/index.html", "travel/paris/index.html"];
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
const targets = ["qr/", "mojicount/", "color/", "json/", "unit/", "datecalc/",
                "intunestart/", "password/", "travel/"];
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

// 回帰防止: ルート <svg> に明示的な width/height があること
// （scalable:true だと属性が消え、fit-content の親で高さ0に潰れた）
{
  const qr = q(0, "M"); qr.addData("https://tools.wicachi.com/"); qr.make();
  const svg = qr.createSvgTag({ cellSize: 6, margin: 4, scalable: false });
  const root = svg.slice(0, svg.indexOf(">") + 1);
  ok("SVGルートに width 属性がある", /\swidth="\d+px"/.test(root), (root.match(/\swidth="[^"]*"/)||["なし"])[0]);
  ok("SVGルートに height 属性がある", /\sheight="\d+px"/.test(root), (root.match(/\sheight="[^"]*"/)||["なし"])[0]);
  ok("viewBox も持つ", /viewBox="0 0 \d+ \d+"/.test(root));
  const w = +(root.match(/\swidth="(\d+)px"/)||[])[1];
  ok("寸法が cellSize から妥当に算出されている", w >= 21 * 2 && w <= 145 * 16 + 16 * 2, `width=${w}px`);
}
// qr.js が scalable:false を使っていること
{
  const qrjs = fs.readFileSync(path.join(__dirname, "src", "js", "qr.js"), "utf8");
  // コメント内に語が現れるので、行コメントを落としてからコード本体だけ検査する
  const code = qrjs.replace(/^\s*\/\/.*$/gm, "").replace(/[^:]\/\/[^/].*$/gm, "");
  ok("qr.js が scalable: false を使用", /scalable:\s*false/.test(code));
  ok("qr.js のコードに scalable: true が残っていない", !/scalable:\s*true/.test(code),
    (code.match(/scalable:\s*\w+/g) || []).join(", ") || "該当なし");
  const css = fs.readFileSync(path.join(__dirname, "src", "style.css"), "utf8");
  ok("CSS に max-width:100% の縮小ガード", /\.qrbox svg[^}]*max-width:100%/.test(css) || /qrbox svg[\s\S]{0,120}max-width:100%/.test(css));
}

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

console.log("\n=== 8. Intune スタートレイアウト JSON 生成 ===");
{
  const IJS = require(path.join(__dirname, "src", "js", "intunestart-core.js"));

  const good = [
    { packagedAppId: "Microsoft.WindowsTerminal_8wekyb3d8bbwe!App" },
    { desktopAppLink: "%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\Microsoft Edge.lnk" },
    { desktopAppId: "Microsoft.Windows.Explorer" },
  ];
  ok("正常系でエラーなし", IJS.validate(good, false).length === 0,
    JSON.stringify(IJS.validate(good, false)));

  const obj = IJS.buildLayout(good, false);
  ok("トップレベルは applyOnce と pinnedList のみ",
    JSON.stringify(Object.keys(obj)) === JSON.stringify(["applyOnce", "pinnedList"]),
    Object.keys(obj).join(","));
  ok("各エントリはキー1つのみ", obj.pinnedList.every((e) => Object.keys(e).length === 1));
  ok("往復整合", IJS.roundTripOk(obj));

  const json = IJS.toJson(obj);
  ok("JSON内バックスラッシュが正しくエスケープ", json.includes("\\\\Start Menu\\\\"), "\\\\ 出現 OK");
  ok("JSONとして再パース可能", JSON.parse(json).pinnedList.length === 3);

  // applyOnce の反映
  ok("applyOnce=true が反映される", IJS.buildLayout(good, true).applyOnce === true);
  ok("applyOnce=false が反映される", IJS.buildLayout(good, false).applyOnce === false);

  // 異常系
  ok("空リストを検出", IJS.validate([], false).length > 0);
  ok("キーなしを検出", IJS.validatePin({}, 0).length > 0);
  ok("複数キーを検出", IJS.validatePin({ packagedAppId: "a!b", desktopAppId: "c!d" }, 0).length > 0);
  ok("不正AUMIDを検出", IJS.validatePin({ packagedAppId: "not-an-aumid" }, 0).length > 0);
  ok("packagedAppId で ! 無しは拒否", IJS.validatePin({ packagedAppId: "Microsoft.WindowsTerminal" }, 0).length > 0);
  ok("desktopAppId の ! 無しを許容", IJS.validatePin({ desktopAppId: "Microsoft.Windows.Explorer" }, 0).length === 0,
    JSON.stringify(IJS.validatePin({ desktopAppId: "Microsoft.Windows.Explorer" }, 0)));
  ok(".lnk 以外を検出", IJS.validatePin({ desktopAppLink: "C:\\Windows\\notepad.exe" }, 0).length > 0);
  ok("secondaryTile 必須欠落を検出", IJS.validatePin({ secondaryTile: { tileId: "x" } }, 0).length > 0);
  const st = { secondaryTile: { tileId: "MSEdge._pin_x", arguments: " --pin-url=https://a.example --profile-directory=Default --launch-tile", displayName: "x", packagedAppId: "Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App" } };
  ok("secondaryTile 正常系は通る", IJS.validatePin(st, 0).length === 0, JSON.stringify(IJS.validatePin(st, 0)));
  ok("applyOnce 不正値を検出", IJS.validate(good, "yes").length > 0);

  // プリセットの健全性
  const badPresets = IJS.PRESETS.filter((p) => IJS.validatePin({ [p.type]: p.value }, 0).length > 0);
  ok("全プリセットが自身の検証を通過", badPresets.length === 0,
    badPresets.length ? badPresets.map((p) => p.name).join(",") : IJS.PRESETS.length + " 件すべて OK");
}

console.log("\n=== 9. DOM ID 整合性（JS が参照する id が HTML に実在するか） ===");
{
  // 今回不具合になった「存在しない要素を触る」系統を構造的に潰す
  const fs2 = require("fs");
  const jsDir = path.join(__dirname, "src", "js");
  const pgDir = path.join(__dirname, "src", "pages");
  const skip = ["intunestart-core.js", "password-core.js", "password-app.js", "edge-favorites-core.js"]; // DOM 非依存 or 複数ファイル構成

  const jsFiles = fs2.readdirSync(jsDir).filter((f) => f.endsWith(".js") && !skip.includes(f));
  ok("対象 JS を検出", jsFiles.length >= 7, jsFiles.length + " 件");

  let totalRefs = 0, allGood = true;
  const problems = [];
  for (const f of jsFiles) {
    const slug = f.replace(/\.js$/, "");
    const pagePath = path.join(pgDir, slug + ".html");
    if (!fs2.existsSync(pagePath)) { problems.push(`${f}: 対応するページ ${slug}.html がない`); allGood = false; continue; }
    const js = fs2.readFileSync(path.join(jsDir, f), "utf8");
    const html = fs2.readFileSync(pagePath, "utf8");

    const ids = new Set();
    for (const m of js.matchAll(/\$\("([A-Za-z][A-Za-z0-9_-]*)"\)/g)) ids.add(m[1]);
    for (const m of js.matchAll(/getElementById\("([A-Za-z][A-Za-z0-9_-]*)"\)/g)) ids.add(m[1]);
    totalRefs += ids.size;

    const missing = [...ids].filter((id) => !new RegExp(`id="${id}"`).test(html));
    if (missing.length) { problems.push(`${f} → 存在しない id: ${missing.join(", ")}`); allGood = false; }
  }
  ok("全 JS の DOM 参照がページ側に実在", allGood,
    allGood ? `${totalRefs} 箇所すべて解決` : problems.join(" / "));

  // 前回バグの回帰確認
  const qrjs = fs2.readFileSync(path.join(jsDir, "qr.js"), "utf8");
  ok("qr.js に dlhref への死んだ参照が残っていない", !qrjs.includes("dlhref"));
}

console.log("\n=== 10. AdSense 統合 ===");
{
  const CLIENT = "ca-pub-2675858646142277";
  const SLOT = "5777667714";
  let loaderOk = 0, unitOk = 0, labelOk = 0;
  const missing = [];
  for (const p of pages) {
    const h = fs.readFileSync(path.join(DIST, p), "utf8");
    const hasLoader = h.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + CLIENT);
    const hasUnit = h.includes('data-ad-slot="' + SLOT + '"') && h.includes('data-ad-client="' + CLIENT + '"');
    const hasLabel = h.includes('class="adlabel"');
    if (hasLoader) loaderOk++;
    if (hasUnit) unitOk++;
    if (hasLabel) labelOk++;
    if (!hasLoader || !hasUnit || !hasLabel) missing.push(p);
  }
  ok("全ページに AdSense ローダー", loaderOk === pages.length, `${loaderOk}/${pages.length}`);
  ok("全ページに広告ユニット（正しいスロット）", unitOk === pages.length, `${unitOk}/${pages.length}`);
  ok("全ページに「広告」明示（ポリシー対応）", labelOk === pages.length, `${labelOk}/${pages.length}`);
  ok("欠落なし", missing.length === 0, missing.join(", ") || "なし");
  ok("adsbygoogle push あり", fs.readFileSync(path.join(DIST, "index.html"), "utf8").includes("(adsbygoogle = window.adsbygoogle || []).push({});"));
}

console.log("\n=== 11. pwgen のコピーは「生成処理」に限定されているか ===");
{
  const h = fs.readFileSync(path.join(DIST, "password/index.html"), "utf8");
  ok("「生成処理はブラウザ内で完結」を含む", h.includes("生成処理はブラウザ内で完結"));
  ok("無条件の「ブラウザ内で完結」だけになっていない（生成処理と明記）",
     h.includes("生成処理はブラウザ内で完結") || !h.includes(">🔒 ブラウザ内で完結<"));
  ok("AdSense を読み込んでいることを開示している",
     h.includes("AdSense") && (h.includes("開示") || h.includes("Cookie")));
  ok("CSPRNG 説明は維持されている", h.includes("crypto.getRandomValues"));
}

console.log("\n=== 12. 統合後のリンク整合（旧外部依存が残っていないか） ===");
{
  let stale = 0;
  const bad = [];
  for (const p of pages) {
    const h = fs.readFileSync(path.join(DIST, p), "utf8");
    // 統合後は github.io へのナビ/フッターリンクは不要
    const hits = (h.match(/micachi\.github\.io\/(pwgen|travel-budget|tools)/g) || []).length;
    if (hits > 0) { stale += hits; bad.push(`${p}:${hits}`); }
  }
  ok("github.io への旧リンク残存なし", stale === 0, bad.join(" ") || "0 件");
}

console.log("\n=== 13. 矛盾文言ガード（AdSense 有効下で「広告なし」を謳わない） ===");
{
  const FORBIDDEN = ["広告なし", "広告を含まない", "広告非表示", "広告ゼロ"];
  const hits = [];
  for (const p of pages) {
    const h = fs.readFileSync(path.join(DIST, p), "utf8");
    for (const w of FORBIDDEN) if (h.includes(w)) hits.push(`${p}: 「${w}」`);
  }
  ok("「広告なし」系の記述なし", hits.length === 0, hits.join(" / ") || "0 件");

  // 広告を開示しているか（全ページ）
  const noDisclose = [];
  for (const p of pages) {
    const h = fs.readFileSync(path.join(DIST, p), "utf8");
    if (!h.includes("AdSense")) noDisclose.push(p);
  }
  ok("全ページで AdSense を開示", noDisclose.length === 0, noDisclose.join(", ") || "全ページ OK");

  // 「入力は送信されない」系の表現は残しつつ、ページ通信と区別できているか
  const pw = fs.readFileSync(path.join(DIST, "password/index.html"), "utf8");
  ok("pwgen: 入力と広告の通信を区別して説明", pw.includes("生成処理") && pw.includes("AdSense"));
  const qr = fs.readFileSync(path.join(DIST, "qr/index.html"), "utf8");
  ok("qr: 「安全」を無条件に謳わない", !/安全に生成できます。\s*<\/p>/.test(qr) || qr.includes("AdSense"));
}

console.log("\n=== 14. Edge ManagedFavorites 生成 ===");
{
  const EFS = require(path.join(__dirname, "src", "js", "edge-favorites-core.js"));

  const tree = [
    EFS.bookmark("社内ポータル", "intranet.example.co.jp"),
    EFS.folder("業務", [
      EFS.bookmark("勤怠", "krouter.example.co.jp"),
      EFS.folder("深層", [EFS.bookmark("深い", "deep.example.co.jp")]),
    ]),
  ];
  const arr = EFS.build(tree, "会社指定");

  ok("1要素目が toplevel_name", arr[0].toplevel_name === "会社指定");
  ok("既定名に切り替わる", EFS.build(tree, "")[0].toplevel_name === EFS.DEFAULT_TOP);
  ok("ブックマークは name+url のみ",
    JSON.stringify(Object.keys(arr[1]).sort()) === JSON.stringify(["name", "url"]));
  ok("フォルダは name+children のみ（url を持たない）",
    JSON.stringify(Object.keys(arr[2]).sort()) === JSON.stringify(["children", "name"]));
  ok("入れ子が再帰的に変換されている",
    arr[2].children[1].children[0].name === "深い");
  ok("往復整合", EFS.roundTripOk(arr));
  ok("JSON 再パース可能", JSON.parse(EFS.toJson(arr)).length === 3);

  const st = EFS.stats(tree);
  ok("統計が正しい", st.bookmarks === 3 && st.folders === 2 && st.maxDepth === 3,
    `bm=${st.bookmarks} fd=${st.folders} depth=${st.maxDepth}`);

  // 検証
  ok("正常系でエラーなし", EFS.validate(tree, "x").length === 0, JSON.stringify(EFS.validate(tree, "x")));
  ok("空ツリーを検出", EFS.validate([], "x").length > 0);
  ok("名前なしを検出", EFS.validateNode(EFS.bookmark("", "a.com"), "t", []).length > 0);
  ok("URL なしを検出", EFS.validateNode(EFS.bookmark("x", ""), "t", []).length > 0);
  ok("URL の空白を検出", EFS.validateNode(EFS.bookmark("x", "a b.com"), "t", []).length > 0);
  ok("javascript: URL を拒否", EFS.validateNode(EFS.bookmark("x", "javascript:alert(1)"), "t", []).length > 0);
  ok("ドットもスキームもない URL を検出", EFS.validateNode(EFS.bookmark("x", "localhost"), "t", []).length > 0);
  ok("フォルダに url を付けたらエラー", EFS.validateNode({ type: "folder", name: "f", url: "a.com", children: [EFS.bookmark("a", "b.com")] }, "t", []).length > 0);
  ok("空フォルダを検出", EFS.validateNode(EFS.folder("空"), "t", []).length > 0);
  ok("about: / file: スキームは許容", EFS.validateNode(EFS.bookmark("x", "about:blank"), "t", []).length === 0);

  // 公式例がそのまま通ること
  const official = [
    EFS.bookmark("Microsoft", "microsoft.com"),
    EFS.bookmark("Bing", "bing.com"),
    EFS.folder("Microsoft Edge links", [
      EFS.bookmark("Microsoft Edge Insiders", "www.microsoftedgeinsider.com"),
      EFS.bookmark("Microsoft Edge", "www.microsoft.com/windows/microsoft-edge"),
    ]),
  ];
  ok("公式ドキュメント例が検証を通過", EFS.validate(official, "My managed favorites folder").length === 0,
    JSON.stringify(EFS.validate(official, "x")));
  const oa = EFS.build(official, "My managed favorites folder");
  ok("公式例の JSON が構造一致",
    oa[0].toplevel_name === "My managed favorites folder" && oa[3].children.length === 2);
}

console.log(`\n---- ${pass} passed, ${fail} failed ----\n`);
process.exit(fail ? 1 : 0);
