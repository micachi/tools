(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let tree = [];
  // 双方向バインディングのループ防止: プログラムによる書き込み中は input ハンドラを止める
  let syncing = false;

  /* ---- ツリー操作（パス配列で参照） ---- */
  function getAt(root, path) {
    let list = root;
    for (const i of path) list = list[i].children;
    return list;
  }
  function addBookmark(path, name = "", url = "") { getAt(tree, path).push(EFS.bookmark(name, url)); render(); }
  function addFolder(path, name = "新しいフォルダ") { getAt(tree, path).push(EFS.folder(name, [])); render(); }
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
      <input type="text" class="tname" placeholder="表示名" value="${esc(node.name)}">
      ${isFolder ? "" : `<input type="text" class="turl mono" placeholder="intranet.example.com または https://..." value="${esc(node.url)}">`}
      ${isFolder ? `<button class="mini" data-a="ab" title="このフォルダ内にブックマーク追加">＋🔖</button>
                   <button class="mini" data-a="af" title="このフォルダ内にサブフォルダ追加">＋📁</button>` : ""}
      <button class="mini" data-a="up" title="上へ">↑</button>
      <button class="mini" data-a="down" title="下へ">↓</button>
      <button class="mini del" data-a="del" title="削除">×</button>`;
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
      box.innerHTML = '<p class="sub">まだ項目がありません。上のボタン、または下の JSON を貼り付けてください。</p>';
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
      setStatus(false, `<b>✕ 検証エラー ${errs.length} 件</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`);
      return;
    }
    const arr = EFS.build(tree, top);
    const ok = EFS.roundTripOk(arr);
    const st = EFS.stats(tree);
    setStatus(ok, `<b>${ok ? "✓ 検証通過" : "✕ 往復整合エラー"}</b>　<span class="sub">ブックマーク ${st.bookmarks} ／ フォルダ ${st.folders} ／ 最大 ${st.maxDepth} 階層</span>`);
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
    if (!txt.trim()) { setStatus(false, "<b>✕ JSON が空です</b>"); return; }
    let r;
    try {
      r = EFS.fromJson(txt);
    } catch (e) {
      setStatus(false, `<b>✕ 取り込み失敗</b><ul><li>${esc(e.message || e)}</li></ul><span class="sub">※ 既存のツリーは保持しています。JSON を直すと再取り込みします。</span>`);
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
      ? `<br><span class="sub">注意: ${r.warnings.map(esc).join(" ／ ")}</span>` : "";
    if (errs.length) {
      setStatus(false, `<b>⚠ 取り込んだが検証エラー ${errs.length} 件</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`);
    } else {
      setStatus(true, `<b>✓ JSON から取り込みました</b>　<span class="sub">ブックマーク ${st.bookmarks} ／ フォルダ ${st.folders} ／ 最大 ${st.maxDepth} 階層</span>${warn}`);
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
      $("cp").textContent = "✓ コピー完了"; setTimeout(() => ($("cp").textContent = "JSON をコピー"), 1200); } catch {}
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
    rd.onerror = () => setStatus(false, "<b>✕ ファイルを読み込めませんでした</b>");
    rd.readAsText(f, "utf-8");
  });

  /* ---- 初期値（公式例をベースに実用形へ） ---- */
  $("topName").value = "会社指定のお気に入り";
  tree = [
    EFS.bookmark("社内ポータル", "intranet.example.co.jp"),
    EFS.bookmark("Webメール", "outlook.office.com"),
    EFS.folder("業務システム", [
      EFS.bookmark("勤怠", "krouter.example.co.jp"),
      EFS.bookmark("経費精算", "expense.example.co.jp"),
    ]),
    EFS.folder("ナレッジ", [
      EFS.bookmark("社内 Wiki", "wiki.example.co.jp"),
      EFS.bookmark("マニュアル", "docs.example.co.jp"),
    ]),
  ];
  render();
})();
