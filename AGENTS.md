<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Versions

Every PR that changes the site bumps `package.json` and adds a matching entry at the top of `CHANGELOG.md`. Use `npm run release -- patch|minor|major "说明"`. Content-only daily memo imports bump `patch`. Do not create the git tag in the PR.

After the squash-merge to `main`, tag that merge commit `vX.Y.Z` and publish a GitHub Release from the changelog entry. Production is a manual deployment of that commit on the Vercel project `yost-blog` (the repo is not Git-connected). To roll back, redeploy the commit of the previous tag to production.
