#!/usr/bin/env python3
"""Import one day's「产业与普通人备忘录」into content/memos/.

Writes the same files the site already serves:

  content/memos/memo-YYYY-MM-DD.md
  /articles/memo-YYYY-MM-DD          (generated from that file, no extra route)

Frontmatter matches the existing series:

  title:  "产业与普通人备忘录：YYYY-MM-DD"
  date:   "YYYY-MM-DD"          (from the filename)
  excerpt one sentence built from that day's topic tags
  tags:   up to four short topic tags
  order:  integer tie-break only; newer dates get a smaller order
          without renumbering files already in the repo

The leading H1 is removed because the title lives in frontmatter.
Everything after that H1 is copied unchanged (markdown, links, tables).

Dedup, and never overwrite:

  - content/memos/memo-YYYY-MM-DD.md already exists
  - another memo has the same date and this series
  - the body matches an existing memo

Infographic: a sibling memo-YYYY-MM-DD_infographic-imagegen.png (or any
image path you pass whose name contains the same date) is compressed to
public/images/memos/<sha1>.webp, 300KB or smaller, and inserted at the top
of the body. This happens only when memo pages can render markdown images
(app/articles/[slug]/page.tsx renders memos through components/PostBody.tsx).
Needs Pillow for that step: pip install pillow

Usage:
  python3 scripts/import-memo.py memo-2026-11-04.md
  python3 scripts/import-memo.py memo-2026-11-04.md memo-2026-11-04_infographic-imagegen.png
  python3 scripts/import-memo.py /path/to/daily-memos/
  python3 scripts/import-memo.py --dry-run memo-2026-10-22.md memo-2026-10-23.md
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEMOS_DIR = ROOT / "content" / "memos"
IMAGE_DIR = ROOT / "public" / "images" / "memos"
PUBLIC_PREFIX = "/images/memos"
SERIES = "产业与普通人备忘录"
DATE_RE = re.compile(r"memo-(\d{4}-\d{2}-\d{2})")
H1_RE = re.compile(r"^#\s+(?!#)")
SIGNAL_RE = re.compile(r"^#{2,4}\s+信号\s*\d+\s*[：:]\s*(.+?)\s*$")
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_IMAGE_BYTES = 300 * 1024

# Longer keys win. Values are the short tags already used on /memo.
TOPICS: list[tuple[str, str]] = [
    ("服务消费", "服务消费"),
    ("服务腿", "服务消费"),
    ("科技金融", "科技金融"),
    ("防赎回", "科技金融"),
    ("场景清单", "应用场景"),
    ("应用场景", "应用场景"),
    ("贡献率", "新动能"),
    ("欧洲气价", "欧洲气价"),
    ("气价", "欧洲气价"),
    ("供强需弱", "供强需弱"),
    ("内冷外热", "汽车出口"),
    ("二手车", "二手车"),
    ("财政账本", "财政收支"),
    ("财政金融", "扩内需"),
    ("财政", "财政收支"),
    ("就业意见", "AI就业"),
    ("AI就业", "AI就业"),
    ("医保", "医保钱包"),
    ("智能体", "智能体"),
    ("台风", "台风"),
    ("蔷琵", "台风"),
    ("种 Token", "数据中心"),
    ("种Token", "数据中心"),
    ("Token", "数据中心"),
    ("账款", "清欠"),
    ("清欠", "清欠"),
    ("理财赎回", "理财赎回"),
    ("韩国镜像", "韩国消费"),
    ("韩国出口", "AI出口"),
    ("海外热", "海外市场"),
    ("汽车出海", "汽车出海"),
    ("出海", "汽车出海"),
    ("配额", "汽车出海"),
    ("工业利润", "工业利润"),
    ("扩内需", "扩内需"),
    ("以旧换新", "以旧换新"),
    ("补贴", "以旧换新"),
    ("全球央行", "全球央行"),
    ("转鹰", "全球央行"),
    ("吉利", "吉利"),
    ("调控少涨", "油价"),
    ("油价", "油价"),
    ("油贵", "油价"),
    ("通胀达标", "日本央行"),
    ("日银", "日本央行"),
    ("算账日", "AI行情"),
    ("AI交易", "AI行情"),
    ("AI回撤", "AI行情"),
    ("AI行情", "AI行情"),
    ("霍尔木兹", "原油"),
    ("人民币", "人民币汇率"),
    ("制造业PMI", "制造业PMI"),
    ("PMI", "制造业PMI"),
    ("实际工资", "实际工资"),
    ("二手房", "二手房"),
    ("比亚迪", "汽车出海"),
    ("金融管理", "资本市场"),
    ("互换便利", "互换便利"),
    ("极氪", "极氪"),
    ("上市公司", "上市公司"),
    ("日本新车", "海外车市"),
    ("外汇存准", "外汇存准"),
    ("10Y", "美债收益率"),
    ("长债", "美债收益率"),
    ("车市", "车市"),
    ("零售", "车市"),
]


def yaml_str(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def compact(value: str) -> str:
    value = re.sub(r"[「」『』\"'“”]", "", value)
    return re.sub(r"\s+", "", value)


SORTED_TOPICS = sorted(TOPICS, key=lambda item: len(compact(item[0])), reverse=True)


def memo_date(path: Path) -> str | None:
    match = DATE_RE.search(path.name)
    return match.group(1) if match else None


def memos_support_images() -> bool:
    """True when a memo article page renders markdown images.

    Memo routes render ArticleView, and ArticleView renders PostBody, which
    maps markdown images to <img>. Existing memo files are text-only; the
    page still supports an infographic when one is supplied.
    """
    page = ROOT / "app" / "articles" / "[slug]" / "page.tsx"
    view = ROOT / "components" / "ArticleView.tsx"
    renderer = ROOT / "components" / "PostBody.tsx"
    if not page.is_file() or not renderer.is_file():
        return False
    route = page.read_text(encoding="utf-8")
    view_src = view.read_text(encoding="utf-8") if view.is_file() else ""
    body = renderer.read_text(encoding="utf-8")
    renders_memo = "getMemo" in route and ("PostBody" in route or "ArticleView" in route)
    uses_images = "PostBody" in view_src or "PostBody" in route
    return renders_memo and uses_images and "img:" in body


def strip_h1(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").lstrip("\ufeff")
    lines = text.split("\n")
    if lines and H1_RE.match(lines[0]):
        lines = lines[1:]
        if lines and lines[0].strip() == "":
            lines = lines[1:]
    return "\n".join(lines).strip("\n")


def normalize_body(body: str) -> str:
    body = body.strip()
    body = re.sub(r"^!\[[^\]]*\]\([^)]+\)\s*", "", body)
    return re.sub(r"\s+", "", body)


def signal_headings(body: str) -> list[str]:
    found = []
    for line in body.split("\n"):
        match = SIGNAL_RE.match(line.strip())
        if match:
            found.append(match.group(1).strip())
    return found


def topic_in(text: str) -> str | None:
    """Earliest topic in text. A longer key wins when both start at the same place."""
    folded = compact(text)
    hits: list[tuple[int, int, str]] = []
    for key, tag in SORTED_TOPICS:
        token = compact(key)
        pos = folded.find(token)
        if pos >= 0:
            hits.append((pos, -len(token), tag))
    if not hits:
        return None
    hits.sort()
    return hits[0][2]


def match_topic(heading: str) -> str | None:
    """Prefer a coined 「phrase」; otherwise the first topic in the heading."""
    head = re.split(r"——|—", heading)[0]
    for quote in re.findall(r"「([^」]+)」", head):
        tag = topic_in(quote)
        if tag:
            return tag
    for text in (head, heading):
        tag = topic_in(text)
        if tag:
            return tag
        folded = compact(text)
        if "AI" in folded or "人工智能" in folded:
            if "就业" in folded:
                return "AI就业"
            if "出口" in folded:
                return "AI出口"
            return "AI行情"
    return None


def fallback_tag(heading: str) -> str:
    title = re.split(r"——|—", heading)[0]
    title = re.sub(r"（[^）]*）", "", title)
    title = re.sub(r"\([^)]*\)", "", title)
    title = re.split(r"[，,]", title)[0]
    title = title.replace("「", "").replace("」", "")
    title = re.sub(r"\d+(?:\.\d+)?%?", "", title)
    title = re.sub(r"[+%％→~～/／.．\-–—]", "", title)
    title = compact(title).strip("：:、。；;的了在把给被从到与和")
    if len(title) > 8:
        title = title[:8].rstrip("的了在把给被从到与和")
    return title if len(title) >= 2 else ""


def tags_for(body: str) -> list[str]:
    tags: list[str] = []
    for heading in signal_headings(body):
        for tag in (match_topic(heading), fallback_tag(heading)):
            if tag and tag not in tags:
                tags.append(tag)
                break
        if len(tags) == 4:
            break
    return tags or ["产业观察"]


def excerpt_for(tags: list[str]) -> str:
    if len(tags) == 1:
        return f"{tags[0]}构成今天的普通人账本观察。"
    if len(tags) == 2:
        return f"{tags[0]}和{tags[1]}共同构成今天的普通人账本观察。"
    return "、".join(tags[:-1]) + "和" + tags[-1] + "共同构成今天的普通人账本观察。"


def dump_markdown(date: str, excerpt: str, tags: list[str], order: int, body: str) -> str:
    lines = [
        "---",
        f"title: {yaml_str(f'{SERIES}：{date}')}",
        f"date: {yaml_str(date)}",
        f"excerpt: {yaml_str(excerpt)}",
        "tags:",
    ]
    for tag in tags:
        lines.append(f"  - {yaml_str(tag)}")
    lines.append(f"order: {order}")
    lines.extend(["---", "", body.strip(), ""])
    return "\n".join(lines)


def fm_field(front: str, key: str) -> str:
    match = re.search(rf"^{key}:\s*(.+)\s*$", front, re.M)
    if not match:
        return ""
    raw = match.group(1).strip()
    if raw.startswith('"'):
        try:
            loaded = json.loads(raw)
        except json.JSONDecodeError:
            return raw.strip('"')
        return loaded if isinstance(loaded, str) else raw.strip('"')
    return raw


def load_existing() -> list[dict]:
    rows = []
    if not MEMOS_DIR.is_dir():
        return rows
    for path in sorted(MEMOS_DIR.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        match = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
        front, body = (match.group(1), match.group(2)) if match else ("", raw)
        title = fm_field(front, "title")
        date = fm_field(front, "date") or memo_date(path) or ""
        order_match = re.search(r"^order:\s*(-?\d+)\s*$", front, re.M)
        rows.append(
            {
                "path": path,
                "title": title,
                "date": date,
                "series": title.startswith(SERIES) or path.name.startswith("memo-"),
                "norm": normalize_body(body),
                "order": int(order_match.group(1)) if order_match else None,
            }
        )
    return rows


def duplicate_reason(date: str, body: str, existing: list[dict]) -> str | None:
    target = MEMOS_DIR / f"memo-{date}.md"
    if target.exists():
        return f"已有 {target.relative_to(ROOT)}，不覆盖"
    norm = normalize_body(body)
    for item in existing:
        if item["date"] == date and item["series"]:
            return f"同日同系列已在 {item['path'].relative_to(ROOT)}"
        if norm and item["norm"] == norm:
            return f"正文与 {item['path'].relative_to(ROOT)} 相同"
    return None


def assign_orders(dates: list[str], existing: list[dict]) -> dict[str, int]:
    """Smaller order sorts newer when two memos share a date. Dates already differ."""
    orders = [item["order"] for item in existing if isinstance(item["order"], int)]
    newest_first = sorted(dates, reverse=True)
    count = len(newest_first)
    if not orders:
        return {date: index for index, date in enumerate(newest_first)}
    floor = min(orders)
    return {date: floor - (count - index) for index, date in enumerate(newest_first)}


def find_infographic(md: Path, date: str, images: list[Path]) -> Path | None:
    for image in images:
        if memo_date(image) == date:
            return image
    for name in (
        f"memo-{date}_infographic-imagegen.png",
        f"memo-{date}_infographic.png",
        f"memo-{date}.png",
        f"memo-{date}.webp",
        f"memo-{date}.jpg",
        f"memo-{date}.jpeg",
    ):
        candidate = md.parent / name
        if candidate.is_file():
            return candidate
    for candidate in sorted(md.parent.glob(f"memo-{date}*")):
        if candidate.suffix.lower() in IMAGE_EXTS:
            return candidate
    return None


def to_webp(src: Path) -> bytes:
    try:
        from PIL import Image
    except ImportError as err:
        raise RuntimeError("压缩信息图需要 Pillow：pip install pillow") from err
    with Image.open(src) as opened:
        image = opened.convert("RGBA" if "A" in opened.getbands() else "RGB")
        if image.mode == "RGBA" and image.getchannel("A").getextrema() == (255, 255):
            image = image.convert("RGB")
        quality = 82
        scale = 1.0
        data = b""
        while True:
            frame = image
            if scale < 0.999:
                frame = image.resize(
                    (max(1, int(image.width * scale)), max(1, int(image.height * scale))),
                    Image.Resampling.LANCZOS,
                )
            buf = io.BytesIO()
            frame.save(buf, format="WEBP", quality=quality, method=6)
            data = buf.getvalue()
            if len(data) <= MAX_IMAGE_BYTES:
                return data
            if quality > 50:
                quality -= 8
                continue
            if scale > 0.55:
                scale *= 0.85
                quality = 74
                continue
            raise RuntimeError(f"{src.name} 仍有 {len(data)} 字节，超过 {MAX_IMAGE_BYTES}")


def store_image(src: Path, dry_run: bool) -> str:
    data = to_webp(src)
    name = hashlib.sha1(data).hexdigest()[:16] + ".webp"
    dest = IMAGE_DIR / name
    if not dry_run:
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            dest.write_bytes(data)
    return f"{PUBLIC_PREFIX}/{name}"


def collect(paths: list[Path]) -> tuple[list[Path], list[Path]]:
    memos: list[Path] = []
    images: list[Path] = []
    for path in paths:
        if path.is_dir():
            memos.extend(sorted(path.glob("memo-*.md")))
            for candidate in sorted(path.iterdir()):
                if candidate.suffix.lower() in IMAGE_EXTS and memo_date(candidate):
                    images.append(candidate)
            continue
        if not path.is_file():
            raise SystemExit(f"找不到文件: {path}")
        if path.suffix.lower() == ".md":
            memos.append(path)
        elif path.suffix.lower() in IMAGE_EXTS:
            images.append(path)
        else:
            raise SystemExit(f"无法识别的文件: {path}")
    unique: list[Path] = []
    seen: set[Path] = set()
    for memo in memos:
        resolved = memo.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        if not memo_date(memo):
            raise SystemExit(f"文件名需要是 memo-YYYY-MM-DD.md：{memo}")
        unique.append(memo)
    return unique, images


def import_memos(memo_paths: list[Path], images: list[Path], dry_run: bool) -> int:
    existing = load_existing()
    support_images = memos_support_images()
    pending = []
    skipped = []
    for memo_path in memo_paths:
        date = memo_date(memo_path)
        assert date
        body = strip_h1(memo_path.read_text(encoding="utf-8"))
        reason = duplicate_reason(date, body, existing)
        if reason:
            skipped.append((memo_path, reason))
            continue
        pending.append((memo_path, date, body))

    orders = assign_orders([date for _, date, _ in pending], existing)
    written = []
    for memo_path, date, body in pending:
        image_note = "无信息图"
        infographic = find_infographic(memo_path, date, images)
        if infographic and not support_images:
            image_note = "备忘录页面不渲染图片，已跳过信息图"
        elif infographic:
            public = store_image(infographic, dry_run)
            body = f"![{SERIES} {date}]({public})\n\n" + body
            image_note = f"{infographic.name} -> {public}"
        tags = tags_for(body)
        excerpt = excerpt_for(tags)
        text = dump_markdown(date, excerpt, tags, orders[date], body)
        dest = MEMOS_DIR / f"memo-{date}.md"
        if not dry_run:
            MEMOS_DIR.mkdir(parents=True, exist_ok=True)
            dest.write_text(text, encoding="utf-8")
        written.append((dest, image_note, excerpt))
        existing.append(
            {
                "path": dest,
                "title": f"{SERIES}：{date}",
                "date": date,
                "series": True,
                "norm": normalize_body(body),
                "order": orders[date],
            }
        )

    action = "would write" if dry_run else "wrote"
    for dest, image_note, excerpt in written:
        print(f"{action} {dest.relative_to(ROOT)}")
        print(f"  excerpt: {excerpt}")
        print(f"  image: {image_note}")
    for memo_path, reason in skipped:
        print(f"skip {memo_path.name}: {reason}")
    print(f"done: {len(written)} imported, {len(skipped)} skipped")
    return 0


def main(argv: list[str]) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Import 产业与普通人备忘录 markdown files.")
    parser.add_argument("paths", nargs="+", type=Path, help="memo-YYYY-MM-DD.md files, image files, or a directory")
    parser.add_argument("--dry-run", action="store_true", help="print actions without writing")
    args = parser.parse_args(argv)
    memos, images = collect(args.paths)
    if not memos:
        raise SystemExit("没有 memo-YYYY-MM-DD.md 可导入")
    return import_memos(memos, images, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
