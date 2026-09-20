(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const EN = (typeof document !== "undefined" && document.documentElement.getAttribute("lang") === "en");

  const L = EN ? {
    pass: "✓ Query is valid",
    errCount: (n) => `✕ ${n} error(s)`,
    perm: (p) => `Required application permission: ${p}`,
    noFields: "No documented $select fields for this resource.",
    fields: (n) => `$select fields (${n} selected)`,
    copy: "Copy", copied: "✓ Copied",
    modes: { url: "URL", ps: "PowerShell", curl: "curl" },
  } : {
    pass: "✓ クエリ妥当",
    errCount: (n) => `✕ エラー ${n} 件`,
    perm: (p) => `必要なアプリ権限: ${p}`,
    noFields: "このリソースに $select できる既知フィールドはありません。",
    fields: (n) => `$select フィールド（${n} 個選択中）`,
    copy: "コピー", copied: "✓ コピー完了",
    modes: { url: "URL", ps: "PowerShell", curl: "curl" },
  };

  let mode = "url";

  function state() {
    return {
      version: $("ver").value,
      path: $("res").value,
      filter: $("filter").value.trim(),
      orderBy: $("orderby").value.trim(),
      top: $("top").value.trim(),
      count: $("count").checked,
      select: [...document.querySelectorAll('#selectFields input:checked')].map((i) => i.value),
    };
  }

  function fillResources() {
    $("res").innerHTML = IGR.RESOURCES.map((r) =>
      `<option value="${esc(r.path)}">${esc(r.label)}　<${esc(r.path)}></option>`).join("");
  }

  function fillFields() {
    const res = IGR.resourceOf($("res").value);
    const box = $("selectFields");
    if (!res || !res.select.length) {
      box.innerHTML = `<p class="sub">${esc(L.noFields)}</p>`;
      return;
    }
    box.innerHTML = res.select.map((f) => `
      <label class="check"><input type="checkbox" value="${esc(f)}" checked> <span class="mono">${esc(f)}</span></label>`).join("");
  }

  function renderOut() {
    const o = state();
    if (mode === "url") $("out").value = IGR.buildUrl(o);
    else if (mode === "ps") $("out").value = IGR.buildPowerShell(o);
    else $("out").value = IGR.buildCurl(o);
  }

  function renderValidation() {
    const errs = IGR.validate(state());
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

  function renderPerm() {
    const res = IGR.resourceOf($("res").value);
    $("perm").textContent = L.perm(res ? res.perm : "—");
    const n = document.querySelectorAll("#selectFields input:checked").length;
    $("fieldCount").textContent = L.fields(n);
  }

  function renderAll() {
    renderPerm();
    renderOut();
    renderValidation();
  }

  fillResources();
  fillFields();

  $("res").addEventListener("change", () => { fillFields(); renderAll(); });
  ["ver", "filter", "orderby", "top"].forEach((id) => $(id).addEventListener("input", renderAll));
  $("count").addEventListener("change", renderAll);
  $("selectFields").addEventListener("change", renderAll);

  $("seg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mode]");
    if (!b) return;
    mode = b.dataset.mode;
    $("seg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    renderOut();
  });

  $("cp").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("out").value);
      $("cp").textContent = L.copied;
      setTimeout(() => ($("cp").textContent = L.copy), 1200);
    } catch {}
  });

  $("seg").querySelector("button").classList.add("on");
  renderAll();
})();
