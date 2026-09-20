/* Microsoft Graph（Intune）照会スニペット生成 — テスト可能

   検証済み要素:
     - ベース URL: https://graph.microsoft.com/{v1.0|beta}/deviceManagement/...
       （memdocs /intune/developer/configure-graph-api-access.md に
         https://graph.microsoft.com/beta/me/managedDevices 等の実例）
     - アプリ権限（Application permission）名: 同ドキュメントの列挙値
         Device.Read.All / DeviceManagementManagedDevices.Read(.ReadWrite).All
         DeviceManagementConfiguration.Read(.ReadWrite).All
         DeviceManagementApps.Read(.ReadWrite).All
         DeviceManagementScripts.Read(.ReadWrite).All
         DeviceManagementRBAC.Read(.ReadWrite).All
         DeviceManagementServiceConfig.Read(.ReadWrite).All
         Report.Read.All
     - スクリプト系リソース: deviceManagementScripts / deviceHealthScripts /
       deviceComplianceScripts / deviceShellScripts / deviceCustomAttributeShellScripts */
const IGR = (() => {
  "use strict";

  const LANG = (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ja";
  const EN = LANG === "en";

  const BASE = "https://graph.microsoft.com";
  const VERSIONS = ["v1.0", "beta"];

  /* リソース定義: path / 説明 / 必要なアプリ権限 */
  const RESOURCES = [
    { path: "deviceManagement/managedDevices", label: EN ? "Managed devices" : "管理対象デバイス", perm: "DeviceManagementManagedDevices.Read.All",
      select: ["id", "deviceName", "operatingSystem", "osVersion", "manufacturer", "model", "ownerType", "complianceState", "enrolledDateTime", "lastSyncDateTime"] },
    { path: "deviceManagement/deviceConfigurations", label: EN ? "Device configuration profiles" : "デバイス構成プロファイル", perm: "DeviceManagementConfiguration.Read.All",
      select: ["id", "name", "createdDateTime", "lastModifiedDateTime"] },
    { path: "deviceManagement/deviceCompliancePolicies", label: EN ? "Compliance policies" : "コンプライアンスポリシー", perm: "DeviceManagementManagedDevices.Read.All",
      select: ["id", "name", "createdDateTime", "lastModifiedDateTime"] },
    { path: "deviceManagement/assignmentFilters", label: EN ? "Assignment filters" : "割り当てフィルター", perm: "DeviceManagementRBAC.Read.All",
      select: ["id", "displayName", "description", "createdDateTime"] },
    { path: "deviceManagement/deviceEnrollmentConfigurations", label: EN ? "Enrollment configurations" : "登録（エンロール）設定", perm: "DeviceManagementServiceConfig.Read.All",
      select: ["id", "name", "createdDateTime"] },
    { path: "deviceManagement/deviceManagementScripts", label: EN ? "Device management scripts (Win)" : "デバイス管理スクリプト（Windows）", perm: "DeviceManagementScripts.Read.All",
      select: ["id", "displayName", "description", "fileName", "runAsAccount", "enforceSignatureCheck"] },
    { path: "deviceManagement/deviceHealthScripts", label: EN ? "Device health scripts" : "デバイスヘルススクリプト", perm: "DeviceManagementScripts.Read.All",
      select: ["id", "displayName", "description", "fileName", "runAsAccount"] },
    { path: "deviceManagement/deviceComplianceScripts", label: EN ? "Device compliance scripts" : "デバイスコンプライアンススクリプト", perm: "DeviceManagementScripts.Read.All",
      select: ["id", "displayName", "description", "fileName"] },
    { path: "deviceManagement/deviceShellScripts", label: EN ? "Device shell scripts (macOS/iOS)" : "デバイスシェルスクリプト（macOS/iOS）", perm: "DeviceManagementScripts.Read.All",
      select: ["id", "displayName", "fileName"] },
    { path: "deviceManagement/deviceCustomAttributeShellScripts", label: EN ? "Custom attribute shell scripts" : "カスタム属性シェルスクリプト", perm: "DeviceManagementScripts.Read.All",
      select: ["id", "displayName", "fileName", "scriptContent"] },
    { path: "deviceManagement/mobileApps", label: EN ? "Mobile apps" : "モバイルアプリ", perm: "DeviceManagementApps.Read.All",
      select: ["id", "displayName", "publisher", "appVersion", "isFeatured"] },
    { path: "deviceManagement/managedAppRegistrations", label: EN ? "Managed app registrations" : "管理アプリ登録", perm: "DeviceManagementApps.Read.All",
      select: ["id", "deviceName", "appName", "appVersion", "managementChannel"] },
    { path: "deviceManagement/reports", label: EN ? "Reports" : "レポート", perm: "Report.Read.All", select: [] },
  ];

  const resourceOf = (p) => RESOURCES.find((r) => r.path === p);

  /* PowerShell SDK のコマンドレット名。
     SDK は集合そのものではなく「単数形」のコマンドレットを生やす（複数形は存在しない）。
     検証: Microsoft.Graph.DeviceManagement*.psd1 の FunctionsToExport /
           microsoftgraph/msgraph-sdk-powershell の examples / 実運用スクリプト */
  const PS_CMD = {
    "deviceManagement/managedDevices": "Get-MgDeviceManagementManagedDevice",
    "deviceManagement/deviceConfigurations": "Get-MgDeviceManagementDeviceConfiguration",
    "deviceManagement/deviceCompliancePolicies": "Get-MgDeviceManagementDeviceCompliancePolicy",
    "deviceManagement/assignmentFilters": "Get-MgDeviceManagementAssignmentFilter",
    "deviceManagement/deviceEnrollmentConfigurations": "Get-MgDeviceManagementDeviceEnrollmentConfiguration",
    // deviceManagementScripts は "DeviceManagement" の重複を畳んだ名前になる
    "deviceManagement/deviceManagementScripts": "Get-MgDeviceManagementScript",
    "deviceManagement/deviceHealthScripts": "Get-MgDeviceManagementDeviceHealthScript",
    "deviceManagement/deviceComplianceScripts": "Get-MgDeviceManagementDeviceComplianceScript",
    "deviceManagement/deviceShellScripts": "Get-MgDeviceManagementDeviceShellScript",
    "deviceManagement/deviceCustomAttributeShellScripts": "Get-MgDeviceManagementDeviceCustomAttributeShellScript",
    "deviceManagement/mobileApps": "Get-MgDeviceManagementMobileApp",
    "deviceManagement/managedAppRegistrations": "Get-MgDeviceManagementManagedAppRegistration",
    "deviceManagement/reports": "Get-MgDeviceManagementReport",
  };
  const psCmdOf = (p) => PS_CMD[p] || null;

  /* ---- URL 生成 ---- */
  function buildUrl(o) {
    const ver = o.version || "v1.0";
    const parts = [];
    if (o.filter) parts.push("$filter=" + encodeURIComponent(o.filter));
    if (o.select && o.select.length) parts.push("$select=" + o.select.join(","));
    if (o.orderBy) parts.push("$orderby=" + encodeURIComponent(o.orderBy));
    if (o.top !== "" && o.top != null) parts.push("$top=" + encodeURIComponent(String(o.top)));
    if (o.count) parts.push("$count=true");
    const qs = parts.length ? "?" + parts.join("&") : "";
    return `${BASE}/${ver}/${o.path}${qs}`;
  }

  /* ---- PowerShell (Microsoft Graph SDK) 生成 ---- */
  function buildPowerShell(o) {
    const res = resourceOf(o.path);
    const perm = res ? res.perm : "DeviceManagementManagedDevices.Read.All";
    const cmd = psCmdOf(o.path);
    const lines = [`# 必要モジュール: Install-Module Microsoft.Graph -Scope CurrentUser`,
                  `# 必要アプリ権限: ${perm}`];
    if (!cmd) {
      lines.push(`# ※ このリソースコマンドレット名は未確認のため Invoke-MgGraphRequest を使います`);
    }
    // -Scopes に必要なアプリ権限を渡す。テナント固定は -TenantId "<tenant-id>" を追加
    lines.push(`Connect-MgGraph -Scopes "${perm}"`);
    const args = [];
    if (o.filter) args.push(`-Filter "${o.filter.replace(/"/g, '`"')}"`);
    if (o.select && o.select.length) args.push(`-Select ${o.select.join(",")}`);
    if (o.orderBy) args.push(`-OrderBy "${o.orderBy.replace(/"/g, '`"')}"`);
    if (o.top !== "" && o.top != null) args.push(`-Top ${o.top}`);
    if (o.count) args.push("-CountVariable cnt -ConsistencyLevel eventual");
    const all = args.length ? " " + args.join(" ") : "";
    lines.push(cmd ? `${cmd}${all}` : `Invoke-MgGraphRequest -Method GET -Uri "${buildUrl(o)}"`);
    if (o.count) lines.push(`Write-Output "Total: $cnt"`);
    return lines.join("\n");
  }

  /* ---- 生 HTTP（curl）生成 ---- */
  function buildCurl(o) {
    return [
      `# アクセストークンは MSAL / client credentials で取得してください`,
      `curl -s -H "Authorization: Bearer $TOKEN" \\`,
      `     -H "ConsistencyLevel: eventual" \\`,
      `     "${buildUrl(o)}"`,
    ].join("\n");
  }

  /* ---- 検証 ---- */
  function validate(o) {
    const errs = [];
    if (!o.path || !resourceOf(o.path)) errs.push(EN ? "Unknown resource" : "不明なリソースです");
    if (o.version && !VERSIONS.includes(o.version)) errs.push(EN ? "api-version must be v1.0 or beta" : "api-version は v1.0 / beta のみです");
    if (o.top !== "" && o.top != null) {
      const n = Number(o.top);
      if (!Number.isInteger(n) || n < 0) errs.push(EN ? "$top must be a non-negative integer" : "$top は 0 以上の整数です");
      if (n > 999) errs.push(EN ? "$top over 999 needs paging (@odata.skip)" : "$top が 999 を超える場合はページング（@odata.skip）が必要です");
    }
    if (o.filter) {
      const q = (o.filter.match(/"/g) || []).length;
      const sq = (o.filter.match(/'/g) || []).length;   // Graph OData の文字列リテラルは ' を使う
      if (q % 2 !== 0 || sq % 2 !== 0) {
        errs.push(EN ? "Unbalanced quotes in $filter" : "$filter のクォートが閉じていません");
      }
      // Graph OData は Intune フィルター構文と違う（-eq ではなく eq）
      if (/(^|\s)-eq(\s|$)/.test(o.filter)) {
        errs.push(EN ? 'Graph OData uses "eq", not the Intune filter "-eq"'
                    : 'Graph OData は "eq" を使います（Intune 割り当てフィルターの "-eq" とは別構文）');
      }
    }
    const res = resourceOf(o.path);
    if (res && o.select && o.select.length) {
      const bad = o.select.filter((s) => !res.select.includes(s) && res.select.length);
      if (bad.length) errs.push((EN ? "Unknown $select field(s): " : "$select に存在しないフィールド: ") + bad.join(", "));
    }
    return errs;
  }

  return { BASE, VERSIONS, RESOURCES, PS_CMD, resourceOf, psCmdOf, buildUrl, buildPowerShell, buildCurl, validate };
})();

if (typeof module !== "undefined" && module.exports) module.exports = IGR;
if (typeof window !== "undefined") window.IGR = IGR;
