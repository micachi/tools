(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DAY = 86400000;

  const STR = {
    ja: {
      wd: ["日", "月", "火", "水", "木", "金", "土"],
      loc: "ja-JP",
      badDate: "⚠ 日付が不正です",
      needDays: "日数を入力してください",
      fmt: (d, w) => `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${w}）`,
      after: (n) => `${n}日後`, before: (n) => `${n}日前`,
      forward: (n) => `前进（あと ${n} 日）`, back: (n) => `過去へ ${n} 日`,
      kDay: "日数", kWeek: "週", kCal: "カレンダー差", kBiz: "営業日（土日除く）",
      bizNote: "祝日は除外していません。実務で正確な営業日が必要な場合は祝日表を追加してください（土日以外の除外漏れに注意）。",
      age: (y, m, d, days) => `満 ${y} 歳（${m} ヶ月 ${d} 日経過 ／ 通算 ${days} 日）`,
    },
    en: {
      wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      loc: "en-US",
      badDate: "⚠ Invalid date",
      needDays: "Enter a number of days",
      fmt: (d, w) => `${w}, ${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
      after: (n) => `${n} day${n === 1 ? "" : "s"} later`, before: (n) => `${n} day${n === 1 ? "" : "s"} earlier`,
      forward: (n) => `forward (${n} day${n === 1 ? "" : "s"})`, back: (n) => `back ${n} day${n === 1 ? "" : "s"}`,
      kDay: "Days", kWeek: "Weeks", kCal: "Calendar diff", kBiz: "Business days (excl. weekends)",
      bizNote: "Public holidays are not excluded. Add a holiday table if you need accurate business-day counts.",
      age: (y, m, d, days) => `${y} years old (${m} months ${d} days elapsed / ${days} days total)`,
    },
  };
  const LANG = (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ja";
  const L = STR[LANG] || STR.ja;

  // タイムゾーン・DST の影響を排するため UTC で扱う
  const parse = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // 2月30日等を弾く
    return dt;
  };
  const iso = (d) => d.toISOString().slice(0, 10);
  const jp = (d) => L.fmt(d, L.wd[d.getUTCDay()]);
  const todayStr = () => iso(new Date());
  const num = (n) => n.toLocaleString(L.loc);

  // カレンダー上の年月日差
  function calDiff(a, b) {
    let y = b.getUTCFullYear() - a.getUTCFullYear();
    let m = b.getUTCMonth() - a.getUTCMonth();
    let d = b.getUTCDate() - a.getUTCDate();
    if (d < 0) {
      m -= 1;
      const prevMonthDays = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0)).getUTCDate();
      d += prevMonthDays;
    }
    if (m < 0) { y -= 1; m += 12; }
    return { y, m, d };
  }

  // 営業日数（土日除外。祝日は簡易に除外しない＝実務では祝日表を追加する前提）
  function businessDays(a, b) {
    let sign = 1, s = a, e = b;
    if (a > b) { sign = -1; s = b; e = a; }
    let n = 0;
    for (let t = s.getTime(); t <= e.getTime(); t += DAY) {
      const wd = new Date(t).getUTCDay();
      if (wd !== 0 && wd !== 6) n++;
    }
    return sign * n;
  }

  function calcOffset() {
    const base = parse($("base").value);
    const n = parseInt($("offset").value, 10);
    const st = $("offOut");
    if (!base) { st.innerHTML = `<span class="err">${L.badDate}</span>`; return; }
    if (!isFinite(n)) { st.innerHTML = `<span class="sub">${L.needDays}</span>`; return; }
    const r = new Date(base.getTime() + n * DAY);
    st.innerHTML = `<b style="color:var(--acc);font-size:1.1rem">${jp(r)}</b> ` +
      `<span class="sub">／ ${iso(r)} ／ ${n >= 0 ? L.after(n) : L.before(-n)}</span>`;
  }

  function calcDiff() {
    const a = parse($("d1").value), b = parse($("d2").value);
    const st = $("diffOut");
    if (!a || !b) { st.innerHTML = `<span class="err">⚠ ${LANG === "en" ? "One of the two dates is invalid" : "どちらかの入力が不正です"}</span>`; return; }
    const days = Math.round((b.getTime() - a.getTime()) / DAY);
    const [s, e] = days >= 0 ? [a, b] : [b, a];
    const c = calDiff(s, e);
    const biz = Math.abs(businessDays(a, b));
    const weeks = Math.abs(days) / 7;

    st.innerHTML = `
      <div class="stats">
        <div class="stat"><span class="v">${num(Math.abs(days))}</span><span class="k">${L.kDay}</span></div>
        <div class="stat"><span class="v">${weeks.toFixed(1)}</span><span class="k">${L.kWeek}</span></div>
        <div class="stat"><span class="v">${c.y}y ${c.m}m ${c.d}d</span><span class="k">${L.kCal}</span></div>
        <div class="stat"><span class="v">${num(biz)}</span><span class="k">${L.kBiz}</span></div>
      </div>
      <p class="sub" style="margin:12px 0 0">
        ${jp(s)} → ${jp(e)}　<span class="ok">${days >= 0 ? L.forward(days) : L.back(-days)}</span>
      </p>
      <p class="sub" style="margin:6px 0 0">${L.bizNote}</p>`;
  }

  function calcAge() {
    const b = parse($("birth").value);
    const st = $("ageOut");
    if (!b) { st.innerHTML = `<span class="err">⚠ ${LANG === "en" ? "Date of birth is invalid" : "生年月日が不正です"}</span>`; return; }
    const now = new Date();
    const c = calDiff(b, now);
    const days = Math.round((now.getTime() - b.getTime()) / DAY);
    st.innerHTML = `<b style="color:var(--acc);font-size:1.1rem">${L.age(c.y, c.m, c.d, num(days))}</b>`;
  }

  $("base").addEventListener("input", calcOffset);
  $("offset").addEventListener("input", calcOffset);
  ["d1", "d2"].forEach((id) => $(id).addEventListener("input", calcDiff));
  $("birth").addEventListener("input", calcAge);
  $("today").addEventListener("click", () => {
    const t = todayStr();
    $("base").value = t; $("d1").value = t; calcOffset(); calcDiff();
  });

  // 初期値
  const t = todayStr();
  $("base").value = t;
  $("offset").value = 30;
  $("d1").value = t;
  $("d2").value = iso(new Date(Date.now() + 100 * DAY));
  calcOffset(); calcDiff();
})();
