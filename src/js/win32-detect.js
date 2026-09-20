(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const EN = (typeof document !== "undefined" && document.documentElement.getAttribute("lang") === "en");

  const L = EN ? {
    add: "Add rule", clear: "Clear all", type: "Rule type",
    productCode: "MSI product code", versionCheck: "Also verify product version", productVersion: "MSI product version",
    path: "Path", fileOrFolder: "File or folder", exists: "Detect by existence", minVersion: "Minimum file version",
    keyPath: "Key path", valueName: "Value name (empty = detect the key)",
    phGuid: "{1B9C8F2A-1234-5678-9ABC-DEF012345678}",
    phPath: "%ProgramFiles%\\Vendor\\App", phFile: "app.exe",
    phKey: "HKLM\\Software\\Vendor\\App", phVal: "Version", phVer: "1.2.0.0",
    pass: "✓ Validation passed", errCount: (n) => `✕ ${n} validation error(s)`,
    andWarn: "★ ALL rules must be satisfied for the app to be detected. Adding rules narrows detection — if any rule fails, Intune treats the app as absent and re-offers it within ~24h (required intent).",
    script: "Custom detection script (upload this .ps1)",
    copy: "Copy script", copied: "✓ Copied", dl: "Save detect.ps1",
    del: "Delete",
  } : {
    add: "ルールを追加", clear: "全消去", type: "ルール種類",
    productCode: "MSI プロダクトコード", versionCheck: "プロダクトバージョンも確認する", productVersion: "MSI プロダクトバージョン",
    path: "Path", fileOrFolder: "ファイル / フォルダ", exists: "存在で検出", minVersion: "最小ファイルバージョン",
    keyPath: "Key path", valueName: "Value name（空ならキーで検出）",
    phGuid: "{1B9C8F2A-1234-5678-9ABC-DEF012345678}",
    phPath: "%ProgramFiles%\\ベンダー\\アプリ", phFile: "app.exe",
    phKey: "HKLM\\Software\\ベンダー\\アプリ", phVal: "Version", phVer: "1.2.0.0",
    pass: "✓ 検証通過", errCount: (n) => `✕ 検証エラー ${n} 件`,
    andWarn: "★ すべてのルール条件を満たすことが検出の条件です。ルールを増やすほど検出は狭まり、1つでも満たさないと Intune は「未インストール」とみなし、required intent のアプリは約24時間以内に再提供します。",
    script: "カスタム検出スクリプト（この .ps1 をアップロード）",
    copy: "スクリプトをコピー", copied: "✓ コピー完了", dl: "detect.ps1 保存",
    del: "削除",
  };

  let rules = [];

  function addRule(type) {
    const base = { type };
    if (type === "msi") Object.assign(base, { productCode: "", versionCheck: false, productVersion: "" });
    if (type === "file") Object.assign(base, { path: "", fileOrFolder: "", exists: true, minVersion: "" });
    if (type === "registry") Object.assign(base, { keyPath: "", valueName: "" });
    rules.push(base);
    render();
  }

  function fields(r, i) {
    if (r.type === "msi") {
      return `
        <div class="field"><label>${L.productCode}</label>
          <input type="text" class="mono" data-i="${i}" data-k="productCode" value="${esc(r.productCode)}" placeholder="${L.phGuid}"></div>
        <div class="field"><label class="switch"><input type="checkbox" data-i="${i}" data-k="versionCheck"${r.versionCheck ? " checked" : ""}> ${L.versionCheck}</label></div>
        ${r.versionCheck ? `<div class="field"><label>${L.productVersion}</label>
          <input type="text" data-i="${i}" data-k="productVersion" value="${esc(r.productVersion)}" placeholder="${L.phVer}"></div>` : ""}`;
    }
    if (r.type === "file") {
      return `
        <div class="field"><label>${L.path}</label>
          <input type="text" class="mono" data-i="${i}" data-k="path" value="${esc(r.path)}" placeholder="${L.phPath}"></div>
        <div class="field"><label>${L.fileOrFolder}</label>
          <input type="text" data-i="${i}" data-k="fileOrFolder" value="${esc(r.fileOrFolder)}" placeholder="${L.phFile}"></div>
        <div class="row">
          <label class="switch"><input type="checkbox" data-i="${i}" data-k="exists"${r.exists ? " checked" : ""}> ${L.exists}</label>
          <div style="flex:1;min-width:170px"><label>${L.minVersion}</label>
            <input type="text" data-i="${i}" data-k="minVersion" value="${esc(r.minVersion)}" placeholder="${L.phVer}"></div>
        </div>`;
    }
    return `
      <div class="field"><label>${L.keyPath}</label>
        <input type="text" class="mono" data-i="${i}" data-k="keyPath" value="${esc(r.keyPath)}" placeholder="${L.phKey}"></div>
      <div class="field"><label>${L.valueName}</label>
        <input type="text" data-i="${i}" data-k="valueName" value="${esc(r.valueName)}" placeholder="${L.phVal}"></div>`;
  }

  function render() {
    const box = $("rules");
    box.innerHTML = "";
    if (!rules.length) {
      box.innerHTML = `<p class="sub">${EN ? "No rules. Add one." : "ルールがありません。追加してください。"}</p>`;
    }
    rules.forEach((r, i) => {
      const d = document.createElement("div");
      d.className = "drule";
      d.innerHTML = `
        <div class="row" style="justify-content:space-between;margin-bottom:8px">
          <b style="font-size:.9rem">${i + 1}. ${esc(W3D.RULE_TYPES[r.type] || r.type)}</b>
          <button class="mini del" data-i="${i}" title="${L.del}">×</button>
        </div>
        ${fields(r, i)}`;
      box.appendChild(d);
    });

    box.querySelectorAll("[data-k]").forEach((el) => {
      const ev = el.type === "checkbox" ? "change" : "input";
      el.addEventListener(ev, (e) => {
        const r = rules[+e.target.dataset.i];
        r[e.target.dataset.k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        // MSI のバージョン確認 ON/OFF でフィールド構成が変わる
        if (e.target.dataset.k === "versionCheck") render(); else renderOut();
      });
    });
    box.querySelectorAll("button.del").forEach((b) => b.addEventListener("click", (e) => {
      rules.splice(+e.currentTarget.dataset.i, 1); render();
    }));
    renderOut();
  }

  function renderOut() {
    const errs = W3D.validate(rules);
    const v = $("validation");
    if (errs.length) {
      v.className = "valid err";
      v.innerHTML = `<b>${L.errCount(errs.length)}</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
    } else {
      v.className = "valid ok";
      v.innerHTML = `<b>${L.pass}</b>`;
    }
    $("warn").textContent = L.andWarn;
    $("out").value = W3D.buildScript(rules);
    $("cp").disabled = !!errs.length;
    $("dl").disabled = !!errs.length;
  }

  $("add").addEventListener("click", () => addRule($("rtype").value));
  $("clear").addEventListener("click", () => { rules = []; render(); });
  $("cp").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("out").value);
      $("cp").textContent = L.copied; setTimeout(() => ($("cp").textContent = L.copy), 1200); } catch {}
  });
  $("dl").addEventListener("click", () => {
    const blob = new Blob([$("out").value], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "detect.ps1"; a.click();
    URL.revokeObjectURL(a.href);
  });

  const sel = $("rtype");
  sel.innerHTML = Object.entries(W3D.RULE_TYPES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");

  rules = [{ type: "msi", productCode: "{2A1B3C4D-5E6F-7A8B-9C0D-1E2F3A4B5C6D}", versionCheck: false, productVersion: "" }];
  render();
})();
