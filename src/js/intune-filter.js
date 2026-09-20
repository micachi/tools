(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* 状態はツリー（ルートは常にグループ）。入れ子括弧にそのまま対応するため。 */
  let root = IFT.group("and", []);
  let syncing = false;

  const L = __loc({
    ja: {
      none: "条件がありません。プリセットを選ぶか「条件を追加」から作成してください。",
      add: "条件を追加", clear: "全消去", presetPick: "— プリセットを選択 —",
      entity: "対象", prop: "プロパティ", op: "演算子", val: "値",
      del: "削除", delGrp: "グループ削除",
      addGrp: "グループ追加",
      grpOf: (op) => `このグループは ${op} で結合`,
      emptyGrp: "空のグループです。条件を追加してください。",
      pass: "✓ 検証通過", errCount: (n) => `✕ 検証エラー ${n} 件`,
      chars: (n, lim) => `${n.toLocaleString("ja-JP")} / ${lim.toLocaleString("ja-JP")} 文字`,
      copied: "✓ コピー完了", copy: "ルールをコピー",
      impFail: "✕ 取り込み失敗", keep: "※ 既存の条件は保持しています。",
      imported: "✓ 取り込みました",
      phStr: "値を入力（-in / -notIn はカンマ区切りで複数）",
      phEnum: "上の候補を選ぶか、直接入力",
    },
    en: {
      none: "No conditions. Pick a preset or press “Add condition”.",
      add: "Add condition", clear: "Clear all", presetPick: "— Select a preset —",
      entity: "Entity", prop: "Property", op: "Operator", val: "Value",
      del: "Delete", delGrp: "Delete group",
      addGrp: "Add group",
      grpOf: (op) => `this group joined by ${op}`,
      emptyGrp: "Empty group — add a condition.",
      pass: "✓ Validation passed", errCount: (n) => `✕ ${n} validation error(s)`,
      chars: (n, lim) => `${n.toLocaleString("en-US")} / ${lim.toLocaleString("en-US")} chars`,
      copied: "✓ Copied", copy: "Copy rule",
      impFail: "✕ Import failed", keep: "※ Your existing conditions are kept.",
      imported: "✓ Imported",
      phStr: "value (comma-separate for -in / -notIn)",
      phEnum: "Pick a candidate below or type it in",
    },
  });

  const ENTITIES = [{ v: "device", l: EN_L("デバイス", "device") }, { v: "app", l: EN_L("アプリ", "app") }];
  function EN_L(ja, en) { return (typeof document !== "undefined" && document.documentElement.getAttribute("lang") === "en") ? en : ja; }

  /* 選択UI 用のプロパティ表示名（JA は日本語名＋公式名、EN は公式名） */
  const propText = (ent, p) => {
    const lab = IFT.propLabel(ent, p);
    return __loc({ ja: `${lab}（${p}）`, en: lab });
  };

  /* ---- パツリー解決（"1.0.2" のようなパスでノードを指す） ---- */
  function nodeAt(path) {
    let n = root;
    if (path === "" || path == null) return n;
    for (const k of String(path).split(".")) {
      if (!n || !n.children) return null;
      n = n.children[+k];
      if (!n) return null;
    }
    return n;
  }
  function parentPath(path) {
    const parts = String(path).split(".");
    // ルート直下の子どもは "0" / "1" の単一セグメント。親はルート（"")。
    return parts.length > 1 ? parts.slice(0, -1).join(".") : "";
  }
  const childIndex = (path) => +String(path).split(".").pop();
  const join = (p, k) => (p ? `${p}.${k}` : `${k}`);

  /* ---- 描画 ---- */
  function renderRows() {
    const box = $("rows");
    box.innerHTML = "";
    if (!root.children.length) {
      box.innerHTML = `<p class="sub">${L.none}</p>` +
        `<div class="fgrp-add"><button class="mini" data-addrule="">＋ ${esc(L.add)}</button>` +
        `<button class="mini" data-addgrp="">＋ ${esc(L.addGrp)}</button></div>`;
      return;
    }
    renderGroup(root, box, "", 0);
  }

  function renderGroup(g, box, path, depth) {
    const wrap = document.createElement("div");
    wrap.className = "fgrp" + (depth === 0 ? " fgrp-root" : "");

    const bar = document.createElement("div");
    bar.className = "fgrp-bar";
    bar.innerHTML =
      `<select class="fgrp-op" data-p="${path}" title="${esc(L.grpOf(g.op))}">` +
        `<option value="and"${g.op === "and" ? " selected" : ""}>and</option>` +
        `<option value="or"${g.op === "or" ? " selected" : ""}>or</option>` +
      `</select>` +
      `<span class="fgrp-tag">${esc(L.grpOf(g.op))}</span>` +
      (depth > 0
        ? `<button type="button" class="mini delgrp" data-delgrp="${path}">× ${esc(L.delGrp)}</button>`
        : "");
    wrap.appendChild(bar);

    const body = document.createElement("div");
    body.className = "fgrp-body";
    if (!g.children.length) {
      const p = document.createElement("p");
      p.className = "sub fgrp-empty";
      p.textContent = L.emptyGrp;
      body.appendChild(p);
    }
    g.children.forEach((c, k) => renderNode(c, body, join(path, k), depth + 1));
    wrap.appendChild(body);

    const add = document.createElement("div");
    add.className = "fgrp-add";
    add.innerHTML =
      `<button type="button" class="mini" data-addrule="${path}">＋ ${esc(L.add)}</button>` +
      `<button type="button" class="mini" data-addgrp="${path}">＋ ${esc(L.addGrp)}</button>`;
    wrap.appendChild(add);

    box.appendChild(wrap);
  }

  function renderNode(n, box, path, depth) {
    if (IFT.isGroup(n)) renderGroup(n, box, path, depth);
    else renderRuleRow(n, box, path);
  }

  function renderRuleRow(r, box, path) {
    const row = document.createElement("div");
    row.className = "frow";
    const props = Object.keys(IFT.PROPS[r.entity] || {});
    const def = IFT.propDef(r.entity, r.prop);
    const ops = (def ? def.ops : Object.keys(IFT.OPS));

    row.innerHTML = `
      <select class="fent" data-p="${path}">
        ${ENTITIES.map((e) => `<option value="${e.v}"${e.v === r.entity ? " selected" : ""}>${e.l}</option>`).join("")}
      </select>
      <select class="fprop" data-p="${path}">
        ${props.map((p) => `<option value="${p}"${p === r.prop ? " selected" : ""}>${esc(propText(r.entity, p))}</option>`).join("")}
      </select>
      <select class="fop" data-p="${path}">
        ${ops.map((o) => `<option value="${o}"${o === r.op ? " selected" : ""}>${IFT.OPS[o].sym} ${esc(IFT.OPS[o].label)}</option>`).join("")}
      </select>
      <input type="text" class="fval" data-p="${path}" value="${esc((r.values || []).join(", "))}"
             placeholder="${(def && (def.type === "bool" || def.values)) ? L.phEnum : L.phStr}">
      <button type="button" class="mini del" data-del="${path}" title="${L.del}">×</button>`;
    box.appendChild(row);

    // 列挙値・真偽値は候補チップを出す（値を知らなくても選べるように）
    if (def && def.values) {
      const chips = document.createElement("div");
      chips.className = "fchips";
      chips.dataset.p = path;
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
  }

  /** 行を再描画せずチップの選択状態だけ更新（入力フォーカスを保つ） */
  function refreshChips() {
    $("rows").querySelectorAll(".fchips").forEach((wrap) => {
      const r = nodeAt(wrap.dataset.p);
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
  const showErr = (errs, syntax) =>
    setStatus(false, `<b>${L.errCount(errs.length)}</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` +
      (syntax != null ? `<span class="sub">${L.chars(syntax.length, IFT.LIMIT_CHARS)}</span>` : ""));

  function renderOut() {
    const errs = IFT.validateTree(root);
    const syntax = IFT.buildTree(root);
    if (errs.length) { showErr(errs); }
    else setStatus(true, `<b>${L.pass}</b> <span class="sub">${L.chars(syntax.length, IFT.LIMIT_CHARS)}</span>`);
    syncing = true;
    $("out").value = syntax;
    syncing = false;
  }

  /** 入力された構文をツリー化。平坦で and/or が混在する場合は優先度でグループ化して取り込む */
  function importTree(txt) {
    try {
      return IFT.parseTree(txt);
    } catch (e1) {
      // 例: (A) and (B) or (C) — 括弧で明示されていない混在は parseTree が拒否するので、
      // and が or より強く結合する前提でツリーを組み直す（意味は保持される）
      try { return IFT.flatToTree(IFT.parse(txt)); } catch (e2) { /* fallthrough */ }
      throw e1;
    }
  }

  function importFromOut() {
    if (syncing) return;
    const txt = $("out").value;
    if (!txt.trim()) { root = IFT.group("and", []); renderRows(); renderOut(); return; }
    try {
      root = importTree(txt);
      renderRows();
      const errs = IFT.validateTree(root);
      if (errs.length) showErr(errs);
      else setStatus(true, `<b>${L.imported}</b> <span class="sub">${L.chars(IFT.buildTree(root).length, IFT.LIMIT_CHARS)}</span>`);
    } catch (e) {
      setStatus(false, `<b>${L.impFail}</b><ul><li>${esc(e.message || e)}</li></ul><span class="sub">${L.keep}</span>`);
    }
  }

  /* ---- イベント（#rows は再描画されるので委譲する） ---- */
  const rowsBox = $("rows");

  rowsBox.addEventListener("change", (e) => {
    const t = e.target;
    if (t.classList.contains("fgrp-op")) {
      const g = nodeAt(t.dataset.p);
      if (g && IFT.isGroup(g)) { g.op = t.value; renderRows(); renderOut(); }
      return;
    }
    if (t.classList.contains("fent")) {
      const r = nodeAt(t.dataset.p);
      if (!r) return;
      const ent = t.value;
      const first = Object.keys(IFT.PROPS[ent])[0];
      const d = IFT.propDef(ent, first);
      r.entity = ent; r.prop = first; r.op = d.ops[0];
      renderRows(); renderOut();
      return;
    }
    if (t.classList.contains("fprop")) {
      const r = nodeAt(t.dataset.p);
      if (!r) return;
      const p = t.value;
      const d = IFT.propDef(r.entity, p);
      if (!d.ops.includes(r.op)) r.op = d.ops[0];
      // 列挙値プロパティに切り替えたとき、旧値が候補に無ければ落とす
      if (d.values) {
        const cur = (r.values || []).map((x) => String(x).trim()).filter((x) => x !== "");
        r.values = cur.filter((x) =>
          /^(null|\$null)$/i.test(x) || d.values.some((v) => v.toLowerCase() === x.toLowerCase()));
      }
      r.prop = p;
      renderRows(); renderOut();
      return;
    }
    if (t.classList.contains("fop")) {
      const r = nodeAt(t.dataset.p);
      if (r) { r.op = t.value; refreshChips(); renderOut(); }
    }
  });

  rowsBox.addEventListener("input", (e) => {
    const t = e.target;
    if (!t.classList.contains("fval")) return;
    const r = nodeAt(t.dataset.p);
    if (!r) return;
    const v = t.value;
    r.values = (r.op === "in" || r.op === "notIn")
      ? v.split(",").map((s) => s.trim()).filter((s) => s !== "")
      : [v];
    renderOut();
  });

  rowsBox.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;

    if (b.dataset.addrule != null) {
      const g = nodeAt(b.dataset.addrule);
      if (g && IFT.isGroup(g)) { g.children.push(IFT.rule("device", "manufacturer", "eq", [""])); renderRows(); renderOut(); }
      return;
    }
    if (b.dataset.addgrp != null) {
      const g = nodeAt(b.dataset.addgrp);
      if (g && IFT.isGroup(g)) {
        g.children.push(IFT.group("or", [IFT.rule("device", "manufacturer", "eq", [""])]));
        renderRows(); renderOut();
      }
      return;
    }
    if (b.dataset.del != null || b.dataset.delgrp != null) {
      const p = b.dataset.del != null ? b.dataset.del : b.dataset.delgrp;
      if (p === "" || p == null) return;            // ルートは消せない
      const pp = parentPath(p);
      const par = nodeAt(pp);
      if (!par || !par.children) return;
      par.children.splice(childIndex(p), 1);
      // 子を持たないグループは残しても意味がないので親から外す（ルートは空のまま可）
      if (IFT.isGroup(par) && !par.children.length && pp !== "") {
        const gpar = nodeAt(parentPath(pp));
        if (gpar && gpar.children) gpar.children.splice(childIndex(pp), 1);
      }
      renderRows(); renderOut();
      return;
    }
    if (b.classList.contains("chip")) {
      const wrap = b.closest(".fchips");
      const r = nodeAt(wrap && wrap.dataset.p);
      if (!r) return;
      const v = b.dataset.v;
      if (r.op === "in" || r.op === "notIn") {
        const cur = r.values || [];
        const idx = cur.findIndex((x) => String(x).toLowerCase() === String(v).toLowerCase());
        if (idx >= 0) cur.splice(idx, 1); else cur.push(v);
        r.values = cur;
      } else {
        r.values = [v];
      }
      const input = rowsBox.querySelector(`.fval[data-p="${CSS.escape(String(wrap.dataset.p))}"]`);
      if (input) input.value = (r.values || []).join(", ");
      refreshChips();
      renderOut();
    }
  });

  $("add").addEventListener("click", () => {
    root.children.push(IFT.rule("device", "manufacturer", "eq", [""]));
    renderRows(); renderOut();
  });
  $("clear").addEventListener("click", () => { root = IFT.group("and", []); renderRows(); renderOut(); });
  $("preset").addEventListener("change", (e) => {
    if (!e.target.value) return;
    const p = IFT.PRESETS[+e.target.value];
    if (p) { root = presetTree(p); renderRows(); renderOut(); }
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

  /** プリセット → ツリー（tree 持ちはそのまま、無ければ平坦 rules から構築） */
  function presetTree(p) {
    if (p.tree) return JSON.parse(JSON.stringify(p.tree));
    return IFT.flatToTree(JSON.parse(JSON.stringify(p.rules)));
  }

  /* ---- 初期値 ---- */
  const sel = $("preset");
  sel.innerHTML = `<option value="">${L.presetPick}</option>` +
    IFT.PRESETS.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join("");

  root = presetTree(IFT.PRESETS[1]);
  renderRows();
  renderPropTable();
  renderOut();
})();
