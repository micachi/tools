(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

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
    if (bits >= 90) return { w: "100%", c: "var(--ok)", label: "非常に強い" };
    if (bits >= 70) return { w: "78%", c: "#7fd97f", label: "強い" };
    if (bits >= 50) return { w: "52%", c: "var(--warn)", label: "まあまあ" };
    if (bits >= 36) return { w: "32%", c: "#ff8f5a", label: "弱い" };
    return { w: "14%", c: "var(--bad)", label: "不適切" };
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
    $("bits").textContent = est.bits ? est.bits.toFixed(1) + " bit（" + s.label + "）" : "—";
    $("crack").textContent = est.bits ? PG.crackTime(est.bits) : "—";
    $("poolInfo").textContent = est.poolSize
      ? `使用文字プール ${est.poolSize} 種 ／ 生成条件は変更後に「生成する」で反映されます`
      : "文字種を1つ以上選んでください";
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
      btn.textContent = "コピー";
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(pw);
          btn.textContent = "✓ 完了";
          setTimeout(() => (btn.textContent = "コピー"), 1200);
        } catch {
          btn.textContent = "コピー失敗";
        }
      });
      li.append(code, btn);
      list.appendChild(li);
    });
    $("resultPanel").hidden = false;
    setStatus(`✓ ${current.length} 件を生成しました（推定 ${est.bits.toFixed(1)} bit）`, "ok");
  }

  async function copyAll() {
    if (!current.length) return setStatus("⚠ 先に生成してください", "err");
    try {
      await navigator.clipboard.writeText(current.join("\n"));
      setStatus(`✓ ${current.length} 件をクリップボードにコピーしました`, "ok");
    } catch {
      setStatus("⚠ コピーできませんでした（ブラウザの権限設定を確認してください）", "err");
    }
  }

  function save() {
    if (!current.length) return setStatus("⚠ 先に生成してください", "err");
    const opt = readOpt();
    const head = [
      "# パスワード生成ログ",
      "# 生成日時: " + new Date().toLocaleString("ja-JP"),
      `# 文字数: ${opt.length} / 文字種: ${
        [["upper","大"],["lower","小"],["digits","数"],["symbols","記"]].filter(([k])=>opt[k]).map(([,v])=>v).join("")
      } / 紛らわしい文字除外: ${opt.excludeAmbiguous ? "あり" : "なし"}`,
      "# 注意: このファイルを平文で放置するのは危険です。保管場所と削除時期を必ず決めてください。",
      "",
    ].join("\n");
    const blob = new Blob([head + current.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `passwords-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("✓ ダウンロードしました", "ok");
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
