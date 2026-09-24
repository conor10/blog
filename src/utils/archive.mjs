import { parseFragment, serialize } from 'parse5';
import katex from 'katex';
import { codeToHtml } from 'shiki';

export function archiveText(html) {
  const text = (node) => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join(' ');
  return text(parseFragment(html)).replace(/\s+/g, ' ').trim();
}

export async function renderArchiveHtml(html) {
  const fragment = parseFragment(html);
  const visit = async (node) => {
    if (!node.childNodes) return;
    node.childNodes = (await Promise.all(node.childNodes.map(async (child) => {
      const attrs = Object.fromEntries((child.attrs ?? []).map(({ name, value }) => [name, value]));
      if (child.tagName === 'span' && attrs.class === 'archive-math') {
        return parseFragment(katex.renderToString(attrs['data-tex'] ?? '', {
          displayMode: attrs['data-display'] === 'true', throwOnError: false, trust: false,
        })).childNodes;
      }
      if (child.tagName === 'pre') {
        const code = child.childNodes.find((n) => n.tagName === 'code');
        const lang = code?.attrs?.find((a) => a.name === 'class')?.value.match(/language-([\w-]+)/)?.[1];
        if (lang === 'python') {
          const text = (node) => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');
          const highlighted = await codeToHtml(text(code), {
            lang, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false,
          });
          return parseFragment(highlighted.replace('class="shiki ', 'class="astro-code shiki ')).childNodes;
        }
      }
      await visit(child);
      return [child];
    }))).flat();
  };
  await visit(fragment);
  return serialize(fragment);
}
