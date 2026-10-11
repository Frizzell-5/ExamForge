# ExamForge

Local practice-exam generator for your Mac. A planner model designs each exam and red-teams it; a builder model writes the questions and grades written answers. Default models: Claude Fable 5.1 plans and Claude Opus 5.5 builds with an API key; Opus 5.5 does both on a subscription.

## Run

Double-click `start.command`, or:

```sh
cd ~/ExamForge && npm start   # http://localhost:4317
```

To get a Mac app (with its own icon, in its own window), run `scripts/make-mac-app.sh`. That installs **ExamForge.app** in `/Applications`, which starts the local server when needed and opens ExamForge without browser tabs or an address bar (via Chrome, Edge or Brave if installed). Keep the ExamForge folder where it was when you built the app.

Requires Node 18+. Under **Settings**, pick how ExamForge talks to Claude:

- **My Claude subscription** (the default when no API key is set): runs through the locally installed [Claude Code](https://claude.com/claude-code) `claude` command with your Claude plan. There are no extra charges, but it counts toward your plan's usage limits. Fable 5.1 needs paid usage credits on a plan, so Opus 5.5 does every stage by default.
- **API key**: pay-as-you-go through the Anthropic API. Paste a key in Settings or export `ANTHROPIC_API_KEY`.

## Workflow

1. **Ingest**: PDF (scanned PDFs and images are read visually), PPTX (with speaker notes), DOCX, VTT/SRT transcripts, TXT/MD/HTML/CSV, or pasted text. Mark past exams as *reference exams*.
2. **Architect** (planner model): builds a concept map, a list of misconceptions to use as traps, and one spec per question. With reference exams it can Influence, Mirror, Mirror-but-harder, or write Isomorphic variants.
3. **Forge** (builder model): writes the questions in parallel batches of 5. The batches share a prompt-cached copy of your sources.
4. **Red Team** (planner model): checks every question for a wrong key, more than one defensible answer, and giveaways, then rewrites the flawed ones.
5. **Calibrate**: shuffles options so the correct letter is spread evenly, and reports how often the correct option is the longest one.
6. **Take**: exam mode (timed) or tutor mode (instant feedback), with keyboard shortcuts. Results break down by concept, difficulty and type. From there you can generate an **adaptive remediation exam** aimed at what you missed, or a **harder version**.

All data stays in `ExamForge/data/`.
