#!/usr/bin/env python3
"""Import articles, memos, and the about page from https://yost-pt.top/.

The owner's own site. Downloads body text and images into this repo and
rewrites image paths to /images/yost/ (articles and memos) or /assets/me/
(about page). Re-running is safe: existing posts with the same title are
updated in place; new posts keep the source slug.

Usage:
  python3 scripts/import-yost.py
  python3 scripts/import-yost.py --only articles
  python3 scripts/import-yost.py --only memos
  python3 scripts/import-yost.py --only about
  python3 scripts/import-yost.py --only dedupe
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import threading
import time
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
MEMOS_DIR = ROOT / "content" / "memos"
ABOUT_DIR = ROOT / "content" / "about"
REDIRECTS_PATH = ROOT / "content" / "redirects.json"
IMAGE_DIR = ROOT / "public" / "images" / "yost"
ME_DIR = ROOT / "public" / "assets" / "me"
ORIGIN = "https://yost-pt.top"
UA = "yostyang-import/1.0 (+https://yostyang.com)"
# mmbiz.qpic.cn returns this 140×140 JPEG when the request has no WeChat referer.
WECHAT_PLACEHOLDER_SHA1 = "d7c4ccffd384b6be5eea46043b5c7eedc218120b"

CATEGORIES = ("电车出行", "跑步", "中年成长", "生活随笔")


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
            time.sleep(0.6 * (attempt + 1))
    raise RuntimeError(f"fetch failed {url}: {last}")


def fetch_text(url: str) -> str:
    return fetch(url).decode("utf-8", "replace")


class ImageStore:
    def __init__(self, directory: Path, public_prefix: str) -> None:
        self.directory = directory
        self.public_prefix = public_prefix.rstrip("/")
        self.directory.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.by_url: dict[str, str] = {}
        self.failures: list[str] = []

    def local(self, url: str, referer: str | None = None) -> str | None:
        url = url.strip()
        if not url or url.startswith("data:"):
            return None
        digest = hashlib.sha1(url.encode()).hexdigest()[:16]
        with self.lock:
            cached = self.by_url.get(url)
            if not cached:
                existing = list(self.directory.glob(f"{digest}.*"))
                if existing and hashlib.sha1(existing[0].read_bytes()).hexdigest() == WECHAT_PLACEHOLDER_SHA1:
                    existing[0].unlink()
                    existing = []
                if existing:
                    cached = f"{self.public_prefix}/{existing[0].name}"
                    self.by_url[url] = cached
        if cached:
            return cached
        try:
            data = self._download(url, referer)
        except Exception as err:  # noqa: BLE001 - report and keep going
            with self.lock:
                self.failures.append(f"{url} ({err})")
            return None
        ext = sniff_ext(data, url)
        if not ext:
            with self.lock:
                self.failures.append(f"{url} (not an image)")
            return None
        name = hashlib.sha1(url.encode()).hexdigest()[:16] + ext
        path = self.directory / name
        if not path.exists() or path.stat().st_size == 0:
            path.write_bytes(data)
        public = f"{self.public_prefix}/{name}"
        with self.lock:
            self.by_url[url] = public
        return public

    def _download(self, url: str, referer: str | None) -> bytes:
        candidates: list[str] = []
        if "qpic.cn" in url or "qlogo.cn" in url:
            # The proxy only returns the real file when the query referer is WeChat.
            candidates.append(
                ORIGIN
                + "/api/import?"
                + urlencode({"image": url, "referer": "https://mp.weixin.qq.com/"})
            )
        candidates.append(url)
        last: Exception | None = None
        for candidate in candidates:
            try:
                data = fetch(candidate, referer=referer or ORIGIN)
            except Exception as err:  # noqa: BLE001
                last = err
                continue
            if data[:20].lstrip().startswith(b"<"):
                last = RuntimeError("html response")
                continue
            if len(data) < 32:
                last = RuntimeError("too small")
                continue
            if hashlib.sha1(data).hexdigest() == WECHAT_PLACEHOLDER_SHA1:
                last = RuntimeError("wechat placeholder")
                continue
            return data
        raise RuntimeError(last or "no data")


def sniff_ext(data: bytes, url: str) -> str | None:
    if data.startswith(b"\x89PNG"):
        return ".png"
    if data.startswith(b"\xff\xd8"):
        return ".jpg"
    if data.startswith(b"GIF8"):
        return ".gif"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return ".webp"
    if url.lower().split("?")[0].endswith(".png"):
        return ".png"
    if url.lower().split("?")[0].endswith((".jpg", ".jpeg")):
        return ".jpg"
    return None


def titles_compatible(source: str, local: str) -> bool:
    """True when titles match, allowing U+FFFD runs in a damaged source title."""
    left = norm_title(source)
    right = norm_title(local)
    if left == right:
        return True
    if "\ufffd" not in left:
        return False
    pattern = "".join("." if char == "\ufffd" else re.escape(char) for char in left)
    pattern = re.sub(r"\.{2,}", ".{1,3}", pattern)
    return re.fullmatch(pattern, right) is not None


def norm_title(value: str) -> str:
    text = unicodedata.normalize("NFKC", unescape(value))
    # Archive titles sometimes carry zero-width spaces copied from WeChat.
    text = "".join(ch for ch in text if unicodedata.category(ch) not in {"Cf", "Cc"})
    text = text.replace("“", "").replace("”", "").replace("‘", "").replace("’", "")
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"[？?！!。．.，,、：:；;（）()《》「」『』<>【】\[\]\"'—–\-·…]", "", text)
    return text.lower()


def yaml_str(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def infer_category(title: str, tags: list[str]) -> str:
    text = title + " " + " ".join(tags)
    if any(word in text for word in ("跑", "马拉松", "运动", "跑鞋", "配速")):
        return "跑步"
    if any(word in text for word in ("车", "电", "极氪", "充电", "春运", "智驾", "货拉拉", "插混", "纯电")):
        return "电车出行"
    if any(word in text for word in ("中年", "减肥", "体重", "写作", "日更")):
        return "中年成长"
    return "生活随笔"


def read_posts() -> list[dict]:
    posts = []
    for path in sorted(POSTS_DIR.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        match = re.match(r"^---\n(.*?)\n---\n", raw, re.S)
        fm = match.group(1) if match else ""
        title = fm_field(fm, "title") or path.stem
        posts.append(
            {
                "path": path,
                "slug": path.stem,
                "title": title,
                "norm": norm_title(title),
                "category": fm_field(fm, "category") or "生活随笔",
                "order": fm_int(fm, "order"),
                "thumb": fm_field(fm, "thumb"),
                "cover": fm_field(fm, "cover"),
            }
        )
    return posts


def fm_field(fm: str, key: str) -> str | None:
    match = re.search(rf"^{key}:\s*(.+)\s*$", fm, re.M)
    if not match:
        return None
    raw = match.group(1).strip()
    if raw.startswith('"') or raw.startswith("'"):
        try:
            return json.loads(raw) if raw.startswith('"') else raw.strip("'")
        except json.JSONDecodeError:
            return raw.strip("\"'")
    return raw


def fm_int(fm: str, key: str) -> int | None:
    match = re.search(rf"^{key}:\s*(-?\d+)\s*$", fm, re.M)
    return int(match.group(1)) if match else None


def dump_markdown(meta: dict, body: str) -> str:
    lines = ["---", f"title: {yaml_str(meta['title'])}", f"date: {yaml_str(meta['date'])}"]
    if meta.get("category"):
        lines.append(f"category: {yaml_str(meta['category'])}")
    lines.append(f"excerpt: {yaml_str(meta['excerpt'])}")
    if meta.get("tags"):
        lines.append("tags:")
        for tag in meta["tags"]:
            lines.append(f"  - {yaml_str(tag)}")
    for key in ("thumb", "cover"):
        if meta.get(key):
            lines.append(f"{key}: {yaml_str(meta[key])}")
    if meta.get("order") is not None:
        lines.append(f"order: {meta['order']}")
    if meta.get("featured"):
        lines.append("featured: true")
    if meta.get("alias"):
        lines.append(f"alias: {yaml_str(meta['alias'])}")
    lines.extend(["---", "", body.strip(), ""])
    return "\n".join(lines)


def sitemap_urls() -> list[str]:
    xml = fetch_text(f"{ORIGIN}/sitemap.xml")
    urls = re.findall(r"<loc>(.*?)</loc>", xml)
    return [unescape(url) for url in urls]


def article_slug(url: str) -> str:
    return url.rstrip("/").rsplit("/", 1)[-1]


class MarkdownConverter:
    def __init__(self, images: ImageStore, referer: str | None) -> None:
        self.images = images
        self.referer = referer
        self.toc: dict[str, int] = {}

    def convert(self, prose: Tag) -> str:
        chunks: list[str] = []
        for child in prose.children:
            if isinstance(child, NavigableString):
                text = clean(str(child))
                if text.strip():
                    chunks.append(text.strip() + "\n\n")
                continue
            if isinstance(child, Tag):
                chunks.append(self.block(child))
        text = "".join(chunks)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]+\n", "\n", text)
        return text.strip()

    def block(self, el: Tag) -> str:
        if el.name == "img":
            return self.image(el)
        anchor = el.get("id") or ""
        if anchor in self.toc and el.name in {"p", "section", "div", "h2", "h3", "h4", "h1"}:
            text = el.get_text(" ", strip=True)
            text = re.sub(r"\s+", " ", text)
            if text:
                return f"{'#' * self.toc[anchor]} {text}\n\n"
        if el.name in {"h1", "h2", "h3", "h4"}:
            level = 2 if el.name == "h1" else min(int(el.name[1]), 3)
            text = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
            return f"{'#' * level} {text}\n\n" if text else ""
        if el.name in {"ul", "ol"}:
            return self.list_block(el, ordered=el.name == "ol") + "\n"
        if el.name == "blockquote":
            inner = self.convert(el).strip()
            if not inner:
                return ""
            return "\n".join("> " + line if line else ">" for line in inner.splitlines()) + "\n\n"
        if el.name == "hr":
            return "---\n\n"
        if el.name == "pre":
            return f"```\n{el.get_text()}\n```\n\n"
        if el.name == "table":
            return self.table(el)
        if el.name in {"p", "section", "div", "figure", "article", "li"}:
            blocks = [c for c in el.children if isinstance(c, Tag) and self.is_block(c)]
            inline_text = "".join(
                clean(str(c)) for c in el.children if isinstance(c, NavigableString)
            ).strip()
            if blocks and not (len(blocks) == 1 and blocks[0].name == "img" and not inline_text):
                parts: list[str] = []
                for child in el.children:
                    if isinstance(child, NavigableString):
                        text = clean(str(child)).strip()
                        if text:
                            parts.append(text + "\n\n")
                    elif isinstance(child, Tag):
                        parts.append(self.block(child))
                return "".join(parts)
            rendered = self.inline(el).strip()
            if not rendered or rendered in {"**", "*", "<br>"}:
                return ""
            return rendered + "\n\n"
        return self.inline(el)

    def is_block(self, el: Tag) -> bool:
        if el.name in {"p", "section", "div", "ul", "ol", "blockquote", "table", "pre", "h1", "h2", "h3", "h4", "hr", "figure"}:
            return True
        if el.name == "img":
            return True
        return False

    def list_block(self, el: Tag, ordered: bool, indent: str = "") -> str:
        lines = []
        index = 1
        for li in el.find_all("li", recursive=False):
            marker = f"{index}. " if ordered else "- "
            content = self.inline(li).strip()
            nested = []
            for child in li.find_all(["ul", "ol"], recursive=False):
                nested.append(self.list_block(child, child.name == "ol", indent + "  "))
            text = re.sub(r"\n+", " ", content).strip()
            lines.append(f"{indent}{marker}{text}")
            for block in nested:
                lines.append(block.rstrip("\n"))
            index += 1
        return "\n".join(lines) + "\n"

    def table(self, el: Tag) -> str:
        rows = []
        for tr in el.find_all("tr"):
            cells = [re.sub(r"\s+", " ", c.get_text(" ", strip=True)) for c in tr.find_all(["th", "td"])]
            if cells:
                rows.append(cells)
        if not rows:
            return ""
        width = max(len(row) for row in rows)
        rows = [row + [""] * (width - len(row)) for row in rows]
        head = "| " + " | ".join(rows[0]) + " |"
        sep = "| " + " | ".join("---" for _ in rows[0]) + " |"
        body = ["| " + " | ".join(row) + " |" for row in rows[1:]]
        return "\n".join([head, sep, *body]) + "\n\n"

    def inline(self, el: Tag) -> str:
        parts: list[str] = []
        for child in el.children:
            if isinstance(child, NavigableString):
                parts.append(clean(str(child)))
                continue
            if not isinstance(child, Tag):
                continue
            if child.name == "br":
                parts.append("\n")
            elif child.name == "img":
                parts.append(self.image(child).strip())
            elif child.name in {"strong", "b"}:
                text = self.inline(child).strip()
                parts.append(f"**{text}**" if text else "")
            elif child.name in {"em", "i"}:
                text = self.inline(child).strip()
                parts.append(f"*{text}*" if text else "")
            elif child.name == "code":
                text = child.get_text()
                parts.append(f"`{text}`" if text else "")
            elif child.name == "a":
                text = self.inline(child).strip() or child.get_text(strip=True)
                href = (child.get("href") or "").strip()
                if href and text:
                    parts.append(f"[{text}]({href})")
                else:
                    parts.append(text)
            elif child.name in {"ul", "ol"}:
                parts.append("\n" + self.list_block(child, child.name == "ol"))
            else:
                parts.append(self.inline(child))
        return "".join(parts)

    def image(self, el: Tag) -> str:
        src = image_url(el)
        if not src:
            return ""
        if src.startswith("//"):
            src = "https:" + src
        elif src.startswith("/"):
            src = ORIGIN + src
        local = self.images.local(src, self.referer)
        if not local:
            return ""
        alt = (el.get("alt") or "").strip()
        return f"![{alt}]({local})\n\n"


def clean(value: str) -> str:
    value = value.replace("\xa0", " ").replace("\u200b", "")
    value = re.sub(r"[ \t]{2,}", " ", value)
    return value


def image_url(el: Tag) -> str:
    for key in ("data-original-src", "data-src", "src"):
        raw = el.get(key)
        if not raw:
            continue
        raw = unescape(raw)
        if "/api/import" in raw and "image=" in raw:
            parsed = urlparse(raw)
            query = dict(pair.split("=", 1) for pair in parsed.query.split("&") if "=" in pair)
            if "image" in query:
                return unquote(query["image"])
        return raw
    return ""


def parse_toc(soup: BeautifulSoup) -> dict[str, int]:
    levels: dict[str, int] = {}
    toc = soup.select_one("aside.toc") or soup.select_one("details.toc-mobile")
    if not toc:
        return levels
    for link in toc.select("a[href^='#']"):
        parent = link.find_parent("li")
        classes = parent.get("class") or [] if parent else []
        level = 3 if "l3" in classes else 2
        anchor = link.get("href", "").lstrip("#")
        if anchor:
            levels[anchor] = level
    return levels


def meta_content(soup: BeautifulSoup, name: str) -> str:
    tag = soup.find("meta", attrs={"name": name})
    if tag and tag.get("content"):
        return tag["content"].strip()
    return ""


def page_tags(soup: BeautifulSoup) -> list[str]:
    tags = []
    for link in soup.select("ul.article-tags a.tag"):
        text = link.get_text(strip=True)
        if text and text not in tags:
            tags.append(text)
    return tags


def page_date(soup: BeautifulSoup, slug: str) -> str:
    time_el = soup.select_one("time[datetime]")
    if time_el and re.fullmatch(r"\d{4}-\d{2}-\d{2}", time_el.get("datetime", "")):
        return time_el["datetime"]
    match = re.search(r"(\d{4}-\d{2}-\d{2})", slug)
    if match:
        return match.group(1)
    raise RuntimeError(f"no date for {slug}")


def page_title(soup: BeautifulSoup) -> str:
    heading = soup.select_one("article h1")
    if heading:
        return heading.get_text(strip=True)
    title = soup.find("title")
    return title.get_text(strip=True).split("｜")[0] if title else ""


def cover_from(soup: BeautifulSoup, images: ImageStore, referer: str | None) -> str | None:
    img = soup.select_one("article img")
    if not img:
        return None
    src = image_url(img)
    if not src:
        return None
    if src.startswith("//"):
        src = "https:" + src
    elif src.startswith("/"):
        src = ORIGIN + src
    return images.local(src, referer)


def import_pages(kind: str, images: ImageStore) -> list[dict]:
    urls = [url for url in sitemap_urls() if "/articles/" in url]
    if kind == "articles":
        urls = [url for url in urls if not article_slug(url).startswith("memo-")]
    else:
        urls = [url for url in urls if article_slug(url).startswith("memo-")]
    print(f"fetching {len(urls)} {kind}…", flush=True)
    pages: dict[str, str] = {}

    def load(url: str) -> tuple[str, str]:
        return url, fetch_text(url)

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(load, url) for url in urls]
        for done, future in enumerate(as_completed(futures), 1):
            url, html = future.result()
            pages[url] = html
            if done % 20 == 0 or done == len(urls):
                print(f"  {done}/{len(urls)}", flush=True)

    # Preserve sitemap order (newest first on the source sitemap).
    ordered = []
    for index, url in enumerate(urls):
        slug = article_slug(url)
        print(f"  convert {index + 1}/{len(urls)} {slug}", flush=True)
        soup = BeautifulSoup(pages[url], "html.parser")
        prose = soup.select_one("div.prose")
        if prose is None:
            raise RuntimeError(f"no prose in {url}")
        referer = ORIGIN + "/articles/" + slug
        converter = MarkdownConverter(images, referer)
        converter.toc = parse_toc(soup)
        body = converter.convert(prose)
        plain = BeautifulSoup(str(prose), "html.parser").get_text(" ", strip=True)
        if len(re.sub(r"\s+", "", body)) < len(re.sub(r"\s+", "", plain)) * 0.75:
            print(f"  warn: short conversion {slug} md={len(body)} text={len(plain)}", flush=True)
        title = page_title(soup)
        if kind == "memos":
            title = f"产业与普通人备忘录：{page_date(soup, slug)}"
        cover = None
        if kind == "articles":
            cover = cover_from(soup, images, referer)
        ordered.append(
            {
                "slug": slug,
                "url": url,
                "title": title,
                "date": page_date(soup, slug),
                "excerpt": meta_content(soup, "description") or title,
                "tags": page_tags(soup),
                "body": body,
                "cover": cover,
                "order": index,
            }
        )
    return ordered


def write_articles(articles: list[dict]) -> dict:
    """Write each source article once, at the yost-pt.top slug.

    Older files with the same title are deleted. Their `/posts/<slug>`
    addresses are recorded as permanent redirects to `/articles/<slug>`.
    """
    posts = read_posts()
    by_norm: dict[str, list[dict]] = defaultdict(list)
    for post in posts:
        by_norm[post["norm"]].append(post)
    used_slugs = {post["slug"] for post in posts}
    redirects = load_redirects()
    updated, created = [], []
    for article in articles:
        key = norm_title(article["title"])
        matches = by_norm.get(key, [])
        if not matches and "\ufffd" in article["title"]:
            matches = [
                post
                for group in by_norm.values()
                for post in group
                if titles_compatible(article["title"], post["title"])
            ]
        cover = article["cover"]
        title = article["title"]
        if matches and "\ufffd" in title:
            title = matches[0]["title"]
        slug = article["slug"]
        if any(post["slug"] == slug for post in matches):
            pass
        elif slug in used_slugs:
            slug = f"{slug}-yost"
        category = infer_category(title, article["tags"])
        thumb = cover
        kept_cover = cover
        if matches:
            donor = next((post for post in matches if post["slug"] == slug), matches[0])
            if donor["category"] in CATEGORIES:
                category = donor["category"]
            thumb = cover or donor["thumb"]
            kept_cover = cover or donor["cover"]
        meta = {
            "title": title.replace("\ufffd", "") if not matches else title,
            "date": article["date"],
            "category": category,
            "excerpt": article["excerpt"],
            "tags": article["tags"],
            "thumb": thumb,
            "cover": kept_cover,
            "order": article["order"],
            "featured": True,
            "alias": None,
        }
        canonical = POSTS_DIR / f"{slug}.md"
        canonical.write_text(dump_markdown(meta, article["body"]), encoding="utf-8")
        used_slugs.add(slug)
        removed = []
        for post in matches:
            if post["path"].resolve() == canonical.resolve():
                continue
            record_redirect(redirects, f"/posts/{post['slug']}", f"/articles/{slug}")
            post["path"].unlink()
            used_slugs.discard(post["slug"])
            removed.append(post["slug"])
        row = {"title": article["title"], "slug": slug, "removed": removed}
        if matches:
            updated.append(row)
        else:
            created.append(row)
        if removed:
            print(f"  dropped {len(removed)} older copies of「{article['title']}」", flush=True)
    save_redirects(redirects)
    return {"updated": updated, "created": created}


def load_redirects() -> dict[str, str]:
    if not REDIRECTS_PATH.exists():
        return {}
    data = json.loads(REDIRECTS_PATH.read_text(encoding="utf-8"))
    return {str(key): str(value) for key, value in data.items()}


def save_redirects(table: dict[str, str]) -> None:
    live = set()
    for post in read_posts():
        live.add(f"/posts/{post['slug']}")
        live.add(f"/posts/{post['slug']}.html")
    cleaned = {source: dest for source, dest in table.items() if source not in live and source != dest}
    REDIRECTS_PATH.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def record_redirect(table: dict[str, str], source: str, dest: str) -> None:
    if not source or source == dest:
        return
    table[source] = dest
    if source.startswith("/posts/") and not source.endswith(".html"):
        table[f"{source}.html"] = dest


def completeness(path: Path) -> tuple[int, int, int]:
    raw = path.read_text(encoding="utf-8")
    body = raw.split("---", 2)[-1] if raw.startswith("---") else raw
    images = len(re.findall(r"!\[[^\]]*\]\([^)]+\)", body))
    return (len(body), images, len(raw))


def strip_alias(text: str) -> str:
    return re.sub(r"\nalias:\s*.+\n", "\n", text, count=1)


def post_public_path(post: dict) -> str:
    front = post["path"].read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", front, re.S)
    fm = match.group(1) if match else ""
    featured = re.search(r"^featured:\s*true\s*$", fm, re.M) is not None
    alias = fm_field(fm, "alias")
    if featured:
        return f"/articles/{alias or post['slug']}"
    return f"/posts/{post['slug']}"


def dedupe_posts() -> dict:
    """One Markdown file per title. Keep the yost-pt.top slug when the post
    came from that site; otherwise keep the longest copy."""
    before = len(list(POSTS_DIR.glob("*.md")))
    redirects = load_redirects()
    renamed = []

    for post in read_posts():
        front = post["path"].read_text(encoding="utf-8")
        match = re.match(r"^---\n(.*?)\n---\n", front, re.S)
        fm = match.group(1) if match else ""
        if not re.search(r"^featured:\s*true\s*$", fm, re.M):
            continue
        alias = fm_field(fm, "alias")
        if not alias or alias == post["slug"]:
            continue
        dest = POSTS_DIR / f"{alias}.md"
        if dest.exists() and dest.resolve() != post["path"].resolve():
            print(f"  warn: cannot rename {post['slug']} to {alias}, file exists", flush=True)
            continue
        dest.write_text(strip_alias(front), encoding="utf-8")
        record_redirect(redirects, f"/posts/{post['slug']}", f"/articles/{alias}")
        post["path"].unlink()
        renamed.append({"from": post["slug"], "to": alias, "title": post["title"]})

    groups: dict[str, list[dict]] = defaultdict(list)
    for post in read_posts():
        groups[post["norm"]].append(post)

    merged = []
    for posts in groups.values():
        if len(posts) < 2:
            continue
        featured = [post for post in posts if _is_featured(post)]
        if featured:
            keeper = featured[0]
            reason = "yost-pt.top"
        else:
            keeper = max(posts, key=lambda post: (*completeness(post["path"]), -len(post["slug"])))
            reason = "最完整"
        removed = []
        dest = post_public_path(keeper)
        for post in posts:
            if post["path"].resolve() == keeper["path"].resolve():
                continue
            record_redirect(redirects, f"/posts/{post['slug']}", dest)
            post["path"].unlink()
            removed.append(post["slug"])
        merged.append(
            {
                "title": keeper["title"],
                "kept": keeper["slug"],
                "kept_url": dest,
                "reason": reason,
                "removed": removed,
            }
        )
        print(f"  merge「{keeper['title']}」keep {keeper['slug']} ({reason}), drop {len(removed)}", flush=True)

    save_redirects(redirects)
    rewrite_removed_links(redirects)
    relink_about()
    memo_note = memo_overlap()
    after = len(list(POSTS_DIR.glob("*.md")))
    report_path = ROOT / "content" / "dedupe-report.json"
    prior: dict = {}
    if report_path.exists():
        try:
            prior = json.loads(report_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            prior = {}
    renamed = _merge_rows(prior.get("renamed_to_yost_slug") or [], renamed, "from")
    merged = _merge_rows(prior.get("merged") or [], merged, "title")
    stored_before = prior.get("articles_before")
    articles_before = stored_before if isinstance(stored_before, int) else before
    report = {
        "articles_before": articles_before,
        "articles_after": after,
        "renamed_to_yost_slug": renamed,
        "merged": merged,
        "memos": memo_note,
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"dedupe: {before} -> {after} articles, {len(merged)} groups, {len(renamed)} yost renames",
        flush=True,
    )
    return report


def _merge_rows(prior: list, current: list, key: str) -> list:
    rows = [row for row in prior if isinstance(row, dict) and key in row]
    seen = {row[key] for row in rows}
    for row in current:
        if row.get(key) not in seen:
            rows.append(row)
            seen.add(row[key])
    return rows


def _is_featured(post: dict) -> bool:
    front = post["path"].read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", front, re.S)
    fm = match.group(1) if match else ""
    return re.search(r"^featured:\s*true\s*$", fm, re.M) is not None


def rewrite_removed_links(redirects: dict[str, str]) -> None:
    sources = [(source, dest) for source, dest in redirects.items() if not source.endswith(".html")]
    # Longer paths first so `/posts/b` cannot clobber `/posts/b0-…`.
    sources.sort(key=lambda item: len(item[0]), reverse=True)
    if not sources:
        return
    for path in list(POSTS_DIR.glob("*.md")) + list(MEMOS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        updated = text
        for source, dest in sources:
            updated = updated.replace(source, dest)
        if updated != text:
            path.write_text(updated, encoding="utf-8")


def relink_about() -> None:
    script_path = ABOUT_DIR / "boot.js"
    if not script_path.exists():
        return
    script = script_path.read_text(encoding="utf-8")
    match = re.search(r"const ARTS = (\[.*?\]);\n", script, re.S)
    if not match:
        return
    arts = json.loads(match.group(1))
    index = local_index()
    linked = 0
    for article in arts:
        path = index.get(norm_title(article.get("t", "")))
        if path:
            article["local"] = path
            linked += 1
        else:
            article.pop("local", None)
    script = (
        script[: match.start(1)]
        + json.dumps(arts, ensure_ascii=False, separators=(",", ":"))
        + script[match.end(1) :]
    )
    script_path.write_text(script, encoding="utf-8")
    print(f"  about links refreshed {linked}/{len(arts)}", flush=True)


def memo_overlap() -> dict:
    post_titles = {post["norm"] for post in read_posts()}
    post_hashes = set()
    for path in POSTS_DIR.glob("*.md"):
        body = path.read_text(encoding="utf-8").split("---", 2)[-1]
        post_hashes.add(hashlib.sha1(norm_title(body).encode()).hexdigest())
    same_title = []
    same_body = []
    if MEMOS_DIR.exists():
        for path in MEMOS_DIR.glob("*.md"):
            raw = path.read_text(encoding="utf-8")
            match = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
            fm, body = (match.group(1), match.group(2)) if match else ("", raw)
            title = fm_field(fm, "title") or path.stem
            if norm_title(title) in post_titles:
                same_title.append(path.stem)
            digest = hashlib.sha1(norm_title(body).encode()).hexdigest()
            if digest in post_hashes:
                same_body.append(path.stem)
    return {"same_title": same_title, "same_body": same_body}


def write_memos(memos: list[dict]) -> int:
    MEMOS_DIR.mkdir(parents=True, exist_ok=True)
    for memo in memos:
        meta = {
            "title": memo["title"],
            "date": memo["date"],
            "excerpt": memo["excerpt"],
            "tags": memo["tags"],
            "order": memo["order"],
        }
        (MEMOS_DIR / f"{memo['slug']}.md").write_text(dump_markdown(meta, memo["body"]), encoding="utf-8")
    return len(memos)


def scope_css(css: str, scope: str = ".me-page") -> str:
    """Prefix every selector with `.me-page` so the about page CSS cannot leak."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out: list[str] = []
    i = 0
    n = len(css)

    def prefix(selector: str) -> str:
        rewritten = []
        for part in split_selectors(selector):
            sel = part.strip()
            if not sel:
                continue
            if sel.startswith(scope):
                rewritten.append(sel)
            elif sel in {"html", "body"}:
                rewritten.append(scope)
            elif sel.startswith(":root"):
                rewritten.append(scope + sel[5:])
            elif sel.startswith("html ") or sel.startswith("body "):
                rewritten.append(scope + sel[sel.find(" ") :])
            else:
                rewritten.append(f"{scope} {sel}")
        return ", ".join(rewritten)

    def copy_balanced() -> None:
        nonlocal i
        start = i
        while i < n and css[i] != "{":
            i += 1
        depth = 0
        while i < n:
            if css[i] == "{":
                depth += 1
            elif css[i] == "}":
                depth -= 1
                if depth == 0:
                    i += 1
                    break
            i += 1
        out.append(css[start:i])

    def parse_rules(stop: str | None) -> None:
        nonlocal i
        while i < n:
            while i < n and css[i] in " \t\r\n":
                out.append(css[i])
                i += 1
            if i >= n:
                return
            if stop and css[i] == stop:
                return
            if css.startswith("@keyframes", i) or css.startswith("@-webkit-keyframes", i):
                copy_balanced()
                continue
            if css[i] == "@":
                start = i
                while i < n and css[i] != "{":
                    i += 1
                out.append(css[start:i] + "{")
                i += 1
                parse_rules("}")
                out.append("}")
                if i < n and css[i] == "}":
                    i += 1
                continue
            start = i
            while i < n and css[i] != "{":
                i += 1
            out.append(prefix(css[start:i]) + "{")
            i += 1
            depth = 1
            body = i
            while i < n and depth:
                if css[i] == "{":
                    depth += 1
                elif css[i] == "}":
                    depth -= 1
                if depth:
                    i += 1
            out.append(css[body:i])
            out.append("}")
            if i < n and css[i] == "}":
                i += 1

    parse_rules(None)
    return "".join(out)


def split_selectors(selector: str) -> list[str]:
    parts = []
    buf = []
    depth = 0
    for char in selector:
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        if char == "," and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(char)
    parts.append("".join(buf))
    return parts


def import_about(posts_index: dict[str, str]) -> None:
    print("about page…", flush=True)
    html = fetch_text(f"{ORIGIN}/me")
    soup = BeautifulSoup(html, "html.parser")
    style = soup.find("style")
    if style is None or style.string is None:
        raise RuntimeError("about page has no style")
    scoped = scope_css(style.string)
    (ROOT / "app" / "me" / "about.css").write_text(scoped + "\n", encoding="utf-8")

    main = soup.find("main", id="top")
    footer = soup.find("footer")
    tip = soup.find(id="tip")
    if main is None:
        raise RuntimeError("about main missing")
    chunk = str(main)
    if footer:
        chunk += "\n" + str(footer)
    if tip:
        chunk += "\n" + str(tip)

    images = ImageStore(ME_DIR, "/assets/me")
    urls = set(re.findall(r"/assets/me/[A-Za-z0-9._-]+", chunk))
    script_tag = soup.find("script")
    script = script_tag.string if script_tag and script_tag.string else ""
    urls.update(re.findall(r"/assets/me/[A-Za-z0-9._-]+", script))
    print(f"  {len(urls)} about images", flush=True)
    for url in sorted(urls):
        local = images.local(ORIGIN + url, ORIGIN + "/me")
        if not local:
            continue
        # ImageStore names by hash; rewrite to the original filename so the
        # embedded HTML and script keep working without a second pass.
        target = ME_DIR / url.rsplit("/", 1)[-1]
        hashed = ROOT / "public" / local.lstrip("/")
        if hashed.exists():
            target.write_bytes(hashed.read_bytes())
            hashed.unlink()

    # Download sspai thumbs referenced as `b` and point them at local files.
    b_urls = sorted(set(re.findall(r"https://cdnfile\.sspai\.com/[^\"\\]+", script)))
    sspai = ImageStore(ME_DIR, "/assets/me")
    print(f"  {len(b_urls)} sspai thumbs", flush=True)
    for url in b_urls:
        local = sspai.local(url, "https://sspai.com/")
        if not local:
            continue
        script = script.replace(url, local)

    local_map = posts_index
    script = script.replace(
        "const links=[a.u?`<a href=\"${esc(a.u)}\" target=\"_blank\" rel=\"noopener\">在公众号读全文 ↗</a>`:'',a.s?`<a href=\"${esc(a.s)}\" target=\"_blank\" rel=\"noopener\">在少数派读 ↗</a>`:''].join('');",
        "const links=[a.local?`<a href=\"${esc(a.local)}\">在本站阅读</a>`:'',a.u?`<a href=\"${esc(a.u)}\" target=\"_blank\" rel=\"noopener\">在公众号读全文 ↗</a>`:'',a.s?`<a href=\"${esc(a.s)}\" target=\"_blank\" rel=\"noopener\">在少数派读 ↗</a>`:''].join('');",
    )
    # Attach local paths onto ARTS entries by normalized title.
    match = re.search(r"const ARTS = (\[.*?\]);\n", script, re.S)
    if not match:
        raise RuntimeError("ARTS payload missing")
    arts = json.loads(match.group(1))
    linked = 0
    for article in arts:
        path = local_map.get(norm_title(article.get("t", "")))
        if path:
            article["local"] = path
            linked += 1
    script = script[: match.start(1)] + json.dumps(arts, ensure_ascii=False, separators=(",", ":")) + script[match.end(1) :]
    print(f"  linked {linked}/{len(arts)} archive titles to local posts", flush=True)

    ABOUT_DIR.mkdir(parents=True, exist_ok=True)
    (ABOUT_DIR / "main.html").write_text(chunk, encoding="utf-8")
    (ABOUT_DIR / "boot.js").write_text(script, encoding="utf-8")

    # Favicon and the footer QR live with the rest of the site chrome.
    (ROOT / "public" / "favicon.png").write_bytes(fetch(ORIGIN + "/assets/favicon.png"))
    (ROOT / "public" / "qrcode.jpg").write_bytes(fetch(ORIGIN + "/assets/qrcode.jpg"))
    if images.failures or sspai.failures:
        print("  image failures", len(images.failures) + len(sspai.failures), flush=True)


def local_index() -> dict[str, str]:
    index = {}
    for post in read_posts():
        fm = post["path"].read_text(encoding="utf-8")
        match = re.match(r"^---\n(.*?)\n---\n", fm, re.S)
        front = match.group(1) if match else ""
        featured = re.search(r"^featured:\s*true\s*$", front, re.M) is not None
        alias = fm_field(front, "alias")
        if featured:
            path = f"/articles/{alias or post['slug']}"
        else:
            path = f"/posts/{post['slug']}"
        index[post["norm"]] = path
    return index


def main() -> int:
    parser = argparse.ArgumentParser(description="Import yost-pt.top content")
    parser.add_argument("--only", choices=["articles", "memos", "about", "dedupe", "all"], default="all")
    args = parser.parse_args()
    images = ImageStore(IMAGE_DIR, "/images/yost")
    report_path = ROOT / "content" / "import-report.json"
    report: dict = {}
    if args.only != "all" and report_path.exists():
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            report = {}
    if args.only in {"articles", "all"}:
        articles = import_pages("articles", images)
        report["articles"] = write_articles(articles)
        print(
            f"articles: {len(articles)} source, {len(report['articles']['updated'])} updated, {len(report['articles']['created'])} created",
            flush=True,
        )
        for row in report["articles"]["created"]:
            print(f"  new: {row['slug']}  {row['title']}", flush=True)
    if args.only in {"memos", "all"}:
        memos = import_pages("memos", images)
        report["memos"] = write_memos(memos)
        print(f"memos: {report['memos']}", flush=True)
    if args.only in {"about", "all"}:
        import_about(local_index())
    if args.only in {"articles", "dedupe", "all"}:
        report["dedupe"] = dedupe_posts()
    if images.failures:
        print(f"image failures: {len(images.failures)}", flush=True)
        for failure in images.failures[:12]:
            print(" ", failure[:180], flush=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("done", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
