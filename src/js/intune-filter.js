(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let rules = [];
  let syncing = false;

  const L = __loc({
    ja: {
      none: "条件がありません。プリセットを選ぶか「条件を追加」から作成してください。",
      add: "条件を追加", clear: "全消去", presetPick: "— プリセットを選択 —",
      join: "結合", entity: "対象", prop: "プロパティ", op: "演算子", val: "値",
      del: "削除",
      phStr: "値を入力（-in / -notIn はカンマ区切りで複数）",
      phNull: "値 または Null / $Null",
      pass: "✓ 検証通過", errCount: (n) => `✕ 検証エラー ${n} 件`,
      chars: (n, lim) => `${n.toLocaleString("ja-JP")} / ${lim.toLocaleString("ja-JP")} 文字`,
      copied: "✓ コピー完了", copy: "ルールをコピー",
      impFail: "✕ 取り込み失敗", keep: "※ 既存の条件は保持しています。",
      warnNull: "Null / $Null が使えるのは -eq / -ne だけです",
      multiHint: "複数値は -in / -notIn を使ってください",
      phEnum: "上の候補を選ぶか、直接入力",
      chipHint: "候補",
    },
    en: {
      none: "No conditions. Pick a preset or press “Add condition”.",
      add: "Add condition", clear: "Clear all", presetPick: "— Select a preset —",
      join: "Join", entity: "Entity", prop: "Property", op: "Operator", val: "Value",
      del: "Delete",
      phStr: "value (comma-separate for -in / -notIn)",
      phNull: "value or Null / $Null",
      pass: "✓ Validation passed", errCount: (n) => `✕ ${n} validation error(s)`,
      chars: (n, lim) => `${n.toLocaleString("en-US")} / ${lim.toLocaleString("en-US")} chars`,
      copied: "✓ Copied", copy: "Copy rule",
      impFail: "✕ Import failed", keep: "※ Your existing conditions are kept.",
      warnNull: "Null / $Null is only allowed with -eq / -ne",
      multiHint: "Use -in / -notIn for multiple values",
      phEnum: "Pick a candidate below or type it in",
      chipHint: "Candidates",
    },
  });

  const ENTITIES = [{ v: "device", l: EN_L("デバイス", "device") }, { v: "app", l: EN_L("アプリ", "app") }];
  function EN_L(ja, en) { return (typeof document !== "undefined" && document.documentElement.getAttribute("lang") === "en") ? en : ja; }

  /* 選択UI 用のプロパティ表示名（JA は日本語名＋公式名、EN は公式名） */
  const propText = (ent, p) => {
    const lab = IFT.propLabel(ent, p);
    return __loc({ ja: `${lab}（${p}）`, en: lab });
  };

  /* ---- 行の描画 ---- */
  function renderRows() {
    const box = $("rows");
    box.innerHTML = "";
    if (!rules.length) { box.innerHTML = `<p class="sub">${L.none}</p>`; return; }

    rules.forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "frow";
      const props = Object.keys(IFT.PROPS[r.entity] || {});
      const def = IFT.propDef(r.entity, r.prop);
      const ops = (def ? def.ops : Object.keys(IFT.OPS));

      row.innerHTML = `
        ${i === 0 ? `<span class="fjoin-space"></span>` : `
          <select class="fjoin" data-i="${i}">
            <option value="and"${(r.join || "and") === "and" ? " selected" : ""}>and</option>
            <option value="or"${r.join === "or" ? " selected" : ""}>or</option>
          </select>`}
        <select class="fent" data-i="${i}">
          ${ENTITIES.map((e) => `<option value="${e.v}"${e.v === r.entity ? " selected" : ""}>${e.l}</option>`).join("")}
        </select>
        <select class="fprop" data-i="${i}">
          ${props.map((p) => `<option value="${p}"${p === r.prop ? " selected" : ""}>${esc(propText(r.entity, p))}</option>`).join("")}
        </select>
        <select class="fop" data-i="${i}">
          ${ops.map((o) => `<option value="${o}"${o === r.op ? " selected" : ""}>${IFT.OPS[o].sym} ${esc(IFT.OPS[o].label)}</option>`).join("")}
        </select>
        <input type="text" class="fval" data-i="${i}" value="${esc((r.values || []).join(", "))}"
               placeholder="${(def && (def.type === "bool" || def.values)) ? L.phEnum : L.phStr}">
        <button class="mini del" data-i="${i}" title="${L.del}">×</button>`;
      box.appendChild(row);

      // 列挙値・真偽値は候補チップを出す（値を知らなくても選べるように）
      if (def && def.values) {
        const chips = document.createElement("div");
        chips.className = "fchips";
        chips.dataset.i = String(i);
        chips.innerHTML = def.values.map((v) => {
          const on = (r.values || []).some((x) => String(x).toLowerCase() === String(v).toLowerCase());
          const lab = IFT.valueLabel(r.entity, r.prop, v);
          const txt = lab === String(v) ? esc(v) : `${esc(lab)} <span class="chipv">${esc(v)}</span>`;
          return `<button type="button" class="chip${on ? " on" : ""}" data-v="${esc(v)}">${txt}</button>`;
        }).join("") +
          `<button type="button" class="chip nullable" data-v="Null">Null</button>` +
          `<button type="button" class="chip nullable" data-v="$Null">$Null</button>`;
        box.appendChild(chips);
      }
    });

    box.querySelectorAll(".fjoin").forEach((el) => el.addEventListener("change", (e) => {
      rules[+e.target.dataset.i].join = e.target.value; renderOut();
    }));
    box.querySelectorAll(".fent").forEach((el) => el.addEventListener("change", (e) => {
      const i = +e.target.dataset.i;
      const ent = e.target.value;
      const first = Object.keys(IFT.PROPS[ent])[0];
      const d = IFT.propDef(ent, first);
      rules[i] = { ...rules[i], entity: ent, prop: first, op: d.ops[0], values: rules[i].values };
      renderRows(); renderOut();
    }));
    box.querySelectorAll(".fprop").forEach((el) => el.addEventListener("change", (e) => {
      const i = +e.target.dataset.i;
      const p = e.target.value;
      const d = IFT.propDef(rules[i].entity, p);
      if (!d.ops.includes(rules[i].op)) rules[i].op = d.ops[0];
      // 列挙値プロパティに切り替えたとき、旧値が候補に無ければ落とす
      // （前プロパティの値が残って不正なルールになるのを防ぐ）
      if (d.values) {
        const cur = (rules[i].values || []).map((x) => String(x).trim()).filter((x) => x !== "");
        rules[i].values = cur.filter((x) =>
          /^(null|\$null)$/i.test(x) ||
          d.values.some((v) => v.toLowerCase() === x.toLowerCase()));
      }
      rules[i].prop = p;
      renderRows(); renderOut();
    }));
    box.querySelectorAll(".fop").forEach((el) => el.addEventListener("change", (e) => {
      rules[+e.target.dataset.i].op = e.target.value; refreshChips(); renderOut();
    }));
    box.querySelectorAll(".fval").forEach((el) => el.addEventListener("input", (e) => {
      const i = +e.target.dataset.i;
      const v = e.target.value;
      rules[i].values = (rules[i].op === "in" || rules[i].op === "notIn")
        ? v.split(",").map((s) => s.trim()).filter((s) => s !== "")
        : [v];
      renderOut();
    }));
    box.querySelectorAll("button.del").forEach((el) => el.addEventListener("click", (e) => {
      rules.splice(+e.currentTarget.dataset.i, 1); renderRows(); renderOut();
    }));

    // 候補チップ：eq/ne は単一選択、in/notIn はトグルで複数選択
    box.querySelectorAll(".fchips .chip").forEach((el) => el.addEventListener("click", (e) => {
      const wrap = e.currentTarget.closest(".fchips");
      const i = +wrap.dataset.i;
      const v = e.currentTarget.dataset.v;
      const r = rules[i];
      if (!r) return;
      if (r.op === "in" || r.op === "notIn") {
        const cur = r.values || [];
        const idx = cur.findIndex((x) => String(x).toLowerCase() === String(v).toLowerCase());
        if (idx >= 0) cur.splice(idx, 1); else cur.push(v);
        r.values = cur;
      } else {
        r.values = [v];
      }
      const input = box.querySelector(`.fval[data-i="${i}"]`);
      if (input) input.value = (r.values || []).join(", ");
      refreshChips();
      renderOut();
    }));
  }

  /** 行を再描画せずチップの選択状態だけ更新（入力フォーカスを保つ） */
  function refreshChips() {
    const box = $("rows");
    box.querySelectorAll(".fchips").forEach((wrap) => {
      const r = rules[+wrap.dataset.i];
      if (!r) return;
      wrap.querySelectorAll(".chip").forEach((c) => {
        const on = (r.values || []).some((x) => String(x).toLowerCase() === String(c.dataset.v).toLowerCase());
        c.classList.toggle("on", on);
      });
    });
  }

  function setStatus(ok, html) {
    const v = $("validation");
    v.className = "valid " + (ok ? "ok" : "err");
    v.innerHTML = html;
    $("cp").disabled = !ok;
  }

  function renderOut() {
    const errs = IFT.validate(rules);
    const syntax = IFT.build(rules);
    const ch = L.chars(syntax.length, IFT.LIMIT_CHARS);
    if (errs.length) {
      setStatus(false, `<b>${L.errCount(errs.length)}</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`);
    } else {
      setStatus(true, `<b>${L.pass}</b>　<span class="sub">${ch}</span>`);
    }
    syncing = true;
    $("out").value = syntax;
    syncing = false;
  }

  function importFromOut() {
    if (syncing) return;
    const txt = $("out").value;
    if (!txt.trim()) { rules = []; renderRows(); renderOut(); return; }
    try {
      rules = IFT.parse(txt);
      renderRows();
      const errs = IFT.validate(rules);
      if (errs.length) setStatus(false, `<b>${L.errCount(errs.length)}</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`);
      else setStatus(true, `<b>✓ ${EN_L("取り込みました", "Imported")}</b>　<span class="sub">${L.chars(IFT.build(rules).length, IFT.LIMIT_CHARS)}</span>`);
    } catch (e) {
      setStatus(false, `<b>${L.impFail}</b><ul><li>${esc(e.message || e)}</li></ul><span class="sub">${L.keep}</span>`);
    }
  }

  /* ---- イベント ---- */
  $("add").addEventListener("click", () => {
    rules.push({ entity: "device", prop: "manufacturer", op: "eq", values: [""], join: rules.length ? "and" : "and" });
    renderRows(); renderOut();
  });
  $("clear").addEventListener("click", () => { rules = []; renderRows(); renderOut(); });
  $("preset").addEventListener("change", (e) => {
    if (!e.target.value) return;
    const p = IFT.PRESETS[+e.target.value];
    if (p) { rules = JSON.parse(JSON.stringify(p.rules)); renderRows(); renderOut(); }
    e.target.value = "";
  });
  let t = null;
  $("out").addEventListener("input", () => { clearTimeout(t); t = setTimeout(importFromOut, 400); });
  $("cp").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("out").value);
      $("cp").textContent = L.copied; setTimeout(() => ($("cp").textContent = L.copy), 1200); } catch {}
  });

  /* ---- プロパティ一覧テーブル ---- */
  function renderPropTable() {
    const box = $("propTable");
    if (!box) return;
    const T = __loc({
      ja: { thName: "日本語名", thProp: "プロパティ（生成される名前）", thOps: "演算子", thPlat: "対象 Platform", thVal: "値" },
      en: { thName: "Display name", thProp: "Property", thOps: "Operators", thPlat: "Platforms", thVal: "Values" },
    });
    const td = `style="padding:8px;border-bottom:1px solid var(--line);vertical-align:top"`;
    const rows = Object.entries(IFT.DEVICE_PROPS).map(([k, d]) => {
      const vals = d.values
        ? `<span class="mono">${d.values.slice(0, 6).map((v) => {
            const lab = IFT.valueLabel("device", k, v);
            return lab === String(v) ? esc(v) : `${esc(lab)} ${esc(v)}`;
          }).join(" / ")}${d.values.length > 6 ? " …" : ""}</span>`
        : `<span class="sub">${d.type === "version" ? "10.0.22000.1000" : "*"}</span>`;
      const name = __loc({ ja: esc(d.ja || d.label), en: esc(d.label) });
      return `<tr>
        <td ${td}>${name}</td>
        <td class="mono" ${td}>${k}</td>
        <td class="mono" ${td}>${d.ops.map((o) => "-" + o).join(" ")}</td>
        <td ${td}><span style="font-size:.8rem">${esc(d.platforms)}</span></td>
        <td ${td}>${vals}${d.note ? `<br><span class="sub">${esc(d.note)}</span>` : ""}</td>
      </tr>`;
    }).join("");
    box.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.84rem">
      <thead><tr style="color:var(--mut);text-align:left">
        <th style="padding:8px;border-bottom:1px solid var(--line)">${T.thName}</th>
        <th style="padding:8px;border-bottom:1px solid var(--line)">${T.thProp}</th>
        <th style="padding:8px;border-bottom:1px solid var(--line)">${T.thOps}</th>
        <th style="padding:8px;border-bottom:1px solid var(--line)">${T.thPlat}</th>
        <th style="padding:8px;border-bottom:1px solid var(--line)">${T.thVal}</th>
      </tr></thead><tbody>${rows}</tbody></table>`;
  }

  /* ---- 初期値 ---- */
  const sel = $("preset");
  sel.innerHTML = `<option value="">${L.presetPick}</option>` +
    IFT.PRESETS.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join("");

  rules = JSON.parse(JSON.stringify(IFT.PRESETS[1].rules));
  renderRows();
  renderPropTable();
  renderOut();
})();
