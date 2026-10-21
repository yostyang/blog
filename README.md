# 约斯特普通

一个普通中年男人的电车、跑步、生活与成长记录。站点用 Next.js（App Router）静态生成。版式是浅纸色底、墨蓝字和蓝色链接，导航是首页、文章、搜索。

仓库里原来的静态导出共 **175** 篇独立文章（旧 README 按专题加总写成 179，和实际 HTML 对不上）。这 175 篇已全部迁到 `content/posts`，配图和头像都在。

| 专题 | 篇数 |
| --- | --- |
| 电车出行 | 26 |
| 跑步 | 27 |
| 中年成长 | 28 |
| 生活随笔 | 94 |

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

`npm run build` 会预渲染首页、文章列表、搜索页、4 个专题页、标签页和全部文章页。

## 目录

```
app/                  路由：首页、文章列表、专题、标签、文章、搜索、RSS、sitemap
components/           导航、文章列表、正文、目录、搜索
content/posts/*.md    文章（Markdown + frontmatter）
lib/                  读取文章与站点配置
public/avatar.jpg     头像
public/images/        正文配图
public/images/thumbs/ 列表缩略图
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
- `tags` 可选。写了之后，列表和文首标签会链到 `/tag/标签名`。

保存后重新跑 `npm run dev` 或 `npm run build` 即可。首页「最新文章」会带上这篇，不用改页面代码。

## 部署到 Vercel

1. 把仓库推到 GitHub。
2. 在 Vercel 里 Import 这个仓库。框架选 Next.js，构建命令 `npm run build`，输出目录保持默认（不要改成静态导出目录）。
3. 可选：设置环境变量 `NEXT_PUBLIC_SITE_URL` 为正式域名，例如 `https://example.com`（不要末尾斜杠）。RSS、sitemap 和分享卡片会用它做绝对地址。不设置时，Vercel 会退回到本次部署的域名。

部署完成后这些地址可用：

- `/` 首页
- `/articles` 全部文章，可用专题筛选
- `/category/电车出行` 等专题页
- `/search` 搜索
- `/posts/文章文件名` 文章页（文末有上一篇、下一篇）
- `/rss.xml` 订阅
- `/sitemap.xml` 站点地图

旧静态站的 `/index.html` 和 `/posts/某篇.html` 会 308 到新地址。
