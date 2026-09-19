(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DAY = 86400000;
  const WD = ["日", "月", "火", "水", "木", "金", "土"];

  // タイムゾーン・DST の影響を排するため UTC で扱う
  const parse = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // 2月30日等を弾く
    return dt;
  };
  const iso = (d) => d.toISOString().slice(0, 10);
  const jp = (d) => `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${WD[d.getUTCDay()]}）`;
  const todayStr = () => iso(new Date());

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
    if (!base) { st.innerHTML = '<span class="err">⚠ 日付が不正です（YYYY-MM-DD）</span>'; return; }
    if (!isFinite(n)) { st.innerHTML = '<span class="sub">日数を入力してください</span>'; return; }
    const r = new Date(base.getTime() + n * DAY);
    st.innerHTML = `<b style="color:var(--acc);font-size:1.1rem">${jp(r)}</b> ` +
      `<span class="sub">／ ${iso(r)} ／ ${n >= 0 ? `${n}日後` : `${-n}日前`}</span>`;
  }

  function calcDiff() {
    const a = parse($("d1").value), b = parse($("d2").value);
    const st = $("diffOut");
    if (!a || !b) { st.innerHTML = '<span class="err">⚠ どちらかの入力が不正です</span>'; return; }
    const days = Math.round((b.getTime() - a.getTime()) / DAY);
    const [s, e] = days >= 0 ? [a, b] : [b, a];
    const c = calDiff(s, e);
    const biz = Math.abs(businessDays(a, b));
    const weeks = Math.abs(days) / 7;

    st.innerHTML = `
      <div class="stats">
        <div class="stat"><span class="v">${Math.abs(days).toLocaleString("ja-JP")}</span><span class="k">日数</span></div>
        <div class="stat"><span class="v">${weeks.toFixed(1)}</span><span class="k">週</span></div>
        <div class="stat"><span class="v">${c.y}年 ${c.m}ヶ月 ${c.d}日</span><span class="k">カレンダー差</span></div>
        <div class="stat"><span class="v">${biz.toLocaleString("ja-JP")}</span><span class="k">営業日（土日除く）</span></div>
      </div>
      <p class="sub" style="margin:12px 0 0">
        ${jp(s)} → ${jp(e)}　<span class="ok">${days >= 0 ? "前进（あと " + days + " 日）" : "過去へ " + (-days) + " 日"}</span>
      </p>
      <p class="sub" style="margin:6px 0 0">
        祝日は除外していません。実務で正確な営業日が必要な場合は祝日表を追加してください（土日以外の除外漏れに注意）。
      </p>`;
  }

  function calcAge() {
    const b = parse($("birth").value);
    const st = $("ageOut");
    if (!b) { st.innerHTML = '<span class="err">⚠ 生年月日が不正です</span>'; return; }
    const now = new Date();
    const c = calDiff(b, now);
    const days = Math.round((now.getTime() - b.getTime()) / DAY);
    st.innerHTML = `<b style="color:var(--acc);font-size:1.1rem">満 ${c.y} 歳</b> ` +
      `<span class="sub">（${c.m} ヶ月 ${c.d} 日経過 ／ 通算 ${days.toLocaleString("ja-JP")} 日）</span>`;
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
