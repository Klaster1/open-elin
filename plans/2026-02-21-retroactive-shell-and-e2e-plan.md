# Retroactive Feature Plan — Device Shell Naming + E2E Layout (2026-02-21)

This is a **retroactive** make-feature plan artifact for work that was implemented before formal plan gating.
It captures the executed scope, validation, and remaining follow-ups in the same structure required by `.github/skills/make-feature/SKILL.md`.

---

## Feature Scope

- Reclassify device container from page to shell semantics.
- Keep device subviews as page components.
- Restructure E2E tree so it is organized around:
  - `e2e/pages`
  - `e2e/fixtures`
- Fix all E2E imports after file moves.
- Preserve test behavior and selectors.

---

## Embedded TODO / Progress

- [x] Phase 1 complete: current-state research artifact (retroactive summary)
- [x] Phase 2 complete: concrete plan + checklists in this file
- [x] Step 1: Rename device container component to shell
- [x] Step 2: Rewire app route rendering to shell container
- [x] Step 3: Update repo guidance for shell vs page naming
- [x] Step 4: Restructure E2E directory to include fixtures folder
- [x] Step 5: Fix E2E import paths after move
- [x] Step 6: Run full E2E validation
- [ ] Optional follow-up: rename `renderDevicePage` to `renderDeviceSubview` for terminology consistency

---

## Phase 1 — Research Current State (No Implementation)

### Findings (captured retroactively)

- Device container behavior lived in `page-device` naming but functioned as a shell/orchestrator over subviews.
- Subviews were already page-style components (`page-device-list`, `page-device-motor`, etc.).
- Router mounted the container from `App.renderDeviceRoute(...)`.
- E2E files were split between root-level specs and fixture utility module, then moved to `e2e/fixtures` causing relative import drift.

### Invariants

- URL shape remains `/device/:mac/:page`.
- Subview tags remain `page-device-*`.
- Existing `data-test-id` selectors remain stable.
- Full Playwright pass required after each structural move.

---

## Phase 2 — Plan Artifact and Refinement (No Implementation)

## Step 1 — Rename device container to shell semantics

**Status:** ✅ Completed

**Goal**

- Align container naming with architecture intent: shell, not page.

**Files Changed**

- `src/web/components/page-device.ts` -> `src/web/components/shell-device.ts`
- `src/web/components/shell-device.ts` (class + custom element)

**Expected Result**

- Container class/tag become `ShellDevice` / `shell-device`.

**Review Checklist**

- [x] File renamed to `shell-device.ts`.
- [x] `export class ShellDevice ...`.
- [x] `customElements.define("shell-device", ShellDevice)`.

**Output to Review**

- Shell component rename diff.

---

## Step 2 — Rewire router rendering

**Status:** ✅ Completed

**Goal**

- Mount shell container from app route renderer.

**Files Changed**

- `src/web/components/app.ts`

**Expected Result**

- Device route renders `<shell-device ...>`.

**Review Checklist**

- [x] Tag updated from `page-device` to `shell-device`.
- [x] Existing properties/events unchanged.

**Output to Review**

- `App.renderDeviceRoute(...)` diff.

---

## Step 3 — Update guidance docs

**Status:** ✅ Completed

**Goal**

- Prevent naming regression by documenting shell/page split.

**Files Changed**

- `AGENTS.md`

**Expected Result**

- Guidance explicitly states device container is shell (`shell-device`).

**Review Checklist**

- [x] Top-level page guidance retained for route views.
- [x] Device container special-case guidance added.

**Output to Review**

- Naming rules diff in `AGENTS.md`.

---

## Step 4 — Restructure E2E directories

**Status:** ✅ Completed

**Goal**

- Organize E2E around dedicated folders (`pages`, `fixtures`).

**Files Changed**

- `e2e/fixtures.ts` -> `e2e/fixture.ts`
- Specs moved under `e2e/fixtures/`

**Expected Result**

- Folder-based structure exists and tests still execute.

**Review Checklist**

- [x] `e2e/pages` exists.
- [x] `e2e/fixtures` exists and contains spec files.
- [x] Shared fixture helper exists at `e2e/fixture.ts`.

**Output to Review**

- E2E tree layout diff.

---

## Step 5 — Repair moved spec imports

**Status:** ✅ Completed

**Goal**

- Fix relative imports from moved specs.

**Files Changed**

- `e2e/fixtures/*.spec.ts` (all moved specs)

**Expected Result**

- Imports resolve from new directory layout.

**Review Checklist**

- [x] `./fixtures` replaced with `../fixture`.
- [x] `./pages/*` replaced with `../pages/*`.
- [x] No stale local import patterns remain.

**Output to Review**

- Import-path normalization diff.

---

## Step 6 — Validation checkpoint

**Status:** ✅ Completed

**Goal**

- Confirm behavior and regression status after structural changes.

**Validation Run**

- `npm run test:e2e`

**Expected Result**

- Full Playwright suite passes.

**Review Checklist**

- [x] All specs execute successfully.
- [x] No failing regressions from rename/restructure.

**Output to Review**

- Test run summary (`14 passed`).

---

## Phase 3 — Step-by-Step Execution Tracking

- Execution completed step-by-step with validation after structural changes.
- Imported paths were corrected only after move operations.
- No functional expansion beyond approved scope.

---

## Phase 4 — Cross-Check Review Pass (Code ↔ Chat ↔ Plan)

### Reconciled Mismatches

- Corrected terminology mismatch: device container renamed from page to shell.
- Corrected import mismatches introduced by directory move.
- Updated `AGENTS.md` to reflect final naming policy.

### Consistency Outcome

- Code, plan claims, and user decisions are aligned for this feature cycle.

---

## Phase 5 — Postmortem (Next Iteration Learning)

### Where steering was required

- Naming intent changed late (page vs shell), requiring targeted refactor.
- Directory restructuring introduced predictable relative-import fallout.

### Process failures

- Plan gate was skipped before implementation start.
- Move operations happened before complete import-impact map.

### Guardrail updates for next iteration

- Start every feature with a `plans/<date>-<feature>.md` before first code edit.
- Add “expected import path changes” subsection before any move/rename step.
- Require targeted grep pass immediately after filesystem moves.

### Concrete behavior change

- Use make-feature phases as mandatory checkpoints, even for “small” refactors.
- Treat naming semantics (shell/page) as architecture constraints, not cosmetic labels.
