# 约斯特普通

7 年插混车主转纯电。站点用 Next.js（App Router）静态生成，正式域名是 https://yostyang.com 。版式是浅纸色底、墨蓝字和蓝色链接。导航是首页、文章、备忘录、关于我、搜索。

正文分两层：

- **推荐文章**（`featured: true`）来自 https://yost-pt.top/ 的 20 篇长文，地址是 `/articles/<slug>`，文件名就是源站 slug。首页「推荐阅读」只放这些。
- **归档**是其余长文，地址是 `/posts/<文件名>`。`/articles` 按发布时间倒序列出全部公开文章，不看 `featured`。同一标题只留一份：有 yost-pt.top 版本时留那一版并删掉旧副本，否则留正文最完整的一份。删掉的地址记在 `content/redirects.json`，永久跳到留下来的那篇。`draft`、`hidden`、`duplicate` 为 true 的稿，以及公开地址本身就在跳转表里的稿，不进列表。
- **备忘录**在 `content/memos/`，大约每天一篇，地址是 `/articles/memo-YYYY-MM-DD`，日历和话题筛选在 `/memo`。

从源站重新拉正文、配图和关于我页面：

```bash
python3 scripts/import-yost.py
python3 scripts/import-yost.py --only articles
python3 scripts/import-yost.py --only memos
python3 scripts/import-yost.py --only about
python3 scripts/import-yost.py --only dedupe
```

少数派上还没进站的文章（每周可再跑，已导入的和重复的都会跳过）：

```bash
python3 scripts/sync-sspai.py
```

微信图床的图会经源站 `/api/import` 转存到 `public/images/yost/`。少数派配图在 `public/images/sspai/`。关于我页面的图在 `public/assets/me/`。

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

`npm run build` 会先跑 `npm test`。检查不过，构建就停。检查确认 `/articles` 列出的就是全部公开文章，首页「全部 N 篇文章」用的是同一个数，`/memo` 的天数等于 `content/memos` 里的文件数。通过之后预渲染首页、文章列表、备忘录、关于我、搜索页、4 个专题页、标签页、全部文章和全部备忘录。

## 目录

```
app/                  路由：首页、文章、备忘录、关于我、专题、标签、搜索、RSS、sitemap
components/           导航、文章列表、备忘录日历、正文、目录、搜索
content/posts/*.md    文章（Markdown + frontmatter）
content/memos/*.md    产业与普通人备忘录
content/about/        关于我页面的 HTML 和脚本
lib/                  读取文章、备忘录与站点配置；catalog 是文章和备忘录索引
CHANGELOG.md          版本说明
public/avatar.jpg     头像
public/favicon.png    站点图标
public/qrcode.jpg     页脚公众号二维码
public/images/        正文配图
public/images/yost/   从 yost-pt.top 转存的配图
public/assets/me/     关于我页面的配图
scripts/import-yost.py  从 yost-pt.top 导入内容
scripts/import-memo.py  导入一天的备忘录
scripts/release.mjs     升版本并写入更新日志
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
- `tags` 可选。文章上的标签筛到 `/articles?tag=`。`/tag/标签名` 仍在，给旧链接和站点地图。
- 可选 `featured: true` 把文章放进首页「推荐阅读」，公开地址是 `/articles/<文件名>`。如果另外写了 `alias`，这段地址改用 alias。`/articles` 索引不看这个标记。

保存后重新跑 `npm run dev` 或 `npm run build` 即可。

## 版本

当前版本在 `package.json` 的 `version`，说明写在 `CHANGELOG.md`。页脚有一行小号的 `vX.Y.Z`，用来看线上是哪一版。

改动站点的 PR 都要升版本。只导入一天备忘录时升 patch：

```bash
npm run release -- patch "导入 2026-11-05 的备忘录"
npm run release -- minor "说明"
npm run release -- major "说明"
```

脚本会改 `package.json`、`package-lock.json` 里的版本号，并在 `CHANGELOG.md` 顶部加一节。它不提交，也不打标签。

### 发布

这个仓库没有连接 Vercel 的 Git。PR squash-merge 到 `main` 之后：

1. 在合并提交上打标签，名字是 `v` 加版本号，例如 `v1.1.0`。
2. 用这一版的更新日志建一个 GitHub Release。
3. 在 Vercel 项目 **yost-blog** 里，用这个提交手动创建 Production Deployment。框架选 Next.js，构建命令 `npm run build`，输出目录保持默认。可选环境变量 `NEXT_PUBLIC_SITE_URL`（不要末尾斜杠）。不设置时 RSS 和 sitemap 用 https://yostyang.com 。

```bash
git checkout main
git pull
git tag v1.1.0
git push origin v1.1.0
gh release create v1.1.0 --title "v1.1.0" --notes "贴上 CHANGELOG 里这一节"
```

### 回滚

生产环境是某一次提交的部署。要回到上一版，找到上一个标签（例如 `v1.0.0`）指向的提交，在 Vercel 项目 yost-blog 里用那个提交重新部署到 Production。不要靠改写 Git 历史来回滚。

这些地址可用：

- `/` 首页：推荐阅读、本周备忘录、按话题读
- `/articles` 全部文章，可用 `?tag=` 筛选
- `/memo` 备忘录日历，可用 `?tag=` 筛选
- `/articles/memo-YYYY-MM-DD` 某一天的备忘录
- `/me` 关于我（`/about` 会 308 到这里）
- `/category/电车出行` 等专题页（含归档）
- `/search` 搜索文章和备忘录
- `/posts/文章文件名` 归档文章，推荐文章也会在这里打开，规范地址是 `/articles/`
- `/rss.xml` 订阅
- `/sitemap.xml` 站点地图

旧静态站的 `/index.html` 和 `/posts/某篇.html` 会 308 到新地址。去重删掉的旧 slug（含 `.html`）也会 308 到保留下来的那一篇。
