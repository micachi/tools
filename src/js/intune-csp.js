(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const EN = (typeof document !== "undefined" && document.documentElement.getAttribute("lang") === "en");

  const L = EN ? {
    noData: "CSP mapping data is not loaded.",
    hits: (n, total) => `${n} of ${total} entries matched`,
    none: "No entry matches the search.",
    scope: (s) => `Applies to: ${s}`,
    pass: "✓ Valid OMA-URI format",
    errCount: (n) => `✕ ${n} format error(s)`,
    copy: "Copy OMA-URI", copied: "✓ Copied",
    resultHead: (n) => `Search results (${n})`,
    more: (n) => ` (showing top ${n})`,
    clickHint: "Click a row to load it into the builder below.",
  } : {
    noData: "CSP 対応データが読み込まれていません。",
    hits: (n, total) => `対応表 ${total} 件のうち ${n} 件ヒット`,
    none: "検索に一致する項目がありません。",
    scope: (s) => `適用スコープ: ${s}`,
    pass: "✓ OMA-URI 形式 OK",
    errCount: (n) => `✕ 形式エラー ${n} 件`,
    copy: "OMA-URI をコピー", copied: "✓ コピー完了",
    resultHead: (n) => `検索結果（${n} 件）`,
    more: (n) => `（上位 ${n} 件を表示）`,
    clickHint: "行をクリックすると下のビルダーに読み込まれます。",
  };

  if (!ICS.MAP || !ICS.MAP.length) {
    $("results").innerHTML = `<p class="sub">${esc(L.noData)}</p>`;
    return;
  }

  // CSP ルートごとにエントリをグルーピング
  const byCsp = new Map();
  for (const e of ICS.MAP) {
    if (!byCsp.has(e.csp)) byCsp.set(e.csp, []);
    byCsp.get(e.csp).push(e);
  }
  const nodes = ICS.cspNodes();

  function fillCsp(csp, offset) {
    const sel = $("csp");
    sel.innerHTML = nodes.map((n) =>
      `<option value="${esc(n.csp)}">${esc(n.csp)} (${n.count})</option>`).join("");
    if (csp) sel.value = csp;
    fillOffsets(offset);
  }

  function fillOffsets(offset) {
    const csp = $("csp").value;
    const list = byCsp.get(csp) || [];
    const seen = new Set();
    const opts = [];
    for (const e of list) {
      for (const o of (e.offsets || [])) {
        const key = o + "|" + e.prop;
        if (seen.has(key)) continue;
        seen.add(key);
        opts.push({ v: o, label: `${e.prop} — ${o}` });
      }
    }
    opts.sort((a, b) => a.label.localeCompare(b.label, "en"));
    $("offset").innerHTML = opts.map((o) => `<option value="${esc(o.v)}">${esc(o.label)}</option>`).join("");
    if (offset != null) $("offset").value = offset;
    update();
  }

  function update() {
    const uri = ICS.omaUri($("csp").value, $("offset").value);
    $("out").value = uri;
    $("scope").textContent = L.scope(ICS.scopeOf($("csp").value));
    renderValidation(uri);
  }

  function renderValidation(uri) {
    const errs = ICS.validateUri(uri);
    const v = $("validation");
    if (errs.length) {
      v.className = "valid err";
      v.innerHTML = `<b>${L.errCount(errs.length)}</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
    } else {
      v.className = "valid ok";
      v.innerHTML = `<b>${L.pass}</b>`;
    }
    $("cp").disabled = !!errs.length;
  }

  function renderResults(list, total) {
    const box = $("results");
    if (!list.length) { box.innerHTML = `<p class="sub">${esc(L.none)}</p>`; $("hits").textContent = L.hits(0, ICS.MAP.length); return; }
    box.innerHTML = list.map((e) => `
      <div class="csprow" tabindex="0" role="button"
           data-csp="${esc(e.csp)}" data-off="${esc((e.offsets || [])[0] || "")}">
        <div class="cspname">${esc(e.name)}</div>
        <div class="csppath mono">${esc(e.csp)}</div>
        <div class="cspoff mono">${esc((e.offsets || []).join(" , "))}</div>
        <span class="badge ${ICS.scopeOf(e.csp) === "?" ? "fail" : "pass"}">${esc(ICS.scopeOf(e.csp))}</span>
      </div>`).join("");
    const bind = (el) => {
      const load = () => { fillCsp(el.dataset.csp, el.dataset.off); $("out").scrollIntoView({ block: "center" }); };
      el.addEventListener("click", load);
      el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); load(); } });
    };
    box.querySelectorAll(".csprow").forEach(bind);
    // 「ヒット総数」を表示（表示枠で切った数をヒット数と誤解させない）
    $("hits").textContent = L.hits(total != null ? total : list.length, ICS.MAP.length)
      + (total != null && total > list.length ? L.more(list.length) : "");
  }

  $("q").addEventListener("input", () => {
    const q = $("q").value.trim();
    const all = ICS.search(q, 100000);
    renderResults(all.slice(0, 60), all.length);
  });

  $("csp").addEventListener("change", () => fillOffsets());
  $("offset").addEventListener("change", () => update());

  // OMA-URI 欄は直接編集可 → 都度検証
  $("out").addEventListener("input", () => renderValidation($("out").value.trim()));

  $("cp").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("out").value.trim());
      $("cp").textContent = L.copied;
      setTimeout(() => ($("cp").textContent = L.copy), 1200);
    } catch {}
  });

  // 初期状態
  $("stats").textContent = L.hits(ICS.MAP.length, ICS.MAP.length) + ` · ${nodes.length} CSP nodes`;
  fillCsp(nodes[0] ? nodes[0].csp : null);
  renderResults(ICS.MAP.slice(0, 20), ICS.MAP.length);
})();
