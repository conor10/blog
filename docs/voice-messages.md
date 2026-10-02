# ElevenLabs voice messages

`/contact/` uses the official `@elevenlabs/client` SDK with custom Voice and Chat controls. Chat starts a text-only session without requesting microphone access. Voice starts only when the visitor presses “Speak to my agent”. It greets visitors using Conor's
cloned voice, listens to their message, responds to what they said, asks whether they want to add anything, and waits for their answer. It thanks them and ends only after they confirm they are finished (or explicitly ask to stop). The greeting asks for
reply details; the agent does not interview visitors or insist on contact fields. Voice has no contact form or live transcript. Chat shows the conversation and a message composer. Audio streams to ElevenLabs during voice sessions. The page keeps copy minimal; the agent introduces itself as Conor’s AI assistant.

## Setup

Enable Agents Read and Write (sometimes labelled Conversational AI) on the local
ElevenLabs API key, then run `node scripts/setup-voice-agent.mjs`. The script creates
one agent and saves `PUBLIC_ELEVENLABS_AGENT_ID` in ignored `.env.local`. It refuses
to duplicate an existing agent with the same name. Restart Astro after setup. Run `node scripts/setup-voice-agent.mjs --update` to apply prompt and workflow changes to the existing agent while preserving its other dashboard settings.
The public agent ID is safe to embed; the API key and voice ID stay server-side.

Configuration is in `config/voice-agent.mjs`: a Start → Listen and respond workflow, with the assistant ending the call after its spoken reply,
three-minute calls, patient turn handling, optional spoken reply details,
no external-action tools, two concurrent calls,
20 calls per day, no burst billing, recordings enabled and 30-day retention.
Only localhost and 127.0.0.1 are initially allowed. This is a preview, not a public
launch. The assistant is instructed to take messages rather than give advice;
prompts do not guarantee perfect adherence, so test off-topic requests as well.

Before launch, test a real message in ElevenLabs, confirm recording/transcript
retention, add conorsvensson.com to the agent's origin allowlist and supply the
public agent ID to the GitHub Pages build. Add a public link only after testing.

## Email delivery — not yet connected

Recordings and transcripts live in ElevenLabs. To notify hi@conorsvensson.com,
configure a signed post-call webhook and a small email relay. It can send a
transcript plus a link to the private ElevenLabs conversation; recordings do not
need to be uploaded to Formspree or hosted by the website. The relay requires a
host and an email delivery integration. Do not claim an email has been delivered
until this is connected and tested. No webhook or email destination is configured
by the setup script, and it does not change workspace-wide settings.

The previous recorder/Formspree prototype is preserved locally in ignored
`.audio-preview/voice-recorder-prototype/`. It is no longer part of the site.

## Validation

The agent has been created and the custom controls render on the local voice page. A browser text-chat test received a relevant acknowledgement, the anything-else question and a closing response. A
synthetic conversation completed the greeting/message/thank-you sequence. After the conversational update, simulations produced relevant acknowledgements for an AI evaluation enquiry and article feedback, and declined a request to invent a booking. The pricing test still promised later contact without reply details, so that conditional wording needs further real-call checking before launch. This
does not replace a microphone test of pauses, interruptions and pronunciation.
Before closing, the assistant gives one or two brief, specific sentences acknowledging the message in a conversational tone. It speaks as Conor’s assistant, does not invent his views or commitments, and does not turn the message into an interview. The approved closing is “Thank you for your message. Conor will be in touch soon.
Take care.” When no reply details are provided it simply thanks the visitor.
Email delivery remains unconfigured.

The anything-else check is required even when the initial message ends with “that is all”. Further additions are heard and acknowledged before checking again; a negative answer closes without repeating the question. Silence is not confirmation, though the configured silence and duration limits still apply.

The deployment workflow reads PUBLIC_ELEVENLABS_AGENT_ID from the matching GitHub repository variable. Production origin access and that variable must be configured before deployment. Voice uses WebSocket connections so the browser Origin header reaches ElevenLabs.
