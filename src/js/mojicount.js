(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  const L = __loc({
    ja: {
      ok: "X(Twitter) 投稿可", over: "X(Twitter) 超過", weightLabel: "重み",
      left: (n) => `（残り ${n}）`, excess: (n) => `（${n} 多い）`,
      copied: "✓ コピー完了", copy: "コピー",
    },
    en: {
      ok: "fits in X (Twitter)", over: "over the X (Twitter) limit", weightLabel: "Weight",
      left: (n) => ` (${n} left)`, excess: (n) => ` (${n} over)`,
      copied: "✓ Copied", copy: "Copy",
    },
  });

  const utf8Bytes = (s) => new TextEncoder().encode(s).length;
  const sjisBytes = (s) => {
    try { return new TextEncoder().encode(s).length; } catch { return s.length; }
  };

  // 書記素（絵文字・結合文字を1文字として数える）
  const seg = (typeof Intl !== "undefined" && Intl.Segmenter)
    ? new Intl.Segmenter("ja", { granularity: "grapheme" })
    : null;
  const graphemes = (s) => seg ? [...seg.segment(s)].length : [...s].length;

  const count = (s, re) => (s.match(re) || []).length;

  function render() {
    const s = $("src").value;
    const g = graphemes(s);
    const cp = [...s].length;
    const lines = s ? s.split(/\r\n|\r|\n/).length : 0;
    const words = (s.match(/[A-Za-z0-9À-ÿ一-龥ぁ-んァ-ンー]+/g) || []).length;
    const u8 = utf8Bytes(s);

    const fullAlpha = count(s, /[Ａ-Ｚａ-ｚ０-９]/g);
    const halfAlpha = count(s, /[A-Za-z0-9]/g);
    const fullKana = count(s, /[ァ-ヴー]/g);
    const space = count(s, / /g);
    const crlf = count(s, /\r\n/g);
    const surrogate = cp - s.length; // サロゲートペアによる余剰

    const set = (id, v) => ($(id).textContent = v);
    set("g", g); set("cp", cp); set("lines", lines); set("words", words);
    set("u8", u8); set("fullAlpha", fullAlpha); set("halfAlpha", halfAlpha);
    set("fullKana", fullKana); set("space", space);
    set("crlf", crlf); set("sp", surrogate);

    // X(Twitter) 判定: 重み付け（英数字=1, その他=2）で 280
    const weight = [...s].reduce((a, c) => a + (/[\u0000-\u10FF\u1E00-\u2FFF\uD800-\uDFFF\uE000-\uFFFF]/.test(c) ? 1 : 2), 0);
    const limit = 280;
    const el = $("xlimit");
    if (!s) { el.innerHTML = '<span class="sub">—</span>'; }
    else if (weight <= limit) {
      el.innerHTML = `<span class="ok">✓ ${L.ok}</span> <span class="sub">${L.weightLabel} ${weight} / ${limit}${L.left(weight === limit ? 0 : limit - weight)}</span>`;
    } else {
      el.innerHTML = `<span class="err">✕ ${L.over}</span> <span class="sub">${L.weightLabel} ${weight} / ${limit}${L.excess(weight - limit)}</span>`;
    }
  }

  // 全角→半角 一括変換
  function toHalf() {
    const s = $("src").value;
    $("src").value = s
      .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/ /g, " ")
      .replace(/［/g, "[").replace(/］/g, "]")
      .replace(/〔/g, "(").replace(/〕/g, ")");
    render();
  }

  $("src").addEventListener("input", render);
  $("half").addEventListener("click", toHalf);
  $("clear").addEventListener("click", () => { $("src").value = ""; render(); });
  $("copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("src").value); $("copy").textContent = L.copied;
      setTimeout(() => ($("copy").textContent = L.copy), 1200); } catch {}
  });
  render();
})();
