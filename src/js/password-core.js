/* ===== 核心ロジック（ブラウザ / Node 両対応・テスト可能） ===== */
const PG = (() => {
  "use strict";

  // ブラウダ / Node 両対応のため言語判定は自己完結
  const LANG = (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ja";
  const T = (LANG === "en" ? {
    noCrypto: "A cryptographic RNG (crypto.getRandomValues) is unavailable in this environment. Open it in a secure browser.",
    noClass: "Select at least one character class",
    letterFirstNeed: "Choose uppercase and/or lowercase to force a leading letter",
    notEnough: (c, m) => `Not enough length (${c} character class(es) require at least ${m} characters)`,
    instant: "instantly", under1s: "under 1 second",
    sec: (v) => `${v} seconds`, hour: (v) => `${v} hours`, day: (v) => `${v} days`,
    year: (v) => `${v} years`, myrial: (v) => `${v} × 10⁴ years`, eons: (v) => `${v} trillion years`,
    impossible: "effectively impossible (longer than the age of the universe)",
  } : {
    noCrypto: "この環境では暗号学的乱数 (crypto.getRandomValues) を使用できません。安全なブラウザで開いてください。",
    noClass: "文字種を1つ以上選んでください",
    letterFirstNeed: "先頭を英字にするには大文字/小文字を選んでください",
    notEnough: (c, m) => `文字数が足りません（文字種 ${c} に対して最低 ${m} 文字）`,
    instant: "即座", under1s: "1秒未満",
    sec: (v) => `${v} 秒`, hour: (v) => `${v} 時間`, day: (v) => `${v} 日`,
    year: (v) => `${v} 年`, myrial: (v) => `${v} 万年`, eons: (v) => `${v} 兆年`,
    impossible: "事実上不可能（宇宙の年齢を超える）",
  });

  const SETS = {
    upper:   "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lower:   "abcdefghijklmnopqrstuvwxyz",
    digits:  "0123456789",
    symbols: "!@#$%^&*()-_=+[]{}|;:,.<>?",
  };
  const AMBIGUOUS = "il1Lo0O";

  /* バッファ付き CSPRNG。crypto.getRandomValues の呼び出し数を抑えて高速化 */
  function makeRand() {
    const BUF = 8192;
    let buf = new Uint32Array(BUF), i = BUF;
    const refill = () => {
      // 弱い乱数へのフォールバックは意図的に置かない。
      // Web Crypto が使えない環境では生成を中止する（サイレントに弱体化させない）。
      if (typeof crypto === "undefined" || !crypto.getRandomValues) {
        throw new Error(T.noCrypto);
      }
      crypto.getRandomValues(buf);
      i = 0;
    };
    const u32 = () => { if (i >= BUF) refill(); return buf[i++]; };
    /* モジュロバイアス除去: 拒否サンプリング */
    const int = (n) => {
      if (!(n > 0)) throw new Error("pool must be non-empty");
      const MOD = 0x100000000;              // 2^32
      const rejectBelow = MOD - (MOD % n);  // n の倍数のうち最大の値以上は破棄
      let x;
      do { x = u32(); } while (x >= rejectBelow);
      return x % n;
    };
    return { int };
  }

  function buildPool(opt) {
    let pool = "";
    const classes = [];
    for (const key of ["upper", "lower", "digits", "symbols"]) {
      if (!opt[key]) continue;
      let s = SETS[key];
      if (opt.excludeAmbiguous) s = [...s].filter((c) => !AMBIGUOUS.includes(c)).join("");
      if (opt.excludeChars) s = [...s].filter((c) => !opt.excludeChars.includes(c)).join("");
      if (!s) continue;
      pool += s;
      classes.push(s);
    }
    return { pool, classes };
  }

  /* 1本生成。classes を全部最低1回使う保証付き。
     注意: 位置は必ず「昇順」に埋めること。noRepeat が前の文字を参照するため、
     シャッフル順で埋めると前の位置が未確定になり連続判定が機能しなくなる。 */
  function generateOne(rand, opt) {
    const { pool, classes } = buildPool(opt);
    const len = opt.length;
    if (!pool) throw new Error(T.noClass);

    const firstPool = opt.letterFirst
      ? [...pool].filter((c) => /[A-Za-z]/.test(c)).join("")
      : pool;
    if (opt.letterFirst && !firstPool) throw new Error(T.letterFirstNeed);

    const start = opt.letterFirst ? 1 : 0;
    if (len - start < classes.length) {
      throw new Error(T.notEnough(classes.length, classes.length + start));
    }

    // 必須クラスを割り当てる位置を選ぶ（letterFirst なら position 0 を除外）
    const candidates = [];
    for (let p = start; p < len; p++) candidates.push(p);
    for (let k = candidates.length - 1; k > 0; k--) {
      const j = rand.int(k + 1);
      [candidates[k], candidates[j]] = [candidates[j], candidates[k]];
    }
    const reqAt = new Map();
    candidates.slice(0, classes.length).forEach((pos, ci) => reqAt.set(pos, classes[ci]));

    const chars = new Array(len);
    for (let idx = 0; idx < len; idx++) {
      let avail = reqAt.get(idx) || (idx === 0 ? firstPool : pool);
      if (opt.noRepeat && idx > 0) {
        const prev = chars[idx - 1];
        if (prev && avail.length > 1) avail = [...avail].filter((c) => c !== prev).join("");
      }
      chars[idx] = avail[rand.int(avail.length)];
    }
    return chars.join("");
  }

  /* 「各文字種1文字以上」を包含排除原理で厳密に数え上げたエントロピー */
  function entropyBits(len, classes) {
    if (!classes.length) return 0;
    const total = classes.reduce((a, b) => a + b.length, 0);
    const n = classes.length;
    if (n === 1) return Math.log2(total) * len;
    let count = 0;
    for (let mask = 0; mask < (1 << n); mask++) {
      let removed = 0, bits = 0;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) { removed += classes[i].length; bits++; }
      const base = total - removed;
      if (base <= 0) continue;
      count += (bits % 2 === 0 ? 1 : -1) * Math.pow(base, len);
    }
    return count > 0 ? Math.log2(count) : 0;
  }

  /* エントロピー推定。
     letterFirst / noRepeat 付きの厳密値は組合せが複雑なため、
     ここでは「保守側（実際の強度より低めに出る）」で丸めている。
     表示時は必ず 概算 である旨を添える。 */
  function estimate(opt) {
    const { pool, classes } = buildPool(opt);
    if (!classes.length) return { bits: 0, poolSize: 0, firstPoolSize: 0 };
    const firstPoolSize = opt.letterFirst
      ? [...pool].filter((c) => /[A-Za-z]/.test(c)).length
      : pool.length;

    let bits;
    if (opt.noRepeat && pool.length > 1) {
      const per = Math.log2(pool.length - 1);
      bits = Math.log2(firstPoolSize || pool.length) + (opt.length - 1) * per;
    } else {
      bits = entropyBits(opt.length - (opt.letterFirst ? 1 : 0), classes) +
             (opt.letterFirst ? Math.log2(firstPoolSize) : 0);
    }
    return { bits: Math.max(0, bits), poolSize: pool.length, firstPoolSize };
  }

  function crackTime(bits, guessesPerSec = 1e12) {
    const seconds = Math.pow(2, Math.max(0, bits - 1)) / guessesPerSec; // 平均は総数の半分
    if (bits < 1) return T.instant;
    const units = [
      ["年", 31557600], ["万年", 3.15576e11], ["億年", 3.15576e12],
    ];
    if (seconds < 1) return T.under1s;
    if (seconds < 3600) return T.sec(Math.round(seconds));
    if (seconds < 86400) return T.hour(Math.round(seconds / 3600));
    if (seconds < 31557600) return T.day(Math.round(seconds / 86400));
    if (seconds < 3.15576e11) return T.year((seconds / 31557600).toFixed(1));
    if (seconds < 3.15576e15) return T.myrial((seconds / 3.15576e11).toFixed(1));
    return T.impossible;
  }

  function generateBatch(opt) {
    const rand = makeRand();
    const out = [];
    for (let i = 0; i < opt.count; i++) out.push(generateOne(rand, opt));
    return out;
  }

  return { SETS, AMBIGUOUS, makeRand, buildPool, generateOne, generateBatch, entropyBits, estimate, crackTime };
})();

if (typeof module !== "undefined" && module.exports) module.exports = PG;
if (typeof window !== "undefined") window.PG = PG;
