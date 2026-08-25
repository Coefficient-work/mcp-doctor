---
name: codex-vs-cursor
description: >-
  Routes coding work to Codex vs Cursor for Louis. Use when planning work,
  choosing an agent, starting a large migration or batch PR, scoping a walk-away
  task, or when the user asks “should I use Codex?”, “Codex or Cursor?”, which
  agent to use, or whether a job is interactive vs async.
---

# Codex vs Cursor — agent routing

Route the **coding agent**, not the framework/stack. Do **not** recommend Claude Code as default. Do **not** push Hermes, Buzz, Obsidian, or Cloudflare Workers for this decision.

## Defaults

| Tool | Role |
|------|------|
| **Cursor** | Daily IDE — UI work, Flutter, Payload admin, TARS ops, fuzzy explore/debug, tight interactive loops, reviewing diffs live |
| **Codex** | Walk-away / async agent — scoped migrations, schema PRs, batch fixes, FlutterFlow/Firebase cleanup, large refactors where Louis can leave and come back to a PR |

## Decision checklist

Prefer **Cursor** when any of these dominate:

- Visual / UI iteration (layout, Flutter widgets, Payload admin screens)
- Unclear scope — need explore → poke → adjust in one session
- TARS hub ops, finance scripts, Gmail/remote bridge, Mac mini control
- Live diff review, pair-style debugging, “stay with me while we fix this”
- Small edits that benefit from IDE context (open files, canvas, terminal)

Prefer **Codex** when most of these are true:

- Scope is writable as a bounded PR (files/areas named up front)
- Work is batchy or mechanical (migrate X→Y, fix N call sites, schema + follow-through)
- Louis wants to **walk away** and return to a PR / branch
- FlutterFlow or Firebase cleanup / large generated-code sweeps
- Multi-hour refactor where interactive back-and-forth adds little

**Split the job** when both apply: Cursor for discovery and acceptance criteria → Codex for the bulk PR → Cursor for review polish.

## Output format (when advising)

Keep it short:

1. **Recommendation:** Cursor | Codex | Split
2. **Why:** 1–2 bullets from the checklist above
3. **If Codex:** one-line PR/scope brief Louis can paste (goal, in-scope paths, out-of-scope, done when)
4. **If Cursor:** stay in-session; no walk-away framing needed

## Repo notes (optional)

| Repo / area | Lean |
|-------------|------|
| `jobs-foundation-website` | Codex especially useful (WP→Payload/media migrations, batch content) |
| `yjordan` | Codex strong for scoped batch/migration PRs |
| Flutter / Firebase batch work | Codex for cleanup sweeps; Cursor for UI polish |
| `tars`, `paedia`, `slj` | Cursor primary (UI/ops, interactive loops) |

These are biases, not hard locks — still apply the checklist.

## Anti-patterns

- Do not churn stacks or suggest switching frameworks to “make Codex happier”
- Do not default to Claude Code / Hermes / Buzz / Obsidian / CF for routing
- Do not send fuzzy, unscoped “make it better” jobs to Codex without a PR brief
- Do not force Codex on TARS ops or live UI tuning

## Quick prompt

```text
Use codex-vs-cursor. Job: {one sentence}. Repo: {name}. Interactive now or walk-away PR?
```
