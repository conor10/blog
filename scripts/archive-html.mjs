import { parse, parseFragment } from 'parse5';

export const attr = (node, name) => node?.attrs?.find((a) => a.name === name)?.value;
export const hasClass = (node, name) => (attr(node, 'class') ?? '').split(/\s+/).includes(name);
export const textContent = (node) => node?.nodeName === '#text'
  ? node.value : (node?.childNodes ?? []).map(textContent).join('');
export const findAll = (node, predicate) => [
  ...(predicate(node) ? [node] : []),
  ...(node?.childNodes ?? []).flatMap((child) => findAll(child, predicate)),
];
export const find = (node, predicate) => findAll(node, predicate)[0];
export const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function originalUrl(value, base) {
  const unwrapped = value.replace(/^(?:(?:https?:)?\/\/web\.archive\.org)?\/web\/\d+[a-z_]*\/((?:https?:\/\/|mailto:).*)$/i, '$1');
  try {
    const url = new URL(unwrapped, base);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null;
    return url.href;
  } catch { return null; }
}

const allowed = new Set('p br hr h2 h3 h4 h5 h6 a strong b em i u s del blockquote pre code ul ol li dl dt dd table thead tbody tfoot tr th td caption figure figcaption img sub sup abbr span div'.split(' '));
const dropped = new Set('style script form input button textarea select option noscript svg object embed nav aside'.split(' '));
const chrome = new Set(['sharedaddy', 'jp-relatedposts', 'post-footer', 'post-meta', 'post_meta', 'wpa-about', 'MathJax_Preview', 'categories', 'tags', 'writer']);

// Serialize only article markup. Old themes, scripts, event handlers, embeds and
// tracking pixels must never become executable content on the current site.
export function cleanHtml(nodes, context) {
  const serialize = (node) => {
    if (node.nodeName === '#text') return escapeHtml(node.value);
    if (!node.tagName) return '';
    const tag = node.tagName.toLowerCase();
    const classes = (attr(node, 'class') ?? '').split(/\s+/);
    if (classes.some((c) => chrome.has(c)) || attr(node, 'id') === 'jp-relatedposts') return '';
    if (tag === 'script' && (attr(node, 'type') ?? '').startsWith('math/tex')) {
      const display = attr(node, 'type').includes('display');
      return `<span class="archive-math" data-display="${display}" data-tex="${escapeHtml(textContent(node))}"></span>`;
    }
    if (tag === 'script' && /gist\.github\.com\//.test(attr(node, 'src') ?? '')) {
      const url = originalUrl(attr(node, 'src'), context.url)?.replace(/\.js(?:\?.*)?$/, '');
      return url ? `<p><a href="${escapeHtml(url)}">View the original code on GitHub Gist</a></p>` : '';
    }
    // WordPress SyntaxHighlighter stores the language in a legacy brush class.
    // Preserve literal code and whitespace without importing its scripts/styles.
    if (tag === 'pre') {
      const language = (attr(node, 'class') ?? '').match(/brush:\s*([\w-]+)/)?.[1]
        ?? (attr(node, 'class') ?? '').match(/language-([\w-]+)/)?.[1];
      const lang = language === 'plain' ? 'text' : language;
      return `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(textContent(node))}</code></pre>`;
    }
    if (dropped.has(tag)) return '';
    if (tag === 'iframe') {
      const url = originalUrl(attr(node, 'src') ?? '', context.url);
      return url ? `<p><a href="${escapeHtml(url)}">View embedded media</a></p>` : '';
    }
    const children = (node.childNodes ?? []).map(serialize).join('');
    if (context.newsletter && ['table', 'tbody', 'thead', 'tfoot', 'tr', 'td'].includes(tag)) return children;
    if (!allowed.has(tag)) return children;
    const outputTag = classes.includes('revue-p') ? 'p' : classes.includes('revue-h2') ? 'h2' : tag;
    const attrs = [];
    for (const name of ['id', 'title', 'colspan', 'rowspan', 'start']) {
      const value = attr(node, name);
      if (value) attrs.push(`${name}="${escapeHtml(value)}"`);
    }
    if (tag === 'a') {
      const href = attr(node, 'href');
      if (!href) return children;
      const url = href.startsWith('#') ? href : originalUrl(href, context.url);
      if (!url) return children;
      // Missing-image placeholders already contain their own source link.
      if (children.includes('class="archive-missing-image"')) return children;
      attrs.push(`href="${escapeHtml(context.link?.(url) ?? url)}"`);
    }
    if (tag === 'img') {
      if (Number(attr(node, 'width')) === 1 || Number(attr(node, 'height')) === 1) return '';
      const url = originalUrl(attr(node, 'src') ?? '', context.url);
      if (!url || !/^https?:/.test(url)) return '';
      if (context.newsletter && /\/assets\/email\/|\/profile_images\//.test(url)) return '';
      if (classes.includes('tex')) {
        return `<span class="archive-math" data-display="false" data-tex="${escapeHtml(attr(node, 'alt') ?? '')}"></span>`;
      }
      const image = context.image?.(url);
      const archived = `https://web.archive.org/web/${context.timestamp}im_/${url}`;
      if (image === null) return `<a class="archive-missing-image" href="${escapeHtml(archived)}">${escapeHtml(attr(node, 'alt') || 'Image from the original post')} (image unavailable; view archive)</a>`;
      attrs.push(`src="${escapeHtml(image ?? archived)}"`);
      attrs.push(`alt="${escapeHtml(attr(node, 'alt') ?? '')}"`, 'loading="lazy"');
    }
    return `<${outputTag}${attrs.length ? ' ' + attrs.join(' ') : ''}>${['br', 'hr', 'img'].includes(tag) ? '' : children + `</${outputTag}>`}`;
  };
  return nodes.map(serialize).join('').trim();
}

export function extractPost(html, source, candidate, options = {}) {
  const doc = parse(html);
  const byClass = (name) => find(doc, (n) => hasClass(n, name));
  const meta = (name) => attr(find(doc, (n) => n.tagName === 'meta' && (attr(n, 'property') === name || attr(n, 'name') === name)), 'content');
  let title, date, nodes;
  if (source === 'newsletter') {
    title = meta('og:title');
    date = attr(find(doc, (n) => n.tagName === 'time'), 'datetime');
    // Revue interleaves paragraphs, images and quoted tweets in presentation
    // tables. Keep all article blocks in order, stopping before its signup UI.
    const blocks = findAll(doc, (n) => n.tagName === 'div' && /max-width:\s*600px/.test(attr(n, 'style') ?? ''));
    nodes = [];
    for (const block of blocks) {
      if (textContent(block).trim() === 'Did you enjoy this issue?') break;
      if (find(block, (n) => hasClass(n, 'introduction-subject'))) {
        nodes.push(...findAll(block, (n) => hasClass(n, 'text-default')));
      } else if (textContent(block).trim() || find(block, (n) => n.tagName === 'img')) {
        nodes.push(block);
      }
    }
  } else if (source === 'blogspot') {
    title = textContent(byClass('post-title')).trim();
    date = attr(byClass('published'), 'title');
    if (!date) {
      const parsed = new Date(textContent(byClass('date-header')).trim() + ' UTC');
      if (!Number.isNaN(parsed.valueOf())) date = parsed.toISOString();
    }
    nodes = byClass('post-body')?.childNodes;
  } else {
    title = textContent(byClass('post_name') ?? byClass('entry-title') ?? byClass('posttitle')).trim() || meta('og:title');
    date = meta('article:published_time') ?? attr(find(doc, (n) => n.tagName === 'time'), 'datetime');
    nodes = (byClass('post_text') ?? byClass('entry-content') ?? byClass('entry'))?.childNodes;
    if (!nodes && byClass('trans')) {
      // The 2021 Hexo theme puts its footer inside the same wrapper as the post.
      nodes = [];
      for (const node of byClass('trans').childNodes) {
        if (hasClass(node, 'row') || find(node, (n) => hasClass(n, 'classtest-link'))) break;
        if (node.tagName !== 'h2' || nodes.some((n) => n.tagName)) nodes.push(node);
      }
    }
    if (!date) {
      const match = candidate.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
      if (match) date = match.slice(1).join('-');
    }
  }
  if (!title || !date || !nodes?.length) throw new Error('Missing article title, publication date or body');
  const body = cleanHtml(nodes, { ...candidate, ...options, newsletter: source === 'newsletter' });
  const plain = textContent(parseFragment(body)).replace(/\s+/g, ' ').trim();
  if (plain.length < 20) throw new Error('Article body is unexpectedly empty');
  if (!/^\d{4}-\d{2}-\d{2}/.test(date) || Number.isNaN(new Date(date).valueOf())) throw new Error('Invalid publication date');
  return { title, date: date.slice(0, 10), html: body, text: plain };
}
