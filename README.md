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

## Article narration

Generate audio from a published `/writing/` article using your ElevenLabs voice.
Requires Node 22+; no API calls happen during normal builds or visitor playback.

Create an ignored `.env.local` file in the project root:

```dotenv
ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_VOICE_ID=your_cloned_voice_id
```

Create a key with Text to Speech permission in ElevenLabs and copy the voice ID
from your voice's menu. Keep the key local; do not use a `PUBLIC_` prefix.

```sh
# Builds the site and saves a free text preview under .audio-preview/
npm run audio -- why-omarchy-is-the-operating-system-for-the-agentic-age

# Preview all published Writing articles (excludes the historical archive)
npm run audio -- --all

# Generate all Writing articles, reusing unchanged recordings
npm run audio -- --all --generate

# Generate one article (uses ElevenLabs credits)
npm run audio -- why-omarchy-is-the-operating-system-for-the-agentic-age --generate
```

The default model is `eleven_multilingual_v2` (10,000 characters per article).
For longer articles, set `ELEVENLABS_MODEL_ID=eleven_flash_v2_5` in `.env.local`
(up to 40,000 characters). Longer texts are rejected before an API request.
The character count is shown before generation; credit cost depends on the model.

Narration inserts a 1.5-second pause after the title using an ElevenLabs break tag.
It includes the title and rendered body, retaining link text and skipping
site navigation and scripts. Subheadings receive a one-second pause before and
a half-second pause after. Images, standard figure captions, and italic captions
immediately following an image (in the same or next paragraph) are skipped.
Ordinary italic prose is retained. This structural detection cannot determine
whether a caption contains an essential point: review the preview. Add
`data-narration="A concise spoken explanation"` to an image, figure or caption
element to explicitly supply narration, or use the full text override below.
Code blocks, tables and equations receive spoken
references to the written article. Review the preview for technical content and
interactive diagrams. For pronunciation adjustments or a custom spoken version,
save the complete narration in `narration/<slug>.txt`; this overrides extraction.

The script saves a versioned MP3 and metadata in `public/audio/`. Commit both,
then rebuild/deploy to show the player automatically. Unchanged text, voice and
model reuse the existing recording; `--force` explicitly spends credits again.
Failed requests leave the previous recording intact and are never auto-retried.
A batch stops at the first failure. After a connection failure, run
`npm run audio -- --all --recover` first: this downloads matching recordings from
the latest 100 history items without generation charges (requires History: Read).
It matches the exact narration, voice and model. Then rerun `--all --generate`
to resume using cached successes. Do not blindly regenerate a lost response.
Article edits do not silently regenerate audio: rerun the command when updating
an article with narration. Generation currently covers the main writing section.

Run offline checks with `node --test tests/article-audio.test.mjs`.
