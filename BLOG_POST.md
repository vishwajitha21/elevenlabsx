# DeliverVault

## Inspiration

It started with a real argument.

A freelancer friend spent six weeks building a web app for a client. When it was time to invoice, the client disputed three deliverables — claimed they hadn't approved them, that the scope had changed, that the emails "didn't count" as formal sign-off. My friend had nothing. A WhatsApp thread, a few email replies, and a gut feeling that he'd done everything right.

He lost the dispute. Not because he was wrong — but because he couldn't prove it.

That conversation stuck. Every freelancer we talked to had a version of that story. The tools exist — Gmail, Slack, GitHub, Notion — but they're completely disconnected. There's no consent chain. No audit trail. No way to show a client "here is exactly what happened, who authorized it, and when."

Trust between freelancers and clients is broken by default, and nobody was building the infrastructure to fix it.

We wanted to build something that changed the relationship. Not just a better proposal tool — a system where every action is authorized, auditable, and provable.

---

## What it does

DeliverVault turns a raw proposal or client brief into a visual, step-by-step approval workflow — and then actually executes it.

You paste your proposal text. That's the entire input. Our AI reads it and extracts a structured workflow: the project title, client name, contract value, and 3–7 concrete steps with realistic timelines. Each step gets automatically connected to the service action it represents — sending a contract draft via Gmail, posting a milestone update to Slack, creating a GitHub issue for code delivery, logging a spec in Notion.

Then the interesting part starts.

**Every service action runs through Auth0 Token Vault.** When a user connects their Gmail once, Auth0 intercepts the OAuth callback and stores that token encrypted — DeliverVault never sees it, never writes it to a database. When a step is approved and the Gmail action fires, the backend requests a short-lived token via RFC 8693 token exchange, uses it for exactly one email send, and it expires. The user can revoke that connection at any moment. The audit log records everything.

**For steps that need human sign-off**, we built two paths. The clean one uses Auth0 CIBA — a push notification goes to the reviewer's phone via Auth0 Guardian. They tap approve on their lock screen. The workflow canvas updates in real time. The other path sends a single-use email link that expires in 48 hours — for mentors or clients who don't have Auth0.

Beyond that: an AI co-pilot that rewrites proposal copy and flags risky contract clauses, real-time step updates via Socket.io, a full paginated audit trail, and optional Stripe payment link generation when the final step is approved.

---

## How we built it

The frontend is React with TypeScript, built in Lovable. The workflow canvas uses React Flow. Animations are Framer Motion and GSAP. The whole app runs in demo mode with no backend — judges can explore the full UI without any setup.

The backend is Express on Render's free tier. Auth0 handles JWT validation, Token Vault credential management via the Management API, and CIBA backchannel authentication. MongoDB Atlas M0 stores proposals, audit logs, CIBA requests, and mentor tokens — all with TTL indexes for automatic cleanup.

The AI runs across a 5-provider waterfall: Groq, Cerebras, SambaNova, Google Gemini, and OpenRouter. Every provider is free tier. If Groq hits its daily limit, Cerebras picks up in milliseconds. Combined daily capacity is over 18,000 requests. Response caching means identical rewrites return in under 1ms.

We added a stale-while-revalidate in-process cache to make the free Render tier feel fast — proposal lists return in under 5ms after the first load. Audit log writes are fire-and-forget via `setImmediate` so they never block a response. A self-ping every 14 minutes prevents Render's cold-start sleep.

Real-time updates use Socket.io with JWT-authenticated connections. When a mentor approves a step via CIBA — their phone, our backend, Auth0, back to the canvas — the node turns green and confetti fires within two seconds of the tap.

---

## Challenges we ran into

**Auth0 Token Vault is not well-documented for this exact use case.** The docs explain what it does clearly, but finding a practical Node.js example of "request a short-lived Gmail token for an authenticated user via credential ID exchange" required reading multiple RFCs, digging through the Management API reference, and a lot of trial and error. The RFC 8693 flow is elegant once it clicks — but nothing in the docs draws a straight line from "user connected Gmail" to "backend makes a Gmail API call."

**CIBA polling and the free tier don't love each other.** Auth0's CIBA requires polling `/oauth/token` every few seconds. On Render's free tier, a cold server takes 30 seconds to wake — which completely breaks the real-time experience. The keep-alive ping solved it, but it required understanding exactly how Render's sleep timer works and cutting it close enough to actually matter.

**Port confusion burned hours.** Frontend on 5000, backend on 3001, Vite proxy bridging them — but Auth0 callback URLs, the CORS config, and the API base URL all had to agree on this. We had three different places with the wrong port hardcoded, and the error messages for each failure pointed to completely unrelated causes.

**Making AI responses feel human.** When you ask the co-pilot to "add a pricing table," it occasionally returns JSON. When you ask it to rewrite something, it returns prose. We needed a message renderer that detects JSON and formats it as a proper table or risk card, while falling back to plain text for conversational replies. That component went through four full rewrites.

---

## Accomplishments that we're proud of

The consent chain works end-to-end. Not mocked, not simulated. Connect your Gmail, approve a step — an email goes out from your real account. Connect GitHub — an issue gets created in your real repo. The Token Vault integration means every action is traceable: the credential ID that was exchanged, the timestamp, the outcome, all in the audit log.

We're proud of the 5-provider AI waterfall. It was straightforward to build and it completely eliminates the "AI is down" failure mode. In three days of testing, all five providers were never simultaneously unavailable. The combined free tier is genuinely sufficient for a production app at reasonable scale.

The CIBA mentor approval flow working in real time is the demo moment that lands hardest. Freelancer hits a button, mentor's phone buzzes 3 seconds later, mentor taps approve, the canvas updates. It's the kind of thing that reads better as a demo than as a feature description.

Demo mode might be our most underrated decision. The entire application runs without a backend, database, or Auth0 credentials. For a hackathon where judges have five minutes — that matters more than almost anything else.

---

## What we learned

**Token Vault changes the trust model, not just the security posture.** We kept saying DeliverVault was "more secure" because credentials aren't in our database. That's true but it's not the interesting part. The interesting part is visibility — users can see which connections are active, what each one authorizes, and revoke any of them instantly. That transparency is what actually makes clients comfortable with automation touching their project communication. The security improvement is a consequence of the transparency improvement.

**CIBA is underused because nobody shows a natural use case for it.** Every example we read described the same abstract banking scenario. Once we had the mentor approval flow working, it was immediately obvious why you'd want this pattern — and how it applies to any AI agent that needs human checkpoints before taking high-stakes actions. The use case was the explanation.

**Free tier is a real engineering constraint, not just a cost consideration.** Cold starts, rate limits, connection limits, storage caps — every architectural decision had a free tier implication. It made us better at prioritizing what had to be fast (proposal loads, step approvals) versus what could be slightly slower (audit log pagination, connection testing). The cache layer and the keep-alive aren't workarounds — they're the right choices for any latency-sensitive app on shared infrastructure.

---

## What's next for DeliverVault

The revocation flow deserves much more surface area. Right now it's one button on the Connections page. It should be visible on every step that used a token — showing exactly which credential was exchanged, with inline revocation. Auth0 gives us all the data to build that. We ran out of time.

A client-facing portal — a read-only live view of the proposal workflow, like a FedEx tracking page for a project. Clients shouldn't need to email "where are we on this?" They should have a URL they can bookmark.

Multi-freelancer agency mode. Right now proposals belong to one user. A team workspace where proposals can be assigned to different freelancers — each authenticated separately, each with their own Token Vault credentials — would make DeliverVault useful for small agencies, not just solo operators.

And the AI needs to grow into an actual agent. The current co-pilot is a chat interface. What it should be is something that proactively analyzes proposals for scope creep risk, flags payment terms that typically lead to disputes, and suggests protective contract language before you even ask. The infrastructure is already there. The intelligence needs to catch up.

---

## Built with

Auth0 Token Vault · Auth0 CIBA · Auth0 Guardian · Auth0 Management API · React · TypeScript · Vite · React Flow · Framer Motion · GSAP · Express.js · Node.js · MongoDB Atlas · Socket.io · Groq · Cerebras · SambaNova · Google Gemini · OpenRouter · Tailwind CSS · shadcn/ui · Render · Lovable · Stripe · Gmail API · Slack API · GitHub API
