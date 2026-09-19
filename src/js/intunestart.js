(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let pins = [];

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
      box.innerHTML = '<p class="sub">ピンがありません。下のプリセットから追加するか、「ピンを追加」を押してください。</p>';
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
               placeholder="${t === "desktopAppLink" ? "%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\App.lnk" : "AUMID 例: Microsoft.WindowsTerminal_8wekyb3d8bbwe!App"}">
        <button class="mini" data-act="up" data-i="${i}" title="上へ">↑</button>
        <button class="mini" data-act="down" data-i="${i}" title="下へ">↓</button>
        <button class="mini del" data-act="del" data-i="${i}" title="削除">×</button>`;
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

  function renderOut() {
    const applyOnce = $("applyOnce").checked;
    const errs = IJS.validate(pins, applyOnce);
    const v = $("validation");
    if (errs.length) {
      v.className = "valid err";
      v.innerHTML = "<b>✕ 検証エラー " + errs.length + " 件</b><ul>" + errs.map((e) => `<li>${esc(e)}</li>`).join("") + "</ul>";
      $("dl").disabled = true; $("cp").disabled = true;
    } else {
      const obj = IJS.buildLayout(pins, applyOnce);
      const ok = IJS.roundTripOk(obj);
      v.className = "valid ok";
      v.innerHTML = `<b>✓ 検証通過</b>　<span class="sub">ピン ${obj.pinnedList.length} 件 ／ applyOnce=${obj.applyOnce} ／ 往復整合 ${ok ? "OK" : "NG"}</span>`;
      $("dl").disabled = !ok; $("cp").disabled = !ok;
      $("out").value = IJS.toJson(obj);
    }
    // applyOnce のバージョン注意
    $("aoWarn").hidden = !$("applyOnce").checked;
  }

  function render() { renderRows(); renderOut(); }

  // プリセット
  function buildPresets() {
    const sel = $("preset");
    sel.innerHTML = '<option value="">— プリセットを選択 —</option>';
    const groups = { docs: "公式ドキュメント記載（信頼度高）", known: "一般に既知の AUMID（実機で要確認）" };
    for (const [g, label] of Object.entries(groups)) {
      const og = document.createElement("optgroup");
      og.label = label;
      IJS.PRESETS.filter((p) => p.src === g).forEach((p, idx) => {
        const o = document.createElement("option");
        o.value = `${g}|${idx}`;
        o.textContent = p.name;
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
  $("applyOnce").addEventListener("change", renderOut);
  $("cp").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("out").value);
      $("cp").textContent = "✓ コピー完了"; setTimeout(() => ($("cp").textContent = "JSON をコピー"), 1200); } catch {}
  });
  $("dl").addEventListener("click", () => {
    const blob = new Blob([$("out").value], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "LayoutModification.json";
    a.click();
    URL.revokeObjectURL(a.href);
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
