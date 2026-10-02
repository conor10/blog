import { readFileSync, writeFileSync } from 'node:fs';
import { voiceAgentConfig } from '../config/voice-agent.mjs';
process.loadEnvFile('.env.local');
const headers = { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' };
const config = voiceAgentConfig(process.env.ELEVENLABS_VOICE_ID);
async function api(path, options = {}) {
  const r = await fetch(`https://api.elevenlabs.io/v1/convai/${path}`, { headers, ...options, signal: AbortSignal.timeout(30000) });
  const data = await r.json();
  if (!r.ok) {
    const reason = typeof data.detail?.status === 'string' ? data.detail.status : 'request rejected';
    if (typeof data.detail?.message === 'string') console.error(data.detail.message);
    if(r.status===422) console.error(JSON.stringify(data.detail?.map?.(e=>({field:e.loc,error:e.msg}))));
    throw Error(`ElevenLabs HTTP ${r.status}: ${reason}`);
  }
  return data;
}
try {
  let id = process.env.PUBLIC_ELEVENLABS_AGENT_ID;
  if (!id) {
    const existing = await api('agents?page_size=100');
    const matches = existing.agents.filter(a => a.name === config.name);
    if (matches.length) throw Error('An agent with this name already exists. Set PUBLIC_ELEVENLABS_AGENT_ID to its ID; no duplicate created.');
    const created = await api('agents/create', { method: 'POST', body: JSON.stringify(config) });
    id = created.agent_id;
    if (!id) throw Error('Agent created but no ID returned. Check the dashboard before retrying.');
    const env = readFileSync('.env.local', 'utf8');
    writeFileSync('.env.local', `${env.replace(/^PUBLIC_ELEVENLABS_AGENT_ID=.*\n?/gm, '').trimEnd()}\nPUBLIC_ELEVENLABS_AGENT_ID=${id}\n`, {mode:0o600});
    console.log(`Created ${id}; stored the public agent ID in .env.local.`);
  }
  if (process.argv.includes('--update')) {
    // Update behaviour only; preserve dashboard voice, privacy, limits and origins.
    await api(`agents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        conversation_config: { agent: { prompt: { prompt: config.conversation_config.agent.prompt.prompt, max_tokens: config.conversation_config.agent.prompt.max_tokens, built_in_tools: { end_call: config.conversation_config.agent.prompt.built_in_tools.end_call } } } },
        workflow: config.workflow,
      }),
    });
    console.log('Updated the conversational response and workflow.');
  }
  const saved = await api(`agents/${encodeURIComponent(id)}`);
  console.log(JSON.stringify({id, name:saved.name, duration:saved.conversation_config?.conversation?.max_duration_seconds, retention:saved.platform_settings?.privacy?.retention_days, allowedHosts:saved.platform_settings?.auth?.allowlist, emailConnected:false}));
} catch(e) {console.error(e.message);process.exitCode=1;}
