---
name: make-feature
description: Strict 5-phase feature workflow: deep research, annotated plan artifact, tracked stepwise execution, implementation/chat/plan review pass, and actionable postmortem.
---

# Make Feature

Build features with a disciplined pipeline that separates thinking from typing.

## When to Use

- User asks to implement a new feature or evolve an existing one.
- Work spans UI + state + protocol/mock + tests.
- Requirement set is likely to evolve during iteration.

## Mandatory 5-Phase Workflow

This workflow is not optional. Do not skip phases.

### Phase 1 — Research Current State (no implementation)

- Read relevant codepaths deeply before proposing changes.
- Build a concrete map of how current behavior works across UI, state/store, protocol/mock, and tests.
- Write findings into a persistent artifact in `plans/` (for example: `plans/<date>-<feature>-research.md`).
- Treat that artifact as review surface; do not rely on chat-only summaries.
- If understanding is shallow, keep researching until key invariants and failure modes are explicit.

### Phase 2 — Plan Artifact and Refinement (no implementation)

- Create a detailed plan in `plans/` (for example: `plans/<date>-<feature>.md`).
- Plan must be broken into concrete, small, deliverable, checkable steps.
- Every step must include:
  - Goal
  - Exact files/components expected to change
  - Expected result
  - Review checklist with binary checks
  - Output to review
- Add an embedded TODO/progress section and explicit phase markers in the same plan file.
- Run refinement loop with user: update the plan based on inline/user notes until approved.
- Use explicit guard: “don’t implement yet” until user says execute.

### Phase 3 — Execute Step-by-Step with Embedded Progress Tracking

- Implement exactly one approved plan step at a time.
- After each step:
  - mark progress in the plan/TODO section,
  - run the narrowest relevant validation,
  - summarize what changed vs plan intent.
- Do not claim a step complete without running checks for that step.
- Keep execution branch-free and deterministic when possible.
- Prefer reuse of existing patterns/components over introducing new ones.
- Keep scope tight to approved plan; no silent feature expansion.

### Phase 4 — Cross-Check Review Pass (implementation ↔ chat ↔ plan)

- Perform an explicit consistency pass across three sources:
  1. Implemented code
  2. User-directed decisions captured in chat
  3. Plan file claims/checklists
- Reconcile mismatches immediately (status text, stale assumptions, missing validations, file references).
- For UI visibility/layout/icon questions, verify by screenshots first; screenshot truth overrides DOM assumptions.
- Run full repo regression at task completion (unless already run in same task) and record results.

### Phase 5 — Postmortem for Next Iteration Learning

- Produce a postmortem focused on reusable learning, not minute one-off nitpicks.
- Must cover:
  - Where steering was required and why
  - Process failures (research, planning, execution, validation, communication)
  - What guardrails/skills/docs were updated
  - Concrete behavior changes for next iteration
- If learning implies policy change, update relevant skill/guidance docs in the same session.

## Required Test Planning Behavior

- Use `.github/skills/write-test/SKILL.md` for e2e specifics.
- If user requests comment-mode checkpoint, create comment-only skeleton with empty test body and STOP for review.
- Default to one high-value fast-path spec unless user explicitly requests matrix/split or a concrete risk gap requires expansion.

## Required Checkpoints

- Research checkpoint: deep-read artifact exists in `plans/` and is reviewed.
- Plan checkpoint: approved plan with concrete steps/checklists and embedded progress tracking.
- Execution checkpoint: each step validated before completion status is reported.
- Review checkpoint: implementation/chat/plan consistency reconciled.
- Postmortem checkpoint: next-iteration learnings documented and integrated into skills/guidance.

## Implementation Heuristics

- Preserve existing architecture patterns and naming conventions.
- Fix root causes across layers (UI/store/protocol/mock), not only symptoms.
- Prefer deterministic flows and stable selectors.

## Anti-Patterns to Reject

- Starting implementation before research + approved plan.
- Generic plan steps that are not deliverable/checkable.
- Completing steps without running validations.
- Continuing past comment-mode review gate without user approval.
- Hand-wavy postmortems that do not change future behavior.

## Handoff Format

At completion, report in this order:

1. What changed (by plan step)
2. What was validated (targeted + full tests + visual checks where relevant)
3. What was reconciled in review pass (plan/chat/code mismatches fixed)
4. What we learned for next iteration (non-trivial, process-level)
