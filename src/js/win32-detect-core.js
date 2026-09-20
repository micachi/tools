/* Intune Win32 検出ルール — 検証 + カスタム検出スクリプト生成（テスト可能）

   出典（公式）: MicrosoftDocs/memdocs /intune/app-management/deployment/add-win32.md
     ## Step 4: Detection rules
     - ルールは最低 1 個必要
     - ★ 全ルール条件を満たすことが検出の条件（AND  semantics）
     - アプリ未検出の場合、required intent のアプリは約 24 時間以内に再提供される
     - MSI: プロダクトコード + プロダクトバージョン確認。追加は 1 回のみ
     - File: Path / File or folder / Detection method / 64bit クライアントで 32bit 関連付け
            Path に , や " などの特殊文字を含めない
     - Registry: Key path（HKEY_LOCAL_MACHINE\... または HKLM\...）/ Value name（空ならキーで検出）
     - Custom script: PowerShell。**終了コード 0 かつ STDOUT へ文字列出力**で検出とみなす
   注意: ブラウザ / Node 両対応のため言語判定は自己完結。 */
const W3D = (() => {
  "use strict";

  const LANG = (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ja";
  const EN = LANG === "en";

  const GUID_RE = /^\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}?$/;
  const HK_ROOTS = ["HKEY_LOCAL_MACHINE", "HKLM", "HKEY_CURRENT_USER", "HKCU", "HKEY_CLASSES_ROOT", "HKCR", "HKEY_USERS", "HKU", "HKEY_CURRENT_CONFIG", "HKCC"];

  const RULE_TYPES = EN
    ? { msi: "MSI", file: "File / Folder", registry: "Registry", script: "Custom script" }
    : { msi: "MSI", file: "ファイル / フォルダ", registry: "レジストリ", script: "カスタムスクリプト" };

  /* ---- 個別検証 ---- */
  function validateRule(r) {
    const errs = [];
    const at = EN ? `Rule (${r.type})` : `ルール（${RULE_TYPES[r.type] || r.type}）`;
    if (!["msi", "file", "registry", "script"].includes(r.type)) { errs.push(`${at}: 不明な型`); return errs; }

    if (r.type === "msi") {
      if (!r.productCode || !GUID_RE.test(r.productCode.trim())) {
        errs.push(`${at}: MSI プロダクトコードは GUID 形式である必要があります（例: {1B9C8F2A-…}）`);
      }
    }
    if (r.type === "file") {
      const p = (r.path || "").trim();
      if (!p) { errs.push(`${at}: Path を入力してください`); return errs; }
      if (/[,"]/.test(p)) {
        errs.push(`${at}: Path にカンマ（,）やダブルクォート（"）を含めません（公式で不可と明記）`);
      }
      if (!r.fileOrFolder) errs.push(`${at}: 検出するファイル／フォルダ名を入力してください`);
      if (!r.exists && !r.minVersion) errs.push(`${at}: 「存在確認」か「最小バージョン」のいずれかを指定してください`);
    }
    if (r.type === "registry") {
      const k = (r.keyPath || "").trim();
      if (!k) { errs.push(`${at}: Key path を入力してください`); return errs; }
      const root = k.split("\\")[0];
      if (!HK_ROOTS.includes(root.toUpperCase())) {
        errs.push(`${at}: ルートキーが不正です（HKEY_LOCAL_MACHINE または HKLM などで開始してください）`);
      }
      if (!/\\/.test(k.replace(/^[^\\]+\\/, ""))) {
        errs.push(`${at}: ルート配下のサブキーパスを指定してください（例: HKLM\Software\Vendor\App）`);
      }
    }
    return errs;
  }

  function validate(rules) {
    const errs = [];
    if (!Array.isArray(rules) || rules.length === 0) {
      errs.push(EN ? "At least one detection rule is required" : "検出ルールは最低 1 個必要です");
      return errs;
    }
    const msi = rules.filter((r) => r.type === "msi");
    if (msi.length > 1) {
      errs.push(EN ? "MSI rule can only be added once" : "MSI ルールは 1 回しか追加できません（現在 " + msi.length + " 個）");
    }
    rules.forEach((r) => errs.push(...validateRule(r)));
    return errs;
  }

  /* ---- PowerShell カスタム検出スクリプト生成 ----
     Intune の契約: 終了コード 0 かつ STDOUT に文字列 → 検出
                   出力なし（終了 0）           → 未検出
                   非 0 で終了                 → エラー（検出失敗）

     各チェックは「未検出なら 出力なしで exit 0」で早期リターンし、
     全チェックを通過した最後にまとめて出力する（= 全ルール AND）。 */
  function psCheck(r) {
    if (r.type === "msi") {
      const code = (r.productCode || "").trim().replace(/[{}]/g, "").toUpperCase();
      const ver = r.versionCheck
        ? `if ($mi.ProductVersion -ne "${String(r.productVersion || "").replace(/"/g, '""')}") {
  # バージョン不一致 → 未検出
  exit 0
}` : "";
      return `# MSI プロダクトコード ${code}${r.versionCheck ? ` + バージョン ${r.productVersion} を照合` : ""}
$mi = Get-WmiObject Win32_Product -Filter "IdentifyingNumber = '{${code}}'" -ErrorAction SilentlyContinue
if ($null -eq $mi) {
  # 未インストール → 未検出
  exit 0
}${ver}`;
    }

    if (r.type === "file") {
      const p = String(r.path || "").replace(/"/g, '""');
      const f = String(r.fileOrFolder || "").replace(/"/g, '""');
      if (r.minVersion) {
        return `# ${p}\\${f} のファイルバージョンが ${r.minVersion} 以上かを検出
$f = Get-Item -LiteralPath "${p}\\${f}" -ErrorAction SilentlyContinue
if ($null -eq $f) { exit 0 }
$fv = [Version]$f.VersionInfo.FileVersion
if ($fv -lt [Version]"${String(r.minVersion).replace(/"/g, '""')}") { exit 0 }`;
      }
      return `# ${p}\\${f} の存在を検出
if (-not (Test-Path -LiteralPath "${p}\\${f}")) { exit 0 }`;
    }

    if (r.type === "registry") {
      const k = String(r.keyPath || "").replace(/"/g, '""');
      const psPath = k.replace(/^HKEY_LOCAL_MACHINE/i, "HKLM:")
                     .replace(/^HKLM/i, "HKLM:")
                     .replace(/^HKEY_CURRENT_USER/i, "HKCU:")
                     .replace(/^HKCU/i, "HKCU:");
      if (r.valueName) {
        const vn = String(r.valueName).replace(/"/g, '""');
        return `# レジストリ値 ${k}\\${r.valueName} を検出
$k = "${psPath}"
if (-not (Test-Path $k)) { exit 0 }
$v = (Get-ItemProperty -Path $k -Name "${vn}" -ErrorAction SilentlyContinue).${r.valueName}
if ($null -eq $v) { exit 0 }`;
      }
      return `# レジストリキー ${k} の存在を検出
if (-not (Test-Path "${psPath}")) { exit 0 }`;
    }

    return "";
  }

  /** 複数ルール → 全条件 AND のカスタム検出スクリプト */
  function buildScript(rules) {
    const header = EN
      ? `# Intune Win32 custom detection script
# Contract: exit 0 + non-empty STDOUT => app DETECTED
#           exit 0 + no output        => NOT detected
#           non-zero exit            => error (detection failed)
# NOTE: ALL rules must be satisfied for the app to be detected.
$ErrorActionPreference = "Stop"`
      : `# Intune Win32 カスタム検出スクリプト
# 契約: 終了コード 0 + STDOUT に文字列 → アプリ「検出」
#       終了コード 0 + 出力なし        → 「未検出」
#       非 0 で終了                  → エラー（検出失敗）
# ★ すべてのルール条件を満たすことが検出の条件です（AND）
$ErrorActionPreference = "Stop"`;

    if (!rules || !rules.length) return header + "\n\nexit 0\n";

    const body = rules.map((r, i) => `# --- rule ${i + 1} (${RULE_TYPES[r.type] || r.type}) ---\n${psCheck(r)}`).join("\n\n");

    return `${header}

${body}

# 全ルールを通過 → 検出
Write-Output "Detected: all ${rules.length} detection rule(s) satisfied"
exit 0
`;
  }

  return { RULE_TYPES, GUID_RE, HK_ROOTS, validateRule, validate, psCheck, buildScript };
})();

if (typeof module !== "undefined" && module.exports) module.exports = W3D;
if (typeof window !== "undefined") window.W3D = W3D;
