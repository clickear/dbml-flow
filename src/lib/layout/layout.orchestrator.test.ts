import assert from "node:assert/strict";
import test from "node:test";

import {
  NodeTypes,
  type GroupNodeType,
  type TableEdgeType,
  type TableNodeType,
} from "@/types/nodes.types";
import { layoutGraph } from "./layout.orchestrator";
import { DEFAULT_LAYOUT_MODE, type LayoutEngines } from "./layout.types";

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

test("defaults to compact layout mode", () => {
  assert.equal(DEFAULT_LAYOUT_MODE, "compact");
});

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
  assert.deepEqual(
    result.tableNodes.map((node) => node.position),
    [
      { x: 1000, y: 1000 },
      { x: 1100, y: 1000 },
    ],
  );
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
  assert.deepEqual(
    result.tableNodes.map((node) => [node.id, node.position]),
    [
      ["t-existing", { x: 10, y: 20 }],
      ["t-new", { x: 10, y: 110 }],
    ],
  );
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
  assert.deepEqual(
    result.tableNodes.map((node) => node.position),
    [
      { x: 1000, y: 1000 },
      { x: 1100, y: 1000 },
    ],
  );
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
  assert.deepEqual(
    result.tableNodes.slice(0, 2).map((node) => node.position),
    [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ],
  );
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
