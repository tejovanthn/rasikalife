---
name: project-auto-checkpoint-commits
description: The working tree moves under you mid-review — both auto "checkpoint:" commits and Tejovanth hand-editing the files you are reviewing
metadata:
  type: project
---

This repo has an automatic checkpointing mechanism that commits the working tree on a timer with messages shaped `checkpoint: <paths> (N files, <timestamp>)`. It fires without the agent doing anything.

**Why:** observed during the phase 2 artist-membership review (2026-07-22). `git status` showed four modified files at 16:12; by 16:27 the tree was clean and `ef470a3b9 checkpoint: ...` held them. Nothing the agent ran committed anything.

**How to apply:**
- When asked to "review the working tree, it's uncommitted", pin the review to a **base commit** (`git diff <base>`) at the start rather than relying on `git status` staying meaningful. Re-run `git diff <base> --stat` at the end to confirm the reviewed content is unchanged.
- A clean `git status` mid-task is not evidence the agent committed. Check `git log` before apologising for a commit you did not make, and say so explicitly when a "do not commit" instruction was in force.
- Scratch test files written into `packages/*/src/` can be swept into a checkpoint. Delete them promptly, or keep them in the session scratchpad and copy in only for the duration of one test run.
- He also **hand-edits the files under review while the review is running**. During the phase 4 collaborators review (2026-07-23) the backfill's count arithmetic — one of the seven things he had asked to be scrutinised — was rewritten between the `git diff` and the `Read`, three minutes apart. Re-read any file whose exact lines you are about to cite, and when a finding has already been fixed under you, say so rather than reporting it.
- Stronger form, seen on the bio-structuring review (2026-07-30): he lands a **real `fix:` commit on top of the commit under review, mid-review**, in a parallel session. HEAD moved from `19a916c25` to `ec553aa8d fix: three defects found reviewing the bio-structuring commit` while the agent was reading, silently invalidating every `HEAD~1 HEAD` diff already taken (they returned empty, which is the tell). So: capture the review base as an explicit SHA in the first command, diff `<base>~1 <base>` thereafter, and **re-run `git log --oneline -3` right before writing up** to see what he has already fixed — three of the findings were gone by the time the review was written.
- Note the scratchpad cannot resolve workspace deps: a probe importing `@rasika/core` only works from inside a package that depends on it. Write it to `packages/<pkg>/src/`, run it, and `rm` it in the same command.

Related: [[feedback-review-gate]].
