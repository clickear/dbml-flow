# Canvas Saved Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-local saved canvas views and a right-side collapsible structure drawer for TableGroup/Table navigation and per-view hiding.

**Architecture:** Keep full parsed graph state in Zustand, add tested pure helpers for saved-view persistence and structure/visibility calculations, then filter visible nodes and edges before rendering React Flow. The drawer UI owns user interaction, while React Flow viewport capture/restore stays in the viewer through `useReactFlow()`.

**Tech Stack:** React 19, TypeScript, Zustand, @xyflow/react, lucide-react, Node test runner with esbuild-bundled test scripts.

---

## File Structure

- Create `src/lib/views/saved-views.ts`: saved view types, localStorage-safe serialization, sanitizing saved state against current nodes, and view capture data helpers.
- Create `src/lib/views/saved-views.test.ts`: unit tests for serialization and missing-node sanitization.
- Create `src/lib/views/structure-tree.ts`: TableGroup/Table tree building, descendant hidden id expansion, visible node filtering, visible edge filtering.
- Create `src/lib/views/structure-tree.test.ts`: unit tests for root-level ungrouped tables, nested groups, hidden descendants, and edge filtering.
- Create `src/components/viewer/view-drawer.tsx`: right-side collapsible drawer, saved view selector, save/save-as controls, and structure tree UI.
- Modify `src/state/store.ts`: saved view state/actions, hidden node state, drawer state, and applying saved positions/fold/relation settings.
- Modify `src/components/viewer/viewer.tsx`: render the drawer, pass visible nodes/edges to React Flow, capture/apply viewport through React Flow instance, and center nodes from drawer clicks.
- Modify `package.json`: add focused test scripts for saved views and structure tree.
- Modify `.gitignore`: ignore `.superpowers/` visual brainstorming artifacts.

## Tasks

### Task 1: Saved View Helper Tests

**Files:**
- Create: `src/lib/views/saved-views.test.ts`
- Create: `src/lib/views/saved-views.ts`
- Modify: `package.json`

- [ ] **Step 1: Add test script**

Add this script to `package.json`:

```json
"test:saved-views": "esbuild src/lib/views/saved-views.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-saved-views.test.mjs && node --test /tmp/dbml-flow-saved-views.test.mjs"
```

- [ ] **Step 2: Create failing test file**

Create `src/lib/views/saved-views.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeSavedView,
  serializeSavedView,
  deserializeSavedView,
  type SavedCanvasView,
} from "./saved-views";

const view: SavedCanvasView = {
  id: "view-1",
  name: "Overview",
  createdAt: 1779140000000,
  updatedAt: 1779140000000,
  viewport: { x: 10, y: 20, zoom: 0.5 },
  positions: {
    "t-public.users": [100, 200],
    "g-public.auth": [50, 75],
  },
  foldedIds: new Set(["g-public.auth"]),
  relationOnly: true,
  relationOnlyOverrides: new Set(["t-public.users"]),
  hiddenNodeIds: new Set(["t-public.sessions"]),
};

test("serializes saved view Set fields as arrays", () => {
  assert.deepEqual(serializeSavedView(view), {
    id: "view-1",
    name: "Overview",
    createdAt: 1779140000000,
    updatedAt: 1779140000000,
    viewport: { x: 10, y: 20, zoom: 0.5 },
    positions: {
      "t-public.users": [100, 200],
      "g-public.auth": [50, 75],
    },
    foldedIds: ["g-public.auth"],
    relationOnly: true,
    relationOnlyOverrides: ["t-public.users"],
    hiddenNodeIds: ["t-public.sessions"],
  });
});

test("deserializes saved view arrays back into Sets", () => {
  const serialized = serializeSavedView(view);
  const result = deserializeSavedView(serialized);

  assert.deepEqual(result.foldedIds, new Set(["g-public.auth"]));
  assert.deepEqual(result.relationOnlyOverrides, new Set(["t-public.users"]));
  assert.deepEqual(result.hiddenNodeIds, new Set(["t-public.sessions"]));
});

test("sanitizes saved view state against current node ids", () => {
  const result = sanitizeSavedView(view, new Set(["t-public.users"]));

  assert.deepEqual(result.positions, {
    "t-public.users": [100, 200],
  });
  assert.deepEqual(result.foldedIds, new Set([]));
  assert.deepEqual(result.relationOnlyOverrides, new Set(["t-public.users"]));
  assert.deepEqual(result.hiddenNodeIds, new Set([]));
});
```

- [ ] **Step 3: Create placeholder module**

Create `src/lib/views/saved-views.ts` with only exports that make the test compile far enough to fail on behavior:

```ts
import type { Viewport } from "@xyflow/react";
import type { NodePositionIndex } from "@/types/nodes.types";

export type SavedCanvasView = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  viewport: Viewport;
  positions: NodePositionIndex;
  foldedIds: Set<string>;
  relationOnly: boolean;
  relationOnlyOverrides: Set<string>;
  hiddenNodeIds: Set<string>;
};

export function serializeSavedView(view: SavedCanvasView): unknown {
  return view;
}

export function deserializeSavedView(value: unknown): SavedCanvasView {
  return value as SavedCanvasView;
}

export function sanitizeSavedView(view: SavedCanvasView): SavedCanvasView {
  return view;
}
```

- [ ] **Step 4: Run red test**

Run: `npm run test:saved-views`

Expected: FAIL because Set fields are not serialized as arrays and missing node ids are not removed.

### Task 2: Saved View Helper Implementation

**Files:**
- Modify: `src/lib/views/saved-views.ts`
- Test: `src/lib/views/saved-views.test.ts`

- [ ] **Step 1: Implement saved view helpers**

Replace `src/lib/views/saved-views.ts` with:

```ts
import type { Viewport } from "@xyflow/react";
import type { NodePositionIndex } from "@/types/nodes.types";

export const SAVED_VIEWS_STORAGE_KEY = "dbml-flow.views.v1";

export type SavedCanvasView = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  viewport: Viewport;
  positions: NodePositionIndex;
  foldedIds: Set<string>;
  relationOnly: boolean;
  relationOnlyOverrides: Set<string>;
  hiddenNodeIds: Set<string>;
};

export type SerializedSavedCanvasView = Omit<
  SavedCanvasView,
  "foldedIds" | "relationOnlyOverrides" | "hiddenNodeIds"
> & {
  foldedIds: string[];
  relationOnlyOverrides: string[];
  hiddenNodeIds: string[];
};

function sortStrings(values: Iterable<string>) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function serializeSavedView(
  view: SavedCanvasView,
): SerializedSavedCanvasView {
  return {
    ...view,
    foldedIds: sortStrings(view.foldedIds),
    relationOnlyOverrides: sortStrings(view.relationOnlyOverrides),
    hiddenNodeIds: sortStrings(view.hiddenNodeIds),
  };
}

export function deserializeSavedView(value: unknown): SavedCanvasView {
  const raw = value as Partial<SerializedSavedCanvasView>;
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Untitled view"),
    createdAt: Number(raw.createdAt ?? Date.now()),
    updatedAt: Number(raw.updatedAt ?? Date.now()),
    viewport: raw.viewport ?? { x: 0, y: 0, zoom: 1 },
    positions: raw.positions ?? {},
    foldedIds: new Set(raw.foldedIds ?? []),
    relationOnly: Boolean(raw.relationOnly),
    relationOnlyOverrides: new Set(raw.relationOnlyOverrides ?? []),
    hiddenNodeIds: new Set(raw.hiddenNodeIds ?? []),
  };
}

export function sanitizeSavedView(
  view: SavedCanvasView,
  currentNodeIds: Set<string>,
): SavedCanvasView {
  const positions = Object.fromEntries(
    Object.entries(view.positions).filter(([id]) => currentNodeIds.has(id)),
  ) as NodePositionIndex;

  const keepCurrent = (ids: Set<string>) =>
    new Set([...ids].filter((id) => currentNodeIds.has(id)));

  return {
    ...view,
    positions,
    foldedIds: keepCurrent(view.foldedIds),
    relationOnlyOverrides: keepCurrent(view.relationOnlyOverrides),
    hiddenNodeIds: keepCurrent(view.hiddenNodeIds),
  };
}
```

- [ ] **Step 2: Run green test**

Run: `npm run test:saved-views`

Expected: PASS.

### Task 3: Structure Tree and Visibility Tests

**Files:**
- Create: `src/lib/views/structure-tree.test.ts`
- Create: `src/lib/views/structure-tree.ts`
- Modify: `package.json`

- [ ] **Step 1: Add test script**

Add this script to `package.json`:

```json
"test:structure-tree": "esbuild src/lib/views/structure-tree.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-structure-tree.test.mjs && node --test /tmp/dbml-flow-structure-tree.test.mjs"
```

- [ ] **Step 2: Create failing structure tests**

Create `src/lib/views/structure-tree.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NodeTypes, type GroupNodeType, type TableEdgeType, type TableNodeType } from "@/types/nodes.types";
import {
  buildStructureTree,
  collectHiddenNodeIds,
  filterVisibleEdges,
  filterVisibleNodes,
} from "./structure-tree";

function group(id: string, label: string, nodeIds: string[], parentGroupId?: string): GroupNodeType {
  return {
    id,
    type: NodeTypes.TableGroup,
    position: { x: 0, y: 0 },
    data: {
      label,
      hovered: false,
      folded: false,
      nodeIds,
      parentGroupId,
      dimensions: { width: 0, height: 0 },
      bounds: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 },
    },
  };
}

function table(id: string, label: string, groupId?: string): TableNodeType {
  return {
    id,
    type: NodeTypes.Table,
    position: { x: 0, y: 0 },
    data: {
      label,
      hovered: false,
      folded: false,
      groupId,
      table: {} as TableNodeType["data"]["table"],
    },
  };
}

const nodes = [
  group("g-public.parent", "Parent", ["g-public.child", "t-public.accounts"]),
  group("g-public.child", "Child", ["t-public.users"], "g-public.parent"),
  table("t-public.users", "users", "g-public.child"),
  table("t-public.accounts", "accounts", "g-public.parent"),
  table("t-public.logs", "logs"),
] satisfies Array<GroupNodeType | TableNodeType>;

test("builds tree with nested groups and ungrouped tables at root", () => {
  assert.deepEqual(buildStructureTree(nodes), [
    {
      id: "g-public.parent",
      label: "Parent",
      type: "group",
      children: [
        {
          id: "g-public.child",
          label: "Child",
          type: "group",
          children: [
            { id: "t-public.users", label: "users", type: "table", children: [] },
          ],
        },
        { id: "t-public.accounts", label: "accounts", type: "table", children: [] },
      ],
    },
    { id: "t-public.logs", label: "logs", type: "table", children: [] },
  ]);
});

test("collects hidden descendants for hidden groups", () => {
  assert.deepEqual(
    collectHiddenNodeIds(nodes, new Set(["g-public.parent"])),
    new Set([
      "g-public.parent",
      "g-public.child",
      "t-public.users",
      "t-public.accounts",
    ]),
  );
});

test("filters visible nodes and edges", () => {
  const hidden = collectHiddenNodeIds(nodes, new Set(["g-public.child"]));
  const edges = [
    { id: "e1", source: "t-public.users", target: "t-public.accounts" },
    { id: "e2", source: "t-public.accounts", target: "t-public.logs" },
  ] as TableEdgeType[];

  assert.deepEqual(filterVisibleNodes(nodes, hidden).map((node) => node.id), [
    "g-public.parent",
    "t-public.accounts",
    "t-public.logs",
  ]);
  assert.deepEqual(filterVisibleEdges(edges, hidden).map((edge) => edge.id), [
    "e2",
  ]);
});
```

- [ ] **Step 3: Create placeholder module**

Create `src/lib/views/structure-tree.ts`:

```ts
import type { Edge } from "@xyflow/react";
import { type NodeType } from "@/types/nodes.types";

export type StructureTreeItem = {
  id: string;
  label: string;
  type: "group" | "table";
  children: StructureTreeItem[];
};

export function buildStructureTree(): StructureTreeItem[] {
  return [];
}

export function collectHiddenNodeIds(): Set<string> {
  return new Set();
}

export function filterVisibleNodes<TNode extends NodeType>(nodes: TNode[]): TNode[] {
  return nodes;
}

export function filterVisibleEdges<TEdge extends Edge>(edges: TEdge[]): TEdge[] {
  return edges;
}
```

- [ ] **Step 4: Run red test**

Run: `npm run test:structure-tree`

Expected: FAIL because tree and hidden calculations return empty or unfiltered values.

### Task 4: Structure Tree and Visibility Implementation

**Files:**
- Modify: `src/lib/views/structure-tree.ts`
- Test: `src/lib/views/structure-tree.test.ts`

- [ ] **Step 1: Implement structure helpers**

Replace `src/lib/views/structure-tree.ts` with:

```ts
import type { Edge } from "@xyflow/react";
import { NodeTypes, type GroupNodeType, type NodeType } from "@/types/nodes.types";

export type StructureTreeItem = {
  id: string;
  label: string;
  type: "group" | "table";
  children: StructureTreeItem[];
};

function toTreeItem(node: NodeType, nodesById: Map<string, NodeType>): StructureTreeItem {
  if (node.type === NodeTypes.Table) {
    return {
      id: node.id,
      label: node.data.label,
      type: "table",
      children: [],
    };
  }

  return {
    id: node.id,
    label: node.data.label,
    type: "group",
    children: node.data.nodeIds
      .map((id) => nodesById.get(id))
      .filter((child): child is NodeType => !!child)
      .map((child) => toTreeItem(child, nodesById)),
  };
}

export function buildStructureTree(nodes: NodeType[]): StructureTreeItem[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  return nodes
    .filter((node) => {
      if (node.type === NodeTypes.TableGroup) {
        return !node.data.parentGroupId;
      }
      return !node.data.groupId;
    })
    .map((node) => toTreeItem(node, nodesById));
}

function collectGroupDescendants(
  group: GroupNodeType,
  nodesById: Map<string, NodeType>,
  hidden: Set<string>,
) {
  for (const childId of group.data.nodeIds) {
    hidden.add(childId);
    const child = nodesById.get(childId);
    if (child?.type === NodeTypes.TableGroup) {
      collectGroupDescendants(child, nodesById, hidden);
    }
  }
}

export function collectHiddenNodeIds(
  nodes: NodeType[],
  hiddenRootIds: Set<string>,
): Set<string> {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const hidden = new Set<string>();

  for (const id of hiddenRootIds) {
    const node = nodesById.get(id);
    if (!node) continue;
    hidden.add(id);
    if (node.type === NodeTypes.TableGroup) {
      collectGroupDescendants(node, nodesById, hidden);
    }
  }

  return hidden;
}

export function filterVisibleNodes<TNode extends NodeType>(
  nodes: TNode[],
  hiddenNodeIds: Set<string>,
): TNode[] {
  return nodes.filter((node) => !hiddenNodeIds.has(node.id));
}

export function filterVisibleEdges<TEdge extends Edge>(
  edges: TEdge[],
  hiddenNodeIds: Set<string>,
): TEdge[] {
  return edges.filter(
    (edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target),
  );
}
```

- [ ] **Step 2: Run green test**

Run: `npm run test:structure-tree`

Expected: PASS.

### Task 5: Store Saved View State and Actions

**Files:**
- Modify: `src/state/store.ts`
- Test: `npm run test:saved-views`
- Test: `npm run test:structure-tree`

- [ ] **Step 1: Add imports**

Add imports:

```ts
import {
  deserializeSavedView,
  sanitizeSavedView,
  SAVED_VIEWS_STORAGE_KEY,
  serializeSavedView,
  type SavedCanvasView,
} from "@/lib/views/saved-views";
import { collectHiddenNodeIds } from "@/lib/views/structure-tree";
```

- [ ] **Step 2: Extend `AppState`**

Add fields and actions:

```ts
savedViews: SavedCanvasView[];
activeViewId: string | null;
viewDrawerOpen: boolean;
hiddenRootNodeIds: Set<string>;
hiddenNodeIds: Set<string>;
loadSavedViews: () => void;
setViewDrawerOpen: (open: boolean) => void;
applySavedView: (viewId: string) => SavedCanvasView | null;
saveActiveView: (viewport: SavedCanvasView["viewport"]) => void;
saveViewAs: (name: string, viewport: SavedCanvasView["viewport"]) => void;
toggleNodeHidden: (nodeId: string) => void;
```

- [ ] **Step 3: Add helper functions above store creation**

Add:

```ts
function readSavedViews(): SavedCanvasView[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const values = JSON.parse(raw) as unknown[];
    return values.map(deserializeSavedView).filter((view) => view.id && view.name);
  } catch {
    return [];
  }
}

function writeSavedViews(views: SavedCanvasView[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SAVED_VIEWS_STORAGE_KEY,
    JSON.stringify(views.map(serializeSavedView)),
  );
}

function createViewId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `view-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```

- [ ] **Step 4: Add initial state**

Add:

```ts
savedViews: [],
activeViewId: null,
viewDrawerOpen: true,
hiddenRootNodeIds: new Set<string>(),
hiddenNodeIds: new Set<string>(),
```

- [ ] **Step 5: Load views during init**

At the start of `initState`, load saved views:

```ts
const savedViews = readSavedViews();
set({ savedViews, activeViewId: savedViews[0]?.id ?? null });
```

- [ ] **Step 6: Implement apply/save actions**

Add actions in store:

```ts
loadSavedViews: () => {
  const savedViews = readSavedViews();
  set({ savedViews, activeViewId: savedViews[0]?.id ?? null });
},
setViewDrawerOpen: (viewDrawerOpen) => set({ viewDrawerOpen }),
applySavedView: (viewId) => {
  const view = get().savedViews.find((item) => item.id === viewId);
  if (!view) return null;
  const currentNodeIds = new Set(get().nodes.map((node) => node.id));
  const sanitized = sanitizeSavedView(view, currentNodeIds);
  const nodes = applySavedPositions(get().nodes, sanitized.positions).map((node) => ({
    ...node,
    data: {
      ...node.data,
      folded: sanitized.foldedIds.has(node.id),
    },
  })) as NodeType[];
  const hiddenNodeIds = collectHiddenNodeIds(nodes, sanitized.hiddenNodeIds);
  set({
    activeViewId: viewId,
    nodes,
    foldedIds: sanitized.foldedIds,
    relationOnly: sanitized.relationOnly,
    relationOnlyOverrides: sanitized.relationOnlyOverrides,
    hiddenRootNodeIds: sanitized.hiddenNodeIds,
    hiddenNodeIds,
  });
  return sanitized;
},
saveActiveView: (viewport) => {
  const { activeViewId, savedViews, savedPositions, foldedIds, relationOnly, relationOnlyOverrides, hiddenRootNodeIds } = get();
  const now = Date.now();
  const views = savedViews.map((view) =>
    view.id === activeViewId
      ? {
          ...view,
          updatedAt: now,
          viewport,
          positions: savedPositions,
          foldedIds: new Set(foldedIds),
          relationOnly,
          relationOnlyOverrides: new Set(relationOnlyOverrides),
          hiddenNodeIds: new Set(hiddenRootNodeIds),
        }
      : view,
  );
  writeSavedViews(views);
  set({ savedViews: views });
},
saveViewAs: (name, viewport) => {
  const { savedViews, savedPositions, foldedIds, relationOnly, relationOnlyOverrides, hiddenRootNodeIds } = get();
  const now = Date.now();
  const view: SavedCanvasView = {
    id: createViewId(),
    name: name.trim() || "Untitled view",
    createdAt: now,
    updatedAt: now,
    viewport,
    positions: savedPositions,
    foldedIds: new Set(foldedIds),
    relationOnly,
    relationOnlyOverrides: new Set(relationOnlyOverrides),
    hiddenNodeIds: new Set(hiddenRootNodeIds),
  };
  const views = [...savedViews, view];
  writeSavedViews(views);
  set({ savedViews: views, activeViewId: view.id });
},
toggleNodeHidden: (nodeId) => {
  const hiddenRootNodeIds = new Set(get().hiddenRootNodeIds);
  if (hiddenRootNodeIds.has(nodeId)) hiddenRootNodeIds.delete(nodeId);
  else hiddenRootNodeIds.add(nodeId);
  set({
    hiddenRootNodeIds,
    hiddenNodeIds: collectHiddenNodeIds(get().nodes, hiddenRootNodeIds),
  });
},
```

- [ ] **Step 7: Update hidden ids after graph rebuild**

In `updateViewerFromDatabase`, after computing final nodes, recompute hidden ids:

```ts
const finalNodes = [...groupNodes, ...tableNodes];
const hiddenRootNodeIds = new Set(
  [...get().hiddenRootNodeIds].filter((id) => finalNodes.some((node) => node.id === id)),
);
set({
  nodes: finalNodes,
  edges,
  hiddenRootNodeIds,
  hiddenNodeIds: collectHiddenNodeIds(finalNodes, hiddenRootNodeIds),
});
```

- [ ] **Step 8: Run tests**

Run:

```bash
npm run test:saved-views
npm run test:structure-tree
```

Expected: both PASS.

### Task 6: Right Drawer UI

**Files:**
- Create: `src/components/viewer/view-drawer.tsx`
- Modify: `src/components/viewer/viewer.tsx`

- [ ] **Step 1: Create drawer component**

Create `src/components/viewer/view-drawer.tsx`:

```tsx
import useStore from "@/state/store";
import { NodeType } from "@/types/nodes.types";
import { StructureTreeItem, buildStructureTree } from "@/lib/views/structure-tree";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Save } from "lucide-react";
import { useMemo, useState } from "react";
import type { Viewport } from "@xyflow/react";

type ViewDrawerProps = {
  nodes: NodeType[];
  getViewport: () => Viewport;
  applyViewport: (viewport: Viewport) => void;
  focusNode: (nodeId: string) => void;
};

function TreeItem({
  item,
  hiddenNodeIds,
  hiddenRootNodeIds,
  onToggleHidden,
  onFocusNode,
}: {
  item: StructureTreeItem;
  hiddenNodeIds: Set<string>;
  hiddenRootNodeIds: Set<string>;
  onToggleHidden: (nodeId: string) => void;
  onFocusNode: (nodeId: string) => void;
}) {
  const isHidden = hiddenNodeIds.has(item.id);
  const isRootHidden = hiddenRootNodeIds.has(item.id);
  return (
    <li className="text-sm">
      <div
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-accent"
        title={item.label}
      >
        <button
          className="min-w-0 flex-1 truncate text-left"
          onClick={() => onFocusNode(item.id)}
        >
          <span className={isHidden ? "text-muted-foreground line-through" : ""}>
            {item.label}
          </span>
        </button>
        <button
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-secondary"
          aria-label={isRootHidden ? "Show node" : "Hide node"}
          title={isRootHidden ? "Show node" : "Hide node"}
          onClick={() => onToggleHidden(item.id)}
        >
          {isRootHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {item.children.length > 0 && (
        <ul className="ml-3 border-l border-border pl-2">
          {item.children.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              hiddenNodeIds={hiddenNodeIds}
              hiddenRootNodeIds={hiddenRootNodeIds}
              onToggleHidden={onToggleHidden}
              onFocusNode={onFocusNode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ViewDrawer({
  nodes,
  getViewport,
  applyViewport,
  focusNode,
}: ViewDrawerProps) {
  const [newViewName, setNewViewName] = useState("");
  const {
    savedViews,
    activeViewId,
    applySavedView,
    saveActiveView,
    saveViewAs,
    viewDrawerOpen,
    setViewDrawerOpen,
    hiddenNodeIds,
    hiddenRootNodeIds,
    toggleNodeHidden,
  } = useStore();
  const tree = useMemo(() => buildStructureTree(nodes), [nodes]);

  const applySelectedView = (viewId: string) => {
    const view = applySavedView(viewId);
    if (view) applyViewport(view.viewport);
  };

  if (!viewDrawerOpen) {
    return (
      <button
        className="absolute right-0 top-4 z-20 flex h-10 w-8 items-center justify-center rounded-l border border-r-0 bg-background shadow"
        aria-label="Open views drawer"
        title="Open views drawer"
        onClick={() => setViewDrawerOpen(true)}
      >
        <ChevronLeft size={16} />
      </button>
    );
  }

  return (
    <aside className="absolute bottom-0 right-0 top-0 z-20 flex w-72 flex-col border-l bg-background shadow-lg">
      <div className="flex h-11 items-center gap-2 border-b px-2">
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent"
          aria-label="Collapse views drawer"
          title="Collapse views drawer"
          onClick={() => setViewDrawerOpen(false)}
        >
          <ChevronRight size={16} />
        </button>
        <select
          className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm"
          value={activeViewId ?? ""}
          onChange={(event) => applySelectedView(event.target.value)}
          aria-label="Saved view"
        >
          <option value="" disabled>
            Select view
          </option>
          {savedViews.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
        </select>
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent disabled:opacity-40"
          aria-label="Save current view"
          title="Save current view"
          disabled={!activeViewId}
          onClick={() => saveActiveView(getViewport())}
        >
          <Save size={15} />
        </button>
      </div>
      <div className="flex items-center gap-2 border-b p-2">
        <input
          className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm"
          value={newViewName}
          onChange={(event) => setNewViewName(event.target.value)}
          placeholder="New view name"
        />
        <button
          className="rounded border px-2 py-1 text-sm hover:bg-accent"
          onClick={() => {
            saveViewAs(newViewName, getViewport());
            setNewViewName("");
          }}
        >
          Save as
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <ul className="space-y-1">
          {tree.map((item) => (
            <TreeItem
              key={item.id}
              item={item}
              hiddenNodeIds={hiddenNodeIds}
              hiddenRootNodeIds={hiddenRootNodeIds}
              onToggleHidden={toggleNodeHidden}
              onFocusNode={focusNode}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Wire drawer in viewer**

In `src/components/viewer/viewer.tsx`, import helpers and component:

```ts
import { filterVisibleEdges, filterVisibleNodes } from "@/lib/views/structure-tree";
import { ViewDrawer } from "./view-drawer";
```

Update `useReactFlow()` destructuring:

```ts
const { fitView, getNode, getZoom, setCenter, getViewport, setViewport } = useReactFlow();
```

Read hidden ids from the store:

```ts
const {
  nodes,
  edges,
  hiddenNodeIds,
  ...
} = useStore();
const visibleNodes = filterVisibleNodes(nodes, hiddenNodeIds);
const visibleEdges = filterVisibleEdges(edges, hiddenNodeIds);
```

Pass visible values to React Flow:

```tsx
nodes={visibleNodes}
edges={visibleEdges}
```

Add drawer as a child of `<ReactFlow>`:

```tsx
<ViewDrawer
  nodes={nodes}
  getViewport={getViewport}
  applyViewport={(viewport) => void setViewport(viewport, { duration: 250 })}
  focusNode={(nodeId) => {
    useStore.getState().selectFlowTarget({ kind: "node", nodeId });
    const node = getNode(nodeId);
    if (!node) return;
    const center = getNodeCenter(node);
    setCenter(center.x, center.y, getPanOnlyCenterOptions(getZoom()));
  }}
/>
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS or type errors only around store action signatures. Fix signatures to match Task 5.

- [ ] **Step 4: Verify hidden ids stay current**

Verify `toggleNodeHidden` and `updateViewerFromDatabase` both recompute `hiddenNodeIds` using `collectHiddenNodeIds`.

- [ ] **Step 5: Build**

Run: `npm run build`

Expected: PASS.

### Task 7: Gitignore and Final Verification

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ignore visual companion artifacts**

Add to `.gitignore`:

```gitignore
.superpowers/
```

- [ ] **Step 2: Run all focused tests**

Run:

```bash
npm run test:saved-views
npm run test:structure-tree
npm run test:source-map
npm run test:viewer
npm run test:flow
```

Expected: all PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Manual verification**

Run: `npm run dev -- --host 127.0.0.1 --port 5173`

Verify:

- Right drawer expands and collapses.
- Saved view select switches named views.
- `Save` updates the active view.
- `Save as` creates a new view.
- Structure tree shows nested TableGroups and root-level ungrouped tables.
- Clicking a tree item centers the canvas node.
- Hiding a table removes its connected edges.
- Hiding a group hides descendant groups/tables and connected edges.
- Switching views restores viewport, positions, folded state, relation-only state, overrides, and hidden nodes.
