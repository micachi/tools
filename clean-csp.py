r"""src/csp-map.json の生成元データを整形するスクリプト。

出典: MicrosoftDocs/memdocs
      /intune/device-configuration/ref-graph-api-csp-windows.md
      "Graph API properties to CSP mapping" を機械抽出した 732 件

抽出直後のデータには Markdown 由来のノイズが混じるため、Offset URI を整形する。
  - `\_` `\-` `\.` などの Markdown エスケープを元に戻す
  - 「(CSP/Configuration requires Graph properties: ...)」のような括弧注記を落とす
  - 「/A and /B」を別々の Offset として分割する
  - 先頭に `/` が無いトークンは補完する
  - 上記後も URI パスとして成立しない（空白・不正文字を含む）トークンは捨てる

使い方:
    python clean-csp.py <抽出JSON> [出力JSON]
    例) python clean-csp.py ../csp_map.json src/csp-map.json
"""
import json
import io
import sys

BS = chr(92)
ALLOWED = set(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789/_{}.-"
)


def ok(tok):
    return tok.startswith("/") and all(c in ALLOWED for c in tok)


def clean(offsets):
    out = []
    for o in offsets:
        for ch in ("_", "-", "."):
            o = o.replace(BS + ch, ch)          # Markdown エスケープを元に戻す
        o = o.split(" (")[0]                    # 括弧内の注記を落とす
        for tok in o.split(" and "):            # 「/A and /B」を分割
            tok = tok.strip()
            if not tok:
                continue
            if not tok.startswith("/"):
                tok = "/" + tok
            if ok(tok) and tok not in out:
                out.append(tok)
    return out


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "../csp_map.json"
    dst = sys.argv[2] if len(sys.argv) > 2 else "src/csp-map.json"

    d = json.load(io.open(src, encoding="utf-8"))
    before = sum(len(e["offsets"]) for e in d)
    emptied = [e["name"] for e in d if not clean(e["offsets"])]
    for e in d:
        e["offsets"] = clean(e["offsets"])
    after = sum(len(e["offsets"]) for e in d)

    print("entries:", len(d))
    print("offset tokens:", before, "->", after)
    print("entries left empty:", len(emptied), emptied[:8])

    with io.open(dst, "w", encoding="utf-8") as f:
        f.write(json.dumps(d, ensure_ascii=False, separators=(",", ":")))
    print("written:", dst)


if __name__ == "__main__":
    main()
