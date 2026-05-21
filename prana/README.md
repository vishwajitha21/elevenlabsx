# Prana — Voice‑First Healthcare Navigator (ElevenHacks · Hack #9: Stripe)

Prana is a voice-first, anonymous healthcare navigator for anyone who’s lost in the U.S. system—especially immigrants navigating cost, language barriers, and confusing care options.

## What it does

Three ways in:
- Web voice intake
- Phone video clip intake
- Telegram message

Supports English, Spanish, and Mandarin. In under a minute it returns:
- **Urgency level**: emergency, urgent, routine, or wellness + a clear next step
- **Plain-language summary** of what you described
- **Care path recommendation**: doctor, pharmacy, mental wellness, alternative medicine, or self-care
- **Cost ranges** per option (insured vs uninsured) + notes on community clinics

For actionable paths, an agent network searches options in parallel (pharmacies + appointments), ranks results under budget, and uses **Stripe Checkout** to close the loop. A webhook then auto-credits an anonymous deductible tracker. The experience syncs across devices in real time (phone → laptop) without WebSockets.

## How it uses Stripe + ElevenLabs

- **ElevenLabs**: high-quality multilingual voice for intake and narration.
- **Stripe**: Checkout closes the loop (pay for an appointment/service) and webhooks update an anonymous deductible tracker idempotently.

## How we built it (high level)

- **Frontend**: Next.js + Tailwind, LiveKit voice intake (animated orb), MediaRecorder for video intake, Mapbox 3D globe for alternative medicine, device sync via Page Visibility-aware polling.
- **Backend**: FastAPI + SQLite; each session creates a run tied to a verified World ID nullifier hash; Stripe webhooks credit the deductible idempotently.
- **Agents**: Fetch.ai uAgents on Agentverse (orchestrator + budget + ranker + pharmacy/appointment sellers) communicating via Chat Protocol + Payment Protocol.
- **Web automation**: BrowserUse (with Playwright fallback) + per-site mock fallbacks so demos don’t blank.
- **Video understanding**: Twelve Labs Marengo to index user clips and route to an expert flow based on visual evidence.
- **Identity**: World ID v4 verify API; nullifier hash used as an anonymous primary key.
- **Integrations**: Composio (Sheets archive, Calendar logging, Reddit posts, Gmail summaries).
- **Voice**: LiveKit + Deepgram + ElevenLabs + Whisper.

## Challenges

- World ID v4 preview integration edge cases (bridge mismatch + strict action identifier matching).
- Tightening scope to match the immigrant-first story (cost transparency, language filters, video intake, Telegram).
- Multi-agent orchestration under a deadline (message contracts, async race conditions, schema stability).
- Cost containment for browser automation (mock fallbacks + local Playwright path).

## What’s next

- Scheduled voice check-ins (Twilio + LiveKit) for elderly users.
- More languages with real localization (e.g., Tagalog, Vietnamese, Korean, Armenian).
- Family caregiver mode (shared sessions across family members/devices).

## Submission description (copy/paste ready)

**Prana** is a voice-first, anonymous healthcare navigator. Speak symptoms in English, Spanish, or Mandarin and get care paths with urgency, cost ranges, and next steps—then let agents find options and close the loop with Stripe Checkout and ElevenLabs voice.
