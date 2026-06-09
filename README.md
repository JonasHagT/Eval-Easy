# Eval Easy

A split-screen interface for testing and evaluating Claude agents — without copy-pasting into spreadsheets.

You deploy an agent (defined by a system prompt and model), chat with it in the left panel, and rate each response on the right. Every eval is saved and exportable as CSV.

![Eval Easy Interface](docs/screenshot.png)

---

## Why this exists

When non-technical domain specialists test AI agents, the feedback loop usually looks like:

1. Chat with the agent
2. Copy the question → paste into a spreadsheet
3. Copy the response → paste into the spreadsheet
4. Type feedback in the next column
5. Repeat for every turn

Eval Easy eliminates steps 2–4. After every agent response, a rating form appears automatically on the right side of the screen. One click to rate, a sentence to comment, save. The eval dataset builds itself as you test.

---

## Features

- **Split-screen layout** — chat on the left, eval form on the right
- **Zero-friction capture** — eval form auto-populates after every agent turn, no switching screens
- **Thumbs up / down** quick verdict
- **1–5 star score** with hover preview
- **Issue tags** — color-coded by severity: `Wrong info`, `Off-topic`, `Too long`, `Tone off`, `Missing context`, `Great answer`, `Helpful`
- **Free-text notes** — "what should it have said?"
- **Eval history tab** — scrollable list of all saved evals in the session
- **CSV export** — one click to download all evals as a spreadsheet-ready file
- **Agent config modal** — swap system prompt, model, and display name without restarting
- **Multiple Claude models** — Sonnet 4.6 (default), Opus 4.8, Haiku 4.5

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
# Edit .env.local and replace the placeholder:
# ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at [console.anthropic.com](https://console.anthropic.com).

### 3. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Using the interface

### Configure your agent

Click **Configure Agent** in the top bar to open the config modal:

| Field | Description |
|---|---|
| **Agent name** | Display label shown in the top bar |
| **System prompt** | Instructions sent to Claude at the start of every conversation |
| **Model** | Which Claude model to use (see [Models](#models) below) |

Changes take effect immediately — the next message sent will use the new config. The conversation history is preserved.

### Chat with the agent

Type in the input box at the bottom left. Press **Enter** to send, **Shift+Enter** for a newline. The agent responds inline. The latest agent response gets a subtle highlight and a `Rate this response →` prompt.

### Rate a response

After every agent turn, the right panel automatically shows the **Rate This Turn** form:

1. **Quick verdict** — 👍 or 👎 (optional but fast)
2. **Score** — 1–5 stars, hover to preview (optional)
3. **Issue tags** — tap any that apply; multiple allowed
4. **Notes** — anything you'd tell the prompt engineer
5. Click **Save Eval**

Hitting **Skip** dismisses the form without saving. The form resets automatically when the next agent response arrives.

### View and export evals

Switch to the **History** tab in the right panel to see all saved evals for this session. Each row shows:
- Turn number and date
- Thumbs + star score
- Truncated question and response
- Tags and notes

Click **Export CSV** (in the History tab or the top bar) to download a file named `evals-YYYY-MM-DD.csv`.

---

## CSV format

Each row in the exported CSV is one saved eval:

| Column | Description |
|---|---|
| `id` | UUID for this eval entry |
| `sessionId` | UUID shared across all turns in one browser session |
| `turnIndex` | Which turn in the conversation (1-based) |
| `userMessage` | The exact message the user sent |
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
| `claude-haiku-4-5-20251001` | Haiku 4.5 | Fastest, lowest cost |

---

## Project structure

```
eval-easy/
├── app/
│   ├── layout.tsx              # Root layout, fonts, metadata
│   ├── page.tsx                # Main page — state orchestration
│   ├── globals.css             # Tailwind base + scrollbar styles
│   └── api/
│       ├── chat/route.ts       # POST — proxies messages to Claude API
│       └── evals/
│           ├── route.ts        # GET all evals, POST new eval, DELETE all
│           └── export/route.ts # GET — streams CSV download
├── components/
│   ├── ChatPanel.tsx           # Left panel — messages + input
│   ├── MessageBubble.tsx       # Individual message (user or assistant)
│   ├── EvalPanel.tsx           # Right panel — rating form + history
│   └── AgentConfigModal.tsx    # Modal for editing agent config
├── lib/
│   ├── types.ts                # Shared TypeScript interfaces
│   └── evalStore.ts            # File-based eval storage + CSV serialisation
└── data/
    └── evals.json              # Auto-created; stores all saved evals
```

### Key data flows

**Sending a message:**
```
page.tsx (sendMessage)
  → POST /api/chat  { messages, systemPrompt, model }
  → Anthropic SDK   claude.messages.create(...)
  ← { response: string }
  → setMessages + setPendingEval
  → EvalPanel receives pendingEval, resets form, tab switches to "Rate This Turn"
```

**Saving an eval:**
```
EvalPanel (handleSave)
  → onSave(thumbs, rating, tags, comment, model, turnIndex, ...)
  → page.tsx adds sessionId, agentName, systemPrompt
  → POST /api/evals  { full eval minus id/createdAt }
  → evalStore.ts: appends to data/evals.json
  ← { id, createdAt, ...rest }
  → evalCount++, pendingEval cleared
```

**Exporting:**
```
GET /api/evals/export
  → evalStore.readEvals()
  → evalsToCSV(evals)
  ← text/csv with Content-Disposition: attachment
```

---

## Local storage

Evals are stored in `data/evals.json` on the local filesystem. This is intentional — no database setup, no cloud account needed, data stays on your machine.

For production deployments (Vercel, Fly.io, etc.) the filesystem is ephemeral. To persist evals across deployments, swap `lib/evalStore.ts` for a database-backed implementation — the interface (`readEvals`, `saveEval`, `clearEvals`, `evalsToCSV`) is the only thing the API routes depend on.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key — never expose this client-side |

The key is only read server-side in `app/api/chat/route.ts` and never sent to the browser.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | API routes + React in one repo, zero config |
| Language | TypeScript | Type safety across front and back end |
| Styling | Tailwind CSS | Fast iteration, dark theme without custom CSS |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) | Official SDK, direct `messages.create` calls |
| Storage | JSON file (`fs`) | No infrastructure needed for local testing |

---

## Roadmap ideas

- **Streaming responses** — show the agent typing in real time
- **Multiple agents** — A/B test two system prompts on the same input
- **Session persistence** — reload past conversations
- **Eval templates** — pre-defined rubric tags per agent type (email tone, factual accuracy, etc.)
- **Aggregate stats** — thumbs ratio, average score, most common tags per session
- **Database backend** — swap `evalStore.ts` for Postgres/SQLite for multi-user use

---

## License

MIT
