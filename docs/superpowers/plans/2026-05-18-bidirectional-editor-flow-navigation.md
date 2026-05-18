# Bidirectional Editor Flow Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build bidirectional double-click navigation between the DBML editor and React Flow canvas for tables, fields, TableGroups, and stable relationships.

**Architecture:** Add a Unicode-aware DBML source map module and route all navigation through Zustand store actions. React Flow consumes pending editor-to-canvas focus requests and Monaco handles canvas-to-editor focus and selection.

**Tech Stack:** React 19, TypeScript, Monaco Editor, @xyflow/react, Zustand, @dbml/core.

---

## File Structure

- Create `src/lib/dbml/source-map.ts`: Unicode-aware scanner and source target lookup.
- Create `src/lib/dbml/source-map.test.ts`: source map unit tests using Node's built-in test runner and `tsx` or compiled JS path if a test runner is added.
- Modify `src/lib/dbml/nested-group.parser.ts`: support Unicode and quoted TableGroup names and members.
- Modify `src/state/store.ts`: store Monaco editor instance, source map, pending flow focus, field highlight, and navigation actions.
- Modify `src/components/editor/editor.tsx`: register Monaco double-click navigation and store the editor instance.
- Modify `src/components/viewer/viewer.tsx`: handle pending focus, node/edge selection, viewport centering, node/edge double-click navigation.
- Modify `src/components/table-node.tsx`: pass double-click handlers to fields and table node body.
- Modify `src/components/table-node-field.tsx`: support field double-click and highlighted styling.
- Modify `src/components/table-group-node.tsx`: support TableGroup double-click to editor.
- Modify `src/components/edges/table-edge.tsx`: make selected edges visually distinct if needed.
- Modify `package.json`: add a focused test script if no existing test script is available.

## Tasks

### Task 1: Source Map Tests

**Files:**
- Create: `src/lib/dbml/source-map.test.ts`
- Create: `src/lib/dbml/source-map.ts`
- Modify: `package.json`

- [ ] **Step 1: Add test command**

Add a script:

```json
"test:source-map": "tsx --test src/lib/dbml/source-map.test.ts"
```

Add `tsx` as a dev dependency if the command is unavailable locally.

- [ ] **Step 2: Write failing source map tests**

Test Unicode tables, quoted identifiers, TableGroups, members, and refs. Expected initial failure: imports or functions are missing.

- [ ] **Step 3: Run test to verify red**

Run: `npm run test:source-map`

Expected: fail because `buildDbmlSourceMap` and related types are not implemented.

### Task 2: Source Map Implementation

**Files:**
- Modify: `src/lib/dbml/source-map.ts`
- Test: `src/lib/dbml/source-map.test.ts`

- [ ] **Step 1: Implement minimal scanner**

Implement:

```ts
export type SourceRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export type DbmlSourceTarget =
  | { kind: "table"; id: string }
  | { kind: "field"; id: string; tableId: string }
  | { kind: "group"; id: string }
  | { kind: "edge"; id: string }
  | { kind: "group-member"; id: string; target: DbmlSourceTarget };

export function buildDbmlSourceMap(code: string): DbmlSourceMap;
```

Use offset-to-position conversion and Unicode-aware identifier scanning. Handle quoted identifiers by unquoting the value and preserving the source range of the unquoted token including quote boundaries for selection.

- [ ] **Step 2: Run source map tests**

Run: `npm run test:source-map`

Expected: pass.

### Task 3: Nested TableGroup Unicode Support

**Files:**
- Modify: `src/lib/dbml/nested-group.parser.ts`
- Test: `src/lib/dbml/source-map.test.ts` or create a focused nested group test.

- [ ] **Step 1: Write failing nested group tests**

Cover:

```dbml
Table 用户 { 编号 int }
TableGroup 分组 { 用户 }
TableGroup 父级 { 分组 }
```

and quoted names.

- [ ] **Step 2: Verify red**

Run: `npm run test:source-map`

Expected: fail on current ASCII TableGroup extraction.

- [ ] **Step 3: Update nested group parser**

Reuse identifier parsing helpers from `source-map.ts` or move shared helpers into a small exported section.

- [ ] **Step 4: Verify green**

Run: `npm run test:source-map`

Expected: pass.

### Task 4: Store Navigation State

**Files:**
- Modify: `src/state/store.ts`

- [ ] **Step 1: Add store fields and action signatures**

Add editor instance, source map, pending focus, highlighted field, and actions:

```ts
setEditor: (editor: editor.IStandaloneCodeEditor | null) => void;
jumpToSource: (target: DbmlSourceTarget) => void;
requestFlowFocusAtEditorPosition: (position: editor.IPosition) => void;
consumePendingFlowFocus: () => FlowFocusRequest | null;
clearFieldHighlight: () => void;
```

- [ ] **Step 2: Build source map on parse**

Update `parseDBML` to rebuild source map from the original code before or after parser execution so editor navigation still works around parse errors where possible.

- [ ] **Step 3: Type-check**

Run: `npm run build`

Expected: fail only on UI callers not wired yet, then continue wiring.

### Task 5: Editor Wiring

**Files:**
- Modify: `src/components/editor/editor.tsx`

- [ ] **Step 1: Store Monaco editor instance**

Call `setEditor(editor)` on mount and clear it on unmount if needed.

- [ ] **Step 2: Register double-click handler**

Use Monaco mouse event detail to detect double-clicks. Resolve clicked position through store action.

- [ ] **Step 3: Type-check**

Run: `npm run build`

Expected: remaining errors only from viewer/table callers not wired yet.

### Task 6: Canvas Wiring and Highlight

**Files:**
- Modify: `src/components/viewer/viewer.tsx`
- Modify: `src/components/table-node.tsx`
- Modify: `src/components/table-node-field.tsx`
- Modify: `src/components/table-group-node.tsx`
- Modify: `src/components/edges/table-edge.tsx`

- [ ] **Step 1: Add canvas double-click actions**

Wire table, field, TableGroup, and edge double-click to `jumpToSource`.

- [ ] **Step 2: Consume pending flow focus**

In `ERViewer`, consume pending focus, update selected nodes/edges, and center viewport.

- [ ] **Step 3: Add field highlight style**

Apply a non-layout-shifting background/ring to the highlighted field row.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: pass.

### Task 7: Manual Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Start dev server**

Run: `npm run dev -- --host 127.0.0.1 --port 5173`

- [ ] **Step 2: Verify manually**

Use DBML with Chinese names, quoted names, TableGroups, nested TableGroups, fields, and refs. Verify both directions and fallback behavior.

- [ ] **Step 3: Final verification**

Run:

```bash
npm run test:source-map
npm run build
```

Expected: both pass.
