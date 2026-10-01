import { parse } from 'parse5';
import { createHash } from 'node:crypto';

const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const find = (node, predicate) => predicate(node) ? node : node.childNodes?.map(n => find(n, predicate)).find(Boolean);
const blocks = new Set(['p', 'div', 'section', 'h1', 'h2', 'h3', 'h4', 'li', 'blockquote', 'figcaption']);
export function extractNarration(html) {
  const document = parse(html);
  const body = find(document, n => attr(n, 'data-post-images') !== undefined);
  const title = find(document, n => n.tagName === 'h1');
  if (!body || !title) throw new Error('Could not find article title and body.');
  const warnings = new Set();
  const meaningfulChildren = n => (n.childNodes || []).filter(c => c.nodeName !== '#text' || c.value.trim());
  const containsImage = n => Boolean(find(n, c => c.tagName === 'img'));
  const imageOnly = n => {
    if (n.tagName === 'img') return true;
    if (n.nodeName === '#text') return !n.value.trim();
    return ['p', 'a', 'picture', 'source', 'br'].includes(n.tagName) && (n.childNodes || []).every(imageOnly);
  };
  function isCaption(node) {
    if (node.tagName === 'figcaption') return true;
    // Markdown may render an image and its italic caption in the same paragraph.
    if (node.tagName === 'em') {
      const siblings = meaningfulChildren(node.parentNode);
      const before = siblings.slice(0, siblings.indexOf(node));
      if (before.some(containsImage) && before.every(imageOnly)) return true;
    }
    // Or a blank line may put the italic caption in the next paragraph.
    if (node.tagName === 'p') {
      const children = meaningfulChildren(node);
      const siblings = meaningfulChildren(node.parentNode);
      const previous = siblings[siblings.indexOf(node) - 1];
      return children.length > 0 && children.every(c => c.tagName === 'em') && previous && containsImage(previous) && imageOnly(previous);
    }
    return false;
  }
  function read(node) {
    const tag = node.tagName;
    if (attr(node, 'data-narration') !== undefined) return `\n\n${attr(node, 'data-narration')}\n\n`;
    if (isCaption(node)) {
      warnings.add('Skipped an image caption; use data-narration or a narration override to include its meaning.');
      return '';
    }
    if (['script', 'style', 'button', 'svg', 'img', 'noscript'].includes(tag) || attr(node, 'aria-hidden') === 'true') return '';
    const classes = (attr(node, 'class') || '').split(/\s+/);
    let omitted = tag === 'pre' ? 'code example' : tag === 'table' ? 'table' : classes.includes('katex') ? 'equation' : null;
    if (omitted) {
      warnings.add(`Replaced ${omitted} with a reference to the written article.`);
      return `\n\nSee the written article for this ${omitted}.\n\n`;
    }
    if (node.nodeName === '#text') return node.value.replace(/\s+/g, ' ');
    if (tag === 'br') return '\n';
    const text = (node.childNodes || []).map(read).join('');
    if (/^h[2-6]$/.test(tag || '')) return `\n\n<break time="1s" />\n\n${text.trim()}\n\n<break time="0.5s" />\n\n`;
    return blocks.has(tag) ? `\n\n${text}\n\n` : text;
  }
  const text = `${read(title).trim()}\n\n<break time="1.5s" />\n\n${read(body)}`.replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text, warnings: [...warnings] };
}
export const fingerprint = (text, voice, model) => createHash('sha256').update(JSON.stringify({ text, voice, model, format: 'mp3_44100_128' })).digest('hex');
export async function generateSpeech({ text, voice, model, apiKey, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: model }), signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const status = error?.detail?.status;
    const reason = status === 'quota_exceeded' ? ' Your available credits are insufficient.' : status === 'missing_permissions' ? ' The API key is missing a required permission.' : '';
    throw new Error(`ElevenLabs returned HTTP ${response.status}.${reason} Check your account, key permissions and remaining credits. No automatic retry was made.`);
  }
  if (!response.headers.get('content-type')?.startsWith('audio/')) throw new Error('ElevenLabs returned an unexpected content type.');
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 100) throw new Error('ElevenLabs returned an empty or incomplete audio file.');
  return audio;
}

// Recovery is read-only: never repeat a paid request after a lost connection.
export async function recoverSpeech({ text, voice, model, apiKey, fetchImpl = fetch }) {
  const headers = { 'xi-api-key': apiKey };
  const history = await fetchImpl('https://api.elevenlabs.io/v1/history?page_size=100', { headers, signal: AbortSignal.timeout(30000) });
  if (!history.ok) throw new Error(`Cannot read ElevenLabs history (HTTP ${history.status}). Enable History: Read on the key.`);
  const data = await history.json();
  const match = data.history?.find(item => item.text === text && item.voice_id === voice && item.model_id === model);
  if (!match) return null;
  const response = await fetchImpl(`https://api.elevenlabs.io/v1/history/${encodeURIComponent(match.history_item_id)}/audio`, { headers, signal: AbortSignal.timeout(180000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) throw new Error(`Could not recover saved audio (HTTP ${response.status}).`);
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 100) throw new Error('Recovered audio is incomplete.');
  return audio;
}
