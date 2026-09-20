(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  const clamp = (v) => Math.min(255, Math.max(0, v));

  function parseHex(s) {
    s = s.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(s)) s = s.split("").map((c) => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
  }
  const toHex = ({ r, g, b }) =>
    "#" + [r, g, b].map((v) => clamp(Math.round(v)).toString(16).padStart(2, "0")).join("").toUpperCase();

  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    const l = (mx + mn) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return { h, s: s * 100, l: l * 100 };
  }
  function hslToRgb({ h, s, l }) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  }

  // WCAG 相対輝度
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const L = __loc({
    ja: {
      pass: "合格", fail: "不合格",
      aaNorm: "AA 通常テキスト", aaLarge: "AA 拡大テキスト", aaa: "AAA",
      hintGood: "読みやすさは十分です。本文テキストに利用可能。",
      hintLarge: "拡大テキスト（18px以上/太字14px以上）のみ利用可。本文には不向き。",
      hintBad: "コントラスト不足。どちらかの色を変える必要があります。",
      ratioWord: "コントラスト比", copiedShort: "コピー完了", copyBtn: "設定をコピー",
    },
    en: {
      pass: "pass", fail: "fail",
      aaNorm: "AA normal text", aaLarge: "AA large text", aaa: "AAA",
      hintGood: "Readable enough for body text.",
      hintLarge: "Large text only (≥18px, or ≥14px bold). Not suitable for body copy.",
      hintBad: "Insufficient contrast — one of the colors must change.",
      ratioWord: "contrast ratio", copiedShort: "Copied", copyBtn: "Copy settings",
    },
  });

  const badge = (pass, label) =>
    `<span class="badge ${pass ? "pass" : "fail"}">${label} ${pass ? L.pass : L.fail}</span>`;

  let fg = { r: 230, g: 233, b: 238 }, bg = { r: 13, g: 16, b: 23 };

  function apply() {
    const sw = $("swatch");
    sw.style.background = toHex(bg);
    sw.style.color = toHex(fg);
    const c = contrast(fg, bg);
    $("ratio").textContent = c.toFixed(2) + " : 1";
    $("badges").innerHTML =
      badge(c >= 4.5, L.aaNorm) +
      badge(c >= 3.0, L.aaLarge) +
      badge(c >= 7.0, L.aaa);
    $("hint").textContent = c >= 4.5 ? L.hintGood : c >= 3.0 ? L.hintLarge : L.hintBad;
  }

  function showFg() {
    $("fgHex").value = toHex(fg);
    const h = rgbToHsl(fg);
    $("fgOut").textContent = `RGB ${fg.r} ${fg.g} ${fg.b} / HSL ${h.h.toFixed(0)}° ${h.s.toFixed(0)}% ${h.l.toFixed(0)}%`;
  }
  function showBg() {
    $("bgHex").value = toHex(bg);
    const h = rgbToHsl(bg);
    $("bgOut").textContent = `RGB ${bg.r} ${bg.g} ${bg.b} / HSL ${h.h.toFixed(0)}° ${h.s.toFixed(0)}% ${h.l.toFixed(0)}%`;
  }

  function sync() { apply(); showFg(); showBg(); }

  $("fgHex").addEventListener("input", () => { const c = parseHex($("fgHex").value); if (c) { fg = c; sync(); } });
  $("bgHex").addEventListener("input", () => { const c = parseHex($("bgHex").value); if (c) { bg = c; sync(); } });
  $("fgPick").addEventListener("input", () => { fg = parseHex($("fgPick").value) || fg; sync(); });
  $("bgPick").addEventListener("input", () => { bg = parseHex($("bgPick").value) || bg; sync(); });
  $("swap").addEventListener("click", () => { [fg, bg] = [bg, fg]; sync(); });
  $("rand").addEventListener("click", () => {
    const h = Math.floor(Math.random() * 360);
    fg = hslToRgb({ h, s: 70, l: 65 });
    bg = hslToRgb({ h: (h + 180) % 360, s: 40, l: 12 });
    sync();
  });
  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(`${toHex(fg)} on ${toHex(bg)}  ${L.ratioWord} ${contrast(fg, bg).toFixed(2)}`);
      $("copy").textContent = "✓ " + L.copiedShort; setTimeout(() => ($("copy").textContent = L.copyBtn), 1200);
    } catch {}
  });
  sync();
})();
