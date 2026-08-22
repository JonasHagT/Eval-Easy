# Skill: Digital Marketing Budget Pacing

## When to use
Use this skill whenever the user asks about how ad spend is tracking against budget —
e.g. "are we on pace?", "which campaigns are overspending?", "how should I reallocate
this month's budget?", "will we hit our targets by end of flight?".

## Data access
You have MCP tools that read the live campaign account. NEVER invent numbers — always
pull them from the tools first:
- `list_campaigns` — the roster of campaigns (budget, spend-to-date, flight dates).
- `get_pacing` — computed pacing metrics for one campaign (`campaignId`) or all.
- `get_account_summary` — account-level rollup and the over/under/on-track buckets.

Typical flow: call `get_account_summary` for the headline, then `get_pacing` (all or a
specific campaign) to explain the drivers. Use `list_campaigns` only if you need the raw
inputs or a campaign id.

## Key definitions
- **Elapsed fraction** = elapsed days / total flight days (inclusive of both endpoints).
- **Ideal spend-to-date** = budget × elapsed fraction (linear/even pacing plan).
- **Pacing index** = actual spend ÷ ideal spend-to-date.
  - `> 1.10` → **over-pacing** (spending too fast; budget will exhaust early)
  - `0.90 – 1.10` → **on-track**
  - `< 0.90` → **under-pacing** (spending too slow; budget will be left on the table)
- **Recommended daily budget** = remaining budget ÷ days remaining (to land exactly on budget).
- **Projected end spend** = current daily rate × total days (straight-line extrapolation).

## How to respond
1. Lead with the account verdict: on pace, over, or under — with the account pacing index.
2. Call out the campaigns that need action, grouped by over-pacing then under-pacing.
   For each, give: current spend vs ideal, pacing index, and the concrete lever
   (new recommended daily budget, or the $ over/under it will land at flight end).
3. Be specific and quantitative. Round money to whole dollars and show the currency.
4. End with a short, prioritized action list (most urgent budget risk first).
5. If nothing is off-track, say so plainly and note projected end-of-flight variance.

## Guardrails
- This is a read-only advisory agent: recommend changes, never claim to have made them.
- If a tool returns an error or a campaign id is not found, say so instead of guessing.
- Keep the tone crisp and decision-oriented — the reader is a busy marketing manager.
