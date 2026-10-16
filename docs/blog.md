# A file lock would have said yes

We were running several coding agents on one repository. They forgot everything when a session ended, and they edited files that looked independent and were not. The usual fix is a lock on the filename, plus a human passing notes between the agents.

A filename lock cannot say that `LoginForm.tsx` imports `api/login.ts`, which imports `auth/session.ts`. If one agent is changing `session.ts` and another starts on the login form, the form can break without either agent touching the same file.

Switchboard parses the repository into FalkorDB. Files are nodes. Imports are edges. An agent claims the files it is about to edit. The next claim is a path query. A path is a conflict, and the path is what we show. No path is the proof that the two edits cannot collide. Decisions, lessons, and the edit log live in the same graph, so a replacement agent can be briefed from the neighborhood of the files it is about to touch, not from a search over a chat transcript.

We measured the difference with a script, not a vibe. Ten times, agent A had claimed `session.ts` and agent B applied an edit that deletes an import and leaves the call. The build broke all ten times. Ten times, the same edit was offered to Switchboard first. The graph blocked it all ten times, and the build stayed green. The median check was a fraction of a millisecond. The script is `npm run bench`. The numbers on the landing page are read from the file that command writes.

The part that took the longest to get right was not the query. It was the sentence. A red line on a graph is not an explanation. The page now says who cannot edit which file, which file the other agent holds, and the import path between them.

The optional sentence from a language model sits on top of that briefing and is off unless an API key is set. The graph is still the answer. Remove FalkorDB and the refusal, the path, the batches, the why-trace, and the briefing all disappear. That is the test we held the project to.
