(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  const L = __loc({
    ja: {
      veryStrong: "非常に強い", strong: "強い", ok: "まあまあ", weak: "弱い", bad: "不適切",
      bitsLabel: (b, s) => `${b} bit（${s}）`,
      poolInfo: (n) => `使用文字プール ${n} 種 ／ 生成条件は変更後に「生成する」で反映されます`,
      noClass: "文字種を1つ以上選んでください",
      copy: "コピー", done: "✓ 完了", copyFail: "コピー失敗",
      generated: (n, b) => `✓ ${n} 件を生成しました（推定 ${b} bit）`,
      genFirst: "⚠ 先に生成してください",
      copiedAll: (n) => `✓ ${n} 件をクリップボードにコピーしました`,
      copyErr: "⚠ コピーできませんでした（ブラウザの権限設定を確認してください）",
      logTitle: "# パスワード生成ログ",
      when: (t) => `# 生成日時: ${t}`,
      spec: (len, cls, amb) => `# 文字数: ${len} / 文字種: ${cls} / 紛らわしい文字除外: ${amb}`,
      warn: "# 注意: このファイルを平文で放置するのは危険です。保管場所と削除時期を必ず決めてください。",
      yes: "あり", no: "なし", clsMap: { upper: "大", lower: "小", digits: "数", symbols: "記" },
      saved: "✓ ダウンロードしました", loc: "ja-JP",
    },
    en: {
      veryStrong: "very strong", strong: "strong", ok: "moderate", weak: "weak", bad: "unacceptable",
      bitsLabel: (b, s) => `${b} bit (${s})`,
      poolInfo: (n) => `Character pool: ${n} ／ change settings and press “Generate” to apply`,
      noClass: "Select at least one character class",
      copy: "Copy", done: "✓ Done", copyFail: "Copy failed",
      generated: (n, b) => `✓ Generated ${n} password(s) (est. ${b} bit)`,
      genFirst: "⚠ Generate first",
      copiedAll: (n) => `✓ Copied ${n} password(s) to the clipboard`,
      copyErr: "⚠ Could not copy (check the browser's permission settings)",
      logTitle: "# Password generation log",
      when: (t) => `# Generated at: ${t}`,
      spec: (len, cls, amb) => `# Length: ${len} / Classes: ${cls} / Ambiguous excluded: ${amb}`,
      warn: "# Warning: keeping this file in plaintext is risky. Decide where to store it and when to delete it.",
      yes: "yes", no: "no", clsMap: { upper: "A-Z", lower: "a-z", digits: "0-9", symbols: "symbols" },
      saved: "✓ Downloaded", loc: "en-US",
    },
  });

  const readOpt = () => ({
    count: +$("count").value,
    length: +$("length").value,
    upper: $("upper").checked,
    lower: $("lower").checked,
    digits: $("digits").checked,
    symbols: $("symbols").checked,
    excludeAmbiguous: $("excludeAmbiguous").checked,
    letterFirst: $("letterFirst").checked,
    noRepeat: $("noRepeat").checked,
    excludeChars: $("excludeChars").value,
  });

  const setStatus = (msg, cls = "") => {
    const el = $("status");
    el.textContent = msg;
    el.className = "status " + cls;
  };

  const strength = (bits) => {
    if (bits >= 90) return { w: "100%", c: "var(--ok)", label: L.veryStrong };
    if (bits >= 70) return { w: "78%", c: "#7fd97f", label: L.strong };
    if (bits >= 50) return { w: "52%", c: "var(--warn)", label: L.ok };
    if (bits >= 36) return { w: "32%", c: "#ff8f5a", label: L.weak };
    return { w: "14%", c: "var(--bad)", label: L.bad };
  };

  let current = [];

  function render() {
    const opt = readOpt();
    $("countVal").textContent = opt.count;
    $("lenVal").textContent = opt.length;

    let est;
    try { est = PG.estimate(opt); } catch (e) { est = { bits: 0, poolSize: 0 }; }

    const s = strength(est.bits);
    const bar = $("bar");
    bar.style.width = s.w;
    bar.style.background = s.c;
    $("bits").textContent = est.bits ? L.bitsLabel(est.bits.toFixed(1), s.label) : "—";
    $("crack").textContent = est.bits ? PG.crackTime(est.bits) : "—";
    $("poolInfo").textContent = est.poolSize ? L.poolInfo(est.poolSize) : L.noClass;
  }

  function generate() {
    const opt = readOpt();
    try {
      current = PG.generateBatch(opt);
    } catch (e) {
      setStatus("⚠ " + e.message, "err");
      $("resultPanel").hidden = true;
      return;
    }
    const est = PG.estimate(opt);
    const list = $("list");
    list.innerHTML = "";
    current.forEach((pw, i) => {
      const li = document.createElement("li");
      const code = document.createElement("code");
      code.textContent = pw;
      const btn = document.createElement("button");
      btn.textContent = L.copy;
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(pw);
          btn.textContent = L.done;
          setTimeout(() => (btn.textContent = L.copy), 1200);
        } catch {
          btn.textContent = L.copyFail;
        }
      });
      li.append(code, btn);
      list.appendChild(li);
    });
    $("resultPanel").hidden = false;
    setStatus(L.generated(current.length, est.bits.toFixed(1)), "ok");
  }

  async function copyAll() {
    if (!current.length) return setStatus(L.genFirst, "err");
    try {
      await navigator.clipboard.writeText(current.join("\n"));
      setStatus(L.copiedAll(current.length), "ok");
    } catch {
      setStatus(L.copyErr, "err");
    }
  }

  function save() {
    if (!current.length) return setStatus(L.genFirst, "err");
    const opt = readOpt();
    const head = [
      L.logTitle,
      L.when(new Date().toLocaleString(L.loc)),
      L.spec(opt.length,
        ["upper", "lower", "digits", "symbols"].filter((k) => opt[k]).map((k) => L.clsMap[k]).join(""),
        opt.excludeAmbiguous ? L.yes : L.no),
      L.warn,
      "",
    ].join("\n");
    const blob = new Blob([head + current.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `passwords-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus(L.saved, "ok");
  }

  ["count", "length", "upper", "lower", "digits", "symbols",
   "excludeAmbiguous", "letterFirst", "noRepeat", "excludeChars"].forEach((id) => {
    $(id).addEventListener("input", render);
    $(id).addEventListener("change", render);
  });
  $("gen").addEventListener("click", generate);
  $("copyAll").addEventListener("click", copyAll);
  $("save").addEventListener("click", save);

  render();
  generate(); // 初期表示から結果を出す
})();
