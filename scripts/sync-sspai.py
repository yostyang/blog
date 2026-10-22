#!/usr/bin/env python3
"""Sync the owner's 少数派 articles into content/posts.

Lists https://sspai.com/u/yostyang via the public API and writes each
article that is not already on the site. A re-run is idempotent: files
named sspai-<id>.md are left as they are, and anything that matches an
existing article or memo is recorded as skipped.

Duplicate rules (strict; retitles count):
- normalized titles are equal, or the title similarity is at least 0.82
- or the shorter title is contained in the longer one (length ratio >= 0.72)
- or the normalized bodies have a similarity of at least 0.50
- or the title similarity is at least 0.68 and the body similarity is at least 0.35

Usage:
  python3 scripts/sync-sspai.py
  python3 scripts/sync-sspai.py --dry-run
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from html import unescape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
MEMOS_DIR = ROOT / "content" / "memos"
IMAGE_DIR = ROOT / "public" / "images" / "sspai"
STATE_PATH = ROOT / "content" / "sspai-sync.json"
AUTHOR_SLUG = "yostyang"
API = "https://sspai.com/api/v1"
UA = "yostyang-blog/1.0 (+https://yostyang.com)"
SHANGHAI = timezone(timedelta(hours=8))
CATEGORIES = ("电车出行", "跑步", "中年成长", "生活随笔")

# Tuned against the existing 165 posts and 114 memos. The closest non-duplicate
# title score was 0.46 with a body score near 0; the weakest real reprint
# (a retitled 来福电台 piece) had a body score of 0.565.
TITLE_DUP = 0.82
TITLE_CONTAIN = 0.72
BODY_DUP = 0.50
DOUBT_TITLE = 0.68
DOUBT_BODY = 0.35
MIN_BODY = 180

TAG_HINTS = (
    ("极氪", "极氪7X"),
    ("跑鞋", "跑步"),
    ("跑步", "跑步"),
    ("跑量", "跑步"),
    ("半马", "马拉松"),
    ("全马", "马拉松"),
    ("新能源", "新能源汽车"),
    ("纯电", "新能源汽车"),
    ("充电", "新能源汽车"),
    ("Apple Watch", "Apple Watch"),
    ("apple watch", "Apple Watch"),
    ("手表", "智能手表"),
    ("中年", "中年人"),
    ("货拉拉", "兼职"),
    ("睡眠", "睡眠"),
)


def fetch(url: str, referer: str | None = None, timeout: int = 40) -> bytes:
    headers = {"User-Agent": UA, "Accept": "*/*"}
    if referer:
        headers["Referer"] = referer
    last: Exception | None = None
    for attempt in range(4):
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=timeout) as res:
                return res.read()
        except (HTTPError, URLError, TimeoutError) as err:
            last = err
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"fetch failed {url}: {last}")


def fetch_json(url: str) -> dict:
    return json.loads(fetch(url, referer="https://sspai.com/").decode("utf-8"))


def norm_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", unescape(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) not in {"Cf", "Cc"})
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"[？?！!。．.，,、：:；;（）()《》「」『』<>【】\[\]\"'“”‘’—–\-·…]", "", text)
    return text.lower()


def plain_fragment(value: str) -> str:
    soup = BeautifulSoup(value or "", "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    return soup.get_text(" ", strip=True)


def yaml_str(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def sniff_ext(data: bytes, url: str) -> str | None:
    if data.startswith(b"\x89PNG"):
        return ".png"
    if data.startswith(b"\xff\xd8"):
        return ".jpg"
    if data.startswith(b"GIF8"):
        return ".gif"
    if data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP":
        return ".webp"
    path = urlparse(url).path.lower()
    for ext in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        if path.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext
    return None


class ImageStore:
    def __init__(self) -> None:
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        self.by_url: dict[str, str] = {}
        self.failures: list[str] = []

    def local(self, url: str, referer: str) -> str | None:
        url = (url or "").strip()
        if not url or url.startswith("data:"):
            return None
        cached = self.by_url.get(url)
        if cached:
            return cached
        digest = hashlib.sha1(url.encode()).hexdigest()[:16]
        existing = list(IMAGE_DIR.glob(f"{digest}.*"))
        if existing:
            public = f"/images/sspai/{existing[0].name}"
            self.by_url[url] = public
            return public
        try:
            data = fetch(url, referer=referer)
        except Exception as err:  # noqa: BLE001 - keep the article, report the image
            self.failures.append(f"{url} ({err})")
            return None
        if len(data) < 32 or data[:1] == b"<":
            self.failures.append(f"{url} (not an image)")
            return None
        ext = sniff_ext(data, url)
        if not ext:
            self.failures.append(f"{url} (unknown type)")
            return None
        path = IMAGE_DIR / f"{digest}{ext}"
        if not path.exists() or path.stat().st_size == 0:
            path.write_bytes(data)
        public = f"/images/sspai/{path.name}"
        self.by_url[url] = public
        return public


def list_articles() -> list[dict]:
    articles: list[dict] = []
    offset = 0
    total = None
    while True:
        query = urlencode({"slug": AUTHOR_SLUG, "limit": 20, "offset": offset})
        payload = fetch_json(f"{API}/article/user/public/page/get?{query}")
        if payload.get("error"):
            raise RuntimeError(f"sspai list error: {payload.get('msg') or payload.get('error')}")
        batch = payload.get("data") or []
        total = payload.get("total", total)
        if not batch:
            break
        articles.extend(batch)
        offset += len(batch)
        if total is not None and offset >= int(total):
            break
    # Newest first is the API order. Drop duplicate ids if a page overlaps.
    seen: set[int] = set()
    unique = []
    for article in articles:
        article_id = int(article["id"])
        if article_id in seen:
            continue
        seen.add(article_id)
        unique.append(article)
    return unique


def article_info(article_id: int) -> dict:
    payload = fetch_json(f"{API}/article/info/get?id={article_id}&view=second")
    if payload.get("error"):
        raise RuntimeError(f"sspai article {article_id}: {payload.get('error')}")
    data = payload.get("data") or {}
    if not data.get("body"):
        raise RuntimeError(f"sspai article {article_id} has no body")
    return data


def shanghai_date(timestamp: int | float | None) -> str:
    if not timestamp:
        raise RuntimeError("missing released_time")
    return datetime.fromtimestamp(int(timestamp), SHANGHAI).strftime("%Y-%m-%d")


def infer_category(title: str, tags: list[str]) -> str:
    text = title + " " + " ".join(tags)
    # Bare「跑」also matches 跑货 and 跑了多少公里, so require a running word.
    if any(word in text for word in ("跑步", "马拉松", "跑鞋", "配速", "跑量", "半马", "全马")):
        return "跑步"
    if any(word in text for word in ("车", "电", "极氪", "充电", "春运", "智驾", "货拉拉", "插混", "纯电")):
        return "电车出行"
    if any(word in text for word in ("中年", "减肥", "体重", "写作", "日更")):
        return "中年成长"
    return "生活随笔"


def collect_tags(title: str, raw_tags: list) -> list[str]:
    names: list[str] = []
    for tag in raw_tags or []:
        if isinstance(tag, dict):
            name = (tag.get("title") or tag.get("name") or "").strip()
        else:
            name = str(tag).strip()
        if name and name not in names:
            names.append(name)
    haystack = title
    for needle, label in TAG_HINTS:
        if needle in haystack and label not in names:
            names.append(label)
        if len(names) >= 4:
            break
    return names[:4]


def excerpt_from(markdown: str, summary: str) -> str:
    """Prefer the first real paragraph. 少数派 summaries glue the heading onto the next sentence."""
    for block in markdown.split("\n\n"):
        line = block.strip()
        if not line or line.startswith(("#", "!", ">", "*", "-", "---")):
            continue
        text = re.sub(r"\*\*([^*]+)\*\*", r"\1", line)
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) >= 24:
            break
    else:
        text = re.sub(r"\s+", " ", summary or "").strip()
    if len(text) > 90:
        window = text[:90]
        cut = max(window.rfind(mark) for mark in ("。", "！", "？"))
        text = window[: cut + 1] if cut >= 24 else window.rstrip() + "…"
    return text or "少数派文章"


def shingles(text: str, size: int = 12) -> set[str]:
    if len(text) < size:
        return set()
    return {text[i : i + size] for i in range(0, len(text) - size + 1, 2)}


def title_score(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    score = SequenceMatcher(None, left, right).ratio()
    if min(len(left), len(right)) >= 10 and (left in right or right in left):
        short, long = (left, right) if len(left) <= len(right) else (right, left)
        score = max(score, len(short) / len(long))
    return score


def body_score(left: str, right: str, left_shingles: set[str], right_shingles: set[str]) -> float:
    if len(left) < MIN_BODY or len(right) < MIN_BODY or not left_shingles or not right_shingles:
        return 0.0
    contain = len(left_shingles & right_shingles) / min(len(left_shingles), len(right_shingles))
    if contain < 0.12:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def titles_contain(left: str, right: str) -> bool:
    if min(len(left), len(right)) < 10:
        return False
    if left not in right and right not in left:
        return False
    short, long = (left, right) if len(left) <= len(right) else (right, left)
    return len(short) / len(long) >= TITLE_CONTAIN


def is_duplicate(title_s: float, body_s: float, contained: bool) -> bool:
    if title_s >= TITLE_DUP or contained:
        return True
    if body_s >= BODY_DUP:
        return True
    if title_s >= DOUBT_TITLE and body_s >= DOUBT_BODY:
        return True
    return False


def load_locals() -> list[dict]:
    docs = []
    for folder, kind in ((POSTS_DIR, "post"), (MEMOS_DIR, "memo")):
        if not folder.exists():
            continue
        for path in sorted(folder.glob("*.md")):
            raw = path.read_text(encoding="utf-8")
            match = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
            front, body = (match.group(1), match.group(2)) if match else ("", raw)
            title_match = re.search(r'^title:\s*(.+)$', front, re.M)
            title = title_match.group(1).strip() if title_match else path.stem
            if title.startswith('"'):
                try:
                    title = json.loads(title)
                except json.JSONDecodeError:
                    title = title.strip('"')
            sspai_match = re.search(r"^sspai:\s*(\d+)\s*$", front, re.M)
            normalized_body = norm_text(body)
            docs.append(
                {
                    "kind": kind,
                    "path": str(path.relative_to(ROOT)),
                    "slug": path.stem,
                    "title": title,
                    "title_norm": norm_text(title),
                    "body_norm": normalized_body,
                    "shingles": shingles(normalized_body),
                    "sspai": int(sspai_match.group(1)) if sspai_match else None,
                }
            )
    return docs


def find_duplicate(title_norm: str, body_norm: str, docs: list[dict]) -> dict | None:
    body_shingles = shingles(body_norm)
    best: dict | None = None
    for doc in docs:
        t_score = title_score(title_norm, doc["title_norm"])
        contained = titles_contain(title_norm, doc["title_norm"])
        b_score = body_score(body_norm, doc["body_norm"], body_shingles, doc["shingles"])
        if not is_duplicate(t_score, b_score, contained):
            continue
        score = max(t_score, b_score, 1.0 if contained else 0.0)
        if best is not None and score <= best["score"]:
            continue
        best = {
            "score": score,
            "title_score": round(t_score, 3),
            "body_score": round(b_score, 3),
            "match_title": doc["title"],
            "match_path": doc["path"],
            "match_kind": doc["kind"],
        }
    return best


def clean(value: str) -> str:
    text = unescape(value).replace("\u00a0", " ").replace("\u200b", "")
    return re.sub(r"[ \t]+", " ", text)


def image_url(img: Tag) -> str:
    raw = (img.get("data-original") or img.get("src") or "").strip()
    return raw.split("?")[0]


class Converter:
    def __init__(self, images: ImageStore, referer: str) -> None:
        self.images = images
        self.referer = referer

    def convert(self, html: str) -> str:
        soup = BeautifulSoup(html or "", "html.parser")
        chunks = [self.block(child) for child in soup.children if isinstance(child, Tag)]
        text = re.sub(r"\n{3,}", "\n\n", "".join(chunks))
        return text.strip()

    def block(self, el: Tag) -> str:
        if el.name in {"h1", "h2"}:
            return self.heading(el, 2)
        if el.name in {"h3", "h4"}:
            return self.heading(el, 3)
        if el.name == "hr":
            return "---\n\n"
        if el.name in {"ul", "ol"}:
            return self.list_block(el, el.name == "ol") + "\n"
        if el.name == "blockquote":
            inner = self.convert("".join(str(child) for child in el.children)).strip()
            if not inner:
                return ""
            return "\n".join("> " + line if line else ">" for line in inner.splitlines()) + "\n\n"
        if el.name == "img":
            return self.image(el)
        if el.name == "figure":
            img = el.find("img")
            return self.image(img) if img else ""
        if el.name in {"p", "div", "section"}:
            return self.paragraph(el)
        return ""

    def heading(self, el: Tag, level: int) -> str:
        text = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
        if not text:
            return ""
        return f"{'#' * level} {text}\n\n"

    def paragraph(self, el: Tag) -> str:
        images = el.find_all("img")
        if images and not el.get_text(strip=True):
            return "".join(self.image(img) for img in images)
        style = (el.get("style") or "").replace(" ", "")
        rendered = self.inline(el).strip()
        if not rendered:
            return ""
        if "text-align:center" in style:
            return f"*{rendered}*\n\n"
        only_strong = [child for child in el.children if isinstance(child, Tag)]
        plain = el.get_text(" ", strip=True)
        if (
            only_strong
            and all(child.name in {"strong", "b"} for child in only_strong)
            and len(plain) <= 28
            and not el.find("a")
        ):
            return f"## {plain}\n\n"
        return rendered + "\n\n"

    def list_block(self, el: Tag, ordered: bool, indent: str = "") -> str:
        lines = []
        index = 1
        for li in el.find_all("li", recursive=False):
            marker = f"{index}. " if ordered else "- "
            bits = []
            for child in li.children:
                if isinstance(child, NavigableString):
                    text = clean(str(child)).strip()
                    if text:
                        bits.append(text)
                elif isinstance(child, Tag) and child.name not in {"ul", "ol"}:
                    bits.append(self.inline(child).strip())
            line = re.sub(r"\s+", " ", " ".join(bit for bit in bits if bit)).strip()
            lines.append(f"{indent}{marker}{line}")
            for nested in li.find_all(["ul", "ol"], recursive=False):
                lines.append(self.list_block(nested, nested.name == "ol", indent + "  ").rstrip("\n"))
            index += 1
        return "\n".join(lines) + "\n"

    def inline(self, el: Tag) -> str:
        parts: list[str] = []
        for child in el.children:
            if isinstance(child, NavigableString):
                parts.append(clean(str(child)))
                continue
            if not isinstance(child, Tag):
                continue
            if child.name == "br":
                parts.append(" ")
            elif child.name == "img":
                parts.append(self.image(child).strip())
            elif child.name in {"strong", "b"}:
                text = self.inline(child).strip()
                parts.append(f"**{text}**" if text else "")
            elif child.name in {"em", "i"}:
                text = self.inline(child).strip()
                parts.append(f"*{text}*" if text else "")
            elif child.name == "a":
                text = self.inline(child).strip() or child.get_text(" ", strip=True)
                href = (child.get("href") or "").strip()
                parts.append(f"[{text}]({href})" if href and text else text)
            elif child.name in {"ul", "ol"}:
                parts.append("\n" + self.list_block(child, child.name == "ol"))
            else:
                parts.append(self.inline(child))
        return "".join(parts)

    def image(self, img: Tag | None) -> str:
        if img is None:
            return ""
        url = image_url(img)
        local = self.images.local(url, self.referer)
        if not local:
            return ""
        alt = re.sub(r"\s+", " ", img.get("alt") or "").strip()
        return f"![{alt}]({local})\n\n"


def banner_url(info: dict, listed: dict) -> str | None:
    raw = (info.get("banner") or listed.get("banner") or "").strip()
    if not raw:
        return None
    if raw.startswith("http"):
        return raw.split("?")[0]
    return "https://cdnfile.sspai.com/" + raw.lstrip("/")


def dump_markdown(meta: dict, body: str) -> str:
    lines = [
        "---",
        f"title: {yaml_str(meta['title'])}",
        f"date: {yaml_str(meta['date'])}",
        f"category: {yaml_str(meta['category'])}",
        f"excerpt: {yaml_str(meta['excerpt'])}",
    ]
    if meta["tags"]:
        lines.append("tags:")
        for tag in meta["tags"]:
            lines.append(f"  - {yaml_str(tag)}")
    if meta.get("thumb"):
        lines.append(f"thumb: {yaml_str(meta['thumb'])}")
    if meta.get("cover"):
        lines.append(f"cover: {yaml_str(meta['cover'])}")
    lines.append(f"source: {yaml_str(meta['source'])}")
    lines.append(f"sspai: {int(meta['sspai'])}")
    lines.extend(["---", "", body.strip(), ""])
    return "\n".join(lines)


def source_footer(title: str, article_id: int) -> str:
    url = f"https://sspai.com/post/{article_id}"
    return f"\n\n---\n\n原文发布于少数派：[{title}]({url})。"


def existing_sspai_ids(docs: list[dict]) -> dict[int, dict]:
    found = {}
    for doc in docs:
        if doc["sspai"]:
            found[doc["sspai"]] = doc
        match = re.fullmatch(r"sspai-(\d+)", doc["slug"])
        if match:
            found[int(match.group(1))] = doc
    return found


def sync(dry_run: bool) -> dict:
    listed = list_articles()
    docs = load_locals()
    already = existing_sspai_ids(docs)
    images = ImageStore()
    added = []
    skipped = []
    unchanged = []

    for item in listed:
        article_id = int(item["id"])
        title = re.sub(r"\s+", " ", (item.get("title") or "").strip())
        if article_id in already:
            unchanged.append(
                {
                    "id": article_id,
                    "title": title,
                    "slug": already[article_id]["slug"],
                    "path": already[article_id]["path"],
                }
            )
            continue
        info = article_info(article_id)
        title = info.get("title") or title
        title = "".join(ch for ch in title if unicodedata.category(ch) not in {"Cf", "Cc"})
        title = re.sub(r"\s+", " ", title).strip()
        html = info.get("body") or ""
        plain = plain_fragment(html)
        title_norm = norm_text(title)
        body_norm = norm_text(plain)
        match = find_duplicate(title_norm, body_norm, docs)
        if match:
            row = {
                "id": article_id,
                "title": title,
                "url": f"https://sspai.com/post/{article_id}",
                "reason": "duplicate",
                **{key: match[key] for key in ("title_score", "body_score", "match_title", "match_path", "match_kind")},
            }
            skipped.append(row)
            print(
                f"  skip {article_id}「{title}」≈ {match['match_kind']}「{match['match_title']}」"
                f" title {match['title_score']} body {match['body_score']}",
                flush=True,
            )
            continue

        released = info.get("released_time") or info.get("rtime") or item.get("released_time")
        tags = collect_tags(title, info.get("tags") or item.get("tags") or [])
        category = infer_category(title, tags)
        if category not in CATEGORIES:
            category = "生活随笔"
        referer = f"https://sspai.com/post/{article_id}"
        if dry_run:
            body = ""
            cover = None
        else:
            converter = Converter(images, referer)
            body = converter.convert(html) + source_footer(title, article_id)
            banner = banner_url(info, item)
            cover = images.local(banner, referer) if banner else None
            if not cover:
                first = re.search(r"!\[[^\]]*\]\((/images/sspai/[^)]+)\)", body)
                cover = first.group(1) if first else None
        docs.append(
            {
                "kind": "post",
                "path": f"content/posts/sspai-{article_id}.md",
                "slug": f"sspai-{article_id}",
                "title": title,
                "title_norm": title_norm,
                "body_norm": body_norm,
                "shingles": shingles(body_norm),
                "sspai": article_id,
            }
        )
        slug = f"sspai-{article_id}"
        meta = {
            "title": title,
            "date": shanghai_date(released),
            "category": category,
            "excerpt": excerpt_from(body, info.get("summary") or item.get("summary") or ""),
            "tags": tags,
            "thumb": cover,
            "cover": cover,
            "source": referer,
            "sspai": article_id,
        }
        path = POSTS_DIR / f"{slug}.md"
        if not dry_run:
            path.write_text(dump_markdown(meta, body), encoding="utf-8")
        added.append({"id": article_id, "title": title, "slug": slug, "date": meta["date"], "category": category})
        print(f"  add  {slug}  {meta['date']}  {category}  {title}", flush=True)

    prior_articles: dict[int, dict] = {}
    if STATE_PATH.exists():
        try:
            prior = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            prior = {}
        for row in prior.get("articles") or []:
            if isinstance(row, dict) and row.get("id") is not None:
                prior_articles[int(row["id"])] = row
    for row in added:
        prior_articles[int(row["id"])] = {**row, "status": "added"}
    for row in unchanged:
        current = prior_articles.get(int(row["id"]), {})
        prior_articles[int(row["id"])] = {**current, **row, "status": "added"}
    for row in skipped:
        prior_articles[int(row["id"])] = {**row, "status": "skipped"}
    articles = [prior_articles[key] for key in sorted(prior_articles, reverse=True)]
    report = {
        "author": AUTHOR_SLUG,
        "source_total": len(listed),
        "added": added,
        "skipped_duplicates": skipped,
        "already_synced": unchanged,
        "articles": articles,
        "image_failures": images.failures,
    }
    if not dry_run:
        STATE_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"sspai: {len(listed)} listed, {len(added)} added, {len(skipped)} skipped as duplicates, {len(unchanged)} already synced",
        flush=True,
    )
    if images.failures:
        print(f"image failures: {len(images.failures)}", flush=True)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync yostyang's 少数派 articles")
    parser.add_argument("--dry-run", action="store_true", help="classify articles without writing files")
    args = parser.parse_args()
    sync(dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
