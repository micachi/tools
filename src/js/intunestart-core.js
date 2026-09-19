/* Intune Windows 11 スタートレイアウト JSON — 生成・検証ロジック（テスト可能）
   注意: ブラウダ（ビルド済み）と Node テストの両方で単独ロードされるため言語判定は自己完結。 */
const IJS = (() => {
  "use strict";

  const LANG = (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ja";
  const STR = {
    ja: {
      nth: (i) => `${i} 件目`,
      noKey: "キーが何も設定されていません",
      oneKey: (u) => `キーは1つだけにしてください（現在: ${u}）`,
      aumidShape: "UWP の AUMID は「<PackageFamilyName>!<AppId>」の形にしてください（! が必須）",
      desktopIdShape: "デスクトップアプリの AppUserModelID は「Microsoft.Windows.Explorer」のようなドット区切りの識別子にしてください",
      needLnk: ".lnk へのパスを指定してください（実行ファイルの直接指定ではピン留めされません）",
      needEnvPath: "環境変数（%APPDATA% 等）または絶対パスにしてください",
      tileMissing: (m) => `secondaryTile に必須フィールドがありません → ${m}`,
      tileArgs: "arguments に --pin-url=<URL> が含まれていません",
      noPins: "ピンが1つもありません（pinnedList は空にできません）",
      tooMany: (n) => `ピンが多すぎます（${n} 件）。実用上 3 桁は避けましょう`,
      applyOnceBad: "applyOnce は true / false のどちらかにしてください",
      parseFail: "JSON として解析できません: ",
      notObj: "トップレベルがオブジェクトではありません",
      noList: "pinnedList（配列）が見つかりません",
      applyOnceMissing: "applyOnce が未指定でした（false として扱います）",
      pin: (i) => `ピン${i}`,
      notObjIgnore: "オブジェクトではないため無視",
      noKnownKey: (k, e) => `既知のキー（${k}）が無いため無視しました → ${e}`,
      emptyWord: "空",
      multiKey: (k) => `複数のキーがあります（${k}）— 先頭のみ採用しました`,
      unknownKey: (e) => `未知のキーを省略しました → ${e}`,
      nothing: "読み込めるピンがありません",
    },
    en: {
      nth: (i) => `Entry ${i}`,
      noKey: "No key is set",
      oneKey: (u) => `Use exactly one key (currently: ${u})`,
      aumidShape: 'A UWP AUMID must look like "<PackageFamilyName>!<AppId>" (! is required)',
      desktopIdShape: 'A Win32 AppUserModelID should be a dot-separated identifier such as "Microsoft.Windows.Explorer"',
      needLnk: "Specify a path to a .lnk (pointing straight at an exe will not pin)",
      needEnvPath: "Use an environment variable (%APPDATA% etc.) or an absolute path",
      tileMissing: (m) => `secondaryTile is missing required fields → ${m}`,
      tileArgs: "arguments does not contain --pin-url=<URL>",
      noPins: "There are no pins (pinnedList cannot be empty)",
      tooMany: (n) => `Too many pins (${n}). Avoid three digits in practice`,
      applyOnceBad: "applyOnce must be true or false",
      parseFail: "Could not parse as JSON: ",
      notObj: "Top level is not an object",
      noList: "pinnedList (an array) was not found",
      applyOnceMissing: "applyOnce was not specified (treated as false)",
      pin: (i) => `Pin ${i}`,
      notObjIgnore: "Ignored: not an object",
      noKnownKey: (k, e) => `Ignored: none of the known keys (${k}) present → ${e}`,
      emptyWord: "empty",
      multiKey: (k) => `Multiple keys present (${k}) — kept only the first`,
      unknownKey: (e) => `Omitted unknown key(s) → ${e}`,
      nothing: "No pins could be loaded",
    },
  };
  const T = STR[LANG] || STR.ja;

  const PIN_TYPES = {
    packagedAppId:  { label: LANG === "en" ? "UWP / MS Store app (AUMID)" : "UWP / MS Store アプリ (AUMID)" },
    desktopAppId:   { label: LANG === "en" ? "Desktop app (AUMID)" : "デスクトップアプリ (AUMID)" },
    desktopAppLink: { label: LANG === "en" ? "Desktop app (.lnk path)" : "デスクトップアプリ (.lnk パス)" },
    secondaryTile:  { label: LANG === "en" ? "Edge pinned site" : "Edge ピン留めサイト" },
  };

  // 公式ドキュメントの例 + 一般に既知の AUMID。実機では Get-StartApps で要確認。
  const P = (name, nameEn, type, value, src) => ({ name, nameEn, type, value, src });
  const PRESETS = [
    P("設定", "Settings", "packagedAppId", "windows.immersivecontrolpanel_cw5n1h2txyewy!microsoft.windows.immersivecontrolpanel", "docs"),
    P("Microsoft Edge", "Microsoft Edge", "desktopAppLink", "%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\Microsoft Edge.lnk", "docs"),
    P("エクスプローラー", "File Explorer", "desktopAppLink", "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\System Tools\\File Explorer.lnk", "docs"),
    P("Windows PowerShell", "Windows PowerShell", "desktopAppLink", "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Windows PowerShell\\Windows PowerShell.lnk", "docs"),
    P("ターミナル", "Terminal", "packagedAppId", "Microsoft.WindowsTerminal_8wekyb3d8bbwe!App", "docs"),
    P("ペイント", "Paint", "packagedAppId", "Microsoft.Paint_8wekyb3d8bbwe!App", "docs"),
    P("写真", "Photos", "packagedAppId", "Microsoft.Windows.Photos_8wekyb3d8bbwe!App", "docs"),
    P("クイック アシスト", "Quick Assist", "packagedAppId", "MicrosoftCorporationII.QuickAssist_8wekyb3d8bbwe!App", "docs"),
    P("Sticky Notes", "Sticky Notes", "packagedAppId", "Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe!App", "docs"),
    P("Windows セキュリティ", "Windows Security", "packagedAppId", "Microsoft.SecHealthUI_8wekyb3d8bbwe!SecHealthUI", "docs"),
    P("Outlook (new)", "Outlook (new)", "packagedAppId", "Microsoft.OutlookForWindows_8wekyb3d8bbwe!Microsoft.OutlookforWindows", "docs"),
    P("電卓", "Calculator", "packagedAppId", "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App", "known"),
    P("アラーム & クロック", "Alarms & Clock", "packagedAppId", "Microsoft.WindowsAlarms_8wekyb3d8bbwe!App", "known"),
    P("Microsoft Store", "Microsoft Store", "packagedAppId", "Microsoft.WindowsStore_8wekyb3d8bbwe!App", "known"),
    P("メモ帳 (Notepad)", "Notepad", "packagedAppId", "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App", "known"),
    P("Microsoft To Do", "Microsoft To Do", "packagedAppId", "Microsoft.ToDo_8wekyb3d8bbwe!App", "known"),
    P("Microsoft Teams (新規)", "Microsoft Teams (new)", "packagedAppId", "MSTeams_8wekyb3d8bbwe!MSTeams", "known"),
  ].map((p) => ({ ...p, label: LANG === "en" ? p.nameEn : p.name }));

  const KEYS = Object.keys(PIN_TYPES);

  /** 1ピン分のエントリを検証し、エラーメッセージ配列を返す */
  function validatePin(pin, i) {
    const errs = [];
    const at = T.nth(i + 1);
    const used = KEYS.filter((k) => pin[k] !== undefined && pin[k] !== "");
    if (used.length === 0) { errs.push(`${at}: ${T.noKey}`); return errs; }
    if (used.length > 1) { errs.push(`${at}: ${T.oneKey(used.join(", "))}`); return errs; }

    const k = used[0];
    const v = pin[k];

    if (k === "packagedAppId") {
      // UWP は PackageFamilyName!AppId の形が必須
      if (!/^[A-Za-z0-9._]+![A-Za-z0-9._]+$/.test(v)) {
        errs.push(`${at}: ${T.aumidShape}`);
      }
    }
    if (k === "desktopAppId") {
      // クラシックアプリの AppUserModelID は "Microsoft.Windows.Explorer" のように ! を含まない形式が正当
      if (!/^[A-Za-z0-9._]+$/.test(v) || !v.includes(".")) {
        errs.push(`${at}: ${T.desktopIdShape}`);
      }
    }
    if (k === "desktopAppLink") {
      if (!/\.lnk$/i.test(v)) errs.push(`${at}: ${T.needLnk}`);
      if (!/%[A-Za-z]+%|^[A-Za-z]:\\/.test(v)) errs.push(`${at}: ${T.needEnvPath}`);
    }
    if (k === "secondaryTile") {
      const t = v || {};
      const req = ["tileId", "arguments", "displayName", "packagedAppId"];
      const missing = req.filter((f) => !t[f]);
      if (missing.length) errs.push(`${at}: ${T.tileMissing(missing.join(", "))}`);
      if (t.arguments && !/--pin-url=/.test(t.arguments)) {
        errs.push(`${at}: ${T.tileArgs}`);
      }
    }
    return errs;
  }

  function validate(pins, applyOnce) {
    const errs = [];
    if (!Array.isArray(pins) || pins.length === 0) errs.push(T.noPins);
    pins.forEach((p, i) => errs.push(...validatePin(p, i)));
    if (pins.length > 100) errs.push(T.tooMany(pins.length));
    if (applyOnce !== true && applyOnce !== false) errs.push(T.applyOnceBad);
    return errs;
  }

  /** Intune に投入する最終 JSON オブジェクト */
  function buildLayout(pins, applyOnce) {
    const list = pins.map((p) => {
      const k = KEYS.find((x) => p[x] !== undefined && p[x] !== "");
      if (!k) return null;
      const o = {};
      o[k] = p[k];
      return o;
    }).filter(Boolean);
    return { applyOnce: !!applyOnce, pinnedList: list };
  }

  const toJson = (obj, indent = 4) => JSON.stringify(obj, null, indent);

  /** 生成 JSON を往復させて破損がないか確認 */
  function roundTripOk(obj) {
    try {
      const a = JSON.parse(JSON.stringify(obj));
      return a.applyOnce === obj.applyOnce && a.pinnedList.length === obj.pinnedList.length;
    } catch { return false; }
  }

  /**
   * 既存 LayoutModification.json をエディタ用の pins 配列に逆変換する。
   * 返り値: { pins, applyOnce, warnings }
   */
  function fromJson(text) {
    const warnings = [];
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(T.parseFail + (e.message || e));
    }
    if (!data || typeof data !== "object") throw new Error(T.notObj);
    if (!Array.isArray(data.pinnedList)) throw new Error(T.noList);

    const applyOnce = data.applyOnce === true;
    if (data.applyOnce === undefined) warnings.push(T.applyOnceMissing);

    const pins = [];
    data.pinnedList.forEach((entry, i) => {
      const at = T.pin(i + 1);
      if (!entry || typeof entry !== "object") { warnings.push(`${at}: ${T.notObjIgnore}`); return; }
      const keys = Object.keys(entry);
      const known = keys.filter((k) => KEYS.includes(k));
      if (known.length === 0) {
        warnings.push(`${at}: ${T.noKnownKey(KEYS.join(" / "), keys.join(", ") || T.emptyWord)}`);
        return;
      }
      if (known.length > 1) warnings.push(`${at}: ${T.multiKey(known.join(", "))}`);
      const k = known[0];
      const extra = keys.filter((x) => !KEYS.includes(x));
      if (extra.length) warnings.push(`${at}: ${T.unknownKey(extra.join(", "))}`);
      pins.push({ [k]: entry[k] });
    });

    if (!pins.length) throw new Error(T.nothing);
    return { pins, applyOnce, warnings };
  }

  return { PIN_TYPES, PRESETS, KEYS, validatePin, validate, buildLayout, toJson, roundTripOk, fromJson };
})();

if (typeof module !== "undefined" && module.exports) module.exports = IJS;
if (typeof window !== "undefined") window.IJS = IJS;
