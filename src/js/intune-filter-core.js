/* Intune 割り当てフィルター（ルール構文）— 生成・検証ロジック（テスト可能）

   出典（公式ドキュメントの GitHub 生 Markdown で確認）:
     MicrosoftDocs/memdocs /intune/fundamentals/filters/ref-device-properties.md
   書式: ([entity].[property name] [operation] [value])
     - プロパティ / 演算子 / 値は大文字小文字を区別しない
     - 括弧と入れ子はサポート（入れ子を使うと簡易ルールビルダーは無効になる）
     - Null / $Null は -eq / -ne でのみ使用可
     - テナントあたり 200 個まで、1フィルター 3,072 文字まで
   注意: ブラウザ（ビルド済み）と Node テストの両方で単独ロードされるため言語判定は自己完結。 */
const IFT = (() => {
  "use strict";

  const LANG = (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ja";
  const EN = LANG === "en";

  const LIMIT_CHARS = 3072;

  /* ── 演算子 ─────────────────────────────────────────── */
  const OPS = {
    eq:          { sym: "-eq",          label: EN ? "Equals" : "等しい" },
    ne:          { sym: "-ne",          label: EN ? "Not equals" : "等しくない" },
    gt:          { sym: "-gt",          label: EN ? "Greater than" : "より大きい" },
    lt:          { sym: "-lt",          label: EN ? "Less than" : "より小さい" },
    ge:          { sym: "-ge",          label: EN ? ">= (以上)" : "以上" },
    le:          { sym: "-le",          label: EN ? "<= (以下)" : "以下" },
    startsWith:  { sym: "-startsWith",  label: EN ? "Starts with" : "で始まる" },
    contains:    { sym: "-contains",    label: EN ? "Contains" : "を含む" },
    notContains: { sym: "-notContains", label: EN ? "Does not contain" : "を含まない" },
    in:          { sym: "-in",          label: EN ? "In (array)" : "配列に含まれる" },
    notIn:       { sym: "-notIn",       label: EN ? "Not in (array)" : "配列に含まれない" },
  };

  const STRING_OPS = ["eq", "ne", "startsWith", "contains", "notContains", "in", "notIn"];
  const VERSION_OPS = ["eq", "ne", "gt", "lt", "ge", "le"];
  const ENUM_OPS = ["eq", "ne", "in", "notIn"];

  /* ── プロパティ定義（公式列挙） ──────────────────────── */
  const DEVICE_PROPS = {
    cpuArchitecture: {
      label: "CPU Architecture", type: "enum", ops: ENUM_OPS,
      values: ["amd64", "x86", "arm64", "x64", "unknown"],
      platforms: "macOS / Windows",
      note: EN ? "Windows: amd64/x86/arm64/unknown ・ macOS: x64/arm64/unknown. Enrollment scenarios not yet supported."
              : "Windows: amd64/x86/arm64/unknown ／ macOS: x64/arm64/unknown。登録（エンロール）シナリオは未対応",
    },
    deviceCategory: { label: "Device Category", type: "string", ops: STRING_OPS, platforms: "Android / iOS / macOS / Windows" },
    deviceManagementType: {
      label: "Device Management Type", type: "enum", ops: ["eq", "ne"],
      values: [
        "Corporate-owned dedicated devices with Entra ID Shared mode",
        "Corporate-owned dedicated devices without Entra ID Shared mode",
        "Corporate-owned with work profile",
        "Corporate-owned fully managed",
        "Personally-owned work profile",
        "AOSP user-associated devices",
        "AOSP userless devices",
      ],
      platforms: "Android",
      note: EN ? "Documented for Android with -eq / -ne only." : "Android のみ -eq / -ne で列挙値から選択",
    },
    deviceName: { label: "Device Name", type: "string", ops: STRING_OPS, platforms: EN ? "All managed platforms" : "全管理プラットフォーム" },
    deviceOwnership: {
      label: "Ownership", type: "enum", ops: ["eq", "ne"],
      values: ["Corporate", "Personal", "unknown"],
      platforms: EN ? "All managed platforms" : "全管理プラットフォーム",
    },
    deviceTrustType: {
      label: "Microsoft Entra join type", type: "enum", ops: ["eq", "ne"],
      values: ["Azure AD Joined", "Azure AD Registered", "Server App Proxied", "unknown"],
      platforms: "Windows",
    },
    enrollmentProfileName: { label: "Enrollment profile name", type: "string", ops: STRING_OPS, platforms: EN ? "All managed platforms" : "全管理プラットフォーム" },
    isRooted: {
      label: "Rooted or jailbroken", type: "bool", ops: ["eq", "ne"],
      values: ["True", "False"],
      platforms: "Android / iOS / iPadOS",
    },
    manufacturer: { label: "Manufacturer", type: "string", ops: STRING_OPS, platforms: EN ? "All managed platforms" : "全管理プラットフォーム" },
    model: { label: "Model", type: "string", ops: STRING_OPS, platforms: EN ? "All managed platforms" : "全管理プラットフォーム" },
    operatingSystemVersion: {
      label: "Operating System Version", type: "version", ops: VERSION_OPS,
      platforms: EN ? "All managed platforms" : "全管理プラットフォーム",
      note: EN ? "The only property documented with comparison operators (-gt / -lt / -ge / -le)."
              : "比較演算子（-gt / -lt / -ge / -le）が公式に明記されている唯一のプロパティ",
    },
    osVersion: { label: "OS Version", type: "string", ops: STRING_OPS, platforms: EN ? "All managed platforms" : "全管理プラットフォーム" },
    operatingSystemSKU: {
      label: "Operating System SKU", type: "enum", ops: ENUM_OPS,
      values: ["BusinessN", "CloudEdition", "CloudEditionN", "Core", "CoreCountrySpecific", "CoreN",
        "CoreSingleLanguage", "Education", "EducationN", "Enterprise", "EnterpriseEval", "EnterpriseG",
        "EnterpriseGN", "EnterpriseN", "EnterpriseNEval", "EnterpriseS", "EnterpriseSEval", "EnterpriseSN",
        "Holographic", "IoTUAP", "IoTUAPCommercial", "IoTEnterprise", "PPIPro", "Professional",
        "ProfessionalEducation", "ProfessionalEducationN", "ProfessionalWorkstation", "ProfessionalN",
        "ProfessionalSingleLanguage", "ServerRdsh"],
      platforms: "Windows",
    },
  };

  const APP_PROPS = {
    appVersion: { label: "App Version", type: "string", ops: STRING_OPS, platforms: "Android / iOS / Windows" },
    deviceManagementType: { label: "Device Management Type", type: "string", ops: STRING_OPS, platforms: "Android / iOS / Windows" },
    deviceManufacturer: { label: "Manufacturer", type: "string", ops: STRING_OPS, platforms: "Android / iOS / Windows" },
    deviceModel: { label: "Model", type: "string", ops: STRING_OPS, platforms: "Android / iOS / Windows" },
    operatingSystemVersion: { label: "Operating System Version", type: "version", ops: VERSION_OPS, platforms: "Android / iOS / Windows" },
    osVersion: { label: "OS Version", type: "string", ops: STRING_OPS, platforms: "Android / iOS / Windows" },
  };

  const PROPS = { device: DEVICE_PROPS, app: APP_PROPS };
  const propDef = (entity, prop) => (PROPS[entity] || {})[prop];

  /* ── 値のレンダリング ───────────────────────────────── */
  const q = (v) => `"${String(v).replace(/"/g, '\\"')}"`;

  function renderValue(rule) {
    const def = propDef(rule.entity, rule.prop);
    const isNull = /^(null|\$null)$/i.test(String(rule.values[0] ?? "").trim());
    if (isNull) return String(rule.values[0]).trim();
    if (rule.op === "in" || rule.op === "notIn") {
      return "[" + rule.values.map(q).join(",") + "]";
    }
    // 公式例に倣い、バージョン比較（gt/lt/ge/le）はクォートなし
    if (def && def.type === "version" && ["gt", "lt", "ge", "le"].includes(rule.op)) {
      return String(rule.values[0]);
    }
    return q(rule.values[0]);
  }

  function renderRule(rule) {
    const sym = (OPS[rule.op] || { sym: "-" + rule.op }).sym;
    return `(${rule.entity}.${rule.prop} ${sym} ${renderValue(rule)})`;
  }

  /** rules: [{ entity, prop, op, values[], join? }] → 構文文字列 */
  function build(rules) {
    if (!rules || !rules.length) return "";
    return rules
      .map((r, i) => (i === 0 ? renderRule(r) : `${r.join || "and"} ${renderRule(r)}`))
      .join(" ");
  }

  /* ── 検証 ───────────────────────────────────────────── */
  function validate(rules) {
    const errs = [];
    if (!Array.isArray(rules) || rules.length === 0) {
      errs.push(EN ? "No conditions" : "条件が1つもありません");
      return errs;
    }
    rules.forEach((r, i) => {
      const at = EN ? `Condition ${i + 1}` : `条件${i + 1}`;
      if (!["device", "app"].includes(r.entity)) { errs.push(`${at}: entity が不正です (${r.entity})`); return; }
      const def = propDef(r.entity, r.prop);
      if (!def) {
        errs.push(`${at}: ${r.entity}.${r.prop} は既知のプロパティではありません`);
        return;
      }
      if (!OPS[r.op]) { errs.push(`${at}: 未知の演算子 -${r.op}`); return; }
      if (!def.ops.includes(r.op)) {
        errs.push(`${at}: ${r.entity}.${r.prop} に -${r.op} は使えません（可: ${def.ops.map((o) => "-" + o).join(", ")}）`);
      }
      const vals = (r.values || []).map((v) => String(v).trim());
      const clean = vals.filter((v) => v !== "");
      if (clean.length === 0) { errs.push(`${at}: 値を入力してください`); return; }

      const isNull = clean.every((v) => /^(null|\$null)$/i.test(v));
      if (isNull && !["eq", "ne"].includes(r.op)) {
        errs.push(`${at}: Null / $Null は -eq / -ne でのみ使用できます`);
      }
      if ((r.op === "in" || r.op === "notIn") && clean.length < 1) {
        errs.push(`${at}: -${r.op} は配列値（["a","b"]）が必要です`);
      }
      if (!["in", "notIn"].includes(r.op) && clean.length > 1) {
        errs.push(`${at}: -${r.op} で値は複数指定できません（複数値は -in / -notIn を使用）`);
      }
      if (def.type === "bool" && !["eq", "ne"].includes(r.op)) {
        errs.push(`${at}: 真偽値プロパティは -eq / -ne のみです`);
      }
      if (def.type === "bool" && !/^(true|false)$/i.test(clean[0])) {
        errs.push(`${at}: True / False のいずれかを入力してください`);
      }
      if (def.values && !isNull && ["eq", "ne"].includes(r.op)) {
        const ok = def.values.some((v) => v.toLowerCase() === clean[0].toLowerCase());
        if (!ok) errs.push(`${at}: "${clean[0]}" は列挙値にありません（例: ${def.values.slice(0, 4).join(" / ")}…）`);
      }
      if (def.type === "version" && ["gt", "lt", "ge", "le"].includes(r.op)) {
        if (!/^[0-9][0-9.]*$/.test(clean[0])) {
          errs.push(`${at}: バージョン比較は 10.0.22000.1000 のような数値形式が必要です`);
        }
      }
    });

    const syntax = build(rules);
    if (syntax.length > LIMIT_CHARS) {
      errs.push(EN ? `Filter exceeds ${LIMIT_CHARS} characters (${syntax.length})`
                  : `フィルターが ${LIMIT_CHARS} 文字を超えています（${syntax.length} 文字）`);
    }
    return errs;
  }

  /* ── パース（既存ルールの取り込み） ──────────────────── */
  function parse(text) {
    if (!text || !text.trim()) throw new Error(EN ? "Empty rule" : "ルールが空です");
    const rules = [];
    // 各 () の直前に付いた and / or をその条件の結合子として取り込む
    const re = /(?:(\band\b|\bor\b)\s+)?\(\s*([a-zA-Z]+)\.([a-zA-Z]+)\s+(-?[a-zA-Z]+)\s+(.+?)\s*\)/gi;
    let mm;
    while ((mm = re.exec(text)) !== null) {
      const entity = mm[2].toLowerCase();
      const prop = mm[3];
      const opRaw = mm[4].replace(/^-/, "").toLowerCase();
      const valRaw = mm[5].trim();
      let values;
      if (/^\[.*\]$/.test(valRaw)) {
        values = valRaw.slice(1, -1).split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter((s) => s !== "");
      } else {
        values = [valRaw.replace(/^"|"$/g, "")];
      }
      rules.push({ entity, prop, op: opRaw, values, join: mm[1] ? mm[1].toLowerCase() : "and" });
    }
    if (!rules.length) throw new Error(EN ? "Could not parse any (entity.property op value) group" : "(entity.property 演算子 値) の形式で読み込めませんでした");
    rules[0].join = "and";
    return rules;
  }

  /* ── プリセット（実務でよく作る形） ──────────────────── */
  const PRESETS = [
    { name: EN ? "Corporate-owned Windows only" : "法人所有の Windows のみ", rules: [
      { entity: "device", prop: "deviceOwnership", op: "eq", values: ["Corporate"], join: "and" },
      { entity: "device", prop: "osVersion", op: "startsWith", values: ["Windows"], join: "and" },
    ]},
    { name: EN ? "Windows 11 or newer" : "Windows 11 以上", rules: [
      { entity: "device", prop: "osVersion", op: "startsWith", values: ["Windows"], join: "and" },
      { entity: "device", prop: "operatingSystemVersion", op: "ge", values: ["10.0.22000"], join: "and" },
    ]},
    { name: EN ? "Exclude rooted / jailbroken" : "ルート化 / 脱獄済み除外", rules: [
      { entity: "device", prop: "isRooted", op: "eq", values: ["False"], join: "and" },
    ]},
    { name: EN ? "Entra joined only" : "Entra Join のみ", rules: [
      { entity: "device", prop: "deviceTrustType", op: "eq", values: ["Azure AD Joined"], join: "and" },
    ]},
    { name: EN ? "Apple Silicon Macs" : "Apple Silicon の Mac", rules: [
      { entity: "device", prop: "osVersion", op: "startsWith", values: ["macOS"], join: "and" },
      { entity: "device", prop: "cpuArchitecture", op: "eq", values: ["arm64"], join: "and" },
    ]},
    { name: EN ? "Specific manufacturers (array)" : "特定メーカー（配列）", rules: [
      { entity: "device", prop: "manufacturer", op: "in", values: ["Dell", "Lenovo", "HP"], join: "and" },
    ]},
    { name: EN ? "Enterprise / Education SKUs" : "Enterprise / Education SKU", rules: [
      { entity: "device", prop: "operatingSystemSKU", op: "in", values: ["Enterprise", "Education"], join: "and" },
    ]},
  ];

  return {
    OPS, PROPS, DEVICE_PROPS, APP_PROPS, PRESETS, LIMIT_CHARS,
    propDef, renderRule, build, validate, parse,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = IFT;
if (typeof window !== "undefined") window.IFT = IFT;
