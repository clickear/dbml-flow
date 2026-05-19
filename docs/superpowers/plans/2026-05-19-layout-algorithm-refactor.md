# Layout Algorithm Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Dagre-first layout path with an ELK plus compact layout system that preserves manual positions during normal DBML edits and overwrites them only during explicit rearrange.

**Architecture:** Add focused layout modules for types, helpers, compact placement, ELK graph conversion, and orchestration. Keep Zustand responsible for parsing, graph state, group bounds, saved positions, and viewport fit, while layout modules return positioned table nodes.

**Tech Stack:** TypeScript, React Flow `@xyflow/react`, `elkjs`, Node test runner, esbuild test bundling, Zustand.

---

## File Structure

- Create: `src/lib/layout/layout.types.ts`
  - Shared layout modes, reasons, constants, inputs, results, and injectable engine types.
- Modify: `src/lib/layout/layout.helpers.ts`
  - Keep existing saved-position helpers and add bounds/new-node helpers.
- Create: `src/lib/layout/layout.helpers.test.ts`
  - Unit tests for saved position bounds and new-node detection.
- Create: `src/lib/layout/compact-layout.ts`
  - Deterministic compact column layout.
- Create: `src/lib/layout/compact-layout.test.ts`
  - Unit tests for compact placement and group block spacing.
- Create: `src/lib/layout/elk-layout.ts`
  - ELK graph conversion, relation direction normalization, ELK execution, result application.
- Create: `src/lib/layout/elk-layout.test.ts`
  - Unit tests for graph conversion without relying on actual ELK layout output.
- Create: `src/lib/layout/layout.orchestrator.ts`
  - Strategy selection, saved position overlay, new-node append, ELK fallback.
- Create: `src/lib/layout/layout.orchestrator.test.ts`
  - Unit tests with injected fake engines.
- Modify: `src/state/store.ts`
  - Replace Dagre calls with async orchestrator, add layout mode and layout request guard.
- Modify: `src/components/controls/rearrange-button.tsx`
  - Keep one-click rearrange, call the new full-overwrite layout path.
- Modify: `package.json`
  - Add `test:layout` script.
- Optional delete after build passes: `src/lib/layout/useElk.ts`
  - Remove commented experiment once production ELK module exists.
- Optional delete after no imports remain: `src/lib/layout/dagre.utils.ts`
  - Remove old Dagre helper if the refactor fully replaces it.

## Key Interfaces

Use these interfaces consistently across tasks:

```ts
export type LayoutMode = "leftright" | "snowflake" | "compact";
export type LayoutReason = "database-update" | "rearrange";
export type LayoutStrategy = "elk" | "compact";

export const DEFAULT_LAYOUT_MODE: LayoutMode = "leftright";
export const LARGE_DIAGRAM_TABLE_THRESHOLD = 100;
export const ELK_NODE_PADDING = 3;
export const COMPACT_VERTICAL_GAP = 50;
export const COMPACT_COLUMN_GAP = 50;
export const COMPACT_BLOCK_GAP = 60;

export type LayoutGraphInput = {
  tableNodes: TableNodeType[];
  groupNodes: GroupNodeType[];
  edges: TableEdgeType[];
  savedPositions: NodePositionIndex;
  mode: LayoutMode;
  reason: LayoutReason;
};

export type LayoutGraphResult = {
  tableNodes: TableNodeType[];
  strategy: LayoutStrategy;
  mode: LayoutMode;
  savedPositionsApplied: boolean;
  appendedNodeIds: string[];
  fallbackReason?: string;
};

export type LayoutEngines = {
  elk: (
    tableNodes: TableNodeType[],
    groupNodes: GroupNodeType[],
    edges: TableEdgeType[],
    mode: Exclude<LayoutMode, "compact">,
  ) => Promise<TableNodeType[]>;
  compact: (
    tableNodes: TableNodeType[],
    groupNodes: GroupNodeType[],
  ) => TableNodeType[];
};
```

---

### Task 1: Add Layout Types And Helper Tests

**Files:**
- Create: `src/lib/layout/layout.types.ts`
- Create: `src/lib/layout/layout.helpers.test.ts`
- Modify: `src/lib/layout/layout.helpers.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the layout test script**

Modify `package.json` scripts:

```json
"test:layout": "esbuild src/lib/layout/layout.helpers.test.ts src/lib/layout/compact-layout.test.ts src/lib/layout/elk-layout.test.ts src/lib/layout/layout.orchestrator.test.ts --bundle --platform=node --format=esm --outdir=/tmp/dbml-flow-layout-tests && node --test /tmp/dbml-flow-layout-tests/*.js"
```

- [ ] **Step 2: Create shared layout types**

Create `src/lib/layout/layout.types.ts`:

```ts
import type { NodePositionIndex, GroupNodeType, TableEdgeType, TableNodeType } from "@/types/nodes.types";

export type LayoutMode = "leftright" | "snowflake" | "compact";
export type LayoutReason = "database-update" | "rearrange";
export type LayoutStrategy = "elk" | "compact";

export const DEFAULT_LAYOUT_MODE: LayoutMode = "leftright";
export const LARGE_DIAGRAM_TABLE_THRESHOLD = 100;
export const ELK_NODE_PADDING = 3;
export const COMPACT_VERTICAL_GAP = 50;
export const COMPACT_COLUMN_GAP = 50;
export const COMPACT_BLOCK_GAP = 60;

export type LayoutGraphInput = {
  tableNodes: TableNodeType[];
  groupNodes: GroupNodeType[];
  edges: TableEdgeType[];
  savedPositions: NodePositionIndex;
  mode: LayoutMode;
  reason: LayoutReason;
};

export type LayoutGraphResult = {
  tableNodes: TableNodeType[];
  strategy: LayoutStrategy;
  mode: LayoutMode;
  savedPositionsApplied: boolean;
  appendedNodeIds: string[];
  fallbackReason?: string;
};

export type LayoutEngines = {
  elk: (
    tableNodes: TableNodeType[],
    groupNodes: GroupNodeType[],
    edges: TableEdgeType[],
    mode: Exclude<LayoutMode, "compact">,
  ) => Promise<TableNodeType[]>;
  compact: (
    tableNodes: TableNodeType[],
    groupNodes: GroupNodeType[],
  ) => TableNodeType[];
};
```

- [ ] **Step 3: Write failing helper tests**

Create `src/lib/layout/layout.helpers.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NodeTypes, type TableNodeType } from "@/types/nodes.types";
import {
  applySavedPositions,
  getSavedPositionBounds,
  getUnsavedTableNodes,
  hasAnySavedPositions,
  hasSavedPosition,
  toNodeIndex,
} from "./layout.helpers";

function table(id: string, x: number, y: number, width = 100, height = 40): TableNodeType {
  return {
    id,
    type: NodeTypes.Table,
    position: { x, y },
    initialWidth: width,
    initialHeight: height,
    data: {
      label: id,
      hovered: false,
      folded: false,
      table: {} as TableNodeType["data"]["table"],
      guessedDimensions: { width, height },
    },
  };
}

test("detects saved positions by node id", () => {
  const saved = { "t-public.users": [10, 20] as [number, number] };

  assert.equal(hasAnySavedPositions(saved), true);
  assert.equal(hasSavedPosition(saved, "t-public.users"), true);
  assert.equal(hasSavedPosition(saved, "t-public.orders"), false);
  assert.equal(hasAnySavedPositions({}), false);
});

test("applies saved positions without mutating other node coordinates", () => {
  const nodes = [table("t-public.users", 0, 0), table("t-public.orders", 50, 60)];
  const positioned = applySavedPositions(nodes, {
    "t-public.users": [300, 400],
  });

  assert.deepEqual(positioned.map((node) => node.position), [
    { x: 300, y: 400 },
    { x: 50, y: 60 },
  ]);
  assert.deepEqual(toNodeIndex(positioned), {
    "t-public.users": [300, 400],
    "t-public.orders": [50, 60],
  });
});

test("computes bounds only for nodes with saved positions", () => {
  const nodes = [
    table("t-public.users", 0, 0, 100, 40),
    table("t-public.orders", 0, 0, 200, 60),
    table("t-public.logs", 0, 0, 80, 30),
  ];
  const bounds = getSavedPositionBounds(nodes, {
    "t-public.users": [10, 20],
    "t-public.orders": [300, 100],
  });

  assert.deepEqual(bounds, {
    xMin: 10,
    xMax: 500,
    yMin: 20,
    yMax: 160,
    width: 490,
    height: 140,
  });
});

test("returns zero bounds when no nodes match saved positions", () => {
  assert.deepEqual(getSavedPositionBounds([table("t-public.users", 0, 0)], {}), {
    xMin: 0,
    xMax: 0,
    yMin: 0,
    yMax: 0,
    width: 0,
    height: 0,
  });
});

test("finds table nodes without saved positions", () => {
  const nodes = [
    table("t-public.users", 0, 0),
    table("t-public.orders", 0, 0),
    table("t-public.logs", 0, 0),
  ];

  assert.deepEqual(
    getUnsavedTableNodes(nodes, {
      "t-public.users": [10, 20],
      "t-public.orders": [30, 40],
    }).map((node) => node.id),
    ["t-public.logs"],
  );
});
```

- [ ] **Step 4: Run helper tests and verify they fail**

Run: `npm run test:layout`

Expected: FAIL with missing exports from `layout.helpers` and missing test files that will be created in later tasks. If esbuild fails because future test files do not exist yet, temporarily run:

```sh
esbuild src/lib/layout/layout.helpers.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-layout-helpers.test.mjs && node --test /tmp/dbml-flow-layout-helpers.test.mjs
```

Expected: FAIL with missing helper exports.

- [ ] **Step 5: Implement helper functions**

Modify `src/lib/layout/layout.helpers.ts`:

```ts
import { getNodeSize, type NodeBounds } from "@/lib/math/math.helper";
import type { NodePositionIndex } from "@/types/nodes.types";
import { type Node } from "@xyflow/react";

export function toNodeIndex<TNode extends Node>(nodes: TNode[]) {
  return nodes.reduce((acc, node) => {
    acc[node.id] = [node.position.x, node.position.y];
    return acc;
  }, {} as NodePositionIndex);
}

export function hasAnySavedPositions(savedPositions: NodePositionIndex) {
  return Object.keys(savedPositions).length > 0;
}

export function hasSavedPosition(
  savedPositions: NodePositionIndex,
  nodeId: string,
) {
  const saved = savedPositions[nodeId];
  return (
    Array.isArray(saved) &&
    Number.isFinite(saved[0]) &&
    Number.isFinite(saved[1])
  );
}

export function applySavedPositions<TNode extends Node>(
  nodes: TNode[],
  savedPositions: NodePositionIndex,
) {
  return nodes.map(
    (node) =>
      <TNode>{
        ...node,
        position: {
          x: hasSavedPosition(savedPositions, node.id)
            ? savedPositions[node.id][0]
            : node.position.x,
          y: hasSavedPosition(savedPositions, node.id)
            ? savedPositions[node.id][1]
            : node.position.y,
        },
      },
  );
}

export function getUnsavedTableNodes<TNode extends Node>(
  nodes: TNode[],
  savedPositions: NodePositionIndex,
) {
  return nodes.filter((node) => !hasSavedPosition(savedPositions, node.id));
}

export function getSavedPositionBounds<TNode extends Node>(
  nodes: TNode[],
  savedPositions: NodePositionIndex,
): NodeBounds {
  const savedNodes = nodes.filter((node) =>
    hasSavedPosition(savedPositions, node.id),
  );
  if (savedNodes.length === 0) {
    return { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 };
  }

  const bounds = savedNodes.map((node) => {
    const [x, y] = savedPositions[node.id];
    const size = getNodeSize(node);
    return {
      xMin: x,
      xMax: x + size.width,
      yMin: y,
      yMax: y + size.height,
    };
  });

  const xMin = Math.min(...bounds.map((bound) => bound.xMin));
  const xMax = Math.max(...bounds.map((bound) => bound.xMax));
  const yMin = Math.min(...bounds.map((bound) => bound.yMin));
  const yMax = Math.max(...bounds.map((bound) => bound.yMax));

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    width: xMax - xMin,
    height: yMax - yMin,
  };
}
```

- [ ] **Step 6: Run helper tests and verify they pass**

Run:

```sh
esbuild src/lib/layout/layout.helpers.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-layout-helpers.test.mjs && node --test /tmp/dbml-flow-layout-helpers.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit helper work**

Run:

```sh
git add package.json src/lib/layout/layout.types.ts src/lib/layout/layout.helpers.ts src/lib/layout/layout.helpers.test.ts
git commit -m "test: cover layout position helpers"
```

---

### Task 2: Implement Compact Layout

**Files:**
- Create: `src/lib/layout/compact-layout.ts`
- Create: `src/lib/layout/compact-layout.test.ts`

- [ ] **Step 1: Write failing compact layout tests**

Create `src/lib/layout/compact-layout.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NodeTypes, type GroupNodeType, type TableNodeType } from "@/types/nodes.types";
import { layoutCompactGraph } from "./compact-layout";

function table(id: string, groupId?: string, width = 100, height = 40): TableNodeType {
  return {
    id,
    type: NodeTypes.Table,
    position: { x: 999, y: 999 },
    initialWidth: width,
    initialHeight: height,
    data: {
      label: id,
      hovered: false,
      folded: false,
      groupId,
      table: {} as TableNodeType["data"]["table"],
      guessedDimensions: { width, height },
    },
  };
}

function group(id: string, nodeIds: string[]): GroupNodeType {
  return {
    id,
    type: NodeTypes.TableGroup,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      hovered: false,
      folded: false,
      nodeIds,
      dimensions: { width: 0, height: 0 },
      bounds: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 },
    },
  };
}

test("returns empty table list unchanged", () => {
  assert.deepEqual(layoutCompactGraph([], []), []);
});

test("lays ungrouped tables in deterministic compact columns", () => {
  const result = layoutCompactGraph(
    [
      table("t-1", undefined, 100, 40),
      table("t-2", undefined, 100, 40),
      table("t-3", undefined, 100, 40),
      table("t-4", undefined, 100, 40),
      table("t-5", undefined, 100, 40),
    ],
    [],
  );

  assert.deepEqual(result.map((node) => [node.id, node.position]), [
    ["t-1", { x: 0, y: 0 }],
    ["t-2", { x: 150, y: 0 }],
    ["t-3", { x: 300, y: 0 }],
    ["t-4", { x: 450, y: 0 }],
    ["t-5", { x: 0, y: 90 }],
  ]);
});

test("places table group blocks to the right of ungrouped tables", () => {
  const result = layoutCompactGraph(
    [
      table("t-free", undefined, 100, 40),
      table("t-users", "g-auth", 120, 40),
      table("t-sessions", "g-auth", 120, 40),
    ],
    [group("g-auth", ["t-users", "t-sessions"])],
  );

  const byId = new Map(result.map((node) => [node.id, node.position]));
  assert.deepEqual(byId.get("t-free"), { x: 0, y: 0 });
  assert.deepEqual(byId.get("t-users"), { x: 160, y: 0 });
  assert.deepEqual(byId.get("t-sessions"), { x: 330, y: 0 });
});

test("ignores nested group ids while placing tables inside a group block", () => {
  const result = layoutCompactGraph(
    [table("t-users", "g-child", 100, 40), table("t-accounts", "g-parent", 100, 40)],
    [
      group("g-parent", ["g-child", "t-accounts"]),
      group("g-child", ["t-users"]),
    ],
  );

  assert.deepEqual(result.map((node) => [node.id, node.position]), [
    ["t-users", { x: 160, y: 0 }],
    ["t-accounts", { x: 0, y: 0 }],
  ]);
});
```

- [ ] **Step 2: Run compact tests and verify they fail**

Run:

```sh
esbuild src/lib/layout/compact-layout.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-compact-layout.test.mjs && node --test /tmp/dbml-flow-compact-layout.test.mjs
```

Expected: FAIL with missing `compact-layout` module.

- [ ] **Step 3: Implement compact layout**

Create `src/lib/layout/compact-layout.ts`:

```ts
import { getNodeSize } from "@/lib/math/math.helper";
import { NodeTypes, type GroupNodeType, type TableNodeType } from "@/types/nodes.types";
import {
  COMPACT_BLOCK_GAP,
  COMPACT_COLUMN_GAP,
  COMPACT_VERTICAL_GAP,
} from "./layout.types";

type CompactColumn = {
  tableIds: string[];
  x: number;
  width: number;
};

function placeBlock(
  tableNodes: TableNodeType[],
  beginX: number,
  beginY = 0,
) {
  if (tableNodes.length === 0) {
    return { nodes: [] as TableNodeType[], nextBeginX: beginX };
  }

  const columnCount = Math.max(4, Math.floor(Math.sqrt(tableNodes.length)));
  const columns: CompactColumn[] = Array.from({ length: columnCount }, () => ({
    tableIds: [],
    x: beginX,
    width: 0,
  }));

  tableNodes.forEach((node, index) => {
    columns[index % columnCount].tableIds.push(node.id);
  });

  const tableById = new Map(tableNodes.map((node) => [node.id, node]));
  const positions = new Map<string, { x: number; y: number }>();

  columns.forEach((column, index) => {
    if (index > 0) {
      const previous = columns[index - 1];
      column.x = previous.x + previous.width + COMPACT_COLUMN_GAP;
    }

    let y = beginY;
    column.tableIds.forEach((tableId) => {
      const node = tableById.get(tableId);
      if (!node) return;

      const size = getNodeSize(node);
      positions.set(node.id, { x: column.x, y });
      y += size.height + COMPACT_VERTICAL_GAP;
      column.width = Math.max(column.width, size.width);
    });
  });

  const positionedNodes = tableNodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
  const lastColumn = [...columns].reverse().find((column) => column.width > 0);

  return {
    nodes: positionedNodes,
    nextBeginX: lastColumn
      ? lastColumn.x + lastColumn.width + COMPACT_BLOCK_GAP
      : beginX,
  };
}

export function layoutCompactGraph(
  tableNodes: TableNodeType[],
  groupNodes: GroupNodeType[],
) {
  if (tableNodes.length === 0) return tableNodes;

  const tableById = new Map(tableNodes.map((node) => [node.id, node]));
  const placedIds = new Set<string>();
  const blocks: TableNodeType[][] = [];

  const ungrouped = tableNodes.filter((node) => !node.data.groupId);
  if (ungrouped.length > 0) {
    blocks.push(ungrouped);
    ungrouped.forEach((node) => placedIds.add(node.id));
  }

  groupNodes.forEach((groupNode) => {
    const groupTables = groupNode.data.nodeIds
      .map((nodeId) => tableById.get(nodeId))
      .filter((node): node is TableNodeType => !!node && node.type === NodeTypes.Table)
      .filter((node) => !placedIds.has(node.id));

    if (groupTables.length === 0) return;

    groupTables.forEach((node) => placedIds.add(node.id));
    blocks.push(groupTables);
  });

  const remaining = tableNodes.filter((node) => !placedIds.has(node.id));
  if (remaining.length > 0) blocks.push(remaining);

  let nextBeginX = 0;
  const positionedById = new Map<string, TableNodeType>();

  blocks.forEach((block) => {
    const result = placeBlock(block, nextBeginX);
    result.nodes.forEach((node) => positionedById.set(node.id, node));
    nextBeginX = result.nextBeginX;
  });

  return tableNodes.map((node) => positionedById.get(node.id) ?? node);
}
```

- [ ] **Step 4: Run compact tests and verify they pass**

Run:

```sh
esbuild src/lib/layout/compact-layout.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-compact-layout.test.mjs && node --test /tmp/dbml-flow-compact-layout.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit compact layout**

Run:

```sh
git add src/lib/layout/compact-layout.ts src/lib/layout/compact-layout.test.ts
git commit -m "feat: add compact layout strategy"
```

---

### Task 3: Implement ELK Graph Conversion And Layout

**Files:**
- Create: `src/lib/layout/elk-layout.ts`
- Create: `src/lib/layout/elk-layout.test.ts`

- [ ] **Step 1: Write failing ELK conversion tests**

Create `src/lib/layout/elk-layout.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NodeTypes, TableEdgeTypeName, type GroupNodeType, type TableEdgeType, type TableNodeType } from "@/types/nodes.types";
import { buildElkGraph, normalizeEdgeDirection } from "./elk-layout";

function table(id: string, groupId?: string): TableNodeType {
  const tableName = id.replace("t-public.", "");
  return {
    id,
    type: NodeTypes.Table,
    position: { x: 0, y: 0 },
    initialWidth: 200,
    initialHeight: 78,
    data: {
      label: tableName,
      hovered: false,
      folded: false,
      groupId,
      table: {
        fields: [
          { name: "id", type: { type_name: "int" }, table: { schema: { name: "public" }, name: tableName } },
          { name: "user_id", type: { type_name: "int" }, table: { schema: { name: "public" }, name: tableName } },
        ],
      } as TableNodeType["data"]["table"],
      guessedDimensions: { width: 200, height: 78 },
    },
  };
}

function group(id: string, nodeIds: string[]): GroupNodeType {
  return {
    id,
    type: NodeTypes.TableGroup,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      hovered: false,
      folded: false,
      nodeIds,
      dimensions: { width: 0, height: 0 },
      bounds: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 },
    },
  };
}

function edge(
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
  sourceRelationType: "one" | "many",
  targetRelationType: "one" | "many",
): TableEdgeType {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: TableEdgeTypeName,
    data: {
      sourcefieldId: sourceHandle,
      targetfieldId: targetHandle,
      ref: {} as TableEdgeType["data"]["ref"],
      sourceRelationType,
      targetRelationType,
    },
  };
}

test("normalizes many-to-one edges from one side to many side", () => {
  assert.deepEqual(
    normalizeEdgeDirection(
      edge(
        "t-public.orders",
        "t-public.users",
        "f-public.orders.user_id",
        "f-public.users.id",
        "many",
        "one",
      ),
    ),
    {
      sourceHandle: "f-public.users.id",
      targetHandle: "f-public.orders.user_id",
    },
  );
});

test("keeps one-to-many edge direction", () => {
  assert.deepEqual(
    normalizeEdgeDirection(
      edge(
        "t-public.users",
        "t-public.orders",
        "f-public.users.id",
        "f-public.orders.user_id",
        "one",
        "many",
      ),
    ),
    {
      sourceHandle: "f-public.users.id",
      targetHandle: "f-public.orders.user_id",
    },
  );
});

test("builds layered ELK graph with field ports and group children", () => {
  const graph = buildElkGraph(
    [table("t-public.users", "g-auth"), table("t-public.orders")],
    [group("g-auth", ["t-public.users"])],
    [
      edge(
        "t-public.users",
        "t-public.orders",
        "f-public.users.id",
        "f-public.orders.user_id",
        "one",
        "many",
      ),
    ],
    "leftright",
  );

  assert.equal(graph.id, "root");
  assert.equal(graph.layoutOptions?.["elk.algorithm"], "layered");
  assert.deepEqual(graph.edges, [
    {
      id: "t-public.users-t-public.orders",
      sources: ["f-public.users.id"],
      targets: ["f-public.orders.user_id"],
    },
  ]);

  const groupNode = graph.children?.find((child) => child.id === "g-auth");
  assert.equal(groupNode?.children?.[0].id, "t-public.users");
  assert.equal(groupNode?.layoutOptions?.["elk.padding"], "[top=30,left=30,bottom=30,right=30]");

  const freeTable = graph.children?.find((child) => child.id === "t-public.orders");
  assert.equal(freeTable?.ports?.some((port) => port.id === "f-public.orders.user_id"), true);
});

test("uses force layout and east-side ports for snowflake mode", () => {
  const graph = buildElkGraph([table("t-public.users")], [], [], "snowflake");
  const users = graph.children?.find((child) => child.id === "t-public.users");

  assert.equal(graph.layoutOptions?.["elk.algorithm"], "force");
  assert.equal(users?.ports?.every((port) => port.layoutOptions?.["elk.port.side"] === "EAST"), true);
});
```

- [ ] **Step 2: Run ELK tests and verify they fail**

Run:

```sh
esbuild src/lib/layout/elk-layout.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-elk-layout.test.mjs && node --test /tmp/dbml-flow-elk-layout.test.mjs
```

Expected: FAIL with missing `elk-layout` module.

- [ ] **Step 3: Implement ELK graph conversion and execution**

Create `src/lib/layout/elk-layout.ts`:

```ts
import { getFieldId } from "@/lib/dbml/node-dmbl.parser";
import { getNodeSize } from "@/lib/math/math.helper";
import { type GroupNodeType, type TableEdgeType, type TableNodeType } from "@/types/nodes.types";
import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import { ELK_NODE_PADDING, type LayoutMode } from "./layout.types";

type ElkMode = Exclude<LayoutMode, "compact">;

const leftrightOptions: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.layered.spacing.baseValue": "40",
  "elk.spacing.componentComponent": "80",
  "elk.layered.spacing.edgeNodeBetweenLayers": "120",
  "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
  "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
  "elk.layered.mergeEdges": "true",
  "elk.layered.nodePlacement.strategy": "INTERACTIVE",
  "elk.layered.layering.strategy": "INTERACTIVE",
};

const snowflakeOptions: Record<string, string> = {
  "elk.algorithm": "force",
  "elk.spacing.nodeNode": "5",
  "elk.force.temperature": "0.001",
  "elk.force.iterations": "300",
};

function layoutOptionsForMode(mode: ElkMode) {
  return mode === "snowflake" ? snowflakeOptions : leftrightOptions;
}

export function normalizeEdgeDirection(edge: TableEdgeType) {
  const sourceRelation = edge.data?.sourceRelationType;
  const targetRelation = edge.data?.targetRelationType;
  const sourceHandle = edge.sourceHandle ?? edge.source;
  const targetHandle = edge.targetHandle ?? edge.target;

  if (sourceRelation !== targetRelation && sourceRelation === "many") {
    return { sourceHandle: targetHandle, targetHandle: sourceHandle };
  }

  return { sourceHandle, targetHandle };
}

function tableToElkNode(node: TableNodeType, mode: ElkMode): ElkNode {
  const size = getNodeSize(node);
  const fields = node.data.table.fields ?? [];
  const rowHeight = fields.length > 0 ? size.height / fields.length : size.height;

  const ports = fields.flatMap((field, index) => {
    const fieldId = getFieldId(field);
    if (!fieldId) return [];

    const y = Math.max(0, rowHeight * index + rowHeight / 2 + ELK_NODE_PADDING);
    const shared = mode === "snowflake"
      ? { layoutOptions: { "elk.port.side": "EAST" } }
      : {};

    return [
      {
        id: fieldId,
        x: size.width + ELK_NODE_PADDING,
        y,
        ...shared,
      },
    ];
  });

  return {
    id: node.id,
    width: size.width + ELK_NODE_PADDING * 2,
    height: size.height + ELK_NODE_PADDING * 2,
    ports: [{ id: node.id }, ...ports],
    layoutOptions: {
      "elk.aspectRatio": "1.6f",
      "elk.alignment": "LEFT",
    },
  };
}

function groupToElkNode(groupNode: GroupNodeType): ElkNode {
  return {
    id: groupNode.id,
    children: [],
    layoutOptions: {
      "elk.aspectRatio": "1.6f",
      "elk.alignment": "LEFT",
      "elk.padding": "[top=30,left=30,bottom=30,right=30]",
    },
  };
}

export function buildElkGraph(
  tableNodes: TableNodeType[],
  groupNodes: GroupNodeType[],
  edges: TableEdgeType[],
  mode: ElkMode,
): ElkNode {
  const tableById = new Map(tableNodes.map((node) => [node.id, node]));
  const groupById = new Map(groupNodes.map((node) => [node.id, node]));
  const elkGroups = new Map<string, ElkNode>();
  const looseChildren: ElkNode[] = [];

  tableNodes.forEach((tableNode) => {
    const elkTable = tableToElkNode(tableNode, mode);
    const groupId = tableNode.data.groupId;
    if (!groupId || !groupById.has(groupId)) {
      looseChildren.push(elkTable);
      return;
    }

    let elkGroup = elkGroups.get(groupId);
    if (!elkGroup) {
      elkGroup = groupToElkNode(groupById.get(groupId)!);
      elkGroups.set(groupId, elkGroup);
    }
    elkGroup.children = [...(elkGroup.children ?? []), elkTable];
  });

  const elkEdges: ElkExtendedEdge[] = edges.flatMap((edge) => {
    if (!tableById.has(edge.source) && !groupById.has(edge.source)) return [];
    if (!tableById.has(edge.target) && !groupById.has(edge.target)) return [];

    const normalized = normalizeEdgeDirection(edge);
    return [
      {
        id: edge.id,
        sources: [normalized.sourceHandle],
        targets: [normalized.targetHandle],
      },
    ];
  });

  return {
    id: "root",
    layoutOptions: layoutOptionsForMode(mode),
    children: [...elkGroups.values(), ...looseChildren],
    edges: elkEdges,
  };
}

function collectLayoutPositions(root: ElkNode) {
  const positions = new Map<string, { x: number; y: number }>();

  root.children?.forEach((child) => {
    if (child.children?.length) {
      child.children.forEach((tableNode) => {
        positions.set(tableNode.id, {
          x: (child.x ?? 0) + (tableNode.x ?? 0),
          y: (child.y ?? 0) + (tableNode.y ?? 0),
        });
      });
      return;
    }

    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  });

  return positions;
}

export async function layoutElkGraph(
  tableNodes: TableNodeType[],
  groupNodes: GroupNodeType[],
  edges: TableEdgeType[],
  mode: ElkMode,
) {
  if (tableNodes.length === 0) return tableNodes;

  const elk = new ELK();
  const graph = buildElkGraph(tableNodes, groupNodes, edges, mode);
  const result = await elk.layout(graph);
  const positions = collectLayoutPositions(result);

  return tableNodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
}
```

- [ ] **Step 4: Run ELK tests and verify they pass**

Run:

```sh
esbuild src/lib/layout/elk-layout.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-elk-layout.test.mjs && node --test /tmp/dbml-flow-elk-layout.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit ELK layout**

Run:

```sh
git add src/lib/layout/elk-layout.ts src/lib/layout/elk-layout.test.ts
git commit -m "feat: add elk layout strategy"
```

---

### Task 4: Implement Layout Orchestrator

**Files:**
- Create: `src/lib/layout/layout.orchestrator.ts`
- Create: `src/lib/layout/layout.orchestrator.test.ts`

- [ ] **Step 1: Write failing orchestrator tests**

Create `src/lib/layout/layout.orchestrator.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NodeTypes, type GroupNodeType, type TableEdgeType, type TableNodeType } from "@/types/nodes.types";
import { layoutGraph } from "./layout.orchestrator";
import type { LayoutEngines } from "./layout.types";

function table(id: string, x = 0, y = 0): TableNodeType {
  return {
    id,
    type: NodeTypes.Table,
    position: { x, y },
    initialWidth: 100,
    initialHeight: 40,
    data: {
      label: id,
      hovered: false,
      folded: false,
      table: {} as TableNodeType["data"]["table"],
      guessedDimensions: { width: 100, height: 40 },
    },
  };
}

const noGroups: GroupNodeType[] = [];
const noEdges: TableEdgeType[] = [];

function engines(overrides: Partial<LayoutEngines> = {}): LayoutEngines {
  return {
    elk: async (nodes) =>
      nodes.map((node, index) => ({
        ...node,
        position: { x: 1000 + index * 100, y: 1000 },
      })),
    compact: (nodes) =>
      nodes.map((node, index) => ({
        ...node,
        position: { x: index * 50, y: 0 },
      })),
    ...overrides,
  };
}

test("uses ELK for normal database update without saved positions", async () => {
  const result = await layoutGraph(
    {
      tableNodes: [table("t-1"), table("t-2")],
      groupNodes: noGroups,
      edges: noEdges,
      savedPositions: {},
      mode: "leftright",
      reason: "database-update",
    },
    engines(),
  );

  assert.equal(result.strategy, "elk");
  assert.deepEqual(result.tableNodes.map((node) => node.position), [
    { x: 1000, y: 1000 },
    { x: 1100, y: 1000 },
  ]);
});

test("preserves saved positions and appends new nodes during database update", async () => {
  const result = await layoutGraph(
    {
      tableNodes: [table("t-existing"), table("t-new")],
      groupNodes: noGroups,
      edges: noEdges,
      savedPositions: { "t-existing": [10, 20] },
      mode: "leftright",
      reason: "database-update",
    },
    engines(),
  );

  assert.equal(result.savedPositionsApplied, true);
  assert.deepEqual(result.appendedNodeIds, ["t-new"]);
  assert.deepEqual(result.tableNodes.map((node) => [node.id, node.position]), [
    ["t-existing", { x: 10, y: 20 }],
    ["t-new", { x: 10, y: 110 }],
  ]);
});

test("explicit rearrange ignores saved positions and overwrites all table coordinates", async () => {
  const result = await layoutGraph(
    {
      tableNodes: [table("t-existing"), table("t-new")],
      groupNodes: noGroups,
      edges: noEdges,
      savedPositions: { "t-existing": [10, 20] },
      mode: "leftright",
      reason: "rearrange",
    },
    engines(),
  );

  assert.equal(result.savedPositionsApplied, false);
  assert.deepEqual(result.appendedNodeIds, []);
  assert.deepEqual(result.tableNodes.map((node) => node.position), [
    { x: 1000, y: 1000 },
    { x: 1100, y: 1000 },
  ]);
});

test("uses compact for large database updates", async () => {
  const nodes = Array.from({ length: 101 }, (_, index) => table(`t-${index}`));
  const result = await layoutGraph(
    {
      tableNodes: nodes,
      groupNodes: noGroups,
      edges: noEdges,
      savedPositions: {},
      mode: "leftright",
      reason: "database-update",
    },
    engines(),
  );

  assert.equal(result.strategy, "compact");
  assert.deepEqual(result.tableNodes.slice(0, 2).map((node) => node.position), [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
  ]);
});

test("falls back to compact when ELK fails", async () => {
  const result = await layoutGraph(
    {
      tableNodes: [table("t-1"), table("t-2")],
      groupNodes: noGroups,
      edges: noEdges,
      savedPositions: {},
      mode: "snowflake",
      reason: "database-update",
    },
    engines({
      elk: async () => {
        throw new Error("elk failed");
      },
    }),
  );

  assert.equal(result.strategy, "compact");
  assert.equal(result.fallbackReason, "elk failed");
});
```

- [ ] **Step 2: Run orchestrator tests and verify they fail**

Run:

```sh
esbuild src/lib/layout/layout.orchestrator.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-layout-orchestrator.test.mjs && node --test /tmp/dbml-flow-layout-orchestrator.test.mjs
```

Expected: FAIL with missing `layout.orchestrator` module.

- [ ] **Step 3: Implement orchestrator**

Create `src/lib/layout/layout.orchestrator.ts`:

```ts
import type { TableNodeType } from "@/types/nodes.types";
import { layoutCompactGraph } from "./compact-layout";
import { layoutElkGraph } from "./elk-layout";
import {
  applySavedPositions,
  getSavedPositionBounds,
  getUnsavedTableNodes,
  hasAnySavedPositions,
} from "./layout.helpers";
import {
  COMPACT_VERTICAL_GAP,
  LARGE_DIAGRAM_TABLE_THRESHOLD,
  type LayoutEngines,
  type LayoutGraphInput,
  type LayoutGraphResult,
  type LayoutMode,
} from "./layout.types";

const defaultEngines: LayoutEngines = {
  elk: layoutElkGraph,
  compact: layoutCompactGraph,
};

function shouldUseCompact(mode: LayoutMode, tableCount: number) {
  return mode === "compact" || tableCount > LARGE_DIAGRAM_TABLE_THRESHOLD;
}

function appendNewTables(
  tableNodes: TableNodeType[],
  savedPositions: LayoutGraphInput["savedPositions"],
) {
  const unsavedNodes = getUnsavedTableNodes(tableNodes, savedPositions);
  if (unsavedNodes.length === 0) {
    return { tableNodes, appendedNodeIds: [] as string[] };
  }

  const savedBounds = getSavedPositionBounds(tableNodes, savedPositions);
  let nextY = savedBounds.yMax + COMPACT_VERTICAL_GAP;
  const beginX = savedBounds.xMin;
  const positions = new Map<string, { x: number; y: number }>();

  unsavedNodes.forEach((node) => {
    positions.set(node.id, { x: beginX, y: nextY });
    const height =
      node.measured?.height ??
      node.initialHeight ??
      node.data.guessedDimensions?.height ??
      36;
    nextY += height + COMPACT_VERTICAL_GAP;
  });

  return {
    tableNodes: tableNodes.map((node) => ({
      ...node,
      position: positions.get(node.id) ?? node.position,
    })),
    appendedNodeIds: unsavedNodes.map((node) => node.id),
  };
}

async function runBaseLayout(
  input: LayoutGraphInput,
  engines: LayoutEngines,
) {
  if (input.tableNodes.length === 0) {
    return {
      tableNodes: input.tableNodes,
      strategy: "compact" as const,
      mode: input.mode,
    };
  }

  if (shouldUseCompact(input.mode, input.tableNodes.length)) {
    return {
      tableNodes: engines.compact(input.tableNodes, input.groupNodes),
      strategy: "compact" as const,
      mode: input.mode,
    };
  }

  try {
    return {
      tableNodes: await engines.elk(
        input.tableNodes,
        input.groupNodes,
        input.edges,
        input.mode,
      ),
      strategy: "elk" as const,
      mode: input.mode,
    };
  } catch (error) {
    return {
      tableNodes: engines.compact(input.tableNodes, input.groupNodes),
      strategy: "compact" as const,
      mode: input.mode,
      fallbackReason: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function layoutGraph(
  input: LayoutGraphInput,
  engines: LayoutEngines = defaultEngines,
): Promise<LayoutGraphResult> {
  const base = await runBaseLayout(input, engines);

  if (input.reason === "rearrange" || !hasAnySavedPositions(input.savedPositions)) {
    return {
      tableNodes: base.tableNodes,
      strategy: base.strategy,
      mode: base.mode,
      savedPositionsApplied: false,
      appendedNodeIds: [],
      fallbackReason: base.fallbackReason,
    };
  }

  const positioned = applySavedPositions(base.tableNodes, input.savedPositions);
  const appended = appendNewTables(positioned, input.savedPositions);

  return {
    tableNodes: appended.tableNodes,
    strategy: base.strategy,
    mode: base.mode,
    savedPositionsApplied: true,
    appendedNodeIds: appended.appendedNodeIds,
    fallbackReason: base.fallbackReason,
  };
}
```

- [ ] **Step 4: Run orchestrator tests and verify they pass**

Run:

```sh
esbuild src/lib/layout/layout.orchestrator.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-layout-orchestrator.test.mjs && node --test /tmp/dbml-flow-layout-orchestrator.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run all layout tests**

Run: `npm run test:layout`

Expected: PASS.

- [ ] **Step 6: Commit orchestrator**

Run:

```sh
git add src/lib/layout/layout.orchestrator.ts src/lib/layout/layout.orchestrator.test.ts package.json
git commit -m "feat: orchestrate layout strategies"
```

---

### Task 5: Integrate Async Layout Into Store

**Files:**
- Modify: `src/state/store.ts`
- Modify: `src/components/controls/rearrange-button.tsx`

- [ ] **Step 1: Add imports and state types**

Modify `src/state/store.ts` imports:

```ts
import { layoutGraph } from "@/lib/layout/layout.orchestrator";
import {
  DEFAULT_LAYOUT_MODE,
  type LayoutMode,
} from "@/lib/layout/layout.types";
import { applySavedPositions, toNodeIndex } from "@/lib/layout/layout.helpers";
```

Remove the import:

```ts
import { getLayoutedGraph } from "@/lib/layout/dagre.utils";
```

Add module-level request sequence near debounce declarations:

```ts
let layoutRequestSeq = 0;
```

Add to `AppState`:

```ts
layoutMode: LayoutMode;
setLayoutMode: (mode: LayoutMode) => void;
onLayout: (fitView: FitView) => void;
```

Replace the old `onLayout: (direction: string, fitView: FitView) => void;` type.

- [ ] **Step 2: Initialize layout mode and setter**

In the Zustand initial state, add:

```ts
layoutMode: DEFAULT_LAYOUT_MODE,
```

Near flow actions, add:

```ts
setLayoutMode: (layoutMode) => set({ layoutMode }),
```

- [ ] **Step 3: Convert `updateViewerFromDatabase` to async guarded layout**

Replace the body of `updateViewerFromDatabase` with this structure:

```ts
updateViewerFromDatabase: (database: Database, nestedGroups) => {
  if (!database) return;

  const requestId = ++layoutRequestSeq;
  const {
    savedPositions: initialSavedPositions,
    setSavedPositions,
    layoutMode,
  } = get();

  const oldTableNode = get().nodes.filter((n) => n.type === NodeTypes.Table);
  const oldGroupNodes = get().nodes.filter(
    (n) => n.type === NodeTypes.TableGroup,
  );

  const run = async () => {
    let { tableNodes, groupNodes } = parseDatabaseToGraph(database, nestedGroups);
    const groupParentById = buildGroupParentIndex(groupNodes);
    const edges = mapDatabaseToEdges(database, get().foldedIds, groupParentById);
    const savedPositions = initialSavedPositions;

    const shouldRunLayout =
      oldTableNode.length !== tableNodes.length ||
      oldGroupNodes.length !== groupNodes.length ||
      Object.keys(savedPositions).length === 0;

    if (shouldRunLayout) {
      const layout = await layoutGraph({
        tableNodes,
        groupNodes,
        edges,
        savedPositions,
        mode: layoutMode,
        reason: "database-update",
      });
      tableNodes = layout.tableNodes;
    } else {
      tableNodes = applySavedPositions(tableNodes, savedPositions);
    }

    if (requestId !== layoutRequestSeq) return;

    const nodesById = toMapId([...groupNodes, ...tableNodes]) as Map<
      string,
      NodeType
    >;
    groupNodes = getBoundedGroups(groupNodes, nodesById);
    const finalNodes = [...groupNodes, ...tableNodes];
    const existingNodeIds = new Set(finalNodes.map((node) => node.id));
    const hiddenRootNodeIds = new Set(
      [...get().hiddenRootNodeIds].filter((id) => existingNodeIds.has(id)),
    );

    set({
      nodes: finalNodes,
      edges,
      hiddenRootNodeIds,
      hiddenNodeIds: collectHiddenNodeIds(finalNodes, hiddenRootNodeIds),
    });
    setSavedPositions(tableNodes);
  };

  void run();
},
```

- [ ] **Step 4: Convert explicit rearrange to full overwrite**

Replace the existing `onLayout` action with:

```ts
onLayout: (fitView) => {
  const requestId = ++layoutRequestSeq;
  const { nodes, edges, layoutMode } = get();

  const run = async () => {
    const tableNodes = nodes.filter((n) => n.type === NodeTypes.Table);
    let groupNodes = nodes.filter((n) => n.type === NodeTypes.TableGroup);

    const layout = await layoutGraph({
      tableNodes,
      groupNodes,
      edges: edges as TableEdgeType[],
      savedPositions: {},
      mode: layoutMode,
      reason: "rearrange",
    });
    if (requestId !== layoutRequestSeq) return;

    const newTableNodes = layout.tableNodes;
    const newGroupNodes = getBoundedGroups(
      groupNodes,
      toMapId([...groupNodes, ...newTableNodes]),
    );

    set({
      nodes: [...newGroupNodes, ...newTableNodes],
    });
    get().setSavedPositions(newTableNodes);
    setTimeout(() => fitView(), 0);
  };

  void run();
},
```

Add `TableEdgeType` to the existing type import from `@/types/nodes.types` if needed.

- [ ] **Step 5: Update rearrange button call signature**

Modify `src/components/controls/rearrange-button.tsx`:

```ts
const handleClick = useCallback(() => {
  onLayout(fitView);
}, [onLayout, fitView]);
```

- [ ] **Step 6: Run TypeScript build and fix integration errors**

Run: `npm run build`

Expected: PASS. If TypeScript reports a signature mismatch, update the remaining call site or type annotation to `onLayout(fitView)`.

- [ ] **Step 7: Commit store integration**

Run:

```sh
git add src/state/store.ts src/components/controls/rearrange-button.tsx
git commit -m "feat: integrate async layout orchestration"
```

---

### Task 6: Remove Old Layout Experiments And Run Full Verification

**Files:**
- Delete: `src/lib/layout/useElk.ts`
- Delete if unreferenced: `src/lib/layout/dagre.utils.ts`
- Modify if needed: imports that still reference deleted files

- [ ] **Step 1: Confirm old layout modules are unreferenced**

Run:

```sh
rg -n "dagre|getLayoutedGraph|useElk" src
```

Expected: no production imports of `dagre.utils.ts` or `useElk.ts`. If `rg` only reports the old files themselves, proceed with deletion.

- [ ] **Step 2: Delete old modules when unreferenced**

Delete `src/lib/layout/useElk.ts`.

Delete `src/lib/layout/dagre.utils.ts` only after Step 1 confirms no imports remain.

- [ ] **Step 3: Run layout tests**

Run: `npm run test:layout`

Expected: PASS.

- [ ] **Step 4: Run existing focused tests**

Run:

```sh
npm run test:saved-views
npm run test:structure-tree
npm run test:flow
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Inspect git status**

Run: `git status --short`

Expected: only intentional layout refactor files are modified or deleted. `docs/layout-algorithm-analysis.md` may still appear as an untracked user-provided reference file and must not be added unless the user asks.

- [ ] **Step 7: Commit cleanup and verification**

Run:

```sh
git add src/lib/layout package.json src/state/store.ts src/components/controls/rearrange-button.tsx
git commit -m "chore: remove legacy layout utilities"
```

---

## Manual QA

- [ ] Start dev server with `npm run dev`.
- [ ] Open the app in the browser.
- [ ] Load the default DBML and confirm the diagram appears without manual interaction.
- [ ] Drag one table, wait for the DBML position block to update, edit DBML by adding a new table, and confirm the dragged table stays fixed while the new table appears below the saved layout.
- [ ] Click rearrange and confirm all tables move to a fresh layout and saved positions are overwritten.
- [ ] Test a schema with more than 100 generated tables and confirm it renders using compact placement without a long ELK delay.

## Final Verification Commands

Run these before reporting completion:

```sh
npm run test:layout
npm run test:saved-views
npm run test:structure-tree
npm run test:flow
npm run build
```
