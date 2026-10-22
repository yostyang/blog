#!/usr/bin/env python3
"""Sync the owner's WeChat 公众号「约斯特普通」 articles into content/posts.

Input: appmsgpublish list responses saved from the mp.weixin.qq.com backend
(list_*.json, each with a JSON-string publish_page). Only normal articles
(item_show_type 0, not deleted) are considered; 图片消息/video posts are skipped.
Each article's public https://mp.weixin.qq.com/s/... page is fetched and
#js_content is converted to Markdown. Images go to public/images/wechat/.

Idempotent: synced and skipped ids are recorded in content/wechat-sync.json,
and files named wechat-<appmsgid>-<idx>.md are never rewritten.

Dedupe reuses the strict rules in scripts/sync-sspai.py (title or body match,
retitles included) against every post and memo, plus earlier WeChat imports.
Existing posts always win; nothing is ever deleted.

Usage:
  python3 scripts/sync-wechat.py --lists /path/to/lists [--dry-run]
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import importlib.util
import json
import re
import time
import unicodedata
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from bs4 import BeautifulSoup, Tag

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("sspai", ROOT / "scripts" / "sync-sspai.py")
S = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(S)

POSTS_DIR = S.POSTS_DIR
IMAGE_DIR = ROOT / "public" / "images" / "wechat"
STATE_PATH = ROOT / "content" / "wechat-sync.json"
CACHE_DIR = ROOT / ".cache" / "wechat"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
BLOCK = {"p", "section", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote", "figure", "hr", "table"}


def fetch(url: str, referer: str | None = None, timeout: int = 40, tries: int = 4) -> bytes:
    headers = {"User-Agent": UA}
    if referer:
        headers["Referer"] = referer
    last = None
    for attempt in range(tries):
        try:
            with S.urlopen(S.Request(url, headers=headers), timeout=timeout) as res:
                return res.read()
        except Exception as err:  # noqa: BLE001
            last = err
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"fetch failed {url}: {last}")


class Images:
    def __init__(self) -> None:
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        self.failures: list[str] = []

    def local(self, url: str, referer: str) -> str | None:
        url = (url or "").strip().replace("&amp;", "&")
        if not url.startswith("http"):
            return None
        digest = hashlib.sha1(url.split("?")[0].encode()).hexdigest()[:16]
        found = list(IMAGE_DIR.glob(f"{digest}.*"))
        if found:
            return f"/images/wechat/{found[0].name}"
        try:
            data = fetch(url, referer="https://mp.weixin.qq.com/", timeout=20, tries=2)
        except Exception as err:  # noqa: BLE001
            self.failures.append(f"{url} ({err})")
            return None
        ext = S.sniff_ext(data, url)
        if not ext or len(data) < 32:
            fmt = re.search(r"wx_fmt=(\w+)", url)
            ext = {"jpeg": ".jpg", "png": ".png", "gif": ".gif", "webp": ".webp"}.get(fmt.group(1) if fmt else "", None) if data[:1] != b"<" else None
        if not ext:
            self.failures.append(f"{url} (not an image)")
            return None
        path = IMAGE_DIR / f"{digest}{ext}"
        path.write_bytes(data)
        return f"/images/wechat/{path.name}"


class Converter(S.Converter):
    def convert_root(self, root: Tag) -> str:
        text = "".join(self.walk(child) for child in root.children if isinstance(child, Tag))
        return re.sub(r"\n{3,}", "\n\n", text).strip()

    def walk(self, el: Tag) -> str:
        if el.name in {"script", "style", "mpvoice", "iframe", "mp-common-profile", "mpvideosnap", "svg"}:
            return ""
        if el.name in {"section", "div"} and el.find(BLOCK - {"hr"}):
            return "".join(self.walk(c) for c in el.children if isinstance(c, Tag)) + (
                "" if el.find(BLOCK - {"hr"}, recursive=False) else ""
            )
        if el.name in {"section", "div", "p"} and el.find(["section", "div", "p"]):
            return "".join(self.walk(c) for c in el.children if isinstance(c, Tag))
        if el.name in {"h5", "h6"}:
            return self.heading(el, 3)
        if el.name not in BLOCK and el.name != "img":
            return self.paragraph(el)
        return self.block(el)

    def image(self, img):
        if img is None:
            return ""
        url = img.get("data-src") or img.get("src") or ""
        local = self.images.local(url, self.referer)
        if not local:
            return ""
        alt = re.sub(r"\s+", " ", img.get("alt") or "").strip()
        return f"![{alt}]({local})\n\n"


def list_items(lists_dir: str) -> tuple[list[dict], list[dict]]:
    items: dict[str, dict] = {}
    other: list[dict] = []
    for name in sorted(glob.glob(str(Path(lists_dir) / "list_*.json"))):
        data = json.loads(Path(name).read_text(encoding="utf-8"))
        page = json.loads(data["publish_page"]) if isinstance(data.get("publish_page"), str) else data.get("publish_page") or {}
        for entry in page.get("publish_list") or []:
            info = json.loads(entry["publish_info"]) if entry.get("publish_info") else {}
            for art in info.get("appmsgex") or []:
                row = {
                    "id": f"{art['appmsgid']}-{art['itemidx']}",
                    "title": re.sub(r"\s+", " ", art.get("title") or "").strip(),
                    "link": art.get("link"),
                    "create_time": art.get("create_time") or art.get("update_time"),
                    "cover": art.get("cover"),
                    "digest": art.get("digest") or "",
                }
                if art.get("is_deleted") or art.get("item_show_type", 0) != 0:
                    row["reason"] = "deleted" if art.get("is_deleted") else f"not an article (item_show_type {art.get('item_show_type')})"
                    other.append(row)
                    continue
                items[row["id"]] = row
    ordered = sorted(items.values(), key=lambda r: r["create_time"])  # oldest first: originals win inside WeChat
    return ordered, other


def page_html(item: dict) -> str:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{item['id']}.html"
    if path.exists() and path.stat().st_size > 1000:
        return path.read_text(encoding="utf-8")
    html = fetch(item["link"]).decode("utf-8", "replace")
    path.write_text(html, encoding="utf-8")
    time.sleep(1.5)
    return html


def footer(title: str, link: str) -> str:
    return f"\n\n---\n\n原文发布于微信公众号「约斯特普通」：[{title}]({link})。"


def dump(meta: dict, body: str) -> str:
    text = S.dump_markdown({**meta, "sspai": 0}, body)
    return text.replace("sspai: 0\n", f"wechat: {S.yaml_str(meta['wechat'])}\n")


def sync(lists_dir: str, dry_run: bool) -> None:
    items, other = list_items(lists_dir)
    state = json.loads(STATE_PATH.read_text(encoding="utf-8")) if STATE_PATH.exists() else {}
    known = {r["id"]: r for r in state.get("articles", [])}
    docs = S.load_locals()
    images = Images()
    added, skipped, failed = [], [], []
    for item in items:
        slug = f"wechat-{item['id']}"
        if item["id"] in known and known[item["id"]].get("status") in {"added", "skipped"}:
            continue
        if (POSTS_DIR / f"{slug}.md").exists():
            known[item["id"]] = {**item, "slug": slug, "status": "added"}
            continue
        try:
            html = page_html(item)
        except Exception as err:  # noqa: BLE001
            failed.append({**item, "reason": str(err)})
            continue
        soup = BeautifulSoup(html, "html.parser")
        root = soup.select_one("#js_content")
        if root is None or len(root.get_text(strip=True)) < 50 or "此内容发送失败无法查看" in soup.get_text():
            failed.append({**item, "reason": "no article body (deleted, blocked or non-article)"})
            continue
        title = "".join(ch for ch in item["title"] if unicodedata.category(ch) not in {"Cf", "Cc"})
        title_norm = S.norm_text(title)
        body_norm = S.norm_text(root.get_text(" ", strip=True))
        match = S.find_duplicate(title_norm, body_norm, docs)
        if match:
            row = {**item, "status": "skipped", "reason": "duplicate", **{k: match[k] for k in ("title_score", "body_score", "match_title", "match_path", "match_kind")}}
            skipped.append(row)
            known[item["id"]] = row
            print(f"  skip「{title}」≈ {match['match_kind']}「{match['match_title']}」 t{match['title_score']} b{match['body_score']}", flush=True)
            continue
        date = S.shanghai_date(item["create_time"])
        tags = S.collect_tags(title, [])
        category = S.infer_category(title, tags)
        body = ""
        cover = None
        if not dry_run:
            urls = [i.get("data-src") or i.get("src") or "" for i in root.find_all("img")]
            with ThreadPoolExecutor(8) as pool:
                list(pool.map(lambda u: images.local(u, item["link"]), urls))
            main = Converter(images, item["link"]).convert_root(root)
            body = main + footer(title, item["link"])
            cover = images.local(item["cover"], item["link"]) if item.get("cover") else None
            if not cover:
                first = re.search(r"!\[[^\]]*\]\((/images/wechat/[^)]+)\)", body)
                cover = first.group(1) if first else None
            meta = {"title": title, "date": date, "category": category,
                    "excerpt": (S.excerpt_from(main, item["digest"] or title) if re.search(r"[^\s!\[\]()/#>*-]", re.sub(r"!\[[^\]]*\]\([^)]*\)", "", main)) else (item["digest"] or title)), "tags": tags,
                    "thumb": cover, "cover": cover, "source": item["link"], "wechat": item["id"]}
            (POSTS_DIR / f"{slug}.md").write_text(dump(meta, body), encoding="utf-8")
        docs.append({"kind": "post", "path": f"content/posts/{slug}.md", "slug": slug, "title": title,
                     "title_norm": title_norm, "body_norm": body_norm, "shingles": S.shingles(body_norm), "sspai": None})
        row = {**item, "slug": slug, "date": date, "category": category, "status": "added"}
        added.append(row)
        known[item["id"]] = row
        print(f"  add  {slug} {date} {category} {title}", flush=True)
    report = {
        "source_total": len(items) + len(other),
        "added": added,
        "skipped_duplicates": skipped,
        "skipped_other": other + failed,
        "articles": sorted(known.values(), key=lambda r: r.get("create_time") or 0, reverse=True),
        "image_failures": images.failures,
    }
    if not dry_run:
        STATE_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wechat: {len(items)} articles, {len(added)} added, {len(skipped)} duplicates, {len(other) + len(failed)} other skipped, {len(images.failures)} image failures")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lists", required=True, help="folder with list_*.json from the 公众号 backend")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    sync(a.lists, a.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
