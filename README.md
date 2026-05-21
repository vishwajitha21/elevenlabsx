# DeliverVault 🔐 (ElevenHacks · Hack #9: Stripe)

DeliverVault is an end-to-end freelancer workflow and consent-chain platform designed to prevent disputes over deliverables, approvals, and billing.

It turns a messy “brain-dump brief” into a structured proposal, tracks client sign-offs in an immutable audit log, and closes out payment via Stripe.

This repository is prepared for **ElevenHacks** (Hack #9: **Stripe**) and includes an **ElevenLabs voice narration** endpoint so you can ship a voice-powered workflow and a viral demo video.

## What it does

- **Consent Chain Protocol**: every approval is logged with timestamps and identity context to eliminate “I didn’t approve that” disputes.
- **AI Co‑Pilot**: generates categorized proposals + detects anomalies (scope creep, budget mismatch, aggressive timelines).
- **Mentor sign‑off (CIBA-style)**: request an out-of-band approval link for complex steps.
- **Integrations**: trigger third-party actions (GitHub issues, Slack notifications; more planned).
- **Stripe checkout**: generate a secure payment flow once the client signs off.
- **ElevenLabs narration**: turn proposals/updates into high-quality voice for client-ready updates and social demos.

## About

- Demo: https://delivervault.netlify.app/

## How it uses Stripe + ElevenLabs

- **Stripe**: used for payments/checkout to ensure the freelancer gets paid after approvals.
- **ElevenLabs**: used to generate spoken narration of proposal summaries (e.g., “Here’s what we’ll deliver and when”). API: `POST /api/voice/narrate`.

## Quickstart (local)

1. Install deps
   - `cd frontend; npm install`
   - `cd ../backend; npm install`

2. Configure env vars
   - Backend: create `backend/.env`
   - Frontend: create `frontend/.env`

3. Run
   - `cd backend; npm run dev`
   - `cd ../frontend; npm run dev`

4. Open `http://localhost:5000`

## Environment variables

### Backend (`backend/.env`)

- `PORT=3001`
- `FRONTEND_URL=http://localhost:5000`
- `MONGODB_URI=...`
- Stripe
  - `STRIPE_SECRET_KEY=...`
- Auth0 (optional; app also supports demo mode)
  - `AUTH0_DOMAIN=...`
  - `AUTH0_AUDIENCE=...`
  - `AUTH0_MGMT_CLIENT_ID=...`
  - `AUTH0_MGMT_CLIENT_SECRET=...`
- ElevenLabs (for voice narration)
  - `ELEVENLABS_API_KEY=...` (required for `/api/voice/*`)
  - `ELEVENLABS_VOICE_ID=...` (optional; default is Rachel)
  - `ELEVENLABS_MODEL_ID=...` (optional; default `eleven_multilingual_v2`)
  - `ELEVENLABS_OUTPUT_FORMAT=...` (optional; default `mp3_44100_128`)
- AI keys (optional, depending on provider you use)
  - `GROQ_API_KEY=...`
  - `CEREBRAS_API_KEY=...`
  - `SAMBANOVA_API_KEY=...`
  - `GEMINI_API_KEY=...`
  - `OPENROUTER_API_KEY=...`
- SMTP (optional; used for magic links)
  - `SMTP_HOST=...`
  - `SMTP_PORT=...`
  - `SMTP_USER=...`
  - `SMTP_PASS=...`
  - `SMTP_FROM=...`

### Frontend (`frontend/.env`)

- `VITE_API_URL=http://localhost:3001`
- `VITE_AUTH0_DOMAIN=...`
- `VITE_AUTH0_CLIENT_ID=...`
- `VITE_AUTH0_AUDIENCE=...`

## Voice API

Authenticated route (requires JWT in non-demo mode):

- `POST /api/voice/narrate`
  - body: `{ "text": "string", "voiceId"?: "string", "modelId"?: "string" }`
  - returns: `{ "audioBase64": "…", "mimeType": "audio/mpeg", "voiceId": "...", "modelId": "...", "outputFormat": "..." }`

## ElevenHacks submission checklist

- Record a short viral demo: show proposal creation → approvals → **voice narration** → Stripe checkout.
- Tag `@stripe` + `@elevenlabsio` and use `#ElevenHacks`.
