import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { extractNarration, fingerprint, generateSpeech, recoverSpeech } from './article-audio.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const [target, ...flags] = process.argv.slice(2);
try {
  if (!target || (target !== '--all' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target)) || flags.some(f => !['--generate', '--force', '--recover'].includes(f))) {
    throw new Error('Usage: npm run audio -- <writing-slug|--all> [--generate | --recover] [--force]');
  }
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
  const slugs = target === '--all' ? readdirSync('dist/writing', { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name) : [target];
  for (const slug of slugs) {
  console.log(`\nArticle: ${slug}`);
  const page = `dist/writing/${slug}/index.html`;
  if (!existsSync(page)) throw new Error('Published article not found. Use its /writing/ URL slug.');
  const narration = extractNarration(readFileSync(page, 'utf8'));
  const override = `narration/${slug}.txt`;
  const text = existsSync(override) ? readFileSync(override, 'utf8').trim() : narration.text;
  mkdirSync('.audio-preview', { recursive: true });
  writeFileSync(`.audio-preview/${slug}.txt`, text + '\n');
  console.log(`\nNarration: ${text.length.toLocaleString()} characters. Preview: ${resolve('.audio-preview', slug + '.txt')}`);
  if (!existsSync(override)) narration.warnings.forEach(w => console.log(w));
  const model = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
  const limit = { eleven_multilingual_v2: 10000, eleven_flash_v2_5: 40000 }[model];
  if (!limit) throw new Error('Supported models: eleven_multilingual_v2 or eleven_flash_v2_5.');
  if (!text || text.length > limit) throw new Error(`This model accepts up to ${limit} characters. Set ELEVENLABS_MODEL_ID=eleven_flash_v2_5 for longer articles, or edit ${override}.`);
  if (!flags.includes('--generate') && !flags.includes('--recover')) {
    console.log('Preview only; no credits used. Add --generate to create the audio.');
  } else {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voice = process.env.ELEVENLABS_VOICE_ID;
    if (!apiKey || !voice) throw new Error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env.local first.');
    const hash = fingerprint(text, voice, model);
    const metadataPath = `public/audio/${slug}.json`;
    const previous = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, 'utf8')) : null;
    if (!flags.includes('--force') && previous?.hash === hash && existsSync(`public${previous.src}`)) {
      console.log('Audio is unchanged; no credits used.');
    } else {
      let audio;
      if (flags.includes('--recover')) {
        audio = await recoverSpeech({ text, voice, model, apiKey });
        if (!audio) { console.log('No matching recording in the latest 100 history items.'); continue; }
        console.log('Recovered existing recording; no generation credits used.');
      } else {
        console.log(`Generating with ${model}; this request uses your ElevenLabs credits.`);
        audio = await generateSpeech({ text, voice, model, apiKey });
      }
      mkdirSync('public/audio', { recursive: true });
      const src = `/audio/${slug}-${hash.slice(0, 12)}.mp3`;
      writeFileSync(`public${src}.tmp`, audio);
      renameSync(`public${src}.tmp`, `public${src}`);
      writeFileSync(`${metadataPath}.tmp`, JSON.stringify({ src, hash, model, characters: text.length }, null, 2) + '\n');
      renameSync(`${metadataPath}.tmp`, metadataPath);
      console.log(`Saved ${src}. Rebuild or restart the preview to see the player. Commit the MP3 and JSON with the article.`);
    }
  }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
