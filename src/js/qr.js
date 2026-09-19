(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function render() {
    const text = $("src").value;
    const box = $("qrbox");
    const info = $("info");
    if (!text) { box.innerHTML = ""; info.textContent = "テキストまたはURLを入力してください"; return; }

    const ecl = $("ecl").value;
    const cell = +$("cell").value;
    const margin = +$("margin").value;

    try {
      const qr = qrcode(0, ecl);            // 0 = 自動バージョン選択
      qr.addData(text);
      qr.make();
      // scalable: true はルート <svg> に width/height を出さないため、
      // fit-content の親で高さ 0 に潰れる。明示寸法を出す scalable: false を使い、
      // レスポンシブな縮小は CSS (max-width:100%) で行う。
      box.innerHTML = qr.createSvgTag({ cellSize: cell, margin: margin, scalable: false });
      const n = qr.getModuleCount();
      const ver = Math.round((n - 17) / 4); // バージョン = (モジュール数 - 17) / 4
      info.innerHTML = `バージョン ${ver} ／ ${n}×${n} モジュール ／ 復元レベル ${ecl} ／ 文字数 ${[...text].length}`;
      $("dl").disabled = false;
    } catch (e) {
      // 注意: このベンダーは Error ではなく「文字列」を throw する。
      // 容量超過と プログラムミス を混同すると原因究明ができなくなるので分離する。
      const msg = (typeof e === "string" ? e : (e && e.message) || String(e));
      box.innerHTML = "";
      $("dl").disabled = true;
      if (/code length overflow|length over/i.test(msg)) {
        info.innerHTML = `<span class="err">⚠ データが多すぎます — ${escHtml(msg)}</span>` +
          `<br><span class="sub">対策: 復元レベルを下げる（L 寄りにする）／テキストを短くする／URL を短縮する</span>`;
      } else {
        info.innerHTML = `<span class="err">⚠ 想定外のエラー: ${escHtml(msg)}</span>`;
        if (typeof console !== "undefined") console.error("[qr] unexpected error", e);
      }
      return;
    }
  }

  function download() {
    const svg = $("qrbox").querySelector("svg");
    if (!svg) return;
    // SVG を canvas に描画して PNG 出力（拡大しても潰れない解像度で）
    const xml = new XMLSerializer().serializeToString(svg);
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    const img = new Image();
    img.onload = () => {
      const size = Math.max(img.width, img.height, 512) * 2;
      const cv = document.createElement("canvas");
      cv.width = size; cv.height = size;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement("a");
      a.href = cv.toDataURL("image/png");
      a.download = "qrcode.png";
      a.click();
    };
    img.onerror = () => { $("info").innerHTML = '<span class="err">⚠ PNG変換に失敗しました</span>'; };
    img.src = url;
  }

  $("src").addEventListener("input", render);
  ["ecl", "cell", "margin"].forEach((id) => $(id).addEventListener("input", render));
  $("cell").addEventListener("input", () => ($("cellVal").textContent = $("cell").value));
  $("margin").addEventListener("input", () => ($("marginVal").textContent = $("margin").value));
  $("dl").addEventListener("click", download);
  render();
})();
