# 约斯特普通

7 年插混车主转纯电。站点用 Next.js（App Router）静态生成，正式域名是 https://yostyang.com 。版式是浅纸色底、墨蓝字和蓝色链接。导航是首页、文章、备忘录、关于我、搜索。

正文分两层：

- **推荐文章**（`featured: true`）来自 https://yost-pt.top/ 的 20 篇长文，地址是 `/articles/<slug>`，文件名就是源站 slug。
- **归档**是其余长文，地址是 `/posts/<文件名>`。同一标题只留一份：有 yost-pt.top 版本时留那一版并删掉旧副本，否则留正文最完整的一份。删掉的地址记在 `content/redirects.json`，永久跳到留下来的那篇。
- **备忘录**在 `content/memos/`，大约每天一篇，地址是 `/articles/memo-YYYY-MM-DD`，日历和话题筛选在 `/memo`。

从源站重新拉正文、配图和关于我页面：

```bash
python3 scripts/import-yost.py
python3 scripts/import-yost.py --only articles
python3 scripts/import-yost.py --only memos
python3 scripts/import-yost.py --only about
python3 scripts/import-yost.py --only dedupe
```

微信图床的图会经源站 `/api/import` 转存到 `public/images/yost/`。关于我页面的图在 `public/assets/me/`。

## 本地运行

需要 Node.js 20 或更新版本。

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:3000 。

生产构建：

```bash
npm run build
npm start
```

`npm run build` 会预渲染首页、文章列表、备忘录、关于我、搜索页、4 个专题页、标签页、全部文章和全部备忘录。

## 目录

```
app/                  路由：首页、文章、备忘录、关于我、专题、标签、搜索、RSS、sitemap
components/           导航、文章列表、备忘录日历、正文、目录、搜索
content/posts/*.md    文章（Markdown + frontmatter）
content/memos/*.md    产业与普通人备忘录
content/about/        关于我页面的 HTML 和脚本
lib/                  读取文章、备忘录与站点配置
public/avatar.jpg     头像
public/favicon.png    站点图标
public/qrcode.jpg     页脚公众号二维码
public/images/        正文配图
public/images/yost/   从 yost-pt.top 转存的配图
public/assets/me/     关于我页面的配图
scripts/import-yost.py  从 yost-pt.top 导入内容
```

## 新增一篇文章

在 `content/posts/` 新建一个 `.md` 文件。文件名就是网址，例如 `content/posts/my-new-post.md` 对应 `/posts/my-new-post`。文件名请使用字母、数字、中文和连字符，不要带空格或斜杠。

```md
---
title: "文章标题"
date: "2026-10-21"
category: "生活随笔"
excerpt: "列表和搜索里显示的摘要，一两句话即可。"
tags:
  - "示例"
thumb: "/images/thumbs/sm_example.jpg"
cover: "/images/thumbs/sm_example.jpg"
---

正文用 Markdown 来写。

![](/images/example.jpg)
```

- `category` 只能是 `电车出行`、`跑步`、`中年成长`、`生活随笔` 之一。要增加专题，改 `lib/categories.ts`。
- `date` 用引号包住的 `YYYY-MM-DD`。同一天有多篇时，可以用可选字段 `order`（数字越小越靠前）固定顺序。不写 `order` 时，新文章会排在同一天已有文章的前面。
- 图片放到 `public/images/`，文中写成 `/images/文件名.jpg`。`thumb` 是列表右侧缩略图，`cover` 用于分享卡片；没有配图时这两个字段可以不写。
- `tags` 可选。归档文章的标签链到 `/tag/标签名`。推荐文章（`featured: true`）的标签链到 `/articles?tag=`。
- 可选 `featured: true` 把文章放进首页「推荐阅读」和 `/articles`，公开地址是 `/articles/<文件名>`。如果另外写了 `alias`，这段地址改用 alias。

保存后重新跑 `npm run dev` 或 `npm run build` 即可。

## 部署到 Vercel

1. 把仓库推到 GitHub。
2. 在 Vercel 里 Import 这个仓库。框架选 Next.js，构建命令 `npm run build`，输出目录保持默认（不要改成静态导出目录）。
3. 可选：设置环境变量 `NEXT_PUBLIC_SITE_URL`（不要末尾斜杠）。RSS 和 sitemap 会用它做绝对地址。不设置时使用 https://yostyang.com 。

这些地址可用：

- `/` 首页：推荐阅读、本周备忘录、按话题读
- `/articles` 推荐文章，可用 `?tag=` 筛选
- `/memo` 备忘录日历，可用 `?tag=` 筛选
- `/articles/memo-YYYY-MM-DD` 某一天的备忘录
- `/me` 关于我（`/about` 会 308 到这里）
- `/category/电车出行` 等专题页（含归档）
- `/search` 搜索文章和备忘录
- `/posts/文章文件名` 归档文章，推荐文章也会在这里打开，规范地址是 `/articles/`
- `/rss.xml` 订阅
- `/sitemap.xml` 站点地图

旧静态站的 `/index.html` 和 `/posts/某篇.html` 会 308 到新地址。去重删掉的旧 slug（含 `.html`）也会 308 到保留下来的那一篇。
