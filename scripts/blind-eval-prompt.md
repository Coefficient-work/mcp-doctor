You are a working developer who just found MCP Doctor. You have no prior context, internal docs, or relationship with the authors.

Isolation rules (mandatory):
- Do not search this machine for coefficient, mcp-doctor clones, past chats, or sibling repos.
- Treat only the local tarball `./mcp-doctor.tgz` in this workspace and whatever it prints as ground truth.
- Do not use `@latest`, GitHub, or the unscoped npm package named `mcp-doctor`.

## Goal

1. Invent a small but realistic MCP server project from scratch (not a toy one-file hello-world, and not named PulseOps, CloudShelf, BeaconHub, or HarborLine). Give it a plausible product name, users, and 6-12 tools with uneven quality on purpose: some good, some vague, some missing schemas, some huge descriptions, at least one destructive-ish tool that is not named delete/remove (use verbs like purging/zeroing/pruning in the description), at least one that takes a secret in a tool argument, at least one list_* tool with all-optional filters (`required: []`), at least one tool with no inputSchema at all, at least one update_/configure_ tool whose description mentions removing failed backends, at least one vault_pointer / *_ref argument that is an env-var name not the secret itself, and at least one description that uses ordinary English words like Executive or Execute.
2. Put the project in this workspace directory. Make it actually runnable as an MCP server (stdio is fine). Include an mcp.json here.
3. Discover and use MCP Doctor only via this exact command:

   npx --yes --package ./mcp-doctor.tgz mcp-doctor

4. Use the tool the way a motivated first-time user would: `--help`, `--version`, then whatever commands look relevant. Write reports to files. Try at least one command that might fail.
5. After `list --config ./mcp.json`, run `inspect <name>` **without** repeating `--config`. Also try `analyze <name>`, `test` and `analyze` with no arguments, `benchmark` without `--out`, `competitors`, `build --demo` without `--out`, and `eval` if a model key is available in the environment or MCP Doctor's default per-user credential file. Do not inspect or print credential values, and do not create accounts.
6. Improve the MCP based on the tool's output. Re-run inspect after changes. Note what got better, what didn't, and what you still don't know how to fix.
7. Maximize product feedback. Be specific and slightly adversarial. Quote exact CLI output, flags, error messages, and report sections. Do not be polite or vague.

## Constraints

- No API keys required unless a command clearly needs one; skip paid eval if it's blocked, and report that as feedback.
- Don't enable telemetry, waitlists, billing, or network posting of reports.
- Don't "fix" the doctor CLI itself. Use it as a user.
- Timebox implementation, not feedback: a working MCP + two inspect passes is enough. Spend extra effort on the critique.

## Deliverable

Write `REPORT.md` in this workspace with these sections (all required):

### 1. Project invented
Name, what it does, tool list, path, how to run it, mcp.json snippet.

### 2. First-run diary
Minute-by-minute: what you typed, what happened, where you hesitated, what you guessed. Include copy-paste of `--help`, `--version`, and the first real command.

### 3. Commands used
Table: command, expected, actual, exit code, time feel (instant / slow / hung), artifacts written.

### 4. What the reports claimed
Grades, checks, suggested fixes. What you agreed with vs disagreed with, with evidence from your code.

### 5. Changes you made
Diff-level summary. What the doctor caused you to change. Second-run score vs first-run.

### 6. Feedback on MCP Doctor (the point)
Cover all of:
- Install / npx / naming / version
- Discoverability of commands (inspect vs test vs eval vs benchmark vs build)
- Flag and argument UX
- Error messages and failure modes, especially a tool with missing inputSchema
- Report format (markdown quality, actionability, false positives/negatives)
- Suggested-fix quality: enough to patch, or too generic?
- Scorecard: gameable? unfair? missing important MCP issues?
- Token / schema / auth / destructive-tool handling
- Docs vs CLI: contradictions, missing examples
- Trust: local-only claims, surprises about network or files touched
- What a first-time user still cannot do
- Top 5 bugs or papercuts
- Top 5 feature requests
- One-line verdict: would you run this again before shipping an MCP? Why/why not?

### 7. Raw artifacts
Attach or inline the inspect reports (before and after), `--help` text, and any errors.

Start by inventing the project. Do not ask clarifying questions; choose reasonable defaults and proceed.
