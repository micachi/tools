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

  /* ── プロパティ定義（公式列挙） ────────────────────────
     label = 公式（英語）名 / ja = 日本語表示名 / valueJa = 列挙値の日本語対応 */
  const DEVICE_PROPS = {
    cpuArchitecture: {
      label: "CPU Architecture", ja: "CPU アーキテクチャ", type: "enum", ops: ENUM_OPS,
      values: ["amd64", "x86", "arm64", "x64", "unknown"],
      valueJa: { amd64: "AMD64（64bit）", x86: "32bit", arm64: "ARM64", x64: "x64（Intel / Apple）", unknown: "不明" },
      platforms: "macOS / Windows",
      note: EN ? "Windows: amd64/x86/arm64/unknown ・ macOS: x64/arm64/unknown. Enrollment scenarios not yet supported."
              : "Windows: amd64/x86/arm64/unknown ／ macOS: x64/arm64/unknown。登録（エンロール）シナリオは未対応",
    },
    deviceCategory: { label: "Device Category", ja: "デバイス カテゴリ", type: "string", ops: STRING_OPS, platforms: "Android / iOS / macOS / Windows" },
    deviceManagementType: {
      label: "Device Management Type", ja: "管理タイプ（Android）", type: "enum", ops: ["eq", "ne"],
      values: [
        "Corporate-owned dedicated devices with Entra ID Shared mode",
        "Corporate-owned dedicated devices without Entra ID Shared mode",
        "Corporate-owned with work profile",
        "Corporate-owned fully managed",
        "Personally-owned work profile",
        "AOSP user-associated devices",
        "AOSP userless devices",
      ],
      valueJa: {
        "corporate-owned dedicated devices with entra id shared mode": "法人所有・専用（Entra 共有モードあり）",
        "corporate-owned dedicated devices without entra id shared mode": "法人所有・専用（Entra 共有モードなし）",
        "corporate-owned with work profile": "法人所有・ワークプロファイルあり",
        "corporate-owned fully managed": "法人所有・完全管理",
        "personally-owned work profile": "個人所有・ワークプロファイルあり",
        "aosp user-associated devices": "AOSP（ユーザー紐付け）",
        "aosp userless devices": "AOSP（ユーザーなし）",
      },
      platforms: "Android",
      note: EN ? "Documented for Android with -eq / -ne only." : "Android のみ -eq / -ne で列挙値から選択",
    },
    deviceName: { label: "Device Name", ja: "デバイス名", type: "string", ops: STRING_OPS, platforms: EN ? "All managed platforms" : "全管理プラットフォーム" },
    deviceOwnership: {
      label: "Ownership", ja: "所有権（法人 / 個人）", type: "enum", ops: ["eq", "ne"],
      values: ["Corporate", "Personal", "unknown"],
      valueJa: { corporate: "法人所有", personal: "個人所有", unknown: "不明" },
      platforms: EN ? "All managed platforms" : "全管理プラットフォーム",
    },
    deviceTrustType: {
      label: "Microsoft Entra join type", ja: "Entra 参加タイプ", type: "enum", ops: ["eq", "ne"],
      values: ["Azure AD Joined", "Azure AD Registered", "Server App Proxied", "unknown"],
      valueJa: {
        "azure ad joined": "Entra Join（ドメイン参加）",
        "azure ad registered": "Entra Register（端末登録のみ）",
        "server app proxied": "サーバーアプリ プロキシ経由",
        unknown: "不明",
      },
      platforms: "Windows",
    },
    enrollmentProfileName: { label: "Enrollment profile name", ja: "登録プロファイル名", type: "string", ops: STRING_OPS, platforms: EN ? "All managed platforms" : "全管理プラットフォーム" },
    isRooted: {
      label: "Rooted or jailbroken", ja: "ROOT 化 / 脱獄", type: "bool", ops: ["eq", "ne"],
      values: ["True", "False"],
      valueJa: { true: "ROOT 化あり", false: "ROOT 化なし" },
      platforms: "Android / iOS / iPadOS",
    },
    manufacturer: { label: "Manufacturer", ja: "メーカー", type: "string", ops: STRING_OPS, platforms: EN ? "All managed platforms" : "全管理プラットフォーム" },
    model: { label: "Model", ja: "機種名（モデル）", type: "string", ops: STRING_OPS, platforms: EN ? "All managed platforms" : "全管理プラットフォーム" },
    operatingSystemVersion: {
      label: "Operating System Version", ja: "OS バージョン（数値比較可）", type: "version", ops: VERSION_OPS,
      platforms: EN ? "All managed platforms" : "全管理プラットフォーム",
      note: EN ? "The only property documented with comparison operators (-gt / -lt / -ge / -le)."
              : "比較演算子（-gt / -lt / -ge / -le）が公式に明記されている唯一のプロパティ",
    },
    osVersion: { label: "OS Version", ja: "OS 名 + バージョン（文字列）", type: "string", ops: STRING_OPS, platforms: EN ? "All managed platforms" : "全管理プラットフォーム" },
    operatingSystemSKU: {
      label: "Operating System SKU", ja: "Windows エディション（SKU）", type: "enum", ops: ENUM_OPS,
      values: ["BusinessN", "CloudEdition", "CloudEditionN", "Core", "CoreCountrySpecific", "CoreN",
        "CoreSingleLanguage", "Education", "EducationN", "Enterprise", "EnterpriseEval", "EnterpriseG",
        "EnterpriseGN", "EnterpriseN", "EnterpriseNEval", "EnterpriseS", "EnterpriseSEval", "EnterpriseSN",
        "Holographic", "IoTUAP", "IoTUAPCommercial", "IoTEnterprise", "PPIPro", "Professional",
        "ProfessionalEducation", "ProfessionalEducationN", "ProfessionalWorkstation", "ProfessionalN",
        "ProfessionalSingleLanguage", "ServerRdsh"],
      valueJa: {
        businessn: "Business N",
        cloudedition: "Cloud（クラウド シタデル）", cloudeditionn: "Cloud N",
        core: "Home（個人版）", corecountryspecific: "Home 地域限定版", coren: "Home N",
        coresinglelanguage: "Home 単一言語版",
        education: "教育版", educationn: "教育版 N",
        enterprise: "企業版", enterpriseeval: "企業版（評価版）",
        enterpriseg: "企業版 G", enterprisegn: "企業版 GN",
        enterprisen: "企業版 N", enterpriseneval: "企業版 N（評価版）",
        enterprises: "企業版 S", enterpriseseval: "企業版 S（評価版）", enterprisesn: "企業版 SN",
        holographic: "Holographic（HoloLens）",
        iotuap: "IoT UAP", iotuapcommercial: "IoT UAP Commercial", iotenterprise: "IoT Enterprise",
        ppipro: "PPI Pro（キオスク端末）",
        professional: "Pro", professionaleducation: "Pro Education",
        professionaleducationn: "Pro Education N",
        professionalworkstation: "Pro Workstation", professionaln: "Pro N",
        professionalsinglelanguage: "Pro 単一言語版",
        serverrdsh: "Windows 365 / AVD（RDS ホスト）",
      },
      platforms: "Windows",
    },
  };

  const APP_PROPS = {
    appVersion: { label: "App Version", ja: "アプリ バージョン", type: "string", ops: STRING_OPS, platforms: "Android / iOS / Windows" },
    deviceManagementType: { label: "Device Management Type", ja: "管理タイプ", type: "string", ops: STRING_OPS, platforms: "Android / iOS / Windows" },
    deviceManufacturer: { label: "Manufacturer", ja: "メーカー", type: "string", ops: STRING_OPS, platforms: "Android / iOS / Windows" },
    deviceModel: { label: "Model", ja: "機種名（モデル）", type: "string", ops: STRING_OPS, platforms: "Android / iOS / Windows" },
    operatingSystemVersion: { label: "Operating System Version", ja: "OS バージョン（数値比較可）", type: "version", ops: VERSION_OPS, platforms: "Android / iOS / Windows" },
    osVersion: { label: "OS Version", ja: "OS 名 + バージョン（文字列）", type: "string", ops: STRING_OPS, platforms: "Android / iOS / Windows" },
  };

  const PROPS = { device: DEVICE_PROPS, app: APP_PROPS };
  const propDef = (entity, prop) => (PROPS[entity] || {})[prop];

  /** 選択UI 用の表示名（JA は日本語名、EN は公式名）。公式名も常に併記できるよう formulaName も返す */
  function propLabel(entity, prop) {
    const d = propDef(entity, prop);
    if (!d) return prop;
    return EN ? (d.label || prop) : (d.ja || d.label || prop);
  }

  /** 列挙値の日本語ラベル（定義が無ければ値をそのまま返す） */
  function valueLabel(entity, prop, value) {
    const d = propDef(entity, prop);
    const key = String(value ?? "").trim().toLowerCase();
    if (d && d.valueJa && d.valueJa[key]) return EN ? String(value) : d.valueJa[key];
    return String(value);
  }

  /* ── 値のレンダリング ───────────────────────────────── */
  const q = (v) => `"${String(v).replace(/"/g, '\\"')}"`;

  function renderValue(rule) {
    const vals = (rule.values || []).map((v) => String(v)).filter((v) => v.trim() !== "");
    if (!vals.length) return "";                      // 未入力のときに "undefined" を出さない
    const def = propDef(rule.entity, rule.prop);
    const isNull = /^(null|\$null)$/i.test(vals[0].trim());
    if (isNull) return vals[0].trim();
    if (rule.op === "in" || rule.op === "notIn") {
      return "[" + vals.map(q).join(",") + "]";
    }
    // 公式例に倣い、バージョン比較（gt/lt/ge/le）はクォートなし
    if (def && def.type === "version" && ["gt", "lt", "ge", "le"].includes(rule.op)) {
      return vals[0];
    }
    return q(vals[0]);
  }

  function renderRule(rule) {
    const sym = (OPS[rule.op] || { sym: "-" + rule.op }).sym;
    const v = renderValue(rule);
    return `(${rule.entity}.${rule.prop} ${sym}${v ? " " + v : ""})`;
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
      if (def.values && !isNull && ["eq", "ne", "in", "notIn"].includes(r.op)) {
        // -in / -notIn も列挙値を検証する（素通りすると不正な SKU をそのまま展開してしまう）
        const bad = clean.filter((v) => !def.values.some((x) => x.toLowerCase() === v.toLowerCase()));
        if (bad.length === 1 && clean.length === 1) {
          errs.push(`${at}: "${bad[0]}" は列挙値にありません（例: ${def.values.slice(0, 4).join(" / ")}…）`);
        } else if (bad.length) {
          errs.push(`${at}: 列挙値にない値: ${bad.map((v) => `"${v}"`).join(", ")}（例: ${def.values.slice(0, 4).join(" / ")}…）`);
        }
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

  /* 記号 → 正規キー（-startsWith / -STARTSWITH どちらも startsWith に正規化） */
  const SYM2KEY = {};
  Object.keys(OPS).forEach((k) => { SYM2KEY[OPS[k].sym.toLowerCase()] = k; });

  /** 括弧の深さが 2 以上（入れ子）かどうか。簡易ビルダーでは表現できない */
  function hasNesting(text) {
    let depth = 0;
    for (const ch of String(text)) {
      if (ch === "(") { depth += 1; if (depth >= 2) return true; }
      else if (ch === ")") depth -= 1;
    }
    return false;
  }

  /* ── パース（既存ルールの取り込み） ──────────────────── */
  function parse(text) {
    if (!text || !text.trim()) throw new Error(EN ? "Empty rule" : "ルールが空です");
    // 入れ子を黙って平坦化すると (or (A) (B)) が A and B に論理反転していた。
    // 公式も入れ子使用時は簡易ビルダーを無効にするため、ここでは拒否する。
    if (hasNesting(text)) {
      throw new Error(EN
        ? "Nested groups cannot be edited with the simple builder"
        : "入れ子を含むルールは簡易ビルダーで編集できません（ルール構文のままご利用ください）");
    }
    const rules = [];
    // 各 () の直前に付いた and / or をその条件の結合子として取り込む。
    // 値は「引用符付き文字列 / 配列 / 空白と括弧を含まない単一トークン」に限定する
    // （後方非貪欲マッチだと "a)b" の ) で切れて値が黙って壊れていた）
    const re = /(?:(\band\b|\bor\b)\s+)?\(\s*([a-zA-Z]+)\.([a-zA-Z]+)\s+(-?[a-zA-Z]+)\s+("(?:[^"\\]|\\.)*"|\[[^\]]*\]|[^\s()]+)\s*\)/gi;
    let mm;
    while ((mm = re.exec(text)) !== null) {
      const entity = mm[2].toLowerCase();
      const prop = mm[3];
      const bare = mm[4].replace(/^-/, "");
      const op = SYM2KEY["-" + bare.toLowerCase()];
      if (!op) throw new Error(EN ? `Unknown operator -${bare}` : `未知の演算子 -${bare} です`);
      const valRaw = mm[5].trim();
      let values;
      if (valRaw.startsWith("[")) {
        values = valRaw.slice(1, -1).split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter((s) => s !== "");
      } else if (valRaw.startsWith('"')) {
        values = [valRaw.slice(1, -1).replace(/\\"/g, '"')];
      } else {
        values = [valRaw];
      }
      rules.push({ entity, prop, op, values, join: mm[1] ? mm[1].toLowerCase() : "and" });
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

  /** データ品質チェック用：列挙値に対して日本語ラベルが欠けている箇所を返す */
  function enumPropsMissingJa() {
    const out = [];
    for (const [ent, set] of Object.entries(PROPS)) {
      for (const [k, d] of Object.entries(set)) {
        if (!d.values) continue;
        for (const v of d.values) {
          if (!d.valueJa || !d.valueJa[String(v).toLowerCase()]) out.push(`${ent}.${k}:${v}`);
        }
      }
    }
    return out;
  }

  return {
    OPS, PROPS, DEVICE_PROPS, APP_PROPS, PRESETS, LIMIT_CHARS,
    propDef, propLabel, valueLabel, enumPropsMissingJa, hasNesting,
    renderRule, build, validate, parse,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = IFT;
if (typeof window !== "undefined") window.IFT = IFT;
