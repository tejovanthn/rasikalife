---
name: project-auto-checkpoint-commits
description: Something outside the agent auto-commits the working tree as "checkpoint:" commits mid-session, so an uncommitted diff can vanish into history while you review it
metadata:
  type: project
---

This repo has an automatic checkpointing mechanism that commits the working tree on a timer with messages shaped `checkpoint: <paths> (N files, <timestamp>)`. It fires without the agent doing anything.

**Why:** observed during the phase 2 artist-membership review (2026-07-22). `git status` showed four modified files at 16:12; by 16:27 the tree was clean and `ef470a3b9 checkpoint: ...` held them. Nothing the agent ran committed anything.

**How to apply:**
- When asked to "review the working tree, it's uncommitted", pin the review to a **base commit** (`git diff <base>`) at the start rather than relying on `git status` staying meaningful. Re-run `git diff <base> --stat` at the end to confirm the reviewed content is unchanged.
- A clean `git status` mid-task is not evidence the agent committed. Check `git log` before apologising for a commit you did not make, and say so explicitly when a "do not commit" instruction was in force.
- Scratch test files written into `packages/*/src/` can be swept into a checkpoint. Delete them promptly, or keep them in the session scratchpad and copy in only for the duration of one test run.

Related: [[feedback-review-gate]].
