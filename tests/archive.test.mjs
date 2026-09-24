import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseFragment } from 'parse5';
import { cleanHtml, extractPost, originalUrl, findAll, attr } from '../scripts/archive-html.mjs';
import { archiveText, renderArchiveHtml } from '../src/utils/archive.mjs';

const context = { url: 'http://quanttech.co/2014/08/18/example/', timestamp: '20160322014408' };

test('restores article text without scripts, old theme styles, forms or tracking pixels', () => {
  const input = `<p onclick="alert(1)" style="color: red">Hello <strong>world</strong></p>
    <script>alert(1)</script><style>body{display:none}</style><form>subscribe<input></form>
    <a href="jav&#x61;script:alert(1)">unsafe</a><img src="/track.gif" width="1">
    <div class="sharedaddy">Share this!</div><iframe src="https://www.youtube.com/embed/test"></iframe>`;
  const html = cleanHtml(parseFragment(input).childNodes, context);
  assert.match(html, /Hello <strong>world<\/strong>/);
  assert.doesNotMatch(html, /onclick|style=|<script|<form|javascript|track.gif|Share this|<iframe/);
  assert.match(html, /href="https:\/\/www.youtube.com\/embed\/test"/);
});

test('unwraps replay links and preserves mathematical source without duplicating previews', async () => {
  assert.equal(originalUrl('https://web.archive.org/web/20160322014408im_/http://quanttech.co/image.png', context.url), 'http://quanttech.co/image.png');
  const input = `<span class="MathJax_Preview"><img src="equation.gif" alt="x"></span><script type="math/tex; mode=display">x^2 < y</script>`;
  const html = cleanHtml(parseFragment(input).childNodes, context);
  assert.doesNotMatch(html, /<img|<script/);
  const rendered = await renderArchiveHtml(html);
  assert.match(rendered, /katex-display/);
  assert.equal((rendered.match(/class="katex"/g) ?? []).length, 1);
});

test('uses the publication day, not the capture date or UTC conversion', () => {
  const html = `<h2 class="date-header">Monday, September 06, 2004</h2><h3 class="post-title">A post</h3><abbr class="published" title="2004-09-06T00:26:00+01:00"></abbr><div class="post-body"><p>This is the complete article text.</p></div>`;
  const post = extractPost(html, 'blogspot', context);
  assert.equal(post.date, '2004-09-06');
  assert.equal(post.title, 'A post');
  assert.throws(() => extractPost('<h1>Wayback error page</h1>', 'blogspot', context));
});

test('the imported corpus is complete relative to the manifest and contains only safe, linked articles', async () => {
  const posts = JSON.parse(await readFile(new URL('../src/content/archive/posts.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../docs/archive-sources.json', import.meta.url)));
  const assets = JSON.parse(await readFile(new URL('../docs/archive-assets.json', import.meta.url)));
  assert.equal(posts.length, manifest.length);
  assert.equal(new Set(posts.map((post) => post.id)).size, posts.length);
  const routes = new Set([...posts.map((post) => `/archive/${post.id}/`), ...Object.values(assets).map((asset) => asset.file).filter(Boolean)]);
  for (const post of posts) {
    assert.ok(post.title && post.date < '2026-01-01');
    assert.match(post.snapshotUrl, /^https:\/\/web\.archive\.org\/web\/\d{14}\//);
    assert.ok(archiveText(post.html).length > 20, post.id);
    if (post.source === 'newsletter') {
      assert.match(post.originalUrl, /^https:\/\/web3perspectives\.com\/p\//, post.id);
      assert.match(post.featuredImage.src, /^\/archive\/featured-[a-f0-9]+\.(png|jpg|webp)$/, post.id);
      assert.ok(post.featuredImage.width > 0 && post.featuredImage.height > 0, post.id);
      assert.ok((await readFile(new URL(`../public${post.featuredImage.src}`, import.meta.url))).length > 0, post.id);
      const source = manifest.find((entry) => `${entry.source}/${entry.slug}` === post.id);
      assert.equal(source.originalUrl, post.originalUrl, post.id);
      assert.equal(source.featuredImage.src, post.featuredImage.src, post.id);
    }
    const doc = parseFragment(post.html);
    assert.equal(findAll(doc, (n) => ['script', 'iframe', 'form', 'style'].includes(n.tagName)).length, 0, post.id);
    for (const node of findAll(doc, (n) => Boolean(n.tagName))) {
      assert.ok((node.attrs ?? []).every((a) => !/^on|^style$/.test(a.name)), post.id);
      const href = attr(node, 'href');
      if (href?.startsWith('/archive/')) assert.ok(routes.has(href.split('#')[0]), `${post.id}: ${href}`);
      if (href) assert.ok(!/^javascript:|^data:/i.test(href), post.id);
      const src = attr(node, 'src');
      if (src?.startsWith('/archive/')) await readFile(new URL(`../public${src}`, import.meta.url));
    }
  }
});

test('newsletter recovery retains interleaved quotes and images while excluding signup text', () => {
  const html = `<meta property="og:title" content="Newsletter"><time datetime="2022-11-15"></time>
    <div style="max-width:600px"><div class="introduction-subject">Newsletter</div><div class="text-default"><div class="revue-p">Introduction to the issue.</div></div></div>
    <div style="max-width:600px"><table><tr><td><p>A quoted tweet between paragraphs.</p><img src="https://example.com/chart.png" alt="Chart"></td></tr></table></div>
    <div style="max-width:600px"><div class="text-default"><div class="revue-p">The end of the article.</div></div></div>
    <div style="max-width:600px">Did you enjoy this issue?</div><div style="max-width:600px">Subscribe here</div>`;
  const post = extractPost(html, 'newsletter', context);
  assert.match(post.html, /A quoted tweet between paragraphs/);
  assert.match(post.html, /alt="Chart"/);
  assert.match(post.html, /The end of the article/);
  assert.doesNotMatch(post.html, /<table|Subscribe here|Did you enjoy/);
});


test('Python highlighting preserves indentation, blank lines and literal HTML in both themes', async () => {
  const code = 'def example(x):\n    if x < 3:\n        return "<tag>"\n\nprint(example(2))\n';
  const input = `<pre class="brush: python; title: ; notranslate">${code.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</pre>`;
  const clean = cleanHtml(parseFragment(input).childNodes, context);
  assert.match(clean, /class="language-python"/);
  const rendered = await renderArchiveHtml(clean);
  const doc = parseFragment(rendered);
  const pre = findAll(doc, (n) => n.tagName === 'pre')[0];
  const text = (n) => n.nodeName === '#text' ? n.value : (n.childNodes ?? []).map(text).join('');
  assert.equal(text(pre), code);
  assert.match(rendered, /astro-code/);
  assert.match(rendered, /--shiki-light:/);
  assert.match(rendered, /--shiki-dark:/);
  assert.equal(findAll(doc, (n) => n.tagName === 'tag').length, 0);
});
