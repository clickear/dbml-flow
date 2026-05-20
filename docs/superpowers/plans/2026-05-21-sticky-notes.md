# Sticky Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DBML `Note` canvas nodes with editor/canvas navigation, lightweight markdown-like rendering, attachment metadata, saved positions, and owner-aware hidden-state behavior.

**Architecture:** Extend the existing DBML parse pipeline to map `database.notes` into a third React Flow node type that sits beside tables and groups, but remains outside automatic layout. Keep attachment ownership as parsed content metadata, thread note targets through the existing source-map/store focus APIs, and reuse the saved-position plus hidden-tree flows instead of inventing a separate note persistence layer.

**Tech Stack:** TypeScript, React 19, React Flow, Zustand, `@dbml/core`, Monaco editor helpers, Node test runner via esbuild.

---

### Task 1: Add Note Types And Parser Coverage

**Files:**
- Modify: `src/types/nodes.types.ts`
- Modify: `src/lib/dbml/node-dmbl.parser.ts`
- Create: `src/lib/dbml/sticky-note.parser.ts`

- [ ] **Step 1: Write the failing parser tests**

Create `src/lib/dbml/sticky-note.parser.ts` with these tests first:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { Parser } from "@dbml/core";
import {
  getAttachedNodeId,
  getNoteId,
  parseNoteAttachment,
} from "./sticky-note.parser";
import { parseDatabaseToGraph } from "./node-dmbl.parser";

const parser = new Parser();

test("parses note attachment metadata from the first line only", () => {
  assert.deepEqual(
    parseNoteAttachment("@attach table:ecommerce.orders\n# Orders summary"),
    { kind: "table", targetId: "t-ecommerce.orders" },
  );
  assert.deepEqual(
    parseNoteAttachment("@attach group:ecommerce\nBody"),
    { kind: "group", targetId: "g-public.ecommerce" },
  );
  assert.equal(parseNoteAttachment("# Orders summary"), null);
});

test("maps database notes into note nodes", () => {
  const database = parser.parse(
    "Table ecommerce.orders { id int [pk] }\nNote note_orders { '@attach table:ecommerce.orders\\n# Orders summary' }",
    "dbmlv2",
  );

  const { noteNodes } = parseDatabaseToGraph(database);

  assert.equal(noteNodes.length, 1);
  assert.equal(noteNodes[0]?.id, getNoteId("public", "note_orders"));
  assert.equal(noteNodes[0]?.data.ownerNodeId, "t-ecommerce.orders");
  assert.equal(noteNodes[0]?.data.lines[1], "# Orders summary");
});
```

Run:

```sh
node --test src/lib/dbml/sticky-note.parser.ts
```

Expected: FAIL because the module and note node mapping do not exist yet.

- [ ] **Step 2: Add note node types**

Update `src/types/nodes.types.ts` to add a dedicated note node type:

```ts
import type { StickyNote, Ref, Table } from "@dbml/core";

export type NoteAttachment =
  | { kind: "table"; targetId: string }
  | { kind: "group"; targetId: string };

export type NoteNodeData = SharedNodeData & {
  note: StickyNote;
  ownerNodeId?: string;
  lines: string[];
};

export const NodeTypes = {
  TableGroup: "TableGroup",
  Table: "Table",
  Note: "Note",
} as const;

export type NoteNodeType = Node<NoteNodeData, "Note">;
export type NodeType = TableNodeType | GroupNodeType | NoteNodeType;
```

- [ ] **Step 3: Implement note parsing helpers**

Create `src/lib/dbml/sticky-note.parser.ts`:

```ts
import type { StickyNote } from "@dbml/core";

import { NodeTypes, type NoteAttachment, type NoteNodeType } from "@/types/nodes.types";

const NOTE_WIDTH = 280;
const NOTE_MIN_HEIGHT = 120;

export function getNoteId(schema: string, name: string) {
  return `n-${schema}.${name}`;
}

export function parseNoteAttachment(content: string): NoteAttachment | null {
  const [firstLine] = content.split(/\r?\n/u);
  const match = firstLine?.match(/^@attach\s+(table|group):(.+)$/u);
  if (!match) return null;

  const [, kind, rawTarget] = match;
  const target = rawTarget.trim();
  if (kind === "table") return { kind: "table", targetId: `t-${target}` };
  return { kind: "group", targetId: target.includes(".") ? `g-${target}` : `g-public.${target}` };
}

export function getAttachedNodeId(note: StickyNote) {
  return parseNoteAttachment(note.content ?? "")?.targetId;
}

export function mapNoteToNode(note: StickyNote): NoteNodeType {
  const lines = (note.content ?? "").split(/\r?\n/u);
  return {
    id: getNoteId(note.schema.name, note.name),
    type: NodeTypes.Note,
    position: { x: 0, y: 0 },
    zIndex: 20,
    data: {
      label: note.name,
      hovered: false,
      folded: false,
      note,
      ownerNodeId: getAttachedNodeId(note),
      lines,
      color: "#f6e27a",
    },
    initialWidth: NOTE_WIDTH,
    initialHeight: Math.max(NOTE_MIN_HEIGHT, lines.length * 24),
  };
}
```

- [ ] **Step 4: Return note nodes from DBML graph parsing**

Update `src/lib/dbml/node-dmbl.parser.ts`:

```ts
import { mapNoteToNode } from "./sticky-note.parser";

export function parseDatabaseToGraph(
  database: Database,
  nestedGroups?: NestedGroupModel,
) {
  const tables = database.schemas.flatMap((s) => s.tables);
  const groups = database.schemas.flatMap((s) => s.tableGroups);
  const notes = database.notes ?? [];

  const tableNodes = tables.map((t) => mapTableToNode(t));
  const noteNodes = notes.map((note) => mapNoteToNode(note));
  // existing group logic unchanged

  return {
    tableNodes,
    groupNodes,
    noteNodes,
  };
}
```

Run:

```sh
node --test src/lib/dbml/sticky-note.parser.ts
```

Expected: PASS.

### Task 2: Extend Source Mapping For Notes

**Files:**
- Modify: `src/lib/dbml/source-map.ts`
- Modify: `src/lib/dbml/source-map.test.ts`
- Modify: `src/state/store.ts`

- [ ] **Step 1: Add failing source-map note tests**

Append these tests to `src/lib/dbml/source-map.test.ts`:

```ts
test("maps note declarations and resolves editor clicks to note targets", () => {
  const code = "Note note_orders { '@attach table:ecommerce.orders\\n# Orders summary' }\n";
  const sourceMap = buildDbmlSourceMap(code);

  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 1, column: 7 }), {
    kind: "note",
    id: "n-public.note_orders",
  });
  assert.deepEqual(
    getRangeForTarget(sourceMap, { kind: "note", id: "n-public.note_orders" }),
    {
      startLineNumber: 1,
      startColumn: 6,
      endLineNumber: 1,
      endColumn: 17,
    },
  );
});
```

Run:

```sh
npm run test:source-map
```

Expected: FAIL because `note` targets are unsupported.

- [ ] **Step 2: Add note ranges and targets to source map**

Update `src/lib/dbml/source-map.ts`:

```ts
export type DbmlSourceTarget =
  | { kind: "table"; id: string }
  | { kind: "field"; id: string; tableId: string }
  | { kind: "group"; id: string }
  | { kind: "note"; id: string }
  | { kind: "edge"; sourceFieldId: string; targetFieldId: string };

export type SourceNote = {
  id: string;
  name: string;
  schema: string;
  nameRange: SourceRange;
  declarationRange: SourceRange;
  blockRange: SourceRange;
};
```

Extend `ParsedBlock["kind"]` to include `"note"`, update the block regex from:

```ts
const marker = /\b(TableGroup|Table)\s+/gu;
```

to:

```ts
const marker = /\b(TableGroup|Table|Note)\s+/gu;
```

Map note blocks into `sourceMap.notes`, include note declaration matching in `findTargetAtPosition`, and return note ranges in `getRangeForTarget`.

- [ ] **Step 3: Route note focus through the store**

Update `src/state/store.ts` in both directions:

```ts
if (target.kind === "table" || target.kind === "group" || target.kind === "note") {
  set({
    pendingFlowFocus: { kind: "node", nodeId: target.id },
    highlightedFieldId: null,
  });
  return;
}
```

`jumpToSource` should keep using `getRangeForTarget` so note double-click support arrives automatically once the source map is extended.

Run:

```sh
npm run test:source-map
```

Expected: PASS.

### Task 3: Render Note Nodes And Hook Up Canvas Navigation

**Files:**
- Create: `src/components/sticky-note-node.tsx`
- Modify: `src/components/viewer/viewer.tsx`
- Modify: `src/components/viewer/viewer.helper.ts`
- Modify: `src/state/store.ts`

- [ ] **Step 1: Write the failing viewer helper test**

Append to `src/components/viewer/viewer.helper.test.ts`:

```ts
test("uses sticky-note color in minimap for note nodes", () => {
  assert.equal(
    getNodeColor({
      id: "n-public.note_orders",
      type: NodeTypes.Note,
      position: { x: 0, y: 0 },
      data: {
        label: "note_orders",
        hovered: false,
        folded: false,
        color: "#f6e27a",
        note: {} as never,
        lines: [],
      },
    } as NodeType),
    "#f6e27a",
  );
});
```

Run:

```sh
npm run test:viewer
```

Expected: FAIL because the note type is not recognized in helper typings yet.

- [ ] **Step 2: Add the sticky note node component**

Create `src/components/sticky-note-node.tsx`:

```tsx
import { cn } from "@/lib/utils";
import useStore from "@/state/store";
import { NodeTypes, type NoteNodeType } from "@/types/nodes.types";
import { type NodeProps } from "@xyflow/react";

import { BaseNode } from "./base-node";

function renderLine(line: string, index: number) {
  const trimmed = line.trim();
  if (!trimmed) return <div key={index} className="h-2" />;
  if (trimmed.startsWith("# ")) return <h3 key={index} className="text-sm font-semibold">{trimmed.slice(2)}</h3>;
  if (trimmed.startsWith("- ")) return <li key={index} className="ml-4 list-disc">{trimmed.slice(2)}</li>;
  return <p key={index} className="text-sm leading-5">{line}</p>;
}

export function StickyNoteNode({ id, data, selected }: NodeProps<NoteNodeType>) {
  const hoveredOwnerId = useStore((state) => state.hoveredNodeId);
  const attachedToHoveredOwner = data.ownerNodeId && hoveredOwnerId === data.ownerNodeId;

  return (
    <BaseNode
      id={id}
      selected={selected}
      hidden={false}
      className={cn("max-w-[280px] border-0 p-0 shadow-md", attachedToHoveredOwner && "ring-2 ring-[color:var(--accent)]")}
      style={{
        width: 280,
        backgroundColor: data.color,
      }}
    >
      <div className="border-b border-black/10 px-3 py-2 text-xs font-medium uppercase tracking-normal">
        {data.label}
      </div>
      <div className="space-y-1 px-3 py-3 text-zinc-900">
        {data.lines.filter((line, index) => !(index === 0 && line.startsWith("@attach "))).map(renderLine)}
      </div>
    </BaseNode>
  );
}
```

- [ ] **Step 3: Register note nodes and note double-click navigation**

Update `src/components/viewer/viewer.tsx`:

```ts
import { StickyNoteNode } from "@/components/sticky-note-node";

const nodeTypes = {
  [NodeTypes.Table]: TableNode,
  [NodeTypes.TableGroup]: TableGroupNode,
  [NodeTypes.Note]: StickyNoteNode,
};
```

Update node double-click handling:

```ts
onNodeDoubleClick={(_, node) => {
  useStore.getState().jumpToSource({
    kind:
      node.type === NodeTypes.TableGroup
        ? "group"
        : node.type === NodeTypes.Note
          ? "note"
          : "table",
    id: node.id,
  });
}}
```

- [ ] **Step 4: Keep notes outside auto layout but inside saved-position updates**

Update `src/state/store.ts` so notes are separated from tables/groups during layout:

```ts
const oldNoteNodes = get().nodes.filter((n) => n.type === NodeTypes.Note);
let { tableNodes, groupNodes, noteNodes } = parseDatabaseToGraph(database, nestedGroups);

const shouldRunLayout =
  oldTableNode.length !== tableNodes.length ||
  oldGroupNodes.length !== groupNodes.length ||
  Object.keys(savedPositions).length === 0;

if (shouldRunLayout) {
  const layout = await layoutGraph({ ... });
  tableNodes = layout.tableNodes;
}

noteNodes = applySavedPositions(noteNodes, savedPositions);
const finalNodes = [...groupNodes, ...tableNodes, ...noteNodes];
setSavedPositions([...tableNodes, ...noteNodes]);
```

`onLayout` should keep rearranging only tables/groups and preserve note positions:

```ts
const noteNodes = nodes.filter((n) => n.type === NodeTypes.Note);
set({
  nodes: [...newGroupNodes, ...newTableNodes, ...noteNodes],
});
get().setSavedPositions([...newTableNodes, ...noteNodes]);
```

Run:

```sh
npm run test:viewer
```

Expected: PASS.

### Task 4: Owner Visibility, Saved Views, And Structure Tree Behavior

**Files:**
- Modify: `src/lib/views/structure-tree.ts`
- Modify: `src/lib/views/structure-tree.test.ts`
- Modify: `src/lib/views/saved-views.test.ts`
- Modify: `src/state/store.ts`

- [ ] **Step 1: Add failing hidden-state test for attached notes**

Append to `src/lib/views/structure-tree.test.ts`:

```ts
function note(id: string, label: string, ownerNodeId?: string): NoteNodeType {
  return {
    id,
    type: NodeTypes.Note,
    position: { x: 0, y: 0 },
    data: {
      label,
      hovered: false,
      folded: false,
      note: {} as never,
      ownerNodeId,
      lines: [],
    },
  };
}

test("hides attached notes when their owner table is hidden", () => {
  const graphNodes = [
    table("t-public.users", "users"),
    note("n-public.users_note", "users_note", "t-public.users"),
  ];

  assert.deepEqual(
    collectHiddenNodeIds(graphNodes, new Set(["t-public.users"])),
    new Set(["t-public.users", "n-public.users_note"]),
  );
});
```

Run:

```sh
npm run test:structure-tree
```

Expected: FAIL because notes are not part of hidden propagation yet.

- [ ] **Step 2: Propagate owner hiding to notes**

Update `src/lib/views/structure-tree.ts` to:

```ts
function collectAttachedNotes(
  ownerId: string,
  nodes: NodeType[],
  hidden: Set<string>,
) {
  nodes
    .filter(
      (node): node is NoteNodeType =>
        node.type === NodeTypes.Note && node.data.ownerNodeId === ownerId,
    )
    .forEach((note) => hidden.add(note.id));
}
```

Call `collectAttachedNotes` whenever a hidden root or hidden group descendant is added.

Keep notes out of `buildStructureTree()` so the drawer remains table/group-centric.

- [ ] **Step 3: Verify saved-view sanitizing keeps note positions**

Extend `src/lib/views/saved-views.test.ts` view fixture:

```ts
positions: {
  "t-public.users": [100, 200],
  "n-public.users_note": [320, 140],
},
```

and keep `"n-public.users_note"` in the current node id set for the sanitize test so note positions survive sanitization.

Run:

```sh
npm run test:saved-views
npm run test:structure-tree
```

Expected: PASS.

### Task 5: End-To-End Store Integration And Verification

**Files:**
- Modify: `src/state/store.ts`
- Modify: `ReadMe.md`
- Modify: `package.json` (only if a dedicated note test script is needed)

- [ ] **Step 1: Finalize store focus and persistence details**

Ensure these store paths all include note nodes:

```ts
const noteNodes = nodes.filter((n) => n.type === NodeTypes.Note);
```

Use that in:

- `updateViewerFromDatabase`
- `applySavedView`
- `saveActiveView`
- `saveViewAs`
- `setSavedPositions`
- `onLayout`

Selection/focus rules:

- note editor click => `pendingFlowFocus.kind = "node"` with the note id
- note canvas double-click => `jumpToSource({ kind: "note", id })`
- note focus should clear `highlightedFieldId`

- [ ] **Step 2: Mark remaining out-of-scope note work in README todo**

Keep `ReadMe.md` aligned with the approved non-goals:

```md
## Notes
- [ ] Floating Notes
  - [ ] Automatic layout participation
  - [ ] Rich text editor / toolbar
  - [ ] Drag coupling to table/group owners
  - [ ] Editor/canvas bidirectional jump for note attachments
  - [ ] Table/group visual ownership affordances
```

Then prune the bullets that are now implemented from this list before committing.

- [ ] **Step 3: Run full verification**

Run:

```sh
npm run test:source-map
npm run test:viewer
npm run test:structure-tree
npm run test:saved-views
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```sh
git add ReadMe.md docs/superpowers/specs/2026-05-21-sticky-notes-design.md docs/superpowers/plans/2026-05-21-sticky-notes.md src/types/nodes.types.ts src/lib/dbml/node-dmbl.parser.ts src/lib/dbml/sticky-note.parser.ts src/lib/dbml/source-map.ts src/lib/dbml/source-map.test.ts src/components/sticky-note-node.tsx src/components/viewer/viewer.tsx src/components/viewer/viewer.helper.ts src/lib/views/structure-tree.ts src/lib/views/structure-tree.test.ts src/lib/views/saved-views.test.ts src/state/store.ts
git commit -m "feat: add sticky note canvas nodes"
```

Expected: commit succeeds with the sticky note feature and plan/spec/docs updates.
