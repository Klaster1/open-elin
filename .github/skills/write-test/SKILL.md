---
name: write-test
description: Writes and refactors deterministic Playwright e2e tests for this repo using strict comment structure, test-id selectors, branch-free flows, and seeded demo setup. Also governs test code embedded in implementation plans.
---

# Write Test

Creates and updates end-to-end tests for the web app with strict, repeatable patterns.

## When to Use

- Adding a new e2e spec
- Updating tests for UI/behavior changes
- User asks to "write test", "add coverage", "fix e2e", or "clean up spec"

## Mandatory Rules

- Use comment-structured test plans directly in the spec before each logical block.
- Use concise imperative comments matching repo style (e.g., `// Go to app`, `// Assert ...`).
- Do not use `Step 1`, `Step 2`, etc.
- When user requests comment-mode planning, create a spec skeleton with comments only and an empty test body (`test(..., async () => {})`), then STOP and wait for review before implementation.
- In comment-mode planning, keep comments in execution order and avoid strategy bullets that do not map to immediate test flow.
- Do not implement assertions/actions until user explicitly approves moving past comment-mode checkpoint.
- Default to one high-value fast-path spec that covers the critical user journey end-to-end.
- Only introduce split specs or matrix coverage when explicitly requested by user, or when a single path cannot cover required risk areas.
- If considering split/matrix coverage, state the specific risk gap first; if no concrete gap exists, keep one-spec scope.
- Comments must describe exact assertion contracts, not vague intent.
- Keep tests deterministic: seed demo state with fixture mutators before entering dependent screens.
- Avoid conditional branches in test flow (`if`, fallback navigation branches, etc.) unless explicitly required by product behavior.
- Prefer branch-free deterministic navigation/state setup.
- Assert in specs, not page models.
- Page models expose interactions/read helpers only.
- Use `page.getByTestId()` (configured for `data-test-id` attribute) as first choice. Never use `page.locator('[data-test-id="..."]')` — always use `getByTestId()`.
- If selector needs internals and there is no `data-test-id`, add `data-test-id` in UI first; avoid brittle structure/style selectors.
- Keep scope tight to the requested behavior; no unrelated assertions.
- After editing tests or tested behavior, run full e2e suite with `npm run test:e2e` from `demo-node` and report results.
- Never ask user whether to run full tests; run automatically unless already run in the same task.

## Setup and Execution

- Project root: `demo-node`
- Dev server command: `npm run dev` (only)
- Full e2e: `npm run test:e2e`
- Single spec: `npx playwright test e2e/<spec>.ts`

## Test Authoring Pattern

```ts
// Go to app
await landing.open();
await expect(landing.root()).toBeVisible();

// Start demo mode
await landing.startDemo();

// Seed deterministic hub state before entering cogs
await updateDemoHubState((draft) => {
  // Set deterministic fixture values
});

// Go to cogs screen
await device.goToCogsTab();

// Assert profiles section and empty state are visible
await expect(cogs.profilesSection()).toBeVisible();
await expect(cogs.profilesEmptyState()).toBeVisible();

// Assert empty-state save action is disabled
await expect(cogs.saveProfileButtonInEmptyState()).toHaveAttribute(
  "disabled",
  "",
);
```

## Anti-Patterns to Reject

- `if`-driven fallback flows in tests for convenience
- Expanding to split specs or matrix permutations without explicit requirement or concrete risk gap
- Vague comments like "Verify stuff" or "Check works"
- `Step N` comment prefixes
- Direct brittle selectors like `.foo > div:nth-child(2)` or internal element probes when `data-test-id` can be used
- Leaving suite-level validation undone after test/behavior changes

## Conversation-Learned Guardrails

- Seed demo cog data before navigating to cogs-dependent assertions.
- If setup logic depends on current position, seed that value at test start before navigating to Setup.
- If a refresh is already automatic in screen lifecycle, do not duplicate it in test setup.
- Use comments that map directly to the following assertion lines (e.g., "Assert empty state is visible and empty-state action is disabled").
- Keep persistence checks deterministic (explicit known route flow) rather than branch-based route recovery.
- For single-spec fast-path requests, collapse matrix cases into one deterministic path and keep only required persistence/state checks.
