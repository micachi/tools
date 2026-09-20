/* 管理対象ブックマーク — 生成・検証ロジック（テスト可能）
   対象: Microsoft Edge「ManagedFavorites」 / Google Chrome「ManagedBookmarks」

   ★ 重要: 両者は JSON スキーマが完全同一である（公式ポリシー定義 JSON で確認済み）。
     Edge  : SOFTWARE\Policies\Microsoft\Edge  → ManagedFavorites
     Chrome: SOFTWARE\Policies\Google\Chrome   → ManagedBookmarks
     どちらも { toplevel_name | name+url | name+children[] } の配列で、
     children は再帰。不完全 URL はアドレスバーと同じ補完される。
     よってエディタと変換ロジックは完全共有し、差異は「名前・既定値・展開先」だけ。

   出典:
     Edge   https://learn.microsoft.com/deployedge/microsoft-edge-policies/managedfavorites
     Chrome https://chromeenterprise.google/policies/managed-bookmarks/
            (chromeenterprise.google/.../policy_templates_en-US.json / policy_definitions)

   注意: ブラウザ（ビルド済み）と Node テストの両方で単独ロードされるため言語判定は自己完結。 */
const MBK = (() => {
  "use strict";

  const LANG = (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ja";
  const STR = {
    ja: {
      item: "項目", emptyItem: "空の項目があります", needName: "名前を入力してください",
      badNameChar: "名前に使用できない文字が含まれています", needUrl: "URL を入力してください",
      urlSpace: "URL に空白を含めません",
      urlDot: "URL にドットまたはスキームが必要です（例: intranet.example.com）",
      jsUrl: "javascript: URL は使用できません",
      folderUrl: "フォルダに url キーを付けないでください（children を使う）",
      folderChildren: "フォルダには children 配列が必要です",
      folderEmpty: "空のフォルダです（展開先で意味を持ちません）",
      unknownType: "不明な型です", noFav: "ブックマークが1つもありません",
      badTopChar: "トップフォルダ名に使用できない文字が含まれています",
      parseFail: "JSON として解析できません: ",
      notArray: "トップレベルが配列ではありません（このポリシーは配列が必須）",
      notObj: "オブジェクトではないため無視しました", noName: "name が無いため無視しました",
      emptyFolder: (n) => `フォルダ「${n}」は中身が空です`,
      treatedAsFolder: () => `url も children も無く、フォルダとして扱いました（空）`,
      elem: (i) => `要素${i}`, nothing: "読み込めるブックマークがありません",
      unknownTarget: (t) => `未対応のターゲットです: ${t}`,
    },
    en: {
      item: "Item", emptyItem: "There is an empty entry", needName: "Enter a name",
      badNameChar: "The name contains characters that are not allowed", needUrl: "Enter a URL",
      urlSpace: "The URL must not contain whitespace",
      urlDot: "The URL needs a dot or a scheme (e.g. intranet.example.com)",
      jsUrl: "javascript: URLs are not allowed",
      folderUrl: "Do not put a url key on a folder (use children)",
      folderChildren: "A folder needs a children array",
      folderEmpty: "This folder is empty (it carries no meaning at the deployment target)",
      unknownType: "Unknown type", noFav: "There are no bookmarks",
      badTopChar: "The top-level folder name contains characters that are not allowed",
      parseFail: "Could not parse as JSON: ",
      notArray: "Top level is not an array (this policy must be an array)",
      notObj: "Ignored: not an object", noName: "Ignored: no name",
      emptyFolder: (n) => `Folder "${n}" is empty`,
      treatedAsFolder: () => `Had neither url nor children; treated as an empty folder`,
      elem: (i) => `Element ${i}`, nothing: "No bookmarks could be loaded",
      unknownTarget: (t) => `Unsupported target: ${t}`,
    },
  };
  const T = STR[LANG] || STR.ja;

  /* ── 展開対象ブラウザ ────────────────────────────────────
     スキーマは同一。ポリシー名・既定フォルダ名・登録先のみ異なる。 */
  const TARGETS = {
    edge: {
      key: "edge",
      label: LANG === "en" ? "Microsoft Edge" : "Microsoft Edge",
      policy: "ManagedFavorites",
      policyJa: "管理されたお気に入り",
      defaultTop: "Managed favorites",
      file: "ManagedFavorites.json",
      winReg: "SOFTWARE\\Policies\\Microsoft\\Edge",
      macDomain: "com.microsoft.Edge",
      supported: "Windows / macOS ≥ 77 ・ Android ≥ 30 ・ iOS ≥ 85",
      // Edge は GPO / Intune 設定カタログで直接適用できる（追加の登録手続きが要らない）
      needsEnrollment: false,
    },
    chrome: {
      key: "chrome",
      label: LANG === "en" ? "Google Chrome" : "Google Chrome",
      policy: "ManagedBookmarks",
      policyJa: "管理対象のブックマーク",
      defaultTop: "Managed bookmarks",
      file: "ManagedBookmarks.json",
      winReg: "SOFTWARE\\Policies\\Google\\Chrome",
      macDomain: "com.google.Chrome",
      supported: "Chrome ≥ 37 ・ ChromeOS ≥ 37 ・ Android ≥ 30 ・ iOS ≥ 88",
      // Chrome は「管理下にある」こと自体が前提。未登録マシンではポリシーが読まれない。
      needsEnrollment: true,
    },
  };
  const target = (k) => {
    const t = TARGETS[k];
    if (!t) throw new Error(T.unknownTarget(k));
    return t;
  };

  /* ノード: { type: 'bookmark'|'folder', name, url?, children? } */
  function bookmark(name, url) { return { type: "bookmark", name, url }; }
  function folder(name, children = []) { return { type: "folder", name, children }; }

  /** 1ノードを検証。errs を返す */
  function validateNode(n, path, errs) {
    const at = path || T.item;
    if (!n) { errs.push(`${at}: ${T.emptyItem}`); return errs; }
    if (!n.name || !String(n.name).trim()) { errs.push(`${at}: ${T.needName}`); return errs; }
    if (/[<>"\n]/.test(n.name)) { errs.push(`${at}: ${T.badNameChar}`); return errs; }

    if (n.type === "bookmark") {
      if (!n.url || !String(n.url).trim()) { errs.push(`${at}: ${T.needUrl}`); return errs; }
      if (/\s/.test(n.url)) { errs.push(`${at}: ${T.urlSpace}`); return errs; }
      if (!/[.]/.test(n.url) && !/^(https?:|file:|about:)/i.test(n.url)) {
        errs.push(`${at}: ${T.urlDot}`);
      }
      if (/^javascript:/i.test(n.url)) { errs.push(`${at}: ${T.jsUrl}`); return errs; }
    } else if (n.type === "folder") {
      if (n.url) errs.push(`${at}: ${T.folderUrl}`);
      if (!Array.isArray(n.children)) { errs.push(`${at}: ${T.folderChildren}`); return errs; }
      if (n.children.length === 0) errs.push(`${at}: ${T.folderEmpty}`);
      n.children.forEach((c, i) => validateNode(c, `${at} > ${c && c.name ? c.name : T.item + (i + 1)}`, errs));
    } else {
      errs.push(`${at}: ${T.unknownType}`);
    }
    return errs;
  }

  function validate(nodes, toplevelName) {
    const errs = [];
    if (!Array.isArray(nodes) || nodes.length === 0) { errs.push(T.noFav); return errs; }
    nodes.forEach((n, i) => validateNode(n, `${T.item}${i + 1}${n && n.name ? "（" + n.name + "）" : ""}`, errs));
    if (toplevelName && /[<>"\n]/.test(toplevelName)) errs.push(T.badTopChar);
    return errs;
  }

  /** 1ノード → ポリシー用 dict */
  function nodeToDict(n) {
    if (n.type === "folder") {
      return { children: (n.children || []).map(nodeToDict), name: n.name };
    }
    return { name: n.name, url: n.url };
  }

  /** 展開用の最終 JSON 配列（target は既定フォルダ名の決定に使う） */
  function build(nodes, toplevelName, targetKey = "edge") {
    const def = target(targetKey).defaultTop;
    const top = (toplevelName && String(toplevelName).trim()) || def;
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
   * 既存ポリシー JSON をツリーに逆変換する。
   * Edge / Chrome どちらの JSON も読める（スキーマ同一のため）。
   * 返り値: { tree, toplevelName, warnings }
   */
  function fromJson(text) {
    const warnings = [];
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(T.parseFail + (e.message || e));
    }
    if (!Array.isArray(data)) throw new Error(T.notArray);

    let toplevelName = "";
    const tree = [];

    const conv = (dict, where) => {
      if (!dict || typeof dict !== "object" || Array.isArray(dict)) {
        warnings.push(`${where}: ${T.notObj}`);
        return null;
      }
      const keys = Object.keys(dict);
      if (keys.includes("toplevel_name")) {
        toplevelName = String(dict.toplevel_name || "");
        return null;
      }
      if (!dict.name || !String(dict.name).trim()) {
        warnings.push(`${where}: ${T.noName}`);
        return null;
      }
      if (Array.isArray(dict.children)) {
        const kids = dict.children.map((c, i) => conv(c, `${where} > ${dict.name}[${i}]`)).filter(Boolean);
        if (kids.length === 0) warnings.push(T.emptyFolder(dict.name));
        return folder(String(dict.name), kids);
      }
      if (typeof dict.url === "string" && dict.url.trim()) {
        return bookmark(String(dict.name), dict.url);
      }
      warnings.push(`${where}「${dict.name}」: ${T.treatedAsFolder()}`);
      return folder(String(dict.name), []);
    };

    data.forEach((d, i) => {
      const n = conv(d, T.elem(i + 1));
      if (n) tree.push(n);
    });

    if (!tree.length) throw new Error(T.nothing);
    return { tree, toplevelName, warnings };
  }

  return {
    TARGETS, target, bookmark, folder,
    validateNode, validate, nodeToDict, build, toJson, roundTripOk, stats, fromJson,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = MBK;
if (typeof window !== "undefined") window.MBK = MBK;
