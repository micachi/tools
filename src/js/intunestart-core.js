/* Intune Windows 11 スタートレイアウト JSON — 生成・検証ロジック（テスト可能） */
const IJS = (() => {
  "use strict";

  const PIN_TYPES = {
    packagedAppId:  { label: "UWP / MS Store アプリ (AUMID)" },
    desktopAppId:   { label: "デスクトップアプリ (AUMID)" },
    desktopAppLink: { label: "デスクトップアプリ (.lnk パス)" },
    secondaryTile:  { label: "Edge ピン留めサイト" },
  };

  // 公式ドキュメントの例 + 一般に既知の AUMID。実機では Get-StartApps で要確認。
  const PRESETS = [
    { name: "設定", type: "packagedAppId", value: "windows.immersivecontrolpanel_cw5n1h2txyewy!microsoft.windows.immersivecontrolpanel", src: "docs" },
    { name: "Microsoft Edge", type: "desktopAppLink", value: "%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\Microsoft Edge.lnk", src: "docs" },
    { name: "エクスプローラー", type: "desktopAppLink", value: "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\System Tools\\File Explorer.lnk", src: "docs" },
    { name: "Windows PowerShell", type: "desktopAppLink", value: "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Windows PowerShell\\Windows PowerShell.lnk", src: "docs" },
    { name: "ターミナル", type: "packagedAppId", value: "Microsoft.WindowsTerminal_8wekyb3d8bbwe!App", src: "docs" },
    { name: "ペイント", type: "packagedAppId", value: "Microsoft.Paint_8wekyb3d8bbwe!App", src: "docs" },
    { name: "写真", type: "packagedAppId", value: "Microsoft.Windows.Photos_8wekyb3d8bbwe!App", src: "docs" },
    { name: "クイック アシスト", type: "packagedAppId", value: "MicrosoftCorporationII.QuickAssist_8wekyb3d8bbwe!App", src: "docs" },
    { name: "Sticky Notes", type: "packagedAppId", value: "Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe!App", src: "docs" },
    { name: "Windows セキュリティ", type: "packagedAppId", value: "Microsoft.SecHealthUI_8wekyb3d8bbwe!SecHealthUI", src: "docs" },
    { name: "Outlook (new)", type: "packagedAppId", value: "Microsoft.OutlookForWindows_8wekyb3d8bbwe!Microsoft.OutlookforWindows", src: "docs" },
    { name: "電卓", type: "packagedAppId", value: "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App", src: "known" },
    { name: "アラーム & クロック", type: "packagedAppId", value: "Microsoft.WindowsAlarms_8wekyb3d8bbwe!App", src: "known" },
    { name: "Microsoft Store", type: "packagedAppId", value: "Microsoft.WindowsStore_8wekyb3d8bbwe!App", src: "known" },
    { name: "メモ帳 (Notepad)", type: "packagedAppId", value: "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App", src: "known" },
    { name: "Microsoft To Do", type: "packagedAppId", value: "Microsoft.ToDo_8wekyb3d8bbwe!App", src: "known" },
    { name: "Microsoft Teams (新規)", type: "packagedAppId", value: "MSTeams_8wekyb3d8bbwe!MSTeams", src: "known" },
  ];

  const KEYS = Object.keys(PIN_TYPES);

  /** 1ピン分のエントリを検証し、エラーメッセージ配列を返す */
  function validatePin(pin, i) {
    const errs = [];
    const at = `${i + 1} 件目`;
    const used = KEYS.filter((k) => pin[k] !== undefined && pin[k] !== "");
    if (used.length === 0) { errs.push(`${at}: キーが何も設定されていません`); return errs; }
    if (used.length > 1) { errs.push(`${at}: キーは1つだけにしてください（現在: ${used.join(", ")}）`); return errs; }

    const k = used[0];
    const v = pin[k];

    if (k === "packagedAppId") {
      // UWP は PackageFamilyName!AppId の形が必須
      if (!/^[A-Za-z0-9._]+![A-Za-z0-9._]+$/.test(v)) {
        errs.push(`${at}: UWP の AUMID は「<PackageFamilyName>!<AppId>」の形にしてください（! が必須）`);
      }
    }
    if (k === "desktopAppId") {
      // クラシックアプリの AppUserModelID は "Microsoft.Windows.Explorer" のように ! を含まない形式が正当
      if (!/^[A-Za-z0-9._]+$/.test(v) || !v.includes(".")) {
        errs.push(`${at}: デスクトップアプリの AppUserModelID は「Microsoft.Windows.Explorer」のようなドット区切りの識別子にしてください`);
      }
    }
    if (k === "desktopAppLink") {
      if (!/\.lnk$/i.test(v)) errs.push(`${at}: .lnk へのパスを指定してください（実行ファイルの直接指定ではピン留めされません）`);
      if (!/%[A-Za-z]+%|^[A-Za-z]:\\/.test(v)) errs.push(`${at}: 環境変数（%APPDATA% 等）または絶対パスにしてください`);
    }
    if (k === "secondaryTile") {
      const t = v || {};
      const req = ["tileId", "arguments", "displayName", "packagedAppId"];
      const missing = req.filter((f) => !t[f]);
      if (missing.length) errs.push(`${at}: secondaryTile に必須フィールドがありません → ${missing.join(", ")}`);
      if (t.arguments && !/--pin-url=/.test(t.arguments)) {
        errs.push(`${at}: arguments に --pin-url=<URL> が含まれていません`);
      }
    }
    return errs;
  }

  function validate(pins, applyOnce) {
    const errs = [];
    if (!Array.isArray(pins) || pins.length === 0) errs.push("ピンが1つもありません（pinnedList は空にできません）");
    pins.forEach((p, i) => errs.push(...validatePin(p, i)));
    if (pins.length > 100) errs.push(`ピンが多すぎます（${pins.length} 件）。実用上 3 桁は避けましょう`);
    if (applyOnce !== true && applyOnce !== false) errs.push("applyOnce は true / false のどちらかにしてください");
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

  return { PIN_TYPES, PRESETS, KEYS, validatePin, validate, buildLayout, toJson, roundTripOk };
})();

if (typeof module !== "undefined" && module.exports) module.exports = IJS;
if (typeof window !== "undefined") window.IJS = IJS;
