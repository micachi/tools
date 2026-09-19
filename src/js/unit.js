(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  // 和単位は英語圏でも名称が通らないためローマ字を併記する
  const JP_EN = {
    "リ": "ri", "間": "ken", "町": "chō",
    "匁": "mon", "貫": "kan",
    "a (アール)": "are", "坪": "tsubo", "反": "tan",
    "合": "gō", "升": "shō", "斗": "to", "石": "koku",
    "knot (ノット)": "knot", "ノット": "knot",
    "月(30日)": "month (30d)", "年(365日)": "year (365d)",
  };
  const disp = (u) => (__LANG === "en" ? (JP_EN[u] || u) : u);

  const L = __loc({
    ja: {
      cats: { length: "長さ", mass: "重さ", area: "面積", volume: "容量", temp: "温度", data: "データ容量", speed: "速さ", time: "時間" },
      needNum: "数値を入力してください", kelvin: "K（ケルビン）", loc: "ja-JP",
    },
    en: {
      cats: { length: "Length", mass: "Mass", area: "Area", volume: "Volume", temp: "Temperature", data: "Data size", speed: "Speed", time: "Time" },
      needNum: "Enter a number", kelvin: "K (kelvin)", loc: "en-US",
    },
  });

  // 基準単位（カテゴリ内で1つ）に対する係数
  const CATS = {
    length: { label: "長さ", base: "m", units: {
      "mm": 0.001, "cm": 0.01, "m": 1, "km": 1000,
      "inch (in)": 0.0254, "foot (ft)": 0.3048, "yard (yd)": 0.9144,
      "mile (mi)": 1609.344, "リ": 0.303, "間": 1.818, "町": 109.09,
    }},
    mass: { label: "重さ", base: "kg", units: {
      "mg": 1e-6, "g": 0.001, "kg": 1, "t": 1000,
      "oz": 0.0283495, "lb": 0.453592, "匁": 0.00375, "貫": 3.75,
    }},
    area: { label: "面積", base: "m2", units: {
      "cm2": 1e-4, "m2": 1, "ha": 10000, "km2": 1e6,
      "a (アール)": 100, "坪": 3.305785, "反": 991.736, "町": 9917.36,
      "acre": 4046.856, "hectare": 10000,
    }},
    volume: { label: "容量", base: "L", units: {
      "mL": 0.001, "L": 1, "m3": 1000,
      "cc": 0.001, "合": 0.18039, "升": 1.8039, "斗": 18.039, "石": 180.39,
      "gal (US)": 3.78541, "fl oz (US)": 0.0295735,
    }},
    data: { label: "データ容量", base: "byte", units: {
      "byte": 1, "KB": 1e3, "MB": 1e6, "GB": 1e9, "TB": 1e12,
      "KiB": 1024, "MiB": 1048576, "GiB": 1073741824, "TiB": 1099511627776,
    }},
    speed: { label: "速さ", base: "m/s", units: {
      "m/s": 1, "km/h": 1 / 3.6, "m/min": 1 / 60,
      "mph": 0.44704, "knot (ノット)": 0.514444, "ノット": 0.514444,
    }},
    time: { label: "時間", base: "s", units: {
      "ms": 0.001, "s": 1, "min": 60, "h": 3600, "day": 86400,
      "week": 604800, "月(30日)": 2592000, "年(365日)": 31536000,
    }},
  };

  const fmt = (n) => {
    if (!isFinite(n)) return "—";
    const a = Math.abs(n);
    if (a === 0) return "0";
    if (a >= 1e15 || a < 1e-6) return n.toExponential(6);
    if (a >= 1) return n.toLocaleString(L.loc, { maximumFractionDigits: 6 });
    return n.toLocaleString(L.loc, { maximumFractionDigits: 10 });
  };

  // 温度は係数では表せない（オフセットあり）ので特別扱い
  function convertTemp(v, from) {
    const c = from === "C" ? v : from === "F" ? (v - 32) * 5 / 9 : v - 273.15;
    return { C: c, F: c * 9 / 5 + 32, K: c + 273.15 };
  }

  let cat = "length";

  function buildUnits() {
    const sel = $("from");
    sel.innerHTML = "";
    const c = CATS[cat];
    Object.keys(c.units).forEach((u) => {
      const o = document.createElement("option");
      o.value = u; o.textContent = disp(u);
      if (u === c.base) o.selected = true;
      sel.appendChild(o);
    });
  }

  function render() {
    const v = parseFloat($("val").value);
    const grid = $("grid");
    if (!isFinite(v)) { grid.innerHTML = `<p class="sub">${L.needNum}</p>`; return; }

    if (cat === "temp") {
      const r = convertTemp(v, $("from").value);
      grid.innerHTML = `
        <div class="stat"><span class="v">${fmt(r.C)}</span><span class="k">℃</span></div>
        <div class="stat"><span class="v">${fmt(r.F)}</span><span class="k">℉</span></div>
        <div class="stat"><span class="v">${fmt(r.K)}</span><span class="k">${L.kelvin}</span></div>`;
      return;
    }

    const c = CATS[cat];
    const from = $("from").value;
    const baseVal = v * c.units[from];
    grid.innerHTML = Object.entries(c.units)
      .map(([u, f]) => `<div class="stat"><span class="v">${fmt(baseVal / f)}</span><span class="k">${disp(u)}</span></div>`)
      .join("");
  }

  function setCat(next) {
    cat = next;
    const sel = $("from");
    if (cat === "temp") {
      sel.innerHTML = "";
      [["C", "℃"], ["F", "℉"], ["K", "K"]].forEach(([v, l]) => {
        const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o);
      });
    } else buildUnits();
    render();
  }

  $("cat").addEventListener("change", (e) => setCat(e.target.value));
  $("from").addEventListener("change", render);
  $("val").addEventListener("input", render);
  $("swap").addEventListener("click", () => {
    const first = $("grid").querySelector(".v");
    if (first && first.textContent !== "—") {
      const t = first.textContent.replace(/,/g, "");
      if (isFinite(parseFloat(t))) $("val").value = t;
    }
  });
  setCat("length");
})();
