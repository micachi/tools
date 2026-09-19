(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  const L = __loc({
    ja: {
      please: "JSON を貼り付けてください",
      invalid: "✕ 不正な JSON です",
      at: (line, col) => `　${line} 行目 ${col} 列付近`,
      valid: "✓ 有効な JSON",
      counts: (s, kb) => `キー ${s.keys} ／ オブジェクト ${s.objects} ／ 配列 ${s.arrays} ／ 文字列 ${s.strings} ／ 数値 ${s.numbers} ／ 最大深さ ${s.depth} ／ 出力 ${kb} KB`,
      copied: "✓ コピー完了", copyBtn: "出力をコピー",
      sample: '{"name":"例","items":[1,2,3],"nested":{"a":true},"note":"\\u65e5\\u672c\\u8a9e"}',
    },
    en: {
      please: "Paste some JSON",
      invalid: "✕ Invalid JSON",
      at: (line, col) => `　near line ${line}, column ${col}`,
      valid: "✓ Valid JSON",
      counts: (s, kb) => `${s.keys} keys ／ ${s.objects} objects ／ ${s.arrays} arrays ／ ${s.strings} strings ／ ${s.numbers} numbers ／ max depth ${s.depth} ／ ${kb} KB out`,
      copied: "✓ Copied", copyBtn: "Copy output",
      sample: '{"name":"example","items":[1,2,3],"nested":{"a":true},"note":"\\u65e5\\u672c\\u8a9e"}',
    },
  });

  // JSON.parse の "position N" から行・列を割り出す
  function locate(src, err) {
    const m = /position (\d+)/.exec(err.message);
    if (!m) return null;
    const pos = +m[1];
    const before = src.slice(0, pos);
    const line = (before.match(/\n/g) || []).length + 1;
    const col = pos - before.lastIndexOf("\n");
    return { line, col, pos };
  }

  function stats(v, d = 0) {
    let keys = 0, arrays = 0, objects = 0, depth = d, strings = 0, numbers = 0;
    if (Array.isArray(v)) {
      arrays++;
      for (const x of v) {
        const s = stats(x, d + 1);
        keys += s.keys; arrays += s.arrays; objects += s.objects; strings += s.strings; numbers += s.numbers;
        depth = Math.max(depth, s.depth);
      }
    } else if (v && typeof v === "object") {
      objects++;
      for (const [k, x] of Object.entries(v)) {
        keys++;
        const s = stats(x, d + 1);
        keys += s.keys; arrays += s.arrays; objects += s.objects; strings += s.strings; numbers += s.numbers;
        depth = Math.max(depth, s.depth);
      }
    } else if (typeof v === "string") strings++;
    else if (typeof v === "number") numbers++;
    return { keys, arrays, objects, strings, numbers, depth };
  }

  function run(mode) {
    const src = $("src").value;
    const out = $("out");
    const st = $("status");
    if (!src.trim()) { out.value = ""; st.innerHTML = `<span class="sub">${L.please}</span>`; $("copy").disabled = true; return; }

    let data;
    try {
      data = JSON.parse(src);
    } catch (e) {
      const loc = locate(src, e);
      out.value = "";
      $("copy").disabled = true;
      st.innerHTML = `<span class="err">${L.invalid}</span>` +
        (loc ? `<span class="sub">${L.at(loc.line, loc.col)} — ${e.message.replace(/\n.*/s, "")}</span>`
            : `<span class="sub">　${e.message}</span>`);
      return;
    }

    const indent = $("indent").value === "tab" ? "\t" : Number($("indent").value);
    let text;
    if (mode === "min") text = JSON.stringify(data);
    else if (mode === "unescape") {
      text = JSON.stringify(data, null, indent).replace(/\\u([0-9a-fA-F]{4})/g,
        (_, h) => String.fromCharCode(parseInt(h, 16)));
    } else text = JSON.stringify(data, null, indent);

    out.value = text;
    $("copy").disabled = false;
    const s = stats(data);
    st.innerHTML = `<span class="ok">${L.valid}</span> ` +
      `<span class="sub">${L.counts(s, (text.length / 1024).toFixed(1))}</span>`;
  }

  $("fmt").addEventListener("click", () => run("fmt"));
  $("min").addEventListener("click", () => run("min"));
  $("unesc").addEventListener("click", () => run("unescape"));
  $("indent").addEventListener("change", () => run("fmt"));
  $("src").addEventListener("input", () => run("fmt"));
  $("clear").addEventListener("click", () => { $("src").value = ""; run("fmt"); });
  $("copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("out").value);
      $("copy").textContent = L.copied; setTimeout(() => ($("copy").textContent = L.copyBtn), 1200); } catch {}
  });
  $("src").value = L.sample;
  run("fmt");
})();
