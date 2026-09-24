# Historical writing archive

The archive lives at `/archive/`, with one local reader page per recovered post.
Search covers titles and full article text; publication and year filters are
shareable through `q`, `source` and `year` URL parameters. Without JavaScript,
all posts remain accessible in chronological groups.

## Recovery coverage

Recovered on 24 September 2026:

| Original home | Posts | Publication years recovered |
| --- | ---: | --- |
| csvensson.blogspot.com | 14 | 2004–2005, 2007 |
| quanttech.co | 21 | 2014–2016 |
| conorsvensson.com | 21 | 2016–2017, 2021 |
| web3perspectives.com (formerly Conor on Web3) | 36 | 2022 |
| **Total** | **92** | **2004–2022** |

This is the recoverable inventory, not a claim that every historical post has
survived. Wayback's URL index, individual posts, cross-post links and the saved
newsletter homepage were checked. No additional dated posts from 2018–2020 or
2023–2025 were found in the domain inventory. The saved newsletter homepage
advertises 47 issues; issues 1, 3, 4, 6–11, 15 and 16 were not included in the
initial Wayback import. Web3 Perspectives was subsequently identified as the
newsletter's current home. Its public archive supplied the canonical article
URLs and featured images for all 36 imported issues. Further posts on that
publication have not yet been added to this import.

The 21 Quanttech posts also appeared on conorsvensson.com. They appear only once
in the archive, under their earlier home. Publication dates come from article
metadata, visible publication dates, or dated permalinks, never capture dates.
The author's original calendar day is retained even for timestamps with offsets.
The 2026 replacement site and subsequent unrelated owners of quanttech.co are
excluded.

## Content and provenance

- `src/content/archive/posts.json` contains the imported metadata and article
  HTML, validated as a separate Astro content collection.
- `docs/archive-sources.json` records the exact source URLs and capture timestamps,
  plus duplicate captures from migrated domains. The first candidate supplies
  the imported copy and the reader's saved-copy link. Newsletter entries also
  record `originalUrl` for the matching Web3 Perspectives article, and
  `featuredImage` with its local path, dimensions, alt text and source URL.
- `docs/archive-assets.json` records each image's recovery outcome. 31 images
  are stored in `public/archive/`; seven unavailable images have labelled links
  to their archived originals. One chart was recovered from its original public
  GitHub repository, recorded in `recoveredFrom`.
- Another 36 featured images, one per imported newsletter issue, are stored in
  `public/archive/featured-*`. They appear above the article and supply its
  Open Graph/Twitter image. These come from the corresponding Web3 Perspectives
  post's `cover_image` metadata; source slugs and publication days were matched.
  The historical Revue snapshot remains the source of the article body.
- Original article wording, code and links are preserved. Site chrome, share
  widgets, comments, author boxes, signup forms, tracking and executable markup
  are removed. Revue paragraphs, quoted tweets and illustrations retain their
  original order; presentation tables are unwrapped.
- MathJax source is preserved as inert data and rendered with KaTeX at build
  time. Old equation preview images are removed to prevent duplicate equations.
- Embeds become ordinary media links, and Gist embeds retain a link to the code.
  Links between recovered posts, including old WordPress permalink variants,
  point to their local archive pages. Other links within the retired blogs
  point to Wayback, avoiding domains that have since changed ownership.

The site builds from local content and media without requesting Wayback.
Archive posts are included in the sitemap but excluded from the current writing
list, RSS feed and the existing A2A corpus.

## Repeating an import

From the repository root, with Node.js and curl available:

```sh
node scripts/download-archive.mjs docs/archive-sources.json /tmp/blog-archive/raw
node scripts/import-archive.mjs docs/archive-sources.json /tmp/blog-archive/raw
node --test tests/*.test.mjs
npm run build
```

The downloader caches completed files and can be rerun after network failures.
The importer refuses to overwrite the corpus if any expected article is missing
or cannot be parsed. Image files and their manifest are stored in the repository; when
adding a newly recovered image, update its manifest entry and rerun the importer.
Review new content and media before committing it.

For another post, add a manifest entry with a unique source/slug, the original URL
and a verified 14-digit snapshot timestamp. Keep raw snapshot HTML outside the
repository. If a replacement snapshot is needed, change the first candidate and
remove only that post's cached raw file before downloading it again.
