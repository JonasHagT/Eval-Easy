# Eval Easy

A split-screen tool for testing AI agents — built so **you** (technical) set things up, and **domain specialists** score results via a simple invite link.

---

## Who does what

| You (technical) | Domain specialist |
|---|---|
| Connect agents (Claude or external API) | Open invite link |
| Build test bank & score guides | Review emails one at a time |
| Run tests / re-run | Score, tag, comment, override AI |
| Invite reviewers | See overall pass rate for the run |

---

## Quick start

```bash
git clone https://github.com/JonasHagT/Eval-Easy.git
cd Eval-Easy
npm install --legacy-peer-deps
cp .env.example .env.local
# Add ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Try the demo review invite:** [http://localhost:3000/review/demo-review-invite](http://localhost:3000/review/demo-review-invite)

---

## Specialist review flow

1. You run a batch from **Test Bank**
2. Click **Invite reviewer** (also available from Dashboard → run → Invite)
3. Copy the link and send it
4. Specialist enters their name → scores one email at a time
5. Scoring guide + AI grade sit next to the draft; they can agree or override
6. Both of you open **Overall** for pass rate, issues, and full drafts

Reviewers never see agent config, API keys, or model pickers.

---

## Features

### Agents library
- Multiple agents (e.g. Email Assistant + Sales follow-up)
- Each has instructions, score guide, pass threshold
- Claude models **or** external API URL (`POST { messages, instructions }` → `{ response }`)

### Manual chat + score
- Split screen: chat left, score right
- Email-specific tags (weak subject, too salesy, missing CTA, placeholders left…)

### Test bank + batch runs
- Per-agent questions with “what good looks like”
- Auto-grade with LLM-as-judge
- Results marked `pending_review` until a specialist scores them

### Invite + review queue
- Magic link: `/review/[token]`
- One-item queue with progress bar
- Override AI grades (tracked as overrides)
- Shared overall: `/review/[token]/overall`

### Run overall + re-run
- `/runs/[runId]` — invite, re-run all, retry failed only
- Dashboard links into each run

---

## How to use

### 1. Configure agents
Click **Agents** → add/edit. Set instructions and “what does a good answer look like?”

### 2. Build the test bank
**Test Bank** → add questions for the active agent.

### 3. Run tests
**Run tests** → name the run → pick model → start. When done: **Invite reviewer**.

### 4. Specialist scores
They open the link, enter their name, and work through the queue.

### 5. Improve and re-run
From the run page or dashboard: **Re-run all** or **Retry failed**.

---

## Demo data

| Resource | Value |
|---|---|
| Agents | Email Assistant, Sales follow-up |
| Demo run | `v1 — Email baseline` |
| Demo invite token | `demo-review-invite` |
| Review URL | `/review/demo-review-invite` |
| Run overall | `/runs/run-demo-batch-001` |

---

## External agent API

When an agent’s connection is **External API**, Eval Easy POSTs:

```json
{
  "messages": [{ "role": "user", "content": "…" }],
  "instructions": "…",
  "systemPrompt": "…",
  "model": "…",
  "agentName": "…"
}
```

Expect:

```json
{ "response": "Subject: …\n\nBody…" }
```

Also accepts `content`, `message`, `text`, or `output`.

---

## Project structure

```
app/
  page.tsx                 # Chat + score
  dashboard/page.tsx       # Progress, invites, re-run
  test-suite/page.tsx      # Test bank + batch
  review/[token]/          # Specialist queue
  review/[token]/overall/  # Shared overall
  runs/[runId]/            # Run detail, invite, re-run
  api/agents|invites|review|runs|chat|evals|test-suite/
components/
  AgentLibraryModal.tsx
  InviteModal.tsx
  ScoreForm.tsx
  EvalPanel.tsx / ChatPanel.tsx / ProgressChart.tsx
lib/
  types.ts, agentStore.ts, inviteStore.ts, evalStore.ts,
  runStore.ts, testStore.ts, agentRunner.ts
data/
  agents.json, invites.json, evals.json, runs.json, test-questions.json
```

---

## Storage

JSON files under `data/`. Fine for a shared hosted instance (Fly, Railway, a VM). For serverless (Vercel), swap the `*Store.ts` files for a database — API routes only depend on those interfaces.

---

## Environment

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (for Claude agents + auto-grade) | Server-side only |

---

## License

MIT
