# Eval Easy

A split-screen interface for testing and evaluating Claude agents — built for domain experts, not developers.

Chat with your agent on the left, rate each response on the right. Build a reusable test bank, run automated batch evals, and track improvement over time on the dashboard.

---

## Why this exists

When non-technical domain specialists test AI agents, the feedback loop usually looks like:

1. Chat with the agent
2. Copy the question → paste into a spreadsheet
3. Copy the response → paste into the spreadsheet
4. Type feedback in the next column
5. Repeat for every turn

Eval Easy eliminates steps 2–4. After every agent response, a rating form appears automatically. One click to rate, a sentence to comment, save. The eval dataset builds itself as you test.

When the evals are mature enough, switch to **Batch mode**: fire your full test bank at the agent automatically, get AI-graded results in minutes, then compare pass rates across model versions on the dashboard.

---

## Features

### Manual eval (Chat → Rate → Repeat)
- **Split-screen layout** — chat on the left, eval form on the right
- **Zero-friction capture** — form auto-populates after every agent turn
- **Thumbs up / down** quick verdict
- **1–5 star score** with hover preview
- **Issue tags** — color-coded: `Wrong info`, `Off-topic` (blocking), `Too long`, `Tone off`, `Missing context` (quality), `Great answer`, `Helpful`
- **Free-text notes** — "what should it have said?"

### Test Bank (`/test-suite`)
- Manage a reusable list of test questions
- Add notes on what a good answer looks like — these guide the AI auto-grader
- 8 categories: General, Follow-up, Cold outreach, Declining, Complaints, Onboarding, Sales, Internal
- Pre-loaded with 8 demo questions for an email writing agent

### Batch runs
- Run all test questions against the agent automatically
- **Pick a model per run** — compare Sonnet vs Haiku vs Opus on the same questions
- **LLM-as-judge** auto-grading via Claude Haiku — score 1–5, pass/fail verdict, one-sentence reasoning
- Real-time progress bar and live result stream
- All results saved to the dashboard

### Dashboard (`/dashboard`)
- **Progress chart** — pass rate over time, color-coded by model
- **Run comparison table** — hill-climbing view across named experiment runs
- **Failure analysis** — bar chart of tag frequency, blocking tags highlighted
- **All-evals table** — full history with AI grade and human notes side by side
- **CSV export** — one click download

### Agent config
- Name, system prompt, and model stored in `localStorage` — persists across pages
- **"What does a good answer look like?"** annotation guide per agent, used by the AI auto-grader
- Switch model at any time — or pick a different model per batch run for comparison

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/JonasHagT/Eval-Easy.git
cd Eval-Easy
npm install
```

### 2. Add your Anthropic API key

```bash
cp .env.example .env.local
# Edit .env.local:
# ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at [console.anthropic.com](https://console.anthropic.com).

### 3. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How to use

### Step 1 — Configure your agent

Click **Configure Agent** in the top bar:

| Field | Description |
|---|---|
| **Agent name** | Display label |
| **System prompt** | Instructions sent to Claude at the start of every conversation |
| **What does a good answer look like?** | Description of good responses — used by the AI auto-grader during batch runs |
| **Model** | Default model for chat |

Config is saved to `localStorage` and shared across all pages.

### Step 2 — Build your test bank

Go to **Test Bank** (`/test-suite`) to add reusable test questions:

- Write the question the agent should answer
- Add notes about what a good answer looks like (guides auto-grading)
- Assign a category

The app ships with 8 demo questions for an email writing agent.

### Step 3 — Manual testing

Chat with the agent on the main page. After each response, rate it in the right panel. You don't need to rate every turn — skip anything uninteresting.

### Step 4 — Run a batch

When your test bank is ready, click **▶ Run Batch** in the Test Bank page:

1. Name the run (e.g. `v2 — more context in prompt`)
2. Pick the model to test
3. Click **Start Run**

Every question is sent to the agent, auto-graded by Claude Haiku, and saved to the dashboard. Runs take 30–90 seconds depending on the number of questions.

### Step 5 — Track progress on the dashboard

Go to **Dashboard** (`/dashboard`) to see:
- **Progress chart** — pass rate per run, line chart over time, color-coded by model
- **Run comparison table** — sorted by date, best run highlighted
- **Failure analysis** — which tags appear most, blocking failures flagged

---

## Workflow: hill climbing with model switching

```
v1 — Baseline (Sonnet)       → 62% pass rate
v2 — More context (Sonnet)   → 74% pass rate
v3 — More context (Opus)     → 81% pass rate  ← new best
```

Each batch run picks a model. The dashboard charts them all so you can see whether prompt changes or model upgrades are driving improvement.

---

## CSV format

Each row in the exported CSV is one saved eval:

| Column | Description |
|---|---|
| `id` | UUID for this eval entry |
| `sessionId` | UUID shared across all turns in one session |
| `runId` | Named run ID (if part of a batch run) |
| `runName` | Named run display name |
| `turnIndex` | Which turn in the conversation (1-based) |
| `userMessage` | The exact question asked |
| `agentResponse` | The exact response the agent gave |
| `rating` | Star score (1–5) or empty |
| `thumbs` | `up`, `down`, or empty |
| `tags` | Comma-separated list of selected tags |
| `comment` | Free-text notes |
| `agentName` | Agent display name at time of eval |
| `model` | Model ID used for this turn |
| `createdAt` | ISO 8601 timestamp |

---

## Models

| Model ID | Label | Best for |
|---|---|---|
| `claude-sonnet-4-6` | Sonnet 4.6 | Default — best balance of quality and speed |
| `claude-opus-4-8` | Opus 4.8 | Most capable, slower |
| `claude-haiku-4-5-20251001` | Haiku 4.5 | Fastest, lowest cost — used for auto-grading |

---

## Project structure

```
eval-easy/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                      # Main chat + eval page
│   ├── dashboard/page.tsx            # Dashboard — metrics, chart, tables
│   ├── test-suite/page.tsx           # Test Bank + batch run modal
│   └── api/
│       ├── chat/route.ts             # Proxies to Claude API
│       ├── runs/route.ts             # Named run management
│       ├── evals/
│       │   ├── route.ts              # CRUD for eval entries
│       │   ├── export/route.ts       # CSV download
│       │   └── autograde/route.ts    # LLM-as-judge via Haiku
│       └── test-suite/route.ts       # CRUD for test questions
├── components/
│   ├── ChatPanel.tsx
│   ├── MessageBubble.tsx
│   ├── EvalPanel.tsx                 # Rating form + history (⚡ AI badge for auto-graded)
│   ├── AgentConfigModal.tsx          # Agent config including annotation guide
│   └── ProgressChart.tsx            # SVG pass-rate chart
├── lib/
│   ├── types.ts                      # Shared TypeScript interfaces
│   ├── evalStore.ts                  # File-based eval storage + CSV
│   ├── runStore.ts                   # File-based run storage
│   └── testStore.ts                  # File-based test question storage
└── data/
    ├── evals.json                    # All saved evals
    ├── runs.json                     # Named runs
    └── test-questions.json           # Test bank questions
```

---

## Local storage

All data is stored in `data/*.json` on the local filesystem. No database, no cloud account needed, data stays on your machine.

For production deployments (Vercel, Fly.io, etc.) the filesystem is ephemeral. Swap the `*Store.ts` files for a database-backed implementation — the interfaces are the only thing API routes depend on.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key — only used server-side |

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) |
| Auto-grading | Claude Haiku 4.5 (LLM-as-judge) |
| Storage | JSON files (`fs`) |

---

## License

MIT
