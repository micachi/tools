(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let tree = [];
  // 双方向バインディングのループ防止: プログラムによる書き込み中は input ハンドラを止める
  let syncing = false;

  const L = __loc({
    ja: {
      newFolder: "新しいフォルダ", namePh: "表示名", urlPh: "intranet.example.com または https://...",
      addBm: "このフォルダ内にブックマーク追加", addFd: "このフォルダ内にサブフォルダ追加",
      up: "上へ", down: "下へ", del: "削除",
      none: "まだ項目がありません。上のボタン、または下の JSON を貼り付けてください。",
      errCount: (n) => `✕ 検証エラー ${n} 件`, pass: "✓ 検証通過", rtErr: "✕ 往復整合エラー",
      stat: (b, f, d) => `ブックマーク ${b} ／ フォルダ ${f} ／ 最大 ${d} 階層`,
      empty: "✕ JSON が空です", impFail: "✕ 取り込み失敗",
      keepTree: "※ 既存のツリーは保持しています。JSON を直すと再取り込みします。",
      warn: "注意", importedErr: (n) => `⚠ 取り込んだが検証エラー ${n} 件`, imported: "✓ JSON から取り込みました",
      copied: "✓ コピー完了", copy: "JSON をコピー", fileFail: "✕ ファイルを読み込めませんでした",
      top0: "会社指定のお気に入り",
      b1: "社内ポータル", b2: "Webメール", f1: "業務システム", f1a: "勤怠", f1b: "経費精算",
      f2: "ナレッジ", f2a: "社内 Wiki", f2b: "マニュアル",
    },
    en: {
      newFolder: "New folder", namePh: "Display name", urlPh: "intranet.example.com or https://...",
      addBm: "Add a bookmark inside this folder", addFd: "Add a subfolder inside this folder",
      up: "Move up", down: "Move down", del: "Delete",
      none: "Nothing yet. Use the buttons above, or paste JSON below.",
      errCount: (n) => `✕ ${n} validation error(s)`, pass: "✓ Validation passed", rtErr: "✕ Round-trip mismatch",
      stat: (b, f, d) => `${b} bookmarks ／ ${f} folders ／ max ${d} level(s) deep`,
      empty: "✕ JSON is empty", impFail: "✕ Import failed",
      keepTree: "※ Your existing tree is kept. Fix the JSON and it will import again.",
      warn: "Warning", importedErr: (n) => `⚠ Imported but ${n} validation error(s)`, imported: "✓ Imported from JSON",
      copied: "✓ Copied", copy: "Copy JSON", fileFail: "✕ Could not read the file",
      top0: "Company favorites",
      b1: "Company portal", b2: "Web mail", f1: "Business systems", f1a: "Time & attendance", f1b: "Expense claims",
      f2: "Knowledge", f2a: "Internal wiki", f2b: "Manuals",
    },
  });

  /* ---- ツリー操作（パス配列で参照） ---- */
  function getAt(root, path) {
    let list = root;
    for (const i of path) list = list[i].children;
    return list;
  }
  function addBookmark(path, name = "", url = "") { getAt(tree, path).push(EFS.bookmark(name, url)); render(); }
  function addFolder(path, name = L.newFolder) { getAt(tree, path).push(EFS.folder(name, [])); render(); }
  function remove(path) {
    getAt(tree, path.slice(0, -1)).splice(path[path.length - 1], 1);
    render();
  }
  function move(path, dir) {
    const parent = getAt(tree, path.slice(0, -1));
    const i = path[path.length - 1], j = i + dir;
    if (j < 0 || j >= parent.length) return;
    [parent[i], parent[j]] = [parent[j], parent[i]];
    render();
  }

  /* ---- 描画 ---- */
  function renderNode(node, path) {
    const isFolder = node.type === "folder";
    const wrap = document.createElement("div");
    wrap.className = "treenode" + (isFolder ? " is-folder" : "");
    wrap.style.marginLeft = (path.length - 1) * 22 + "px";

    const row = document.createElement("div");
    row.className = "treerow";
    row.innerHTML = `
      <span class="ticon">${isFolder ? "📁" : "🔖"}</span>
      <input type="text" class="tname" placeholder="${L.namePh}" value="${esc(node.name)}">
      ${isFolder ? "" : `<input type="text" class="turl mono" placeholder="${L.urlPh}" value="${esc(node.url)}">`}
      ${isFolder ? `<button class="mini" data-a="ab" title="${L.addBm}">＋🔖</button>
                   <button class="mini" data-a="af" title="${L.addFd}">＋📁</button>` : ""}
      <button class="mini" data-a="up" title="${L.up}">↑</button>
      <button class="mini" data-a="down" title="${L.down}">↓</button>
      <button class="mini del" data-a="del" title="${L.del}">×</button>`;
    wrap.appendChild(row);

    row.querySelector(".tname").addEventListener("input", (e) => { node.name = e.target.value; renderOut(); });
    const u = row.querySelector(".turl");
    if (u) u.addEventListener("input", (e) => { node.url = e.target.value; renderOut(); });
    row.querySelectorAll("button[data-a]").forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.a;
      if (a === "ab") addBookmark(path);
      if (a === "af") addFolder(path);
      if (a === "up") move(path, -1);
      if (a === "down") move(path, 1);
      if (a === "del") remove(path);
    }));

    if (isFolder) (node.children || []).forEach((c, i) => wrap.appendChild(renderNode(c, [...path, i])));
    return wrap;
  }

  function renderTree() {
    const box = $("tree");
    box.innerHTML = "";
    if (!tree.length) {
      box.innerHTML = `<p class="sub">${L.none}</p>`;
      return;
    }
    tree.forEach((n, i) => box.appendChild(renderNode(n, [i])));
  }

  function setStatus(ok, html) {
    const v = $("validation");
    v.className = "valid " + (ok ? "ok" : "err");
    v.innerHTML = html;
    $("cp").disabled = !ok;
    $("dl").disabled = !ok;
  }

  /** ツリー → JSON（出力欄へ書き込む） */
  function renderOut() {
    const top = $("topName").value;
    const errs = EFS.validate(tree, top);
    if (errs.length) {
      setStatus(false, `<b>${L.errCount(errs.length)}</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`);
      return;
    }
    const arr = EFS.build(tree, top);
    const ok = EFS.roundTripOk(arr);
    const st = EFS.stats(tree);
    setStatus(ok, `<b>${ok ? L.pass : L.rtErr}</b>　<span class="sub">${L.stat(st.bookmarks, st.folders, st.maxDepth)}</span>`);
    if (ok) {
      syncing = true;
      $("out").value = EFS.toJson(arr);
      syncing = false;
    }
  }

  /** JSON 欄 → ツリー（ユーザーが JSON を編集/貼り付けした時） */
  function importFromOut() {
    if (syncing) return;
    const txt = $("out").value;
    if (!txt.trim()) { setStatus(false, `<b>${L.empty}</b>`); return; }
    let r;
    try {
      r = EFS.fromJson(txt);
    } catch (e) {
      setStatus(false, `<b>${L.impFail}</b><ul><li>${esc(e.message || e)}</li></ul><span class="sub">${L.keepTree}</span>`);
      return;
    }
    // 取り込み成功 → ツリーとトップフォルダ名を差し替え（JSON 欄のテキストはそのまま維持）
    tree = r.tree;
    syncing = true;
    $("topName").value = r.toplevelName || "";
    syncing = false;
    renderTree();

    const errs = EFS.validate(tree, r.toplevelName);
    const st = EFS.stats(tree);
    const warn = r.warnings.length
      ? `<br><span class="sub">${L.warn}: ${r.warnings.map(esc).join(" ／ ")}</span>` : "";
    if (errs.length) {
      setStatus(false, `<b>${L.importedErr(errs.length)}</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`);
    } else {
      setStatus(true, `<b>${L.imported}</b>　<span class="sub">${L.stat(st.bookmarks, st.folders, st.maxDepth)}</span>${warn}`);
    }
  }

  function render() { renderTree(); renderOut(); }

  /* ---- イベント ---- */
  $("ab").addEventListener("click", () => addBookmark([]));
  $("af").addEventListener("click", () => addFolder([]));
  $("clear").addEventListener("click", () => { tree = []; render(); });
  $("topName").addEventListener("input", () => { if (!syncing) renderOut(); });

  // JSON 欄は編集可。入力停止後にツリーへ反映
  let t = null;
  $("out").addEventListener("input", () => { clearTimeout(t); t = setTimeout(importFromOut, 400); });

  $("cp").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("out").value);
      $("cp").textContent = L.copied; setTimeout(() => ($("cp").textContent = L.copy), 1200); } catch {}
  });
  $("dl").addEventListener("click", () => {
    const blob = new Blob([$("out").value], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ManagedFavorites.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
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

  /* ---- 初期値（公式例をベースに実用形へ） ---- */
  $("topName").value = L.top0;
  tree = [
    EFS.bookmark(L.b1, "intranet.example.co.jp"),
    EFS.bookmark(L.b2, "outlook.office.com"),
    EFS.folder(L.f1, [
      EFS.bookmark(L.f1a, "krouter.example.co.jp"),
      EFS.bookmark(L.f1b, "expense.example.co.jp"),
    ]),
    EFS.folder(L.f2, [
      EFS.bookmark(L.f2a, "wiki.example.co.jp"),
      EFS.bookmark(L.f2b, "docs.example.co.jp"),
    ]),
  ];
  render();
})();
