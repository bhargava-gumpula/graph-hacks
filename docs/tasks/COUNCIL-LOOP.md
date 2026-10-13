# Cloud task: improve our Graph Hacks idea until it has a ≥15% chance to win a track

You are running in a cloud session. **Hard budget: $50 total. Track your estimated spend and stop at $45** (estimate each subagent's tokens × model price; Opus 5.5 is $4/$20 per MTok and Sonnet 5.5 is $2/$10). If you can't estimate, cap it at **40 advisor runs in total**.

**Ideas, notes and graph-model sketches only: write no product code.** The hackathon rules forbid main coding or design work before the start, Tue Oct 14 11:31 AM PT.

## Read first
- `docs/HACKATHON.md`: the rules, tracks, dates and submission requirements.
- `docs/COUNCIL.md`: three earlier councils. **Council 3 is the important one:** what each idea scored, the competitors found, and the "best version" fixes.
- `docs/brief-1.md` (Switchboard) and `docs/brief-2.md` (Maintainer Brain): the original neutral briefs.
- `docs/advisor-process.md`: the required deep process every advisor follows.

## The loop
1. **Generate candidates (round 1).** Write 4–6 improved idea briefs in the same neutral format as `brief-1.md`, each a single idea:
   - the best version of Switchboard (from Council 3),
   - the best version of Maintainer Brain,
   - 2–4 genuinely different ideas that tackle what Council 3 punished: originality, the graph being essential (graph algorithms as the hero, the graph as the product's model, as Atrium was), demo memorability, and real usefulness.

   Avoid the crowded ideas: generic fraud rings, "chat with your docs", plain GraphRAG chatbots, and GitHub-repo-as-company clones. Each brief must fit one builder directing Claude Code agents, 4 days, about $30 of Claude API spend, and public, synthetic or own data. Save them as `docs/council-loop/round1/candidate-N.md`.
2. **Evaluate blind.** For each candidate, run **5 independent advisors** (Contrarian, First Principles, Expansionist, Outsider, Executor), each in its own subagent:
   - Each advisor reads **only** its candidate's brief, `docs/advisor-process.md` and `docs/HACKATHON.md`. It never sees other candidates, earlier councils or this file.
   - Each follows the full process in `advisor-process.md`, including real web research.
   - Use Opus 5.5 for the advisors.
3. **Score.** Average each candidate's win chance and scores. Write `docs/council-loop/roundN/results.md`.
4. **Improve.** Take the top 2 candidates. Revise their briefs to fix the flaws the advisors found (do not argue with the advisors: change the idea), then save them as round N+1 candidates.
5. **Repeat steps 2–4** until a candidate averages **≥15% win chance with all five advisors at 12% or higher**, or the budget runs out.
   - Use fresh advisors every round, so no advisor ever sees an earlier version.
   - Write each revised brief so it isn't inflated: describe what will actually be built, not what sounds good. The advisors are told to be calibrated, and a brief that over-promises is a failed brief.

## Deliverables
Commit everything under `docs/council-loop/` and push to a branch named `council-loop`. Do not push to `main`. Finish with `docs/council-loop/FINAL.md`, containing:
- the winning brief and its scorecard per advisor,
- the runner-up,
- what changed each round and why,
- the estimated total spend,
- open risks.
