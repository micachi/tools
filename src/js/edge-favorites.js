(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let tree = [];

  /* ---- ツリー操作（パス配列で参照） ---- */
  function getAt(root, path) {
    let list = root;
    for (const i of path) list = list[i].children;
    return list;
  }
  function addBookmark(path, name = "", url = "") {
    getAt(tree, path).push(EFS.bookmark(name, url));
    render();
  }
  function addFolder(path, name = "新しいフォルダ") {
    getAt(tree, path).push(EFS.folder(name, []));
    render();
  }
  function remove(path) {
    const parent = getAt(tree, path.slice(0, -1));
    parent.splice(path[path.length - 1], 1);
    render();
  }
  function move(path, dir) {
    const parent = getAt(tree, path.slice(0, -1));
    const i = path[path.length - 1];
    const j = i + dir;
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
      box.innerHTML = '<p class="sub">まだ項目がありません。上のボタンから追加してください。</p>';
      return;
    }
    tree.forEach((n, i) => box.appendChild(renderNode(n, [i])));
  }

  function renderOut() {
    const top = $("topName").value;
    const errs = EFS.validate(tree, top);
    const v = $("validation");
    if (errs.length) {
      v.className = "valid err";
      v.innerHTML = `<b>✕ 検証エラー ${errs.length} 件</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
      $("cp").disabled = true; $("dl").disabled = true;
      return;
    }
    const arr = EFS.build(tree, top);
    const ok = EFS.roundTripOk(arr);
    const st = EFS.stats(tree);
    v.className = "valid ok";
    v.innerHTML = `<b>✓ 検証通過</b>　<span class="sub">ブックマーク ${st.bookmarks} ／ フォルダ ${st.folders} ／ 最大 ${st.maxDepth} 階層 ／ 往復整合 ${ok ? "OK" : "NG"}</span>`;
    $("cp").disabled = !ok; $("dl").disabled = !ok;
    $("out").value = EFS.toJson(arr);
  }

  function render() { renderTree(); renderOut(); }

  /* ---- イベント ---- */
  $("ab").addEventListener("click", () => addBookmark([]));
  $("af").addEventListener("click", () => addFolder([]));
  $("clear").addEventListener("click", () => { tree = []; render(); });
  $("topName").addEventListener("input", renderOut);
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

  /* ---- インポート ---- */
  function doImport(text) {
    const msg = $("impMsg");
    if (!text || !text.trim()) { msg.className = "valid err"; msg.textContent = "⚠ JSON を入力してください"; return; }
    try {
      const r = EFS.fromJson(text);
      tree = r.tree;
      $("topName").value = r.toplevelName || "";
      render();
      const st = EFS.stats(tree);
      const w = r.warnings.length
        ? `<br><span class="sub">注意: ${r.warnings.map(esc).join(" ／ ")}</span>` : "";
      msg.className = "valid ok";
      msg.innerHTML = `✓ 読み込み完了 — ブックマーク ${st.bookmarks} ／ フォルダ ${st.folders} ／ 最大 ${st.maxDepth} 階層${w}`;
    } catch (e) {
      msg.className = "valid err";
      msg.innerHTML = "✕ " + esc(e.message || e);
    }
  }
  $("impBtn").addEventListener("click", () => doImport($("imp").value));
  $("impFile").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { $("imp").value = rd.result; $("impName").textContent = f.name; doImport(rd.result); };
    rd.onerror = () => { $("impMsg").className = "valid err"; $("impMsg").textContent = "✕ ファイルを読み込めませんでした"; };
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
