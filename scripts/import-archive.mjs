import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractPost, originalUrl } from './archive-html.mjs';

// Import downloaded snapshots, without making network requests during a build.
// node scripts/import-archive.mjs docs/archive-sources.json /path/to/raw
const [manifestPath, rawDirectory] = process.argv.slice(2);
if (!manifestPath || !rawDirectory) throw new Error('Usage: node scripts/import-archive.mjs <manifest.json> <raw-directory>');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const assets = JSON.parse(await readFile('docs/archive-assets.json', 'utf8').catch(() => '{}'));
const imageFiles = new Map(Object.entries(assets).map(([url, asset]) => [originalUrl(url, url), asset.file]));
const pathKey = (url) => new URL(url).pathname.replace(/\/$/, '').toLowerCase();
const routes = new Map();
for (const post of manifest) {
  for (const candidate of post.candidates) routes.set(pathKey(candidate.url), `/archive/${post.source}/${post.slug}/`);
  // WordPress briefly used year/month permalinks before including the day.
  for (const candidate of post.candidates) {
    const path = pathKey(candidate.url).replace(/^(\/\d{4}\/\d{2})\/\d{2}\//, '$1/');
    routes.set(path, `/archive/${post.source}/${post.slug}/`);
  }
}
const localLink = (value, timestamp) => {
  if (!/^https?:/.test(value)) return value;
  const url = new URL(value);
  if (!['csvensson.blogspot.com', 'quanttech.co', 'www.quanttech.co', 'conorsvensson.com', 'www.conorsvensson.com', 'writing.conorsvensson.com'].includes(url.hostname)) return value;
  return routes.has(pathKey(value)) ? routes.get(pathKey(value)) + url.hash : `https://web.archive.org/web/${timestamp}/${value}`;
};
const posts = [], failures = [];
for (const entry of manifest) {
  try {
    const raw = await readFile(resolve(rawDirectory, `${entry.source}--${entry.slug}.html`), 'utf8');
    const candidate = entry.candidates[0];
    const article = extractPost(raw, entry.source, candidate, {
      link: (url) => imageFiles.get(url) ?? localLink(url, candidate.timestamp),
      image: (url) => imageFiles.get(url),
    });
    posts.push({
      id: `${entry.source}/${entry.slug}`,
      source: entry.source,
      title: article.title,
      date: article.date,
      description: article.text.length > 180 ? article.text.slice(0, 177).replace(/\s+\S*$/, '') + '…' : article.text,
      originalUrl: entry.originalUrl ?? originalUrl(candidate.url, candidate.url),
      snapshotUrl: `https://web.archive.org/web/${candidate.timestamp}/${candidate.url}`,
      ...(entry.featuredImage && { featuredImage: {
        src: entry.featuredImage.src,
        alt: entry.featuredImage.alt,
        width: entry.featuredImage.width,
        height: entry.featuredImage.height,
      } }),
      html: article.html,
    });
  } catch (error) {
    failures.push({ slug: entry.slug, error: error.message });
  }
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} posts could not be imported; existing archive left untouched.`);
}
posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
await mkdir('src/content/archive', { recursive: true });
await writeFile('src/content/archive/posts.json', JSON.stringify(posts, null, 2) + '\n');
console.log(`Imported ${posts.length} articles.`);
