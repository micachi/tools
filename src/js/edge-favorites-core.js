/* Microsoft Edge ManagedFavorites — 生成・検証ロジック（テスト可能）
   スキーマ出典: Microsoft Learn / deployedge / microsoft-edge-policies / managedfavorites */
const EFS = (() => {
  "use strict";

  const DEFAULT_TOP = "Managed favorites";

  /* ノード: { type: 'bookmark'|'folder', name, url?, children? } */
  function bookmark(name, url) { return { type: "bookmark", name, url }; }
  function folder(name, children = []) { return { type: "folder", name, children }; }

  /** 1ノードを検証。errs を返す */
  function validateNode(n, path, errs) {
    const at = path || "項目";
    if (!n) { errs.push(`${at}: 空の項目があります`); return errs; }
    if (!n.name || !String(n.name).trim()) { errs.push(`${at}: 名前を入力してください`); return errs; }
    if (/[<>"\n]/.test(n.name)) { errs.push(`${at}: 名前に使用できない文字が含まれています`); return errs; }

    if (n.type === "bookmark") {
      if (!n.url || !String(n.url).trim()) { errs.push(`${at}: URL を入力してください`); return errs; }
      if (/\s/.test(n.url)) { errs.push(`${at}: URL に空白を含めません`); return errs; }
      // スキーム無しでも Edge が補完する（microsoft.com → https://microsoft.com/）が、
      // 明らかな誤入力は弾く
      if (!/[.]/.test(n.url) && !/^(https?:|file:|about:)/i.test(n.url)) {
        errs.push(`${at}: URL にドットまたはスキームが必要です（例: intranet.example.com）`);
      }
      if (/^javascript:/i.test(n.url)) { errs.push(`${at}: javascript: URL は使用できません`); return errs; }
    } else if (n.type === "folder") {
      if (n.url) errs.push(`${at}: フォルダに url キーを付けないでください（children を使う）`);
      if (!Array.isArray(n.children)) { errs.push(`${at}: フォルダには children 配列が必要です`); return errs; }
      if (n.children.length === 0) errs.push(`${at}: 空のフォルダです（Intune 上で意味を持ちません）`);
      n.children.forEach((c, i) => validateNode(c, `${at} > ${c && c.name ? c.name : "項目" + (i + 1)}`, errs));
    } else {
      errs.push(`${at}: 不明な型です`);
    }
    return errs;
  }

  function validate(nodes, toplevelName) {
    const errs = [];
    if (!Array.isArray(nodes) || nodes.length === 0) {
      errs.push("お気に入りが1つもありません");
      return errs;
    }
    nodes.forEach((n, i) => validateNode(n, `項目${i + 1}${n && n.name ? "（" + n.name + "）" : ""}`, errs));
    if (toplevelName && /[<>"\n]/.test(toplevelName)) errs.push("トップフォルダ名に使用できない文字が含まれています");
    return errs;
  }

  /** 1ノード → ManagedFavorites の dict */
  function nodeToDict(n) {
    if (n.type === "folder") {
      return { children: (n.children || []).map(nodeToDict), name: n.name };
    }
    return { name: n.name, url: n.url };
  }

  /** Intune 投入用の最終 JSON 配列 */
  function build(nodes, toplevelName) {
    const top = (toplevelName && String(toplevelName).trim()) || DEFAULT_TOP;
    return [{ toplevel_name: top }, ...nodes.map(nodeToDict)];
  }

  const toJson = (arr, indent = 2) => JSON.stringify(arr, null, indent);

  /** 生成 JSON が往復で壊れないか */
  function roundTripOk(arr) {
    try {
      const a = JSON.parse(JSON.stringify(arr));
      return Array.isArray(a) && a.length === arr.length && a[0].toplevel_name === arr[0].toplevel_name;
    } catch { return false; }
  }

  /** 統計 */
  function stats(nodes) {
    let bookmarks = 0, folders = 0, maxDepth = 0;
    const walk = (list, d) => {
      maxDepth = Math.max(maxDepth, d);
      for (const n of list) {
        if (n.type === "folder") { folders++; walk(n.children || [], d + 1); }
        else bookmarks++;
      }
    };
    walk(nodes, 1);
    return { bookmarks, folders, maxDepth };
  }

  /**
   * 既存 ManagedFavorites JSON をツリーに逆変換する。
   * 返り値: { tree, toplevelName, warnings }
   */
  function fromJson(text) {
    const warnings = [];
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("JSON として解析できません: " + (e.message || e));
    }
    if (!Array.isArray(data)) throw new Error("トップレベルが配列ではありません（ManagedFavorites は配列が必須）");

    let toplevelName = "";
    const tree = [];

    const conv = (dict, where) => {
      if (!dict || typeof dict !== "object" || Array.isArray(dict)) {
        warnings.push(`${where}: オブジェクトではないため無視しました`);
        return null;
      }
      const keys = Object.keys(dict);
      if (keys.includes("toplevel_name")) {
        toplevelName = String(dict.toplevel_name || "");
        return null;
      }
      if (!dict.name || !String(dict.name).trim()) {
        warnings.push(`${where}: name が無いため無視しました`);
        return null;
      }
      if (Array.isArray(dict.children)) {
        const kids = dict.children.map((c, i) => conv(c, `${where} > ${dict.name}[${i}]`)).filter(Boolean);
        if (kids.length === 0) warnings.push(`フォルダ「${dict.name}」は中身が空です`);
        return folder(String(dict.name), kids);
      }
      if (typeof dict.url === "string" && dict.url.trim()) {
        return bookmark(String(dict.name), dict.url);
      }
      warnings.push(`${where}「${dict.name}」: url も children も無く、フォルダとして扱いました（空）`);
      return folder(String(dict.name), []);
    };

    data.forEach((d, i) => {
      const n = conv(d, `要素${i + 1}`);
      if (n) tree.push(n);
    });

    if (!tree.length) throw new Error("読み込めるお気に入りがありません");
    return { tree, toplevelName, warnings };
  }

  return { DEFAULT_TOP, bookmark, folder, validateNode, validate, nodeToDict, build, toJson, roundTripOk, stats, fromJson };
})();

if (typeof module !== "undefined" && module.exports) module.exports = EFS;
if (typeof window !== "undefined") window.EFS = EFS;
