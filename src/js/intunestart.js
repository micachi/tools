(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let pins = [];
  // 双方向バインディングのループ防止: プログラムによる書き込み中は input ハンドラを止める
  let syncing = false;

  const L = __loc({
    ja: {
      noPins: "ピンがありません。下のプリセットから追加するか、「ピンを追加」を押してください。",
      aumidPh: "AUMID 例: Microsoft.WindowsTerminal_8wekyb3d8bbwe!App",
      up: "上へ", down: "下へ", del: "削除",
      errCount: (n) => `✕ 検証エラー ${n} 件`, pass: "✓ 検証通過", rtErr: "✕ 往復整合エラー",
      pinCount: (n) => `ピン ${n} 件`, empty: "✕ JSON が空です",
      impFail: "✕ 取り込み失敗",
      keepTree: "※ 既存のピン一覧は保持しています。JSON を直すと再取り込みします。",
      warn: "注意", importedErr: (n) => `⚠ 取り込んだが検証エラー ${n} 件`,
      imported: "✓ JSON から取り込みました",
      presetPick: "— プリセットを選択 —",
      gDocs: "公式ドキュメント記載（信頼度高）", gKnown: "一般に既知の AUMID（実機で要確認）",
      copied: "✓ コピー完了", copy: "JSON をコピー",
      fileFail: "✕ ファイルを読み込めませんでした",
    },
    en: {
      noPins: "No pins yet. Add one from the presets below or press “Add pin”.",
      aumidPh: "AUMID e.g. Microsoft.WindowsTerminal_8wekyb3d8bbwe!App",
      up: "Move up", down: "Move down", del: "Delete",
      errCount: (n) => `✕ ${n} validation error(s)`, pass: "✓ Validation passed", rtErr: "✕ Round-trip mismatch",
      pinCount: (n) => `${n} pin(s)`, empty: "✕ JSON is empty",
      impFail: "✕ Import failed",
      keepTree: "※ Your existing pins are kept. Fix the JSON and it will import again.",
      warn: "Warning", importedErr: (n) => `⚠ Imported but ${n} validation error(s)`,
      imported: "✓ Imported from JSON",
      presetPick: "— Select a preset —",
      gDocs: "From official docs (high confidence)", gKnown: "Generally known AUMIDs (verify on a real machine)",
      copied: "✓ Copied", copy: "Copy JSON",
      fileFail: "✕ Could not read the file",
    },
  });

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function addPin(type = "packagedAppId", value = "") {
    pins.push({ [type]: value });
    render();
  }
  function delPin(i) { pins.splice(i, 1); render(); }
  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= pins.length) return;
    [pins[i], pins[j]] = [pins[j], pins[i]];
    render();
  }

  function typeOf(pin) { return IJS.KEYS.find((k) => pin[k] !== undefined) || "packagedAppId"; }
  function valOf(pin) {
    const k = typeOf(pin);
    const v = pin[k];
    return k === "secondaryTile" ? JSON.stringify(v) : String(v ?? "");
  }

  function renderRows() {
    const box = $("rows");
    box.innerHTML = "";
    if (!pins.length) {
      box.innerHTML = `<p class="sub">${L.noPins}</p>`;
      return;
    }
    pins.forEach((pin, i) => {
      const t = typeOf(pin);
      const row = document.createElement("div");
      row.className = "pinrow";
      row.innerHTML = `
        <span class="idx">${i + 1}</span>
        <select data-i="${i}" class="ptype">
          ${IJS.KEYS.map((k) => `<option value="${k}"${k === t ? " selected" : ""}>${IJS.PIN_TYPES[k].label}</option>`).join("")}
        </select>
        <input type="text" data-i="${i}" class="pval" value="${esc(valOf(pin))}"
               placeholder="${t === "desktopAppLink" ? "%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\App.lnk" : L.aumidPh}">
        <button class="mini" data-act="up" data-i="${i}" title="${L.up}">↑</button>
        <button class="mini" data-act="down" data-i="${i}" title="${L.down}">↓</button>
        <button class="mini del" data-act="del" data-i="${i}" title="${L.del}">×</button>`;
      box.appendChild(row);
    });

    box.querySelectorAll(".ptype").forEach((el) => el.addEventListener("change", (e) => {
      const i = +e.target.dataset.i;
      const old = valOf(pins[i]);
      pins[i] = { [e.target.value]: old };
      render();
    }));
    box.querySelectorAll(".pval").forEach((el) => el.addEventListener("input", (e) => {
      const i = +e.target.dataset.i;
      const t = typeOf(pins[i]);
      let v = e.target.value;
      if (t === "secondaryTile") { try { v = JSON.parse(v); } catch { /* 未確定はそのまま */ } }
      pins[i] = { [t]: v };
      renderOut();
    }));
    box.querySelectorAll("button[data-act]").forEach((el) => el.addEventListener("click", (e) => {
      const i = +e.target.dataset.i, a = e.target.dataset.act;
      if (a === "up") move(i, -1);
      if (a === "down") move(i, 1);
      if (a === "del") delPin(i);
    }));
  }

  function setStatus(ok, html) {
    const v = $("validation");
    v.className = "valid " + (ok ? "ok" : "err");
    v.innerHTML = html;
    $("cp").disabled = !ok;
    $("dl").disabled = !ok;
  }

  /** ピン一覧 → JSON（出力欄へ書き込む） */
  function renderOut() {
    const applyOnce = $("applyOnce").checked;
    $("aoWarn").hidden = !applyOnce;
    const errs = IJS.validate(pins, applyOnce);
    if (errs.length) {
      setStatus(false, `<b>${L.errCount(errs.length)}</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`);
      return;
    }
    const obj = IJS.buildLayout(pins, applyOnce);
    const ok = IJS.roundTripOk(obj);
    setStatus(ok, `<b>${ok ? L.pass : L.rtErr}</b> <span class="sub">${L.pinCount(obj.pinnedList.length)} / applyOnce=${obj.applyOnce}</span>`);
    if (ok) {
      syncing = true;
      $("out").value = IJS.toJson(obj);
      syncing = false;
    }
  }

  /** JSON 欄 → ピン一覧（ユーザーが JSON を編集/貼り付けした時） */
  function importFromOut() {
    if (syncing) return;
    const txt = $("out").value;
    if (!txt.trim()) { setStatus(false, `<b>${L.empty}</b>`); return; }
    let r;
    try {
      r = IJS.fromJson(txt);
    } catch (e) {
      setStatus(false, `<b>${L.impFail}</b><ul><li>${esc(e.message || e)}</li></ul><span class="sub">${L.keepTree}</span>`);
      return;
    }
    pins = r.pins;
    syncing = true;
    $("applyOnce").checked = r.applyOnce;
    syncing = false;
    $("aoWarn").hidden = !r.applyOnce;
    renderRows();

    const errs = IJS.validate(pins, r.applyOnce);
    const warn = r.warnings.length
      ? `<br><span class="sub">${L.warn}: ${r.warnings.map(esc).join(" ／ ")}</span>` : "";
    if (errs.length) {
      setStatus(false, `<b>${L.importedErr(errs.length)}</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`);
    } else {
      setStatus(true, `<b>${L.imported}</b> <span class="sub">${L.pinCount(pins.length)} / applyOnce=${r.applyOnce}</span>${warn}`);
    }
  }

  function render() { renderRows(); renderOut(); }

  // プリセット
  function buildPresets() {
    const sel = $("preset");
    sel.innerHTML = `<option value="">${L.presetPick}</option>`;
    const groups = { docs: L.gDocs, known: L.gKnown };
    for (const [g, label] of Object.entries(groups)) {
      const og = document.createElement("optgroup");
      og.label = label;
      IJS.PRESETS.filter((p) => p.src === g).forEach((p, idx) => {
        const o = document.createElement("option");
        o.value = `${g}|${idx}`;
        o.textContent = p.label;
        og.appendChild(o);
      });
      sel.appendChild(og);
    }
  }

  $("add").addEventListener("click", () => addPin());
  $("preset").addEventListener("change", (e) => {
    if (!e.target.value) return;
    const [g, idx] = e.target.value.split("|");
    const p = IJS.PRESETS.filter((x) => x.src === g)[+idx];
    if (p) { pins.push({ [p.type]: p.value }); render(); }
    e.target.value = "";
  });
  $("clear").addEventListener("click", () => { pins = []; render(); });
  $("applyOnce").addEventListener("change", () => { if (!syncing) renderOut(); });
  $("cp").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("out").value);
      $("cp").textContent = L.copied; setTimeout(() => ($("cp").textContent = L.copy), 1200); } catch {}
  });
  $("dl").addEventListener("click", () => {
    const blob = new Blob([$("out").value], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "LayoutModification.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ---- JSON 欄からの取り込み（編集可のため input で） ---- */
  let impTimer = null;
  $("out").addEventListener("input", () => { clearTimeout(impTimer); impTimer = setTimeout(importFromOut, 400); });
  $("impFile").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      syncing = true; $("out").value = rd.result; syncing = false;
      $("impName").textContent = f.name;
      importFromOut();
    };
    rd.onerror = () => setStatus(false, `<b>${L.fileFail}</b>`);
    rd.readAsText(f, "utf-8");
  });

  // 初期状態：ドキュメント例をそのまま载入
  pins = [
    { desktopAppLink: "%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\Microsoft Edge.lnk" },
    { packagedAppId: "windows.immersivecontrolpanel_cw5n1h2txyewy!microsoft.windows.immersivecontrolpanel" },
    { packagedAppId: "Microsoft.WindowsTerminal_8wekyb3d8bbwe!App" },
    { packagedAppId: "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App" },
  ];
  buildPresets();
  render();
})();
