# Note Attached Top Bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace attached-note docking behavior with a stable attached-top folded bar that sits above tables and groups by default, while keeping expanded notes as floating cards.

**Architecture:** Split note behavior into two categories: attached notes and unattached notes. Attached notes default to a `folded-attached-top` presentation anchored to the owner, with width rules based on owner type. Expanding an attached bar creates a floating note beside the owner; collapsing it always returns to the owner top bar. Unattached notes keep the existing floating behavior.

**Tech Stack:** TypeScript, React 19, React Flow, Zustand, Node test runner via esbuild.

---

### Task 1: Replace Docked Tests With Attached-Top Tests

**Files:**
- Modify: `src/lib/dbml/sticky-note.parser.test.ts`

- [ ] **Step 1: Add failing attached-top tests**

Replace the current docking-oriented assertions with attached-top assertions:

```ts
test("maps attached table notes to folded attached-top state by default", () => {
  const database = parser.parse(
    "Note note_orders { '@attach table:ecommerce.orders\\n# Orders summary' }",
    "dbmlv2",
  );

  const { noteNodes } = parseDatabaseToGraph(database);

  assert.equal(noteNodes[0]?.data.displayMode, "folded-attached-top");
});

test("places attached table note bars with table width", () => {
  const ownerNode = owner("t-public.users", 320, 160, 220);
  const placed = placeNotesNearOwners(
    [note("n-public.users_note", ownerNode.id)],
    new Map([[ownerNode.id, ownerNode]]),
    wideBounds,
  );

  assert.equal(placed[0]?.data.displayMode, "folded-attached-top");
  assert.equal(placed[0]?.data.dockedWidth, 220);
  assert.deepEqual(placed[0]?.position, { x: 320, y: 130 });
});
```

Add a group-width cap test:

```ts
test("caps attached table-group note bar width", () => {
  const groupNode = {
    id: "g-public.auth",
    type: NodeTypes.TableGroup,
    position: { x: 120, y: 180 },
    data: {
      label: "auth",
      hovered: false,
      folded: false,
      nodeIds: [],
      dimensions: { width: 640, height: 240 },
      bounds: { xMin: 120, xMax: 760, yMin: 180, yMax: 420, width: 640, height: 240 },
    },
  } as never;

  const placed = placeNotesNearOwners(
    [note("n-public.group_note", groupNode.id)],
    new Map([[groupNode.id, groupNode]]),
    wideBounds,
  );

  assert.equal(placed[0]?.data.dockedWidth, 320);
});
```

Run:

```sh
npm run test:sticky-notes
```

Expected: FAIL because attached notes still use the old docking model.

- [ ] **Step 2: Change note presentation model**

Update `src/types/nodes.types.ts`:

```ts
export type NoteDisplayMode =
  | "expanded-floating"
  | "folded-floating"
  | "folded-attached-top";
```

Update `src/lib/dbml/sticky-note.parser.ts` so attached notes default to `folded-attached-top` and no longer choose between right/left/docked as the default collapsed state.

Run:

```sh
npm run test:sticky-notes
```

Expected: PASS for the new attached-top placement tests.

### Task 2: Render Attached Top Bars

**Files:**
- Modify: `src/components/sticky-note-node.tsx`
- Modify: `src/types/nodes.types.ts`

- [ ] **Step 1: Render attached-top bars**

Update `src/components/sticky-note-node.tsx`:

- `folded-attached-top` renders as a full-width title bar above the owner
- `expanded-floating` remains the existing full note card
- `folded-floating` remains a compact floating title bar for unattached notes

Rendering rules:

- attached-top bars use `data.dockedWidth`
- table-attached bars use exact owner width
- group-attached bars use `min(group width, 320)`
- attached-top bars align left with the owner
- attached-top bars sit directly above the owner top edge

- [ ] **Step 2: Preserve note content rendering**

Keep the current markdown-lite body rendering for expanded notes only. Attached-top bars never render note body.

Run:

```sh
npm run build
```

Expected: PASS.

### Task 3: Update Store Behavior For Attached Notes

**Files:**
- Modify: `src/state/store.ts`
- Modify: `src/lib/dbml/sticky-note.parser.ts`

- [ ] **Step 1: Add failing expand/collapse behavior tests**

Append to `src/lib/dbml/sticky-note.parser.test.ts`:

```ts
test("expanding an attached-top note places it beside the owner", () => {
  const ownerNode = owner("t-public.users", 320, 160, 220);
  const expanded = expandNoteToFloating(
    {
      ...note("n-public.users_note", ownerNode.id),
      data: {
        ...note("n-public.users_note", ownerNode.id).data,
        folded: true,
        displayMode: "folded-attached-top",
      },
    },
    new Map([[ownerNode.id, ownerNode]]),
    wideBounds,
  );

  assert.equal(expanded.data.displayMode, "expanded-floating");
  assert.equal(expanded.position.x, 564);
});

test("collapsing an expanded attached note returns it to owner top bar", () => {
  const ownerNode = owner("t-public.users", 320, 160, 220);
  const placed = placeNotesNearOwners(
    [
      {
        ...note("n-public.users_note", ownerNode.id),
        position: { x: 40, y: 40 },
        data: {
          ...note("n-public.users_note", ownerNode.id).data,
          displayMode: "expanded-floating",
        },
      },
    ],
    new Map([[ownerNode.id, ownerNode]]),
    wideBounds,
  );

  assert.equal(placed[0]?.data.displayMode, "folded-attached-top");
});
```

Run:

```sh
npm run test:sticky-notes
```

Expected: FAIL until expand/collapse helpers distinguish attached notes from unattached ones.

- [ ] **Step 2: Make store collapse attached notes back to owner top bars**

Update `src/state/store.ts` note folding logic:

- expanding `folded-attached-top` -> `expanded-floating`
- collapsing attached expanded note -> recompute `folded-attached-top`
- expanding/collapsing unattached note continues to use floating states

- [ ] **Step 3: Keep drag behavior scoped to expanded state only**

Dragging an expanded attached note should only affect the current floating state. Once collapsed, it returns to the owner top bar.

Run:

```sh
npm run test:sticky-notes
npm run build
```

Expected: PASS.

### Task 4: Full Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run:

```sh
npm run test:sticky-notes
npm run test:source-map
npm run test:structure-tree
npm run test:saved-views
npm run test:viewer
```

Expected: PASS.

- [ ] **Step 2: Run build**

Run:

```sh
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

Run:

```sh
git add docs/superpowers/specs/2026-05-21-sticky-notes-design.md docs/superpowers/plans/2026-05-21-note-attached-top-bars.md src/types/nodes.types.ts src/lib/dbml/sticky-note.parser.ts src/lib/dbml/sticky-note.parser.test.ts src/components/sticky-note-node.tsx src/state/store.ts
git commit -m "feat: add attached top note bars"
```

Expected: commit succeeds.
