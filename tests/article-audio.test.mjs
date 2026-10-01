import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractNarration, fingerprint, generateSpeech, recoverSpeech } from '../scripts/article-audio.mjs';

test('reads prose and links without site furniture, scripts or raw code/math', () => {
  const { text, warnings } = extractNarration(`<nav>Menu</nav><h1>A &amp; B</h1><div data-post-images><p>Hello <a href="/">world</a>.</p><pre>dangerous_code()</pre><span class="katex"><math>x</math></span><script>bad()</script><img alt="photo"/><p>Next paragraph.</p></div><footer>Cite this</footer>`);
  assert.match(text, /^A & B\n\n<break time="1.5s" \/>\n\nHello world\./);
  assert.match(text, /written article for this code example/);
  assert.match(text, /written article for this equation/);
  assert.doesNotMatch(text, /Menu|dangerous_code|bad\(\)|Cite this/);
  assert.equal(warnings.length, 2);
});
test('rejects pages without article markup', () => assert.throws(() => extractNarration('<h1>Missing</h1>')));
test('cache changes when text, voice or model changes', () => {
  const hash = fingerprint('text', 'voice', 'model');
  assert.equal(hash, fingerprint('text', 'voice', 'model'));
  for (const args of [['changed','voice','model'],['text','changed','model'],['text','voice','changed']]) assert.notEqual(hash, fingerprint(...args));
});
test('API sends text and configured voice and returns audio', async () => {
  const audio = await generateSpeech({ text: 'Hello', voice: 'voice-id', model: 'eleven_multilingual_v2', apiKey: 'test-key', fetchImpl: async (url, options) => {
    assert.match(url, /\/voice-id\?output_format=mp3_44100_128$/);
    assert.equal(options.headers['xi-api-key'], 'test-key');
    assert.deepEqual(JSON.parse(options.body), { text: 'Hello', model_id: 'eleven_multilingual_v2' });
    return new Response(Buffer.alloc(200), { headers: { 'content-type': 'audio/mpeg' } });
  }});
  assert.equal(audio.length, 200);
});
test('failed requests are not retried or returned as audio', async () => {
  let calls = 0;
  await assert.rejects(generateSpeech({ fetchImpl: async () => { calls++; return new Response('private account details', { status: 401 }); } }), /HTTP 401/);
  assert.equal(calls, 1);
  await assert.rejects(generateSpeech({ fetchImpl: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }) }), /content type/);
});

test('separates subheadings from surrounding prose with pauses', () => {
  const { text } = extractNarration('<h1>Title</h1><div data-post-images><p>Before.</p><h2>Section</h2><p>After.</p><h5>Detail</h5></div>');
  assert.match(text, /Before\.\n\n<break time="1s" \/>\n\nSection\n\n<break time="0.5s" \/>\n\nAfter\./);
  assert.match(text, /<break time="1s" \/>\n\nDetail/);
});
test('recognises image captions without dropping ordinary italic prose', () => {
  const { text } = extractNarration(`<h1>Title</h1><div data-post-images>
    <p><a><img alt="unspoken"/></a> <em>Same paragraph caption <a>here</a>.</em></p>
    <p><img/></p><p><em>Separate caption.</em></p>
    <figure><img/><figcaption>Semantic caption.</figcaption></figure>
    <p><em>Important prose.</em></p>
    <p>An image in prose <img/> with <em>emphasis preserved.</em></p>
    <figure data-narration="The chart shows a doubling in speed."><img/><figcaption>Visual label</figcaption></figure>
  </div>`);
  assert.doesNotMatch(text, /Same paragraph|Separate caption|Semantic caption|unspoken|Visual label/);
  assert.match(text, /Important prose/);
  assert.match(text, /emphasis preserved/);
  assert.match(text, /The chart shows a doubling in speed/);
});

test('recovers only matching text, voice and model without a paid POST', async () => {
  const calls = [];
  const audio = await recoverSpeech({ text: 'Exact', voice: 'mine', model: 'model', apiKey: 'key', fetchImpl: async (url, options) => {
    calls.push(url);
    assert.notEqual(options.method, 'POST');
    if(url.includes('?page_size=')) return Response.json({ history: [
      {text:'Exact',voice_id:'other',model_id:'model',history_item_id:'wrong'},
      {text:'Exact',voice_id:'mine',model_id:'model',history_item_id:'right'}
    ]});
    assert.match(url, /\/right\/audio$/);
    return new Response(Buffer.alloc(200), {headers:{'content-type':'audio/mpeg'}});
  }});
  assert.equal(audio.length, 200);
  assert.equal(calls.length, 2);
  assert.equal(await recoverSpeech({ text:'missing',fetchImpl:async()=>Response.json({history:[]}) }),null);
});
