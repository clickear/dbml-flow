# Layout Mode Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline layout mode picker to the existing rearrange control and make `compact` the default layout.

**Architecture:** Reuse the existing Zustand `layoutMode`, `setLayoutMode`, and `onLayout` APIs. Keep expanded/collapsed UI state local to `RearrangeButton`, and keep layout execution flowing through the existing orchestrator.

**Tech Stack:** TypeScript, React, React Flow controls, Zustand, lucide-react icons, Node test runner via esbuild.

---

### Task 1: Default Layout Mode

**Files:**
- Modify: `src/lib/layout/layout.types.ts`
- Modify: `src/lib/layout/layout.orchestrator.test.ts`

- [ ] **Step 1: Add failing default-mode test**

Add this import to `src/lib/layout/layout.orchestrator.test.ts`:

```ts
import { DEFAULT_LAYOUT_MODE, type LayoutEngines } from "./layout.types";
```

Replace the existing type-only import from `./layout.types`.

Add this test:

```ts
test("defaults to compact layout mode", () => {
  assert.equal(DEFAULT_LAYOUT_MODE, "compact");
});
```

Run: `npm run test:layout`

Expected: FAIL because `DEFAULT_LAYOUT_MODE` is currently `leftright`.

- [ ] **Step 2: Change default mode**

Change `src/lib/layout/layout.types.ts`:

```ts
export const DEFAULT_LAYOUT_MODE: LayoutMode = "compact";
```

Run: `npm run test:layout`

Expected: PASS.

### Task 2: Inline Layout Picker UI

**Files:**
- Modify: `src/components/controls/rearrange-button.tsx`

- [ ] **Step 1: Implement expanded picker**

Update `RearrangeButton` to:

- keep `expanded` in local state;
- read `layoutMode`, `setLayoutMode`, and `onLayout` from the store;
- toggle expansion when clicking the magic wand;
- render `LR`, snowflake, and compact buttons inline when expanded;
- on option click, call `setLayoutMode(mode)`, then `onLayout(fitView, mode)`, then collapse.

Because `setLayoutMode` and `onLayout` are separate store calls, `onLayout` should accept an optional mode override so the selected mode is used immediately.

### Task 3: Store Mode Override

**Files:**
- Modify: `src/state/store.ts`

- [ ] **Step 1: Add optional mode parameter**

Change the `onLayout` type:

```ts
onLayout: (fitView: FitView, mode?: LayoutMode) => void;
```

Change the implementation to read:

```ts
const { nodes, edges, layoutMode } = get();
const modeToApply = mode ?? layoutMode;
```

Pass `modeToApply` to `layoutGraph`.

### Task 4: Verification

**Files:**
- Verify: layout picker, default mode, and existing uncommitted dictionary width fix.

- [ ] **Step 1: Run focused tests**

Run:

```sh
npm run test:layout
npm run test:dbml-math
```

Expected: PASS.

- [ ] **Step 2: Run build**

Run:

```sh
npm run build
```

Expected: PASS.
