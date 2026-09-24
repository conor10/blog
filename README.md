# conorsvensson.com

Personal site built with [Astro](https://astro.build/). TypeScript, MDX, content collections, RSS, sitemap, dual-theme Shiki syntax highlighting. Deployed to GitHub Pages at [conorsvensson.com](https://conorsvensson.com).

## Local development

```sh
npm install
npm run dev
```

Preview the production build locally:

```sh
npm run build
npm run preview
```

In `dev` mode, draft posts are visible so you can iterate on them. They're excluded from `build` (and therefore from the live site, sitemap, and feed).

## Writing posts

Posts live in `src/content/writing/` as a folder per post. To add a new one:

1. Create a folder named `YYYY-MM-DD-post-slug/`, e.g. `src/content/writing/2026-04-22-context-windows/`.
2. Add an `index.md` inside it with frontmatter (see below).
3. Drop any images into the same folder and reference them with a relative path, e.g. `![alt](./diagram.png)`. Astro processes them through the image pipeline automatically (resize, format conversion, content-hashed URL).

The date prefix on the folder name is for filesystem ordering only. It's stripped to produce the URL — `2026-04-22-context-windows/` becomes `/writing/context-windows/`. Posts are sorted on the index by the `date` field in frontmatter, not by folder name.

To override the URL slug (e.g. to rename a post's URL without renaming its folder), set a `slug` field in frontmatter. That value wins over the folder-derived slug.

### Frontmatter

```yaml
---
title: "Post title"
date: 2026-04-22
description: "One-line summary used for OG/Twitter cards and the feed."
slug: "custom-url"         # optional, overrides the folder-derived slug
tags: ["agents", "web3"]   # optional
draft: false               # optional, defaults to false
---
```

- `draft: true` hides the post from the production build (and the sitemap and feed), but it still renders in `npm run dev` so you can iterate.

### Feeds

- RSS feed (full post content): `/feed.xml`
- Sitemap: `/sitemap-index.xml`

Both regenerate on every build.

## Historical archive

`/archive/` contains recovered posts from earlier blogs and the Conor on Web3
newsletter, with full-text search and publication/year filters. Content and
recovered images are stored locally; historical posts do not enter the current
RSS feed. See [archive recovery and maintenance](docs/archive.md) for coverage,
source records and import instructions.

## Deploying

Pushes to `main` auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`. No manual step needed.

## Social cards (Open Graph / Twitter)

- **Site-wide default** is `public/og-default.png` (1200×630). Any page without its own card uses this.
- **Per-post cards are auto-generated** from the post title and date via [`astro-og-canvas`](https://github.com/delucis/astro-og-canvas). Routes are at `/og/{slug}.png`; they build once per prod build.
- **To override a post's card**, set `ogImage: "/path/to/image.png"` in its frontmatter (supports any URL or public-absolute path).
